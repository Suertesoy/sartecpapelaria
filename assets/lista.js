/* ======================================================
   SARTEC — Ferramenta de lista escolar
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

let estado = {
  nome: '',
  whatsapp: '',
  itens: [],
  metadados: { escola: '', anoSerie: '', segmento: '', anoLetivo: '' },
  preferenciaGeral: 'economico',
  aluno: { nome: '', preferenciaCor: '', observacoes: '' },
};

// =============== UTILITÁRIOS ===============
function trocarEstado(id) {
  document.querySelectorAll('.estado').forEach(el => el.classList.remove('ativo'));
  document.getElementById(id).classList.add('ativo');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

// =============== UPLOAD ===============
const uploadArea = document.getElementById('upload-area');
const arquivoInput = document.getElementById('arquivo');
const uploadLabel = document.getElementById('upload-label');
const formUpload = document.getElementById('form-upload');
const inputWhatsapp = document.getElementById('whatsapp');

inputWhatsapp.addEventListener('input', (e) => {
  e.target.value = formatarTelefone(e.target.value);
});

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
  const f = arquivoInput.files?.[0];
  if (!f) return;
  uploadLabel.textContent = `✓ ${f.name}`;
}

formUpload.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const whatsapp = inputWhatsapp.value.trim();
  const arquivo = arquivoInput.files?.[0];

  if (!nome || !whatsapp) { alert('Preencha nome e WhatsApp.'); return; }
  if (!arquivo) { alert('Anexe a foto ou PDF da lista.'); return; }
  if (arquivo.size > LIMITE_BYTES) {
    alert('O arquivo é maior que 4MB. Reduza o tamanho e tente novamente.');
    return;
  }

  estado.nome = nome;
  estado.whatsapp = whatsapp;

  await iniciarAnalise(arquivo);
});

// =============== ANÁLISE COM IA ===============
async function iniciarAnalise(arquivo) {
  trocarEstado('estado-loading');

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
      estado.metadados = dados.metadados || { escola: '', anoSerie: '', segmento: '', anoLetivo: '' };
      estado.itens = dados.itens.map(it => ({ ...it, incluso: true, preferenciaCliente: '' }));
      renderizarResultado();
      trocarEstado('estado-resultado');
      return;
    }

    if (isLocal) {
      estado.metadados = META_MOCK;
      estado.itens = ITENS_MOCK.map(it => ({ ...it, incluso: true, preferenciaCliente: '' }));
      renderizarResultado();
      trocarEstado('estado-resultado');
      return;
    }

    trocarEstado('estado-upload');
    alert(dados.error || 'Não consegui identificar itens na lista. Tente enviar uma foto mais nítida ou um PDF.');
  } catch (err) {
    clearInterval(interval);
    console.error('[lista] Erro na análise:', err);

    if (isLocal) {
      estado.metadados = META_MOCK;
      estado.itens = ITENS_MOCK.map(it => ({ ...it, incluso: true, preferenciaCliente: '' }));
      renderizarResultado();
      trocarEstado('estado-resultado');
      return;
    }

    trocarEstado('estado-upload');
    alert('Erro de conexão. Verifique sua internet e tente novamente.');
  }
}

// =============== RESULTADO ===============
const grid = document.getElementById('itens-grid');
const counterQuero = document.getElementById('counter-quero');
const counterTem = document.getElementById('counter-tem');
const resumoTotal = document.getElementById('resumo-total');
const btnEnviar = document.getElementById('btn-enviar');
const btnMarcarTodosTem = document.getElementById('btn-marcar-todos-tem');
const btnRecomecar = document.getElementById('btn-recomecar');

function renderizarAluno() {
  const bloco = document.getElementById('bloco-aluno');
  if (!bloco) return;
  const a = estado.aluno;
  bloco.innerHTML = `
    <div class="aluno-lista">
      <p class="aluno-lista-titulo">Dados do aluno</p>
      <p class="aluno-lista-desc">Quando a escola indicar uma cor específica, seguimos a indicação da lista. Quando não houver cor indicada, informe aqui se há alguma preferência de cor, estampa ou estilo para ajudar a equipe a separar os materiais.</p>
      <div class="aluno-lista-grid">
        <label class="aluno-lista-field">
          Nome do aluno
          <input id="aluno-nome" type="text" value="${esc(a.nome)}" placeholder="Ex: Gustavo" />
        </label>
        <label class="aluno-lista-field">
          Preferência de cor quando a lista não indicar
          <input id="aluno-cor" type="text" value="${esc(a.preferenciaCor)}" placeholder="Ex: rosa, azul, cores neutras, sem preferência" />
        </label>
        <label class="aluno-lista-field aluno-lista-field-full">
          Observações sobre cores/modelos
          <input id="aluno-obs" type="text" value="${esc(a.observacoes)}" placeholder="Ex: evitar personagens, pode ser qualquer estampa, preferência por tons claros" />
        </label>
      </div>
    </div>
  `;
  document.getElementById('aluno-nome').addEventListener('input', e => {
    estado.aluno.nome = e.target.value;
    atualizarLinkEnviar();
  });
  document.getElementById('aluno-cor').addEventListener('input', e => {
    estado.aluno.preferenciaCor = e.target.value;
    atualizarLinkEnviar();
  });
  document.getElementById('aluno-obs').addEventListener('input', e => {
    estado.aluno.observacoes = e.target.value;
    atualizarLinkEnviar();
  });
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
        <button class="preferencia-option${estado.preferenciaGeral === p.id ? ' ativo' : ''}" type="button" data-pref="${p.id}">
          <strong>${esc(p.label)}</strong>
          <span>${esc(p.desc)}</span>
        </button>`).join('')}
      </div>
    </div>
  `;
  bloco.querySelectorAll('.preferencia-option').forEach(btn => {
    btn.addEventListener('click', () => {
      estado.preferenciaGeral = btn.dataset.pref;
      bloco.querySelectorAll('.preferencia-option').forEach(b => {
        b.classList.toggle('ativo', b === btn);
      });
      atualizarLinkEnviar();
    });
  });
}

function renderizarMetadados() {
  const bloco = document.getElementById('bloco-metadados');
  if (!bloco) return;
  const m = estado.metadados;
  bloco.innerHTML = `
    <div class="meta-lista">
      <p class="meta-lista-titulo">Dados identificados na lista</p>
      <div class="meta-lista-campos">
        <label>Escola<input id="meta-escola" value="${esc(m.escola)}" placeholder="Não identificado" /></label>
        <label>Ano / Série<input id="meta-anoSerie" value="${esc(m.anoSerie)}" placeholder="Não identificado" /></label>
        <label>Segmento<input id="meta-segmento" value="${esc(m.segmento)}" placeholder="Não identificado" /></label>
        <label>Ano letivo<input id="meta-anoLetivo" value="${esc(m.anoLetivo)}" placeholder="Não identificado" /></label>
      </div>
      <p class="meta-lista-dica">Confira se os dados estão corretos. Eles ajudam a equipe da Sartec a localizar a lista certa e confirmar o orçamento.</p>
    </div>
  `;
  ['escola', 'anoSerie', 'segmento', 'anoLetivo'].forEach(campo => {
    document.getElementById(`meta-${campo}`).addEventListener('input', (e) => {
      estado.metadados[campo] = e.target.value;
      atualizarLinkEnviar();
    });
  });
}

function renderizarResultado() {
  renderizarMetadados();
  renderizarAluno();
  renderizarPreferenciaGeral();

  grid.innerHTML = estado.itens.map(it => {
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
    const id = card.dataset.id;
    const item = estado.itens.find(x => x.id === id);

    card.querySelectorAll('.item-choice-option').forEach(btn => {
      btn.addEventListener('click', () => {
        item.incluso = btn.dataset.acao === 'incluir';
        atualizarUI();
      });
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
      toggle.textContent = input.value.trim()
        ? 'Editar marca/preferência'
        : '+ adicionar marca/preferência';
      atualizarLinkEnviar();
    });
  });

  btnMarcarTodosTem.textContent = 'Marcar todos como "Não quero"';
  atualizarContadores();
  atualizarLinkEnviar();
}

function atualizarUI() {
  grid.querySelectorAll('.item-card').forEach(card => {
    const id = card.dataset.id;
    const item = estado.itens.find(x => x.id === id);
    card.classList.toggle('excluido', !item.incluso);
    card.querySelector('.qty-num').textContent = item.qty;
    card.querySelectorAll('.item-choice-option').forEach(btn => {
      btn.classList.toggle('ativo',
        item.incluso ? btn.dataset.acao === 'incluir' : btn.dataset.acao === 'excluir'
      );
    });
  });
  atualizarContadores();
  atualizarLinkEnviar();
}

function atualizarContadores() {
  const inclusos = estado.itens.filter(x => x.incluso);
  const excluidos = estado.itens.filter(x => !x.incluso);
  counterQuero.textContent = `${inclusos.length} ${inclusos.length === 1 ? 'item' : 'itens'}`;
  counterTem.textContent = `${excluidos.length} não ${excluidos.length === 1 ? 'quero' : 'quero'}`;
  resumoTotal.textContent = `${inclusos.length} ${inclusos.length === 1 ? 'item' : 'itens'}`;
}

function atualizarLinkEnviar() {
  const inclusos = estado.itens.filter(x => x.incluso);
  if (inclusos.length === 0) {
    btnEnviar.style.opacity = '0.5';
    btnEnviar.style.pointerEvents = 'none';
    btnEnviar.removeAttribute('href');
    return;
  }
  btnEnviar.style.opacity = '';
  btnEnviar.style.pointerEvents = '';

  const excluidos = estado.itens.filter(x => !x.incluso);
  const m = estado.metadados;
  const a = estado.aluno;
  const pref = PREFERENCIAS_GERAL.find(p => p.id === estado.preferenciaGeral) || PREFERENCIAS_GERAL[0];

  const dadosLista = [
    `Escola: ${m.escola || 'Não informado'}`,
    `Ano/Série: ${m.anoSerie || 'Não informado'}`,
    m.segmento  ? `Segmento: ${m.segmento}`  : null,
    m.anoLetivo ? `Ano letivo: ${m.anoLetivo}` : null,
  ].filter(Boolean).join('\n');

  const dadosAluno = [
    `Nome: ${a.nome || 'Não informado'}`,
    `Preferência de cor quando a lista não indicar: ${a.preferenciaCor || 'Não informado'}`,
    `Observações sobre cores/modelos: ${a.observacoes || 'Não informado'}`,
    'Quando a lista indicar cor específica, considerar a cor da lista. Quando não indicar, considerar a preferência informada, conforme disponibilidade.',
  ].join('\n');

  function linhaItem(x) {
    const base = `${x.qty}x ${x.nome}${x.obs ? ' (' + x.obs + ')' : ''}`;
    const sugestao = x.marcaSugerida
      ? `  Sugestão da escola: ${x.marcaSugerida}`
      : null;
    const prefCliente = (x.preferenciaCliente || '').trim()
      ? `  Preferência do cliente: ${x.preferenciaCliente.trim()}`
      : null;
    const clienteAlterou =
      (x.preferenciaCliente || '').trim() &&
      x.marcaSugerida &&
      x.preferenciaCliente.trim().toLowerCase() !== x.marcaSugerida.toLowerCase()
        ? `  (Cliente alterou a sugestão da escola para este item.)`
        : null;
    return [base, sugestao, prefCliente, clienteAlterou].filter(Boolean).join('\n');
  }

  const linhasQuero = inclusos.map(linhaItem).join('\n\n');
  const linhasNaoQuero = excluidos.length > 0
    ? excluidos.map(linhaItem).join('\n\n')
    : 'Nenhum item marcado como Não quero.';

  const mensagem =
`Olá, Sartec! Sou *${estado.nome}*.

[SITE_LISTA_ESCOLAR]

*Lista escolar organizada pelo site*

*Dados da lista:*
${dadosLista}

*Dados do aluno:*
${dadosAluno}

*WhatsApp informado no site:*
${estado.whatsapp}

*Preferência para o orçamento:*
${pref.label} — ${pref.desc}

*Itens que quero comprar:*
${linhasQuero}

*Itens marcados como Não quero:*
${linhasNaoQuero}

Aguardo o orçamento e a confirmação de disponibilidade, marcas/modelos e valores.

— Enviado pela ferramenta de lista escolar do site da Sartec`;

  btnEnviar.href = montarWpp(SARTEC.WPP_PRINCIPAL, mensagem);
}

btnMarcarTodosTem.addEventListener('click', () => {
  const algumIncluso = estado.itens.some(x => x.incluso);
  estado.itens.forEach(x => x.incluso = !algumIncluso);
  atualizarUI();
  btnMarcarTodosTem.textContent = algumIncluso
    ? 'Marcar todos como "Não quero"'
    : 'Marcar todos como "Quero comprar"';
});

btnRecomecar.addEventListener('click', () => {
  if (confirm('Recomeçar do zero? Sua seleção atual será perdida.')) {
    formUpload.reset();
    uploadLabel.textContent = 'Clique ou arraste sua lista aqui';
    trocarEstado('estado-upload');
  }
});
