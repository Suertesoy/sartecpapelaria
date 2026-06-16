/* ======================================================
   SARTEC — Ferramenta de lista escolar (multi-lista)
   Chama /api/analisar-lista para leitura real com IA.
   ITENS_MOCK é usado apenas em localhost como fallback.
   ====================================================== */

const ITENS_MOCK = [
  { id: 'cad_universitario', nome: 'Caderno universitário 96 folhas', qty: 4, obs: 'Capa dura', unidade: 'un', categoria: 'cadernos', marcaSugerida: 'Tilibra', confianca: 'alta' },
  { id: 'lapis_grafite', nome: 'Lápis grafite nº 2', qty: 6, obs: '', unidade: 'un', categoria: 'lápis', marcaSugerida: 'Faber-Castell', confianca: 'alta' },
  { id: 'borracha_branca', nome: 'Borracha branca', qty: 2, obs: 'Sem capa', unidade: 'un', categoria: 'borrachas', marcaSugerida: '', confianca: 'alta' },
  { id: 'apontador', nome: 'Apontador com depósito', qty: 1, obs: '', unidade: 'un', categoria: 'apontadores', marcaSugerida: '', confianca: 'alta' },
  { id: 'caneta_azul', nome: 'Caneta esferográfica azul', qty: 4, obs: '', unidade: 'un', categoria: 'canetas', marcaSugerida: 'BIC', confianca: 'alta' },
  { id: 'lapis_cor', nome: 'Caixa de lápis de cor', qty: 1, obs: '24 cores', unidade: 'caixa', categoria: 'artes', marcaSugerida: 'Faber-Castell', confianca: 'alta' },
  { id: 'canetinha', nome: 'Caixa de canetinha hidrocor', qty: 1, obs: '12 cores', unidade: 'caixa', categoria: 'artes', marcaSugerida: '', confianca: 'alta' },
  { id: 'tesoura', nome: 'Tesoura sem ponta', qty: 1, obs: '', unidade: 'un', categoria: 'tesouras', marcaSugerida: '', confianca: 'alta' },
  { id: 'cola_bastao', nome: 'Cola bastão', qty: 2, obs: '', unidade: 'un', categoria: 'colas', marcaSugerida: 'UHU', confianca: 'alta' },
  { id: 'papel_sulfite', nome: 'Resma de papel sulfite A4', qty: 1, obs: '500 folhas, 75g', unidade: 'pacote', categoria: 'papéis', marcaSugerida: '', confianca: 'alta' },
];

const META_MOCK = { escola: 'Escola Exemplo', anoSerie: '3º ano', segmento: 'Ensino Fundamental I', anoLetivo: '2026' };

const PREFERENCIAS_GERAL = [
  { id: 'economico',  label: 'Mais econômico',            desc: 'Priorizar as opções mais em conta disponíveis.' },
  { id: 'custo_ben', label: 'Melhor custo-benefício',     desc: 'Buscar equilíbrio entre qualidade e preço.' },
  { id: 'escola',    label: 'Seguir sugestões da escola', desc: 'Quando a lista sugerir marca, tentar seguir a sugestão.' },
  { id: 'qualidade', label: 'Marcas de maior qualidade',  desc: 'Priorizar marcas melhores, mesmo que custem mais.' },
];

const LOADING_MSGS = [
  'Enviando lista para análise...',
  'A IA está lendo os itens...',
  'Identificando materiais para orçamento...',
  'Organizando os itens para você revisar...',
];

const LIMITE_BYTES = 4 * 1024 * 1024;

// =============== ESTADO ===============

let nextListNum = 1;
let pedidoEnviado = false;

function rascunhoVazio() {
  return {
    num: null,
    id: null,
    arquivoNome: '',
    metadados: { escola: '', anoSerie: '', segmento: '', anoLetivo: '' },
    aluno: { nome: '', preferenciaCor: '', observacoes: '' },
    preferenciaGeral: 'economico',
    itens: [],
  };
}

let estado = {
  nome: '',
  whatsapp: '',
  listas: [],
  rascunho: rascunhoVazio(),
  modoNovaLista: false,
};

// =============== UTILITÁRIOS ===============
function trocarEstado(id) {
  document.querySelectorAll('.estado').forEach(el => el.classList.remove('ativo'));
  document.getElementById(id).classList.add('ativo');
}

function scrollPara(el, block = 'center') {
  if (!el) return;
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduzido ? 'instant' : 'smooth', block });
}

function mostrarErro(msg) {
  const el = document.getElementById('lista-erro');
  if (!el) return;
  el.innerHTML = `<span class="lista-erro-ico" aria-hidden="true">⚠</span><div><strong>Não foi possível analisar a lista</strong><p>${esc(msg)}</p></div>`;
  el.style.display = '';
  scrollPara(el, 'nearest');
}

function ocultarErro() {
  const el = document.getElementById('lista-erro');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}

function formatarTelefone(valor) {
  const limpo = valor.replace(/\D/g, '').slice(0, 11);
  if (limpo.length <= 10) {
    return limpo.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => {
      let r = '';
      if (a) r = `(${a}`;
      if (a.length === 2) r += ') ';
      if (b) r += b;
      if (c) r += `-${c}`;
      return r;
    });
  }
  return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// =============== PERSISTÊNCIA LOCAL ===============
const LS_KEY = 'sartec_lista_progress';

function salvarProgresso() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      v: 1,
      ts: Date.now(),
      nextListNum,
      nome: estado.nome,
      whatsapp: estado.whatsapp,
      modoNovaLista: estado.modoNovaLista,
      listas: estado.listas,
      rascunho: estado.rascunho,
    }));
  } catch (_) {}
}

function restaurarProgresso() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    if (!snap || snap.v !== 1) return false;
    nextListNum          = snap.nextListNum || 1;
    estado.nome          = snap.nome || '';
    estado.whatsapp      = snap.whatsapp || '';
    estado.modoNovaLista = !!snap.modoNovaLista;
    estado.listas        = Array.isArray(snap.listas) ? snap.listas : [];
    estado.rascunho      = snap.rascunho || rascunhoVazio();
    return true;
  } catch (_) {
    return false;
  }
}

function limparProgresso() {
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
}

function temProgresso() {
  return estado.listas.length > 0
    || estado.rascunho.itens.length > 0
    || estado.nome.trim() !== ''
    || estado.whatsapp.trim() !== '';
}

function mostrarBannerRestaurado() {
  const banner = document.getElementById('pedido-salvo-banner');
  if (banner) banner.style.display = '';
}

function ocultarBannerSalvo() {
  const banner = document.getElementById('pedido-salvo-banner');
  if (banner) banner.style.display = 'none';
}

function limparTudoERecomecar() {
  limparProgresso();
  pedidoEnviado        = false;
  estado.listas        = [];
  estado.rascunho      = rascunhoVazio();
  nextListNum          = 1;
  estado.modoNovaLista = false;

  const formEl = document.getElementById('form-upload');
  if (formEl) formEl.classList.remove('nova-lista');

  const novaHeader = document.getElementById('nova-lista-header');
  if (novaHeader) novaHeader.style.display = 'none';

  renderizarFaixas();
  formUpload.reset();
  clearTimeout(uploadFeedbackTimer);
  uploadArea.classList.remove('upload-lendo', 'upload-ok');
  uploadLabel.textContent = 'Clique ou arraste os arquivos da lista aqui';
  ocultarBannerSalvo();

  trocarEstado('estado-upload');
  scrollPara(document.getElementById('estado-upload'), 'start');
}

// =============== UPLOAD ===============
const uploadArea = document.getElementById('upload-area');
const arquivoInput = document.getElementById('arquivo');
const uploadLabel = document.getElementById('upload-label');
const formUpload = document.getElementById('form-upload');
const inputWhatsapp = document.getElementById('whatsapp');

inputWhatsapp.addEventListener('input', (e) => {
  e.target.value = formatarTelefone(e.target.value);
  estado.whatsapp = e.target.value;
  salvarProgresso();
});

const nomeInput = document.getElementById('nome');
if (nomeInput) {
  nomeInput.addEventListener('input', e => {
    estado.nome = e.target.value;
    salvarProgresso();
  });
}

let uploadFeedbackTimer = null;

uploadArea.addEventListener('click', () => arquivoInput.click());
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    arquivoInput.files = e.dataTransfer.files;
    onArquivoEscolhido();
  }
});
arquivoInput.addEventListener('change', onArquivoEscolhido);

function onArquivoEscolhido() {
  const files = arquivoInput.files;
  if (!files || files.length === 0) return;

  clearTimeout(uploadFeedbackTimer);
  uploadArea.classList.remove('upload-ok');
  uploadArea.classList.add('upload-lendo');
  uploadLabel.innerHTML = '<span class="upload-spinner" aria-hidden="true"></span><span> Lendo arquivo...</span>';

  const nome = files.length === 1
    ? files[0].name
    : `${files.length} arquivos selecionados`;

  uploadFeedbackTimer = setTimeout(() => {
    uploadArea.classList.remove('upload-lendo');
    uploadArea.classList.add('upload-ok');
    const span = document.createElement('span');
    span.textContent = `✓ Arquivo adicionado: ${nome}`;
    uploadLabel.innerHTML = '';
    uploadLabel.appendChild(span);
  }, 520);
}

formUpload.addEventListener('submit', async (e) => {
  e.preventDefault();
  const arquivos = arquivoInput.files;

  ocultarErro();

  if (!estado.modoNovaLista) {
    const nome = document.getElementById('nome').value.trim();
    const whatsapp = inputWhatsapp.value.trim();
    if (!nome || !whatsapp) { mostrarErro('Preencha nome e WhatsApp antes de continuar.'); return; }
    estado.nome = nome;
    estado.whatsapp = whatsapp;
  }

  if (!arquivos || arquivos.length === 0) { mostrarErro('Anexe a foto ou PDF da lista antes de continuar.'); return; }
  for (const arq of arquivos) {
    if (arq.size > LIMITE_BYTES) {
      mostrarErro(`O arquivo "${arq.name}" é maior que 4MB. Reduza o tamanho e tente novamente.`);
      return;
    }
  }

  estado.rascunho.arquivoNome = arquivos[0].name;
  await iniciarAnalise(arquivos[0]);
});

// =============== ANÁLISE COM IA ===============
async function iniciarAnalise(arquivo) {
  // Assign permanent number only when analysis actually starts
  if (!estado.rascunho.num) {
    estado.rascunho.num = nextListNum++;
    estado.rascunho.id = 'lista_' + estado.rascunho.num + '_' + Date.now();
  }

  const btnAnalisar = document.getElementById('btn-analisar');
  if (btnAnalisar) { btnAnalisar.disabled = true; btnAnalisar.textContent = 'Analisando...'; }

  const reativarBtn = () => {
    if (btnAnalisar) { btnAnalisar.disabled = false; btnAnalisar.textContent = 'Analisar lista'; }
  };

  const tituloLoading = document.getElementById('lista-loading-titulo');
  if (tituloLoading) {
    tituloLoading.textContent = estado.listas.length > 0 ? 'Analisando nova lista...' : 'Analisando sua lista...';
  }

  trocarEstado('estado-loading');
  scrollPara(document.getElementById('estado-loading'), 'start');

  const hint = document.getElementById('loading-hint');
  let i = 0;
  hint.textContent = LOADING_MSGS[0];
  const interval = setInterval(() => {
    i = (i + 1) % LOADING_MSGS.length;
    hint.textContent = LOADING_MSGS[i];
  }, 700);

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  try {
    const formData = new FormData();
    formData.append('arquivo', arquivo);

    const resposta = await fetch('/api/analisar-lista', { method: 'POST', body: formData });
    const dados = await resposta.json();

    clearInterval(interval);

    if (dados.ok && dados.itens?.length) {
      estado.rascunho.metadados = dados.metadados || { escola: '', anoSerie: '', segmento: '', anoLetivo: '' };
      estado.rascunho.itens = dados.itens.map(it => ({ ...it, incluso: true, preferenciaCliente: '' }));
      renderizarFaixas();
      renderizarResultado();
      reativarBtn();
      trocarEstado('estado-resultado');
      scrollPara(document.getElementById('listas-container') || document.getElementById('estado-resultado'), 'start');
      return;
    }

    if (isLocal) {
      estado.rascunho.metadados = META_MOCK;
      estado.rascunho.itens = ITENS_MOCK.map(it => ({ ...it, incluso: true, preferenciaCliente: '' }));
      renderizarFaixas();
      renderizarResultado();
      reativarBtn();
      trocarEstado('estado-resultado');
      scrollPara(document.getElementById('listas-container') || document.getElementById('estado-resultado'), 'start');
      return;
    }

    reativarBtn();
    trocarEstado('estado-upload');
    mostrarErro(dados.error || 'Não consegui identificar itens na lista. Tente enviar uma foto mais nítida ou um PDF.');
  } catch (err) {
    clearInterval(interval);
    console.error('[lista] Erro na análise:', err);

    if (isLocal) {
      estado.rascunho.metadados = META_MOCK;
      estado.rascunho.itens = ITENS_MOCK.map(it => ({ ...it, incluso: true, preferenciaCliente: '' }));
      renderizarFaixas();
      renderizarResultado();
      reativarBtn();
      trocarEstado('estado-resultado');
      scrollPara(document.getElementById('listas-container') || document.getElementById('estado-resultado'), 'start');
      return;
    }

    reativarBtn();
    trocarEstado('estado-upload');
    mostrarErro('Erro de conexão. Verifique sua internet e tente novamente.');
  }
}

// =============== FAIXAS DE LISTAS SALVAS ===============

function renderizarFaixas() {
  const container = document.getElementById('listas-container');
  if (!container) return;

  if (estado.listas.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = '';
  const ordenadas = [...estado.listas].sort((a, b) => (a.num || 0) - (b.num || 0));

  container.innerHTML = ordenadas.map(lista => {
    const quero    = lista.itens.filter(x => x.incluso).length;
    const naoQuero = lista.itens.filter(x => !x.incluso).length;
    const total    = lista.itens.length;

    const partes = [`Lista ${lista.num}`];
    partes.push((lista.aluno.nome || '').trim() || 'nome pendente');
    if (lista.metadados.escola) partes.push(lista.metadados.escola);

    const resumo = [
      `${total} identificado${total !== 1 ? 's' : ''}`,
      quero > 0    ? `${quero} para orçamento`       : null,
      naoQuero > 0 ? `${naoQuero} não quero`         : null,
      lista.arquivoNome ? lista.arquivoNome           : null,
    ].filter(Boolean).join(' · ');

    return `
      <div class="lista-faixa" data-id="${lista.id}">
        <div class="lista-faixa-info">
          <span class="lista-faixa-titulo">${esc(partes.join(' · '))}</span>
          <span class="lista-faixa-resumo">${esc(resumo)}</span>
        </div>
        <button class="lista-faixa-btn" type="button" data-id="${lista.id}">Revisar</button>
      </div>`;
  }).join('');

  container.querySelectorAll('.lista-faixa').forEach(faixa => {
    faixa.addEventListener('click', () => expandirLista(faixa.dataset.id));
  });
  container.querySelectorAll('.lista-faixa-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); expandirLista(btn.dataset.id); });
  });
}

function salvarRascunhoNaListas() {
  if (!estado.rascunho || estado.rascunho.itens.length === 0) return;
  const idx = estado.listas.findIndex(l => l.id === estado.rascunho.id);
  const copia = { ...estado.rascunho, itens: estado.rascunho.itens.map(it => ({ ...it })) };
  if (idx >= 0) estado.listas[idx] = copia;
  else estado.listas.push(copia);
}

function expandirLista(id) {
  salvarRascunhoNaListas();

  const idx = estado.listas.findIndex(l => l.id === id);
  if (idx < 0) return;

  estado.rascunho = { ...estado.listas[idx], itens: estado.listas[idx].itens.map(it => ({ ...it })) };
  estado.listas.splice(idx, 1);

  renderizarFaixas();
  renderizarResultado();
  trocarEstado('estado-resultado');
  const alvo = document.getElementById('listas-container');
  scrollPara(alvo && alvo.children.length ? alvo : document.getElementById('estado-resultado'), 'start');
}

// =============== VALIDAÇÃO POR LISTA ===============

function ocultarErroAluno() {
  const msg = document.getElementById('aluno-erro-inline');
  if (msg) msg.remove();
  document.querySelectorAll('.campo-erro').forEach(el => el.classList.remove('campo-erro'));
}

function mostrarErroAluno(campoId, msg) {
  ocultarErroAluno();
  const campo = document.getElementById(campoId);
  if (!campo) return;
  campo.classList.add('campo-erro');
  const erroEl = document.createElement('p');
  erroEl.id = 'aluno-erro-inline';
  erroEl.className = 'aluno-campo-erro-msg';
  erroEl.textContent = msg;
  campo.insertAdjacentElement('afterend', erroEl);
  setTimeout(() => {
    scrollPara(campo, 'center');
    campo.focus();
  }, 80);
}

function abrirListaComErro(listaId, campoId, msg) {
  if (estado.rascunho.id === listaId) {
    mostrarErroAluno(campoId, msg);
  } else {
    expandirLista(listaId);
    setTimeout(() => mostrarErroAluno(campoId, msg), 120);
  }
}

function validarEEnviar(e) {
  const todasListas = [
    ...estado.listas,
    ...(estado.rascunho.itens.length > 0 ? [estado.rascunho] : []),
  ].sort((a, b) => (a.num || 0) - (b.num || 0));

  for (const lista of todasListas) {
    if (!(lista.aluno.nome || '').trim()) {
      e.preventDefault();
      abrirListaComErro(lista.id, 'aluno-nome', 'Informe o nome da criança/aluno para identificar esta lista.');
      return;
    }
    if (!(lista.aluno.preferenciaCor || '').trim()) {
      e.preventDefault();
      abrirListaComErro(lista.id, 'aluno-cor', 'Informe uma preferência de cor, personagem ou estilo. Se não tiver preferência, escreva "qualquer cor".');
      return;
    }
  }

  // Validação passou — suprimir aviso de saída
  pedidoEnviado = true;
}

// =============== RESULTADO ===============
const grid            = document.getElementById('itens-grid');
const counterQuero    = document.getElementById('counter-quero');
const counterTem      = document.getElementById('counter-tem');
const resumoTotal     = document.getElementById('resumo-total');
const btnEnviar       = document.getElementById('btn-enviar');
const btnMarcarTodosTem = document.getElementById('btn-marcar-todos-tem');
const btnLimpar       = document.getElementById('btn-recomecar');
const btnAdicionarLista = document.getElementById('btn-adicionar-lista');

function renderizarAluno() {
  const bloco = document.getElementById('bloco-aluno');
  if (!bloco) return;
  const a = estado.rascunho.aluno;
  bloco.innerHTML = `
    <div class="aluno-lista">
      <p class="aluno-lista-titulo">Dados da criança/aluno <span class="campo-obrigatorio-nota">campos obrigatórios</span></p>
      <p class="aluno-lista-desc">Para separar tudo certinho, informe de quem é esta lista e quais cores ou estilos a criança prefere.</p>
      <div class="aluno-lista-grid">
        <label class="aluno-lista-field">
          Nome da criança/aluno <span class="campo-req" aria-hidden="true">*</span>
          <input id="aluno-nome" type="text" value="${esc(a.nome)}" placeholder="Ex: Pedro, Ana, Lucas" />
        </label>
        <label class="aluno-lista-field">
          Preferência de cores, personagens ou estilo <span class="campo-req" aria-hidden="true">*</span>
          <input id="aluno-cor" type="text" value="${esc(a.preferenciaCor)}" placeholder="Ex: azul, rosa, tons claros, sem personagem, qualquer cor" />
          <span class="campo-dica">Ajuda a equipe a separar opções sem assumir preferência. Pode escrever "qualquer cor" se não tiver preferência.</span>
        </label>
        <label class="aluno-lista-field aluno-lista-field-full">
          Observações adicionais
          <input id="aluno-obs" type="text" value="${esc(a.observacoes)}" placeholder="Ex: evitar personagens, pode ser qualquer estampa, preferência por tons claros" />
        </label>
      </div>
    </div>
  `;
  document.getElementById('aluno-nome').addEventListener('input', e => { estado.rascunho.aluno.nome = e.target.value; ocultarErroAluno(); atualizarLinkEnviar(); });
  document.getElementById('aluno-cor').addEventListener('input',  e => { estado.rascunho.aluno.preferenciaCor = e.target.value; ocultarErroAluno(); atualizarLinkEnviar(); });
  document.getElementById('aluno-obs').addEventListener('input',  e => { estado.rascunho.aluno.observacoes = e.target.value; atualizarLinkEnviar(); });
}

function renderizarPreferenciaGeral() {
  const bloco = document.getElementById('bloco-preferencia');
  if (!bloco) return;
  bloco.innerHTML = `
    <div class="preferencia-orcamento">
      <p class="preferencia-titulo">Preferência para o orçamento</p>
      <p class="preferencia-desc">Escolha como a equipe deve priorizar marcas e opções ao montar seu orçamento. A disponibilidade, marcas/modelos e valores são confirmados pelo WhatsApp.</p>
      <div class="preferencia-options">
        ${PREFERENCIAS_GERAL.map(p => `
        <button class="preferencia-option${estado.rascunho.preferenciaGeral === p.id ? ' ativo' : ''}" type="button" data-pref="${p.id}">
          <strong>${esc(p.label)}</strong>
          <span>${esc(p.desc)}</span>
        </button>`).join('')}
      </div>
    </div>
  `;
  bloco.querySelectorAll('.preferencia-option').forEach(btn => {
    btn.addEventListener('click', () => {
      estado.rascunho.preferenciaGeral = btn.dataset.pref;
      bloco.querySelectorAll('.preferencia-option').forEach(b => b.classList.toggle('ativo', b === btn));
      atualizarLinkEnviar();
    });
  });
}

function renderizarMetadados() {
  const bloco = document.getElementById('bloco-metadados');
  if (!bloco) return;
  const m = estado.rascunho.metadados;
  bloco.innerHTML = `
    <div class="meta-lista">
      <p class="meta-lista-titulo">Dados identificados na lista</p>
      <div class="meta-lista-campos">
        <label>Escola<input id="meta-escola"    value="${esc(m.escola)}"    placeholder="Não identificado" /></label>
        <label>Ano / Série<input id="meta-anoSerie"  value="${esc(m.anoSerie)}"  placeholder="Não identificado" /></label>
        <label>Segmento<input id="meta-segmento"  value="${esc(m.segmento)}"  placeholder="Não identificado" /></label>
        <label>Ano letivo<input id="meta-anoLetivo" value="${esc(m.anoLetivo)}" placeholder="Não identificado" /></label>
      </div>
      <p class="meta-lista-dica">Confira se os dados estão corretos. Eles ajudam a equipe da Sartec a localizar a lista certa e confirmar o orçamento.</p>
    </div>
  `;
  ['escola', 'anoSerie', 'segmento', 'anoLetivo'].forEach(campo => {
    document.getElementById(`meta-${campo}`).addEventListener('input', (e) => {
      estado.rascunho.metadados[campo] = e.target.value;
      atualizarLinkEnviar();
    });
  });
}

function renderizarResumoPedido() {
  const bloco = document.getElementById('bloco-pedido-resumo');
  if (!bloco) return;

  const totalListas = estado.listas.length + (estado.rascunho.itens.length > 0 ? 1 : 0);
  if (totalListas <= 1) { bloco.innerHTML = ''; return; }

  const todasOrdenadas = [
    ...estado.listas,
    ...(estado.rascunho.itens.length > 0 ? [estado.rascunho] : []),
  ].sort((a, b) => (a.num || 0) - (b.num || 0));

  const totalInclusos = todasOrdenadas.reduce((acc, l) => acc + l.itens.filter(x => x.incluso).length, 0);

  const linhas = todasOrdenadas.map(l => {
    const quero    = l.itens.filter(x => x.incluso).length;
    const naoQuero = l.itens.filter(x => !x.incluso).length;
    const nome     = l.aluno.nome ? ` · ${l.aluno.nome}` : '';
    const ativo    = l.id === estado.rascunho.id ? ' <em>(revisando agora)</em>' : '';
    return `<li>Lista ${l.num}${nome}: <strong>${quero}</strong> para orçamento · ${naoQuero} não quero${ativo}</li>`;
  }).join('');

  bloco.innerHTML = `
    <div class="resumo-total-pedido">
      <p class="resumo-total-titulo">Total do pedido: <strong>${totalInclusos} ${totalInclusos === 1 ? 'item' : 'itens'}</strong> para orçamento em ${totalListas} ${totalListas === 1 ? 'lista' : 'listas'}</p>
      <ul class="resumo-total-lista">${linhas}</ul>
    </div>
  `;
}

function renderizarBadge() {
  const bloco = document.getElementById('resultado-badge');
  if (!bloco) return;
  const totalListas = estado.listas.length + 1;
  if (totalListas > 1 && estado.rascunho.num) {
    bloco.innerHTML = `<span class="resultado-lista-badge">Lista ${estado.rascunho.num}</span>`;
  } else {
    bloco.innerHTML = '';
  }
}

function renderizarResultado() {
  renderizarBadge();
  renderizarMetadados();
  renderizarAluno();
  renderizarPreferenciaGeral();
  renderizarResumoPedido();

  grid.innerHTML = estado.rascunho.itens.map(it => {
    const busca = encodeURIComponent('material escolar ' + it.nome + (it.obs ? ' ' + it.obs : ''));
    const marcaLabel = it.marcaSugerida ? it.marcaSugerida : 'não informada';
    const temPref = (it.preferenciaCliente || '').trim() !== '';
    return `
    <div class="item-card ${it.incluso ? '' : 'excluido'}" data-id="${it.id}">
      <div class="item-info">
        <h4>${esc(it.nome)}</h4>
        ${it.obs ? `<div class="obs">${esc(it.obs)}</div>` : ''}
      </div>
      <p class="marca-sugerida">Sugestão da escola: <strong>${esc(marcaLabel)}</strong></p>
      <button class="marca-preferencia-toggle" type="button">${temPref ? 'Editar marca/preferência' : '+ adicionar marca/preferência'}</button>
      <div class="marca-preferencia-wrap" style="display:${temPref ? 'block' : 'none'}">
        <input
          class="marca-preferencia-input"
          type="text"
          value="${esc(it.preferenciaCliente || '')}"
          placeholder="Ex: Faber-Castell, Tilibra, mais barato, qualquer marca"
          aria-label="Marca ou preferência para ${esc(it.nome)}"
        />
      </div>
      <a href="https://www.google.com/search?tbm=isch&q=${busca}" target="_blank" rel="noopener" class="item-img-buscar">O que é este item?</a>
      <div class="item-controls">
        <div class="qty-control">
          <button class="qty-btn" data-acao="menos" aria-label="Diminuir">−</button>
          <span class="qty-num">${it.qty}</span>
          <button class="qty-btn" data-acao="mais" aria-label="Aumentar">+</button>
        </div>
        <div class="item-choice-toggle">
          <button class="item-choice-option${it.incluso ? ' ativo' : ''}" type="button" data-acao="incluir">Quero comprar</button>
          <button class="item-choice-option${!it.incluso ? ' ativo' : ''}" type="button" data-acao="excluir">Não quero</button>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.item-card').forEach(card => {
    const id   = card.dataset.id;
    const item = estado.rascunho.itens.find(x => x.id === id);

    card.querySelectorAll('.item-choice-option').forEach(btn => {
      btn.addEventListener('click', () => { item.incluso = btn.dataset.acao === 'incluir'; atualizarUI(); });
    });

    card.querySelectorAll('.qty-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.acao === 'mais') item.qty += 1;
        else item.qty = Math.max(1, item.qty - 1);
        atualizarUI();
      });
    });

    const toggle = card.querySelector('.marca-preferencia-toggle');
    const wrap   = card.querySelector('.marca-preferencia-wrap');
    const input  = card.querySelector('.marca-preferencia-input');

    toggle.addEventListener('click', () => {
      const aberto = wrap.style.display !== 'none';
      wrap.style.display = aberto ? 'none' : 'block';
      if (!aberto) setTimeout(() => input.focus(), 0);
    });

    input.addEventListener('input', () => {
      item.preferenciaCliente = input.value;
      toggle.textContent = input.value.trim() ? 'Editar marca/preferência' : '+ adicionar marca/preferência';
      atualizarLinkEnviar();
    });
  });

  btnMarcarTodosTem.textContent = 'Marcar todos como "Não quero"';
  atualizarContadores();
  atualizarLinkEnviar();
}

function atualizarUI() {
  grid.querySelectorAll('.item-card').forEach(card => {
    const id   = card.dataset.id;
    const item = estado.rascunho.itens.find(x => x.id === id);
    card.classList.toggle('excluido', !item.incluso);
    card.querySelector('.qty-num').textContent = item.qty;
    card.querySelectorAll('.item-choice-option').forEach(btn => {
      btn.classList.toggle('ativo', item.incluso ? btn.dataset.acao === 'incluir' : btn.dataset.acao === 'excluir');
    });
  });
  atualizarContadores();
  atualizarLinkEnviar();
}

function atualizarContadores() {
  const inclusos  = estado.rascunho.itens.filter(x => x.incluso);
  const excluidos = estado.rascunho.itens.filter(x => !x.incluso);
  if (counterQuero) counterQuero.textContent = `${inclusos.length} ${inclusos.length === 1 ? 'item' : 'itens'}`;
  if (counterTem)   counterTem.textContent   = `${excluidos.length} não quero`;
  if (resumoTotal)  resumoTotal.textContent  = `${inclusos.length} ${inclusos.length === 1 ? 'item' : 'itens'}`;
  renderizarResumoPedido();
}

// =============== GERAÇÃO DA MENSAGEM ===============

function linhaItem(x) {
  const base = `✅ ${x.qty}x ${x.nome}${x.obs ? ' (' + x.obs + ')' : ''}`;
  const sugestao    = x.marcaSugerida ? `   Sugestão da escola: ${x.marcaSugerida}` : null;
  const prefCliente = (x.preferenciaCliente || '').trim() ? `   Preferência: ${x.preferenciaCliente.trim()}` : null;
  return [base, sugestao, prefCliente].filter(Boolean).join('\n');
}

function gerarBlocoLista(lista, numero) {
  const m    = lista.metadados;
  const a    = lista.aluno;
  const pref = PREFERENCIAS_GERAL.find(p => p.id === lista.preferenciaGeral) || PREFERENCIAS_GERAL[0];
  const inclusos = lista.itens.filter(x => x.incluso);

  const tituloPartes = [`*Lista ${numero}`];
  if (a.nome) tituloPartes.push(a.nome);
  const titulo = tituloPartes.join(' · ') + '*';

  const meta = [
    m.escola    ? `Escola: ${m.escola}`           : null,
    m.anoSerie  ? `Ano/Série: ${m.anoSerie}`      : null,
    m.segmento  ? `Segmento: ${m.segmento}`       : null,
    m.anoLetivo ? `Ano letivo: ${m.anoLetivo}`    : null,
    a.preferenciaCor ? `Preferência de cor: ${a.preferenciaCor}` : null,
    a.observacoes    ? `Observações: ${a.observacoes}`           : null,
    `Critério para o orçamento: ${pref.label}`,
  ].filter(Boolean).join('\n');

  const linhasItens = inclusos.length > 0
    ? inclusos.map(linhaItem).join('\n')
    : 'Nenhum item selecionado para orçamento.';

  return `${titulo}\n${meta}\n\n${linhasItens}`;
}

function atualizarLinkEnviar() {
  const inclRascunho = estado.rascunho.itens.filter(x => x.incluso).length;
  const inclSalvas   = estado.listas.reduce((acc, l) => acc + l.itens.filter(x => x.incluso).length, 0);
  const totalInclusos = inclRascunho + inclSalvas;

  const todasListas = [
    ...estado.listas,
    ...(estado.rascunho.itens.length > 0 ? [estado.rascunho] : []),
  ].sort((a, b) => (a.num || 0) - (b.num || 0));

  const plural = todasListas.length > 1;
  if (btnEnviar) btnEnviar.textContent = plural ? 'Enviar listas para orçamento' : 'Enviar lista para orçamento';

  if (totalInclusos === 0) {
    if (btnEnviar) { btnEnviar.style.opacity = '0.5'; btnEnviar.style.pointerEvents = 'none'; btnEnviar.removeAttribute('href'); }
    return;
  }
  if (btnEnviar) { btnEnviar.style.opacity = ''; btnEnviar.style.pointerEvents = ''; }

  salvarProgresso();

  const intro = plural
    ? `Montei ${todasListas.length} listas escolares pelo site da Sartec:`
    : 'Organizei minha lista escolar pelo site da Sartec:';

  const blocos = todasListas.map(l => gerarBlocoLista(l, l.num)).join('\n\n---\n\n');

  const mensagem =
`Olá, Sartec! Sou *${estado.nome}*.

${intro}

[SITE_LISTA_ESCOLAR]
*WhatsApp:* ${estado.whatsapp}

${blocos}

A equipe pode conferir estoque, marcas e valores e me enviar o orçamento pelo WhatsApp?

— Enviado pela ferramenta de lista escolar do site da Sartec`;

  if (btnEnviar) btnEnviar.href = montarWpp(SARTEC.WPP_PRINCIPAL, mensagem);
}

// =============== BOTÕES ===============

btnMarcarTodosTem.addEventListener('click', () => {
  const algumIncluso = estado.rascunho.itens.some(x => x.incluso);
  estado.rascunho.itens.forEach(x => x.incluso = !algumIncluso);
  atualizarUI();
  btnMarcarTodosTem.textContent = algumIncluso ? 'Marcar todos como "Não quero"' : 'Marcar todos como "Quero comprar"';
});

btnAdicionarLista.addEventListener('click', () => {
  salvarRascunhoNaListas();
  estado.rascunho      = rascunhoVazio();
  estado.modoNovaLista = true;

  const formEl = document.getElementById('form-upload');
  if (formEl) formEl.classList.add('nova-lista');

  const novaHeader = document.getElementById('nova-lista-header');
  if (novaHeader) {
    novaHeader.style.display = '';
    const tituloEl = novaHeader.querySelector('.nova-lista-num');
    if (tituloEl) tituloEl.textContent = nextListNum;
  }

  renderizarFaixas();
  salvarProgresso();

  clearTimeout(uploadFeedbackTimer);
  arquivoInput.value = '';
  uploadArea.classList.remove('upload-lendo', 'upload-ok');
  uploadLabel.textContent = 'Clique ou arraste os arquivos da lista aqui';

  trocarEstado('estado-upload');
  const alvo = document.getElementById('listas-container');
  scrollPara(alvo && alvo.children.length ? alvo : document.getElementById('estado-upload'), 'start');
});

btnLimpar.addEventListener('click', () => {
  if (confirm('Tem certeza que deseja apagar todas as listas deste pedido?')) {
    limparTudoERecomecar();
  }
});

if (btnEnviar) {
  btnEnviar.addEventListener('click', validarEEnviar);
}

// =============== PROTEÇÃO CONTRA SAÍDA ===============
window.addEventListener('beforeunload', (e) => {
  if (!pedidoEnviado && temProgresso()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// =============== LIMPAR PEDIDO — BANNER ===============
const btnLimparSalvo = document.getElementById('btn-limpar-salvo');
if (btnLimparSalvo) {
  btnLimparSalvo.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja apagar todas as listas deste pedido?')) {
      limparTudoERecomecar();
    }
  });
}

// =============== RESTAURAR PROGRESSO AO CARREGAR ===============
(function inicializarProgresso() {
  const restaurado = restaurarProgresso();
  if (!restaurado) return;

  if (nomeInput && estado.nome) nomeInput.value = estado.nome;
  if (inputWhatsapp && estado.whatsapp) inputWhatsapp.value = estado.whatsapp;

  const temRascunho = estado.rascunho.itens.length > 0;
  const temListas   = estado.listas.length > 0;

  if (!temRascunho && !temListas) return;

  renderizarFaixas();

  if (temRascunho) {
    renderizarResultado();
    trocarEstado('estado-resultado');
  } else if (estado.modoNovaLista) {
    const formEl = document.getElementById('form-upload');
    if (formEl) formEl.classList.add('nova-lista');
    const novaHeader = document.getElementById('nova-lista-header');
    if (novaHeader) {
      novaHeader.style.display = '';
      const tituloEl = novaHeader.querySelector('.nova-lista-num');
      if (tituloEl) tituloEl.textContent = nextListNum;
    }
  }

  mostrarBannerRestaurado();
})();
