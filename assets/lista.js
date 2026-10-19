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

// label/desc: desktop e mensagem do WhatsApp. labelMob/descMob: só a apresentação no mobile.
const PREFERENCIAS_GERAL = [
  { id: 'economico',  label: 'Mais econômico',            desc: 'Priorizar as opções mais em conta disponíveis.',           labelMob: 'Mais econômico',            descMob: 'Priorizar menor preço' },
  { id: 'custo_ben', label: 'Melhor custo-benefício',     desc: 'Buscar equilíbrio entre qualidade e preço.',               labelMob: 'Melhor custo-benefício',     descMob: 'Equilíbrio entre preço e qualidade' },
  { id: 'escola',    label: 'Seguir sugestões da escola', desc: 'Quando a lista sugerir marca, tentar seguir a sugestão.',  labelMob: 'Seguir sugestões da escola', descMob: 'Priorizar marcas sugeridas' },
  { id: 'qualidade', label: 'Marcas de maior qualidade',  desc: 'Priorizar marcas melhores, mesmo que custem mais.',        labelMob: 'Maior qualidade',            descMob: 'Priorizar marcas melhores' },
];

// Mesmo corte do CSS (max-width: 640px). Só escolhe textos de placeholder no momento do render.
const ehMobile = () => window.matchMedia('(max-width: 640px)').matches;

const LOADING_MSGS = [
  'Organizando sua lista...',
  'Lendo os materiais encontrados',
  'Separando as informações importantes',
  'Preparando tudo para você conferir',
];

const MAX_ARQUIVOS       = 5;

// =============== ESTADO ===============

let nextListNum   = 1;
let pedidoEnviado = false;
let pendingDados  = null;

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
  // Gancho para o CSS do modo revisão (cabeçalho compacto, camada de aquisição recolhida)
  document.body.dataset.leEstado = id.replace('estado-', '');
  document.body.classList.toggle('le-pedido', id === 'estado-resultado' || id === 'estado-sucesso' || estado.listas.length > 0);
  if (typeof window.atualizarOrientacaoMobile === 'function') window.atualizarOrientacaoMobile();
}

// Início real da experiência de revisão (o container de faixas fica oculto na 1ª lista)
function alvoInicioRevisao() {
  return document.getElementById('le-revisao-topo') || document.getElementById('estado-resultado');
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
  if (el) { el.style.display = 'none'; el.innerHTML = ''; el.className = 'lista-erro-card'; }
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
    || estado.whatsapp.trim() !== ''
    || arquivosSelecionados.length > 0;
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
  trackEvent('school_list_restart');
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
  limparArquivos();
  ocultarBannerSalvo();

  trocarEstado('estado-upload');
  scrollPara(document.getElementById('estado-upload'), 'start');
}

// =============== UPLOAD ===============
const uploadArea = document.getElementById('upload-area');
const arquivoInput = document.getElementById('arquivo');
const formUpload = document.getElementById('form-upload');
const inputWhatsapp = document.getElementById('whatsapp');
const grupoArquivos = document.getElementById('grupo-arquivos');
const arquivosSel = document.getElementById('arquivos-sel');
const arquivosSelTitulo = document.getElementById('arquivos-sel-titulo');
const arquivosSelLista = document.getElementById('arquivos-sel-lista');
const arquivosSelLimite = document.getElementById('arquivos-sel-limite');
const arquivosAviso = document.getElementById('arquivos-aviso');
const btnAddPagina = document.getElementById('btn-add-pagina');

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

// ---- Coleção própria de arquivos ----
// O FileList do input é substituído a cada nova seleção (câmera no celular, por exemplo).
// Por isso cada seleção é copiada para cá e o input é zerado; o submit usa só esta coleção.
// Não é persistida em localStorage (File não é serializável).
let arquivosSelecionados = []; // { id, file, chave, url }  (url = miniatura, só para imagens)
let proximoIdArquivo = 1;

const TIPOS_ARQUIVO = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

// Mesmos tipos aceitos pela API (jpeg, png, pdf). Sem `type` do navegador, cai para a extensão.
function tipoDoArquivo(file) {
  if (Object.values(TIPOS_ARQUIVO).includes(file.type)) return file.type;
  if (file.type) return null;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return TIPOS_ARQUIVO[ext] || null;
}

// Chave simples, sem hash: suficiente para evitar o mesmo arquivo duas vezes
function chaveArquivo(file) {
  return [file.name, file.size, file.lastModified, file.type].join('|');
}

function formatarTamanho(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function ehPdf(entrada) { return tipoDoArquivo(entrada.file) === 'application/pdf'; }

// Só imagens: "página(s)". Se houver PDF no conjunto: "arquivo(s)".
function descreverQuantidade(n, adicionadas) {
  const soImagens = arquivosSelecionados.every(e => !ehPdf(e));
  const unidade = soImagens ? (n === 1 ? 'página' : 'páginas') : (n === 1 ? 'arquivo' : 'arquivos');
  if (!adicionadas) return `${n} ${unidade}`;
  return `${n} ${unidade} ${soImagens ? 'adicionada' : 'adicionado'}${n === 1 ? '' : 's'}`;
}

function mostrarAvisoArquivos(msg) {
  if (!arquivosAviso) return;
  arquivosAviso.textContent = msg || '';
  arquivosAviso.hidden = !msg;
}

function rotuloAnalisar() {
  const n = arquivosSelecionados.length;
  return n === 0 ? 'Analisar lista' : `Analisar ${descreverQuantidade(n)}`;
}

function atualizarBotaoAnalisar() {
  const btn = document.getElementById('btn-analisar');
  if (btn && !btn.disabled) btn.textContent = rotuloAnalisar();
}

function renderizarArquivos() {
  const n = arquivosSelecionados.length;
  grupoArquivos.classList.toggle('tem-arquivos', n > 0);
  arquivosSel.hidden = n === 0;
  atualizarBotaoAnalisar();
  if (n === 0) { arquivosSelLista.innerHTML = ''; return; }

  arquivosSelTitulo.textContent = descreverQuantidade(n, true);
  arquivosSelLista.innerHTML = '';
  arquivosSelecionados.forEach((ent, i) => {
    const pdf = ehPdf(ent);
    const li = document.createElement('li');
    li.className = 'arquivo-item';
    li.dataset.id = ent.id;

    const thumb = document.createElement('span');
    thumb.className = 'arquivo-thumb' + (pdf ? ' arquivo-thumb-pdf' : '');
    thumb.setAttribute('aria-hidden', 'true');
    if (!pdf && ent.url) {
      const img = document.createElement('img');
      img.src = ent.url;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      thumb.textContent = 'PDF';
    }

    const info = document.createElement('span');
    info.className = 'arquivo-info';
    const nome = document.createElement('span');
    nome.className = 'arquivo-nome';
    nome.textContent = pdf ? `PDF · ${ent.file.name}` : `Página ${i + 1}`;
    const meta = document.createElement('span');
    meta.className = 'arquivo-meta';
    meta.textContent = formatarTamanho(ent.file.size);
    info.append(nome, meta);

    const rem = document.createElement('button');
    rem.type = 'button';
    rem.className = 'arquivo-remover';
    rem.textContent = 'Remover';
    rem.setAttribute('aria-label', pdf ? `Remover PDF ${ent.file.name}` : `Remover página ${i + 1}`);
    rem.addEventListener('click', () => removerArquivo(ent.id));

    li.append(thumb, info, rem);
    arquivosSelLista.appendChild(li);
  });

  const cheio = n >= MAX_ARQUIVOS;
  btnAddPagina.hidden = cheio;
  arquivosSelLimite.hidden = !cheio;
}

// Mudou o conjunto: qualquer confirmação/erro pendente deixa de valer.
function aoMudarArquivos() {
  pendingDados = null;
  ocultarErro();
  renderizarArquivos();
}

function adicionarArquivos(novos) {
  mostrarAvisoArquivos('');
  const recusas = [];
  let adicionados = 0;
  let duplicados = 0;
  let bytesPdf = arquivosSelecionados.filter(e => ehPdf(e)).reduce((acc, e) => acc + e.file.size, 0);

  for (const file of novos) {
    const tipo = tipoDoArquivo(file);
    if (!tipo) { recusas.push(`"${file.name}" não é PDF, JPG ou PNG.`); continue; }
    const chave = chaveArquivo(file);
    if (arquivosSelecionados.some(e => e.chave === chave)) { duplicados++; continue; }
    if (arquivosSelecionados.length >= MAX_ARQUIVOS) {
      recusas.push(`Você pode enviar até ${MAX_ARQUIVOS} arquivos por lista. Selecione os mais completos da mesma criança.`);
      break;
    }
    if (tipo === 'application/pdf') {
      // PDF não é comprimido: precisa caber sozinho (com os outros PDFs) no limite de envio
      if (bytesPdf + file.size > ORCAMENTO_ENVIO_BYTES - MAX_ARQUIVOS * OVERHEAD_PARTE_BYTES) {
        recusas.push(`O PDF "${file.name}" é grande demais para enviar. Use um PDF menor ou fotografe as páginas.`);
        continue;
      }
    } else if (file.size > MAX_IMAGEM_ORIGINAL_BYTES) {
      recusas.push(`A imagem "${file.name}" é grande demais. Tire a foto de novo ou use outra imagem.`);
      continue;
    }
    arquivosSelecionados.push({
      id: proximoIdArquivo++,
      file,
      chave,
      url: tipo.startsWith('image/') ? URL.createObjectURL(file) : null,
    });
    if (tipo === 'application/pdf') bytesPdf += file.size;
    adicionados++;
  }

  if (adicionados > 0) {
    aoMudarArquivos();
    // Só contagens: nunca nomes de arquivo
    trackEvent('school_list_upload_file_selected', { file_count: arquivosSelecionados.length, added_count: adicionados });
  }
  const avisos = [...new Set(recusas)];
  if (duplicados > 0) avisos.push(duplicados === 1 ? 'Esse arquivo já estava na lista.' : 'Alguns arquivos já estavam na lista.');
  if (avisos.length) mostrarAvisoArquivos(avisos.join(' '));
}

function removerArquivo(id) {
  const idx = arquivosSelecionados.findIndex(e => e.id === id);
  if (idx < 0) return;
  const [removido] = arquivosSelecionados.splice(idx, 1);
  if (removido.url) URL.revokeObjectURL(removido.url);
  mostrarAvisoArquivos('');
  aoMudarArquivos();
  trackEvent('school_list_upload_file_removed', { file_count: arquivosSelecionados.length });

  // O foco segue para um alvo que continua existindo
  const proximo = arquivosSelLista.querySelectorAll('.arquivo-remover')[Math.min(idx, arquivosSelecionados.length - 1)];
  if (proximo) proximo.focus();
  else uploadArea.focus();
}

// Esvazia a coleção (recomeço, nova lista, separar listas, análise aplicada) e devolve o upload ao estado inicial.
function limparArquivos() {
  arquivosSelecionados.forEach(e => { if (e.url) URL.revokeObjectURL(e.url); });
  arquivosSelecionados = [];
  arquivoInput.value = '';
  mostrarAvisoArquivos('');
  renderizarArquivos();
}

function abrirSeletorDeArquivos() { arquivoInput.click(); }

uploadArea.addEventListener('click', abrirSeletorDeArquivos);
uploadArea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirSeletorDeArquivos(); }
});
btnAddPagina.addEventListener('click', abrirSeletorDeArquivos);

[uploadArea, arquivosSel].forEach(alvo => {
  alvo.addEventListener('dragover', (e) => { e.preventDefault(); alvo.classList.add('dragover'); });
  alvo.addEventListener('dragleave', () => alvo.classList.remove('dragover'));
  alvo.addEventListener('drop', (e) => {
    e.preventDefault();
    alvo.classList.remove('dragover');
    if (e.dataTransfer.files.length) adicionarArquivos(Array.from(e.dataTransfer.files));
  });
});

arquivoInput.addEventListener('change', () => {
  const escolhidos = Array.from(arquivoInput.files || []);
  arquivoInput.value = ''; // libera o input: a próxima captura/seleção volta a disparar "change"
  if (escolhidos.length) adicionarArquivos(escolhidos);
});

formUpload.addEventListener('submit', async (e) => {
  e.preventDefault();
  const arquivos = arquivosSelecionados.map(ent => ent.file);

  ocultarErro();
  trackEvent('school_list_form_attempt');

  if (!estado.modoNovaLista) {
    const nome = document.getElementById('nome').value.trim();
    const whatsapp = inputWhatsapp.value.trim();
    if (!nome || !whatsapp) {
      mostrarErro('Preencha nome e WhatsApp antes de continuar.');
      trackEvent('school_list_form_error', { reason: 'nome_ou_whatsapp_ausente' });
      return;
    }
    estado.nome = nome;
    estado.whatsapp = whatsapp;
  }

  if (arquivos.length === 0) {
    mostrarErro('Anexe a foto ou PDF da lista antes de continuar.');
    trackEvent('school_list_form_error', { reason: 'arquivo_ausente' });
    return;
  }
  if (arquivos.length > MAX_ARQUIVOS) {
    mostrarErro(`Você pode enviar até ${MAX_ARQUIVOS} arquivos por lista. Selecione os mais completos da mesma criança.`);
    return;
  }
  estado.rascunho.arquivoNome = arquivos.map(f => f.name).join(', ');
  await iniciarAnalise(arquivos);
});

// =============== PREPARAÇÃO PARA ENVIO (compressão de fotos) ===============
// A Vercel recusa corpo de request acima de 4,5 MB com 413 FUNCTION_PAYLOAD_TOO_LARGE, antes de o handler rodar.
// Fotos de celular passam disso com facilidade. Só comprimimos quando o conjunto não cabe;
// PDFs seguem intactos. O contrato com a API não muda: vários campos "arquivo".
const ORCAMENTO_ENVIO_BYTES = 4_000_000;   // corpo total do multipart, com folga sobre os 4,5 MB da Vercel
const OVERHEAD_PARTE_BYTES  = 1024;        // cabeçalhos multipart por arquivo
const MAX_IMAGEM_ORIGINAL_BYTES = 30 * 1024 * 1024; // só protege a memória do navegador ao decodificar
// A visão do Claude reduz imagens acima de ~1568 px no lado maior; passar muito disso só pesa no envio.
const NIVEIS_COMPRESSAO = [
  { lado: 1800, qualidade: 0.85 },
  { lado: 1800, qualidade: 0.75 },
  { lado: 1600, qualidade: 0.70 },
  { lado: 1400, qualidade: 0.65 },
  { lado: 1200, qualidade: 0.60 },
];

class ErroPreparo extends Error {}

function ehImagemArquivo(file) { return (tipoDoArquivo(file) || '').startsWith('image/'); }

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, liberar: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function canvasParaBlob(canvas, qualidade) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidade));
}

// JPEG até `alvoBytes`, lado maior limitado, orientação EXIF aplicada pelo navegador ao desenhar a <img>.
async function comprimirImagem(file, alvoBytes) {
  let carregada;
  try { carregada = await carregarImagem(file); }
  catch (_) { throw new ErroPreparo(`Não foi possível preparar a imagem "${file.name}". Tente tirar a foto de novo.`); }
  const { img, liberar } = carregada;
  const canvas = document.createElement('canvas');
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    for (const nivel of NIVEIS_COMPRESSAO) {
      const escala = Math.min(1, nivel.lado / Math.max(w, h));
      canvas.width  = Math.max(1, Math.round(w * escala));
      canvas.height = Math.max(1, Math.round(h * escala));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; // PNG com transparência não pode virar fundo preto no JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await canvasParaBlob(canvas, nivel.qualidade);
      if (blob && blob.size <= alvoBytes) {
        const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], nome, { type: 'image/jpeg', lastModified: file.lastModified });
      }
    }
  } finally {
    canvas.width = canvas.height = 0; // libera o buffer do canvas
    liberar();
  }
  throw new ErroPreparo('Não conseguimos reduzir as páginas o bastante para enviar. Envie menos páginas por vez.');
}

// Devolve os arquivos na mesma ordem. Se tudo já cabe, devolve os originais sem tocar em nada.
async function prepararArquivosParaEnvio(files) {
  const orcamento = ORCAMENTO_ENVIO_BYTES - files.length * OVERHEAD_PARTE_BYTES;
  if (files.reduce((acc, f) => acc + f.size, 0) <= orcamento) return files;

  const bytesPdf = files.filter(f => !ehImagemArquivo(f)).reduce((acc, f) => acc + f.size, 0);
  const indicesImagens = files.map((f, i) => i).filter(i => ehImagemArquivo(files[i])).sort((a, b) => files[a].size - files[b].size);
  if (!indicesImagens.length || bytesPdf >= orcamento) {
    throw new ErroPreparo('Os arquivos ficaram grandes demais para enviar. Use um PDF menor ou fotografe as páginas.');
  }

  // Da menor para a maior: cada imagem pode usar uma parte igual do que sobra; as pequenas deixam folga para as grandes
  const preparados = files.slice();
  let restante = orcamento - bytesPdf;
  let faltam = indicesImagens.length;
  for (const i of indicesImagens) {
    const cota = restante / faltam;
    if (files[i].size > cota) preparados[i] = await comprimirImagem(files[i], cota);
    restante -= preparados[i].size;
    faltam--;
  }
  return preparados;
}

// =============== ANÁLISE COM IA ===============

function aplicarDadosAnalisados(dados) {
  limparArquivos(); // os arquivos já viraram esta lista; a próxima criança começa do zero
  if (!estado.rascunho.num) {
    estado.rascunho.num = nextListNum++;
    estado.rascunho.id  = 'lista_' + estado.rascunho.num + '_' + Date.now();
  }
  estado.rascunho.metadados = dados.metadados || { escola: '', anoSerie: '', segmento: '', anoLetivo: '' };
  estado.rascunho.itens     = dados.itens.map(it => ({ ...it, incluso: true, preferenciaCliente: '' }));
  renderizarFaixas();
  renderizarResultado();
  trocarEstado('estado-resultado');
  window.scrollTo({ top: window.scrollY, behavior: 'instant' }); // interrompe a rolagem suave do loading, se ainda em curso
  scrollPara(alvoInicioRevisao(), 'start');
  trackEvent('school_list_analysis_completed', { item_count: estado.rascunho.itens.length });
}

function mostrarErroMultiArquivo() {
  const el = document.getElementById('lista-erro');
  if (!el) return;
  el.className = 'lista-erro-card';
  el.innerHTML = `
    <span class="lista-erro-ico" aria-hidden="true">⚠</span>
    <div>
      <strong>Identificamos listas de crianças diferentes.</strong>
      <p>Os arquivos enviados parecem ter escolas ou séries diferentes. Para separar corretamente os materiais por nome e preferência, envie uma criança por vez.</p>
      <p class="lista-erro-dica">Depois de finalizar esta lista, você poderá clicar em "Adicionar nova lista" para enviar a próxima.</p>
      <button class="lista-erro-btn-novo" type="button" id="btn-escolher-novamente">Escolher arquivos novamente</button>
    </div>`;
  el.style.display = '';
  scrollPara(el, 'nearest');

  document.getElementById('btn-escolher-novamente')?.addEventListener('click', () => {
    ocultarErro();
    limparArquivos();
    arquivoInput.click();
  });
}

function mostrarConfirmacaoMultiArquivo() {
  const el = document.getElementById('lista-erro');
  if (!el) return;
  el.className = 'lista-erro-card lista-confirmacao-card';
  el.innerHTML = `
    <span class="lista-erro-ico" aria-hidden="true">❓</span>
    <div>
      <strong>Esses arquivos são da mesma criança?</strong>
      <p>Encontramos informações que podem indicar listas diferentes. Confirme se todos os arquivos pertencem ao mesmo aluno antes de continuar.</p>
      <div class="lista-confirmacao-btns">
        <button class="btn btn-primary" type="button" id="btn-confirmar-mesma-crianca">Sim, são da mesma criança</button>
        <button class="btn btn-ghost"   type="button" id="btn-separar-listas">Não, vou separar as listas</button>
      </div>
    </div>`;
  el.style.display = '';
  scrollPara(el, 'nearest');

  document.getElementById('btn-confirmar-mesma-crianca')?.addEventListener('click', () => {
    if (!pendingDados) return;
    el.style.display = 'none';
    el.className = 'lista-erro-card';
    const dados = pendingDados;
    pendingDados = null;
    aplicarDadosAnalisados(dados);
  });

  document.getElementById('btn-separar-listas')?.addEventListener('click', () => {
    pendingDados = null;
    el.className = 'lista-erro-card';
    ocultarErro();
    limparArquivos();
  });
}

async function iniciarAnalise(arquivos) {
  trackEvent('school_list_analysis_started', { file_count: arquivos.length });

  const btnAnalisar = document.getElementById('btn-analisar');
  if (btnAnalisar) { btnAnalisar.disabled = true; btnAnalisar.textContent = 'Analisando...'; }

  const reativarBtn = () => {
    if (btnAnalisar) { btnAnalisar.disabled = false; btnAnalisar.textContent = rotuloAnalisar(); }
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
    // Não reinicia o ciclo nem sugere progresso: fica na última mensagem
    i = Math.min(i + 1, LOADING_MSGS.length - 1);
    hint.textContent = LOADING_MSGS[i];
  }, 2200);

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  try {
    let paraEnviar;
    try {
      paraEnviar = await prepararArquivosParaEnvio(arquivos);
    } catch (errPreparo) {
      clearInterval(interval);
      reativarBtn();
      trocarEstado('estado-upload');
      mostrarErro(errPreparo instanceof ErroPreparo ? errPreparo.message : 'Não foi possível preparar os arquivos. Tente novamente.');
      return;
    }

    const formData = new FormData();
    for (const arq of paraEnviar) formData.append('arquivo', arq);

    const resposta = await fetch('/api/analisar-lista', { method: 'POST', body: formData });
    if (resposta.status === 413) {
      // A infraestrutura recusou o corpo antes do handler (resposta não é JSON)
      clearInterval(interval);
      reativarBtn();
      trocarEstado('estado-upload');
      mostrarErro('Os arquivos ficaram grandes demais para enviar juntos. Envie menos páginas por vez.');
      return;
    }
    const dados = await resposta.json();

    clearInterval(interval);

    if (dados.ok && dados.itens?.length) {
      const vc = dados.validacaoConjunto;

      // Arquivos de crianças diferentes — bloqueado com certeza
      if (vc && !vc.mesmaCriancaProvavel && vc.confianca === 'alta') {
        reativarBtn();
        trocarEstado('estado-upload');
        mostrarErroMultiArquivo();
        return;
      }

      // Incerto — pedir confirmação antes de continuar
      if (vc && !vc.mesmaCriancaProvavel) {
        pendingDados = dados;
        reativarBtn();
        trocarEstado('estado-upload');
        mostrarConfirmacaoMultiArquivo();
        return;
      }

      aplicarDadosAnalisados(dados);
      reativarBtn();
      return;
    }

    if (isLocal) {
      aplicarDadosAnalisados({ metadados: META_MOCK, itens: ITENS_MOCK });
      reativarBtn();
      return;
    }

    reativarBtn();
    trocarEstado('estado-upload');
    mostrarErro(dados.error || 'Não consegui identificar itens na lista. Tente enviar uma foto mais nítida ou um PDF.');
  } catch (err) {
    clearInterval(interval);
    console.error('[lista] Erro na análise:', err);

    if (isLocal) {
      aplicarDadosAnalisados({ metadados: META_MOCK, itens: ITENS_MOCK });
      reativarBtn();
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
    faixa.addEventListener('click', () => trocarParaLista(faixa.dataset.id));
  });
  container.querySelectorAll('.lista-faixa-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); trocarParaLista(btn.dataset.id); });
  });
}

// Troca iniciada pelo usuário (faixas). expandirLista também é usada pela validação, por isso o evento fica aqui.
function trocarParaLista(id) {
  const alvo = estado.listas.find(l => l.id === id);
  trackEvent('school_list_switch_list', {
    list_number: alvo ? alvo.num : undefined,
    lists_count: estado.listas.length + (estado.rascunho.itens.length > 0 ? 1 : 0),
  });
  expandirLista(id);
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

// ---- Aviso leve de pendências (não bloqueia; a validação final continua em validarEEnviar) ----
let pendentesSinalizados = false;

function atualizarPendentes() {
  const a = estado.rascunho.aluno || {};
  const faltaNome = !(a.nome || '').trim();
  const faltaCor  = !(a.preferenciaCor || '').trim();
  const mostrar   = pendentesSinalizados && (faltaNome || faltaCor);
  ['le-pendentes-aviso', 'le-pendentes-aviso-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = !mostrar;
  });
  const nome = document.getElementById('aluno-nome');
  const cor  = document.getElementById('aluno-cor');
  if (nome) nome.classList.toggle('campo-pendente', mostrar && faltaNome);
  if (cor)  cor.classList.toggle('campo-pendente',  mostrar && faltaCor);
}

function sinalizarPendentes() {
  if (estado.rascunho.itens.length === 0) return;
  pendentesSinalizados = true;
  atualizarPendentes();
}

function reiniciarPendentes() {
  pendentesSinalizados = false;
  atualizarPendentes();
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

  const itensInclusos  = todasListas.reduce((acc, l) => acc + l.itens.filter(x => x.incluso).length, 0);
  const itensExcluidos = todasListas.reduce((acc, l) => acc + l.itens.filter(x => !x.incluso).length, 0);
  trackEvent('school_list_submit_whatsapp', {
    action: 'submit',
    lists_count: todasListas.length,
    items_included: itensInclusos,
    items_excluded: itensExcluidos,
    items_total: itensInclusos + itensExcluidos,
  });

  // O link (target=_blank) abre o WhatsApp pelo comportamento padrão; o site não sabe se a mensagem foi enviada.
  setTimeout(mostrarSucesso, 250);
}

// =============== ESTADO DE SUCESSO (fechamento visual, sem confirmar envio) ===============
function mostrarSucesso() {
  const todas = [
    ...estado.listas,
    ...(estado.rascunho.itens.length > 0 ? [estado.rascunho] : []),
  ];
  const itensInclusos = todas.reduce((acc, l) => acc + l.itens.filter(x => x.incluso).length, 0);

  const reabrir = document.getElementById('btn-reabrir-wpp');
  if (reabrir && btnEnviar && btnEnviar.href) reabrir.href = btnEnviar.href;

  trocarEstado('estado-sucesso');
  const alvo = document.getElementById('estado-sucesso');
  scrollPara(alvo, 'start');
  const titulo = document.getElementById('le-sucesso-titulo');
  if (titulo) titulo.focus({ preventScroll: true });

  trackEvent('school_list_success_view', { lists_count: todas.length, items_included: itensInclusos });
}

document.getElementById('btn-voltar-lista')?.addEventListener('click', () => {
  pedidoEnviado = false; // pode voltar a editar; o aviso de saída volta a valer
  trocarEstado('estado-resultado');
  scrollPara(alvoInicioRevisao(), 'start');
});

// Única ação que apaga o pedido a partir do sucesso
document.getElementById('btn-nova-lista-sucesso')?.addEventListener('click', limparTudoERecomecar);

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
  const mob = ehMobile();
  bloco.innerHTML = `
    <div class="aluno-lista">
      <p class="aluno-lista-titulo">Dados da criança/aluno <span class="campo-obrigatorio-nota">campos obrigatórios</span></p>
      <p class="aluno-lista-desc">Para separar tudo certinho, informe de quem é esta lista e quais cores ou estilos a criança prefere.</p>
      <div class="aluno-lista-grid">
        <label class="aluno-lista-field">
          <span class="le-desk">Nome da criança/aluno</span><span class="le-mob">Nome</span> <span class="campo-req" aria-hidden="true">*</span>
          <input id="aluno-nome" type="text" value="${esc(a.nome)}" placeholder="Ex: Pedro, Ana, Lucas" />
        </label>
        <label class="aluno-lista-field">
          <span class="le-desk">Preferência de cores, personagens ou estilo</span><span class="le-mob">O que ela gosta?</span> <span class="campo-req" aria-hidden="true">*</span>
          <input id="aluno-cor" type="text" value="${esc(a.preferenciaCor)}" placeholder="${mob ? 'Ex: azul, sem personagem, qualquer cor' : 'Ex: azul, rosa, tons claros, sem personagem, qualquer cor'}" />
          <span class="campo-dica"><span class="le-desk">Ajuda a equipe a separar opções sem assumir preferência. Pode escrever "qualquer cor" se não tiver preferência.</span><span class="le-mob">Cor, personagem ou estilo. Se não tiver preferência, escreva "qualquer cor".</span></span>
        </label>
        <label class="aluno-lista-field aluno-lista-field-full">
          <span class="le-desk">Observações adicionais</span><span class="le-mob">Alguma observação? <span class="campo-opcional">Opcional</span></span>
          <input id="aluno-obs" type="text" value="${esc(a.observacoes)}" placeholder="${mob ? 'Ex: evitar personagens' : 'Ex: evitar personagens, pode ser qualquer estampa, preferência por tons claros'}" />
        </label>
      </div>
    </div>
  `;
  document.getElementById('aluno-nome').addEventListener('input', e => { estado.rascunho.aluno.nome = e.target.value; ocultarErroAluno(); atualizarPendentes(); atualizarLinkEnviar(); });
  document.getElementById('aluno-cor').addEventListener('input',  e => { estado.rascunho.aluno.preferenciaCor = e.target.value; ocultarErroAluno(); atualizarPendentes(); atualizarLinkEnviar(); });
  document.getElementById('aluno-obs').addEventListener('input',  e => { estado.rascunho.aluno.observacoes = e.target.value; atualizarLinkEnviar(); });
  reiniciarPendentes(); // novo render (outra lista ou novo resultado): recomeça sem aviso
}

function renderizarPreferenciaGeral() {
  const bloco = document.getElementById('bloco-preferencia');
  if (!bloco) return;
  bloco.innerHTML = `
    <div class="preferencia-orcamento">
      <p class="preferencia-titulo"><span class="le-desk">Preferência para o orçamento</span><span class="le-mob">Critério do orçamento</span></p>
      <p class="preferencia-desc">Escolha como a equipe deve priorizar marcas e opções ao montar seu orçamento. A disponibilidade, marcas/modelos e valores são confirmados pelo WhatsApp.</p>
      <div class="preferencia-options">
        ${PREFERENCIAS_GERAL.map(p => `
        <button class="preferencia-option${estado.rascunho.preferenciaGeral === p.id ? ' ativo' : ''}" type="button" data-pref="${p.id}" aria-pressed="${estado.rascunho.preferenciaGeral === p.id}">
          <strong><span class="le-desk">${esc(p.label)}</span><span class="le-mob">${esc(p.labelMob)}</span></strong>
          <span class="pref-desc"><span class="le-desk">${esc(p.desc)}</span><span class="le-mob">${esc(p.descMob)}</span></span>
        </button>`).join('')}
      </div>
    </div>
  `;
  bloco.querySelectorAll('.preferencia-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const mudou = estado.rascunho.preferenciaGeral !== btn.dataset.pref;
      estado.rascunho.preferenciaGeral = btn.dataset.pref;
      bloco.querySelectorAll('.preferencia-option').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      atualizarLinkEnviar();
      if (mudou) trackEvent('school_list_budget_preference_change', { preference: btn.dataset.pref, list_number: estado.rascunho.num });
    });
  });
}

function resumoMetadados(m) {
  const detalhe = [m.anoSerie, m.segmento, m.anoLetivo].map(v => (v || '').trim()).filter(Boolean).join(' · ');
  return {
    escola: (m.escola || '').trim() || 'Escola não identificada',
    detalhe: detalhe || 'Série, segmento e ano letivo não identificados',
  };
}

function renderizarMetadados() {
  const bloco = document.getElementById('bloco-metadados');
  if (!bloco) return;
  const m = estado.rascunho.metadados;
  const nadaIdentificado = !['escola', 'anoSerie', 'segmento', 'anoLetivo'].some(c => (m[c] || '').trim());
  const r = resumoMetadados(m);
  // No mobile os campos só aparecem ao tocar em "Editar" (ou se a IA não identificou nada). No desktop ficam sempre visíveis.
  bloco.innerHTML = `
    <div class="meta-lista${nadaIdentificado ? ' editando' : ''}">
      <p class="meta-lista-titulo">Dados identificados na lista</p>
      <div class="meta-resumo">
        <div class="meta-resumo-txt">
          <strong id="meta-resumo-escola">${esc(r.escola)}</strong>
          <span id="meta-resumo-detalhe">${esc(r.detalhe)}</span>
        </div>
        <button type="button" class="meta-editar" id="meta-editar" aria-expanded="${nadaIdentificado}" aria-controls="meta-campos">${nadaIdentificado ? 'Concluir' : 'Editar'}</button>
      </div>
      <div class="meta-lista-campos" id="meta-campos">
        <label>Escola<input id="meta-escola"    value="${esc(m.escola)}"    placeholder="Não identificado" /></label>
        <label>Ano / Série<input id="meta-anoSerie"  value="${esc(m.anoSerie)}"  placeholder="Não identificado" /></label>
        <label>Segmento<input id="meta-segmento"  value="${esc(m.segmento)}"  placeholder="Não identificado" /></label>
        <label>Ano letivo<input id="meta-anoLetivo" value="${esc(m.anoLetivo)}" placeholder="Não identificado" /></label>
      </div>
      <p class="meta-lista-dica">Confira se os dados estão corretos. Eles ajudam a equipe da Sartec a localizar a lista certa e confirmar o orçamento.</p>
    </div>
  `;
  const caixa = bloco.querySelector('.meta-lista');
  const btnEditar = document.getElementById('meta-editar');
  btnEditar.addEventListener('click', () => {
    const abrir = !caixa.classList.contains('editando');
    caixa.classList.toggle('editando', abrir);
    btnEditar.setAttribute('aria-expanded', String(abrir));
    btnEditar.textContent = abrir ? 'Concluir' : 'Editar';
    if (abrir) document.getElementById('meta-escola').focus();
  });
  ['escola', 'anoSerie', 'segmento', 'anoLetivo'].forEach(campo => {
    document.getElementById(`meta-${campo}`).addEventListener('input', (e) => {
      estado.rascunho.metadados[campo] = e.target.value;
      const novo = resumoMetadados(estado.rascunho.metadados);
      document.getElementById('meta-resumo-escola').textContent = novo.escola;
      document.getElementById('meta-resumo-detalhe').textContent = novo.detalhe;
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
    const marcaSugerida = (it.marcaSugerida || '').trim();
    const temPref = (it.preferenciaCliente || '').trim() !== '';
    return `
    <div class="item-card ${it.incluso ? '' : 'excluido'}" data-id="${it.id}">
      <div class="item-info">
        <h4>${esc(it.nome)}</h4>
        ${it.obs ? `<div class="obs">${esc(it.obs)}</div>` : ''}
      </div>
      ${marcaSugerida ? `<p class="marca-sugerida">Sugestão da escola: <strong>${esc(marcaSugerida)}</strong></p>` : ''}
      <div class="item-extras">
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
      </div>
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
      btn.addEventListener('click', () => {
        item.incluso = btn.dataset.acao === 'incluir';
        atualizarUI();
        trackEvent('school_list_item_toggle', { action: btn.dataset.acao, item_id: item.id });
      });
    });

    card.querySelectorAll('.qty-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.acao === 'mais') item.qty += 1;
        else item.qty = Math.max(1, item.qty - 1);
        atualizarUI();
        trackEvent('school_list_quantity_change', { action: b.dataset.acao, item_id: item.id, quantity: item.qty });
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

    // Só metadados: nunca o texto digitado
    input.addEventListener('change', () => {
      trackEvent('school_list_item_preference_change', {
        item_id: item.id,
        action: input.value.trim() ? 'set' : 'clear',
        list_number: estado.rascunho.num,
      });
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
  const barraItens = document.getElementById('le-barra-itens');
  if (barraItens) barraItens.textContent = `${inclusos.length} ${inclusos.length === 1 ? 'item' : 'itens'}`;
  if (btnMarcarTodosTem) btnMarcarTodosTem.textContent = inclusos.length > 0 ? 'Marcar todos como "Não quero"' : 'Marcar todos como "Quero comprar"';
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

  const arquivosNomes = lista.arquivoNome
    ? lista.arquivoNome.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const meta = [
    m.escola    ? `Escola: ${m.escola}`           : null,
    m.anoSerie  ? `Ano/Série: ${m.anoSerie}`      : null,
    m.segmento  ? `Segmento: ${m.segmento}`       : null,
    m.anoLetivo ? `Ano letivo: ${m.anoLetivo}`    : null,
    arquivosNomes.length > 1 ? `Arquivos: ${arquivosNomes.join(', ')}` : null,
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
  atualizarUI(); // atualizarContadores() já deixa o rótulo coerente com o estado novo
  trackEvent('school_list_mark_all_toggle', { new_state: algumIncluso ? 'nao_quero' : 'quero' });
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
  trackEvent('school_list_add_list', { list_number: nextListNum, lists_count: estado.listas.length });

  limparArquivos();

  trocarEstado('estado-upload');
  const alvo = document.getElementById('listas-container');
  scrollPara(alvo && alvo.children.length ? alvo : document.getElementById('estado-upload'), 'start');
});

// =============== MODAL "LIMPAR PEDIDO" (no lugar do confirm nativo) ===============
const modalLimpar = document.getElementById('le-modal-limpar');
const modalCancelar = document.getElementById('le-modal-cancelar');
const modalConfirmar = document.getElementById('le-modal-confirmar');
let modalOpener = null;

function abrirModalLimpar(opener) {
  if (!modalLimpar) return;
  modalOpener = opener || document.activeElement;
  modalLimpar.hidden = false;
  document.body.classList.add('le-modal-aberto');
  modalCancelar.focus();
}

function fecharModalLimpar() {
  if (!modalLimpar) return;
  modalLimpar.hidden = true;
  document.body.classList.remove('le-modal-aberto');
  const opener = modalOpener;
  modalOpener = null;
  if (opener && document.contains(opener) && opener.offsetParent !== null) opener.focus();
}

if (modalLimpar) {
  modalLimpar.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-fechar-modal')) fecharModalLimpar();
  });
  modalCancelar.addEventListener('click', fecharModalLimpar);
  modalConfirmar.addEventListener('click', () => {
    modalOpener = null; // o fluxo reinicia no upload; não devolve o foco ao botão que some
    fecharModalLimpar();
    limparTudoERecomecar();
  });
  document.addEventListener('keydown', (e) => {
    if (modalLimpar.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); fecharModalLimpar(); return; }
    if (e.key === 'Tab') {
      const foco = [modalCancelar, modalConfirmar];
      const i = foco.indexOf(document.activeElement);
      if (i === -1 || (e.shiftKey && i === 0)) { e.preventDefault(); foco[e.shiftKey ? 1 : 0].focus(); }
      else if (!e.shiftKey && i === foco.length - 1) { e.preventDefault(); foco[0].focus(); }
    }
  });
}

btnLimpar.addEventListener('click', () => abrirModalLimpar(btnLimpar));

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
  btnLimparSalvo.addEventListener('click', () => abrirModalLimpar(btnLimparSalvo));
}

// =============== AVISO LEVE DE PENDÊNCIAS: gatilhos ===============
(function iniciarGatilhosPendentes() {
  const etapa2 = document.getElementById('le-etapa-2');
  if (etapa2) {
    etapa2.addEventListener('focusout', (e) => {
      if (e.relatedTarget && !etapa2.contains(e.relatedTarget)) sinalizarPendentes();
    });
  }
  document.querySelectorAll('.le-etapas a[href="#le-etapa-3"], .le-etapas a[href="#le-etapa-4"]').forEach(a => {
    a.addEventListener('click', sinalizarPendentes);
  });
  const etapa3 = document.getElementById('le-etapa-3');
  if (etapa3 && 'IntersectionObserver' in window) {
    new IntersectionObserver((entradas) => {
      if (entradas.some(en => en.isIntersecting)) sinalizarPendentes();
    }, { threshold: 0.25 }).observe(etapa3);
  }
})();

// =============== ORIENTAÇÃO MOBILE (passo atual + barra compacta) ===============
// Só orienta: não bloqueia etapas nem marca conclusão. No desktop o CSS esconde tudo isto.
function iniciarOrientacaoMobile() {
  const ids = ['le-etapa-1', 'le-etapa-2', 'le-etapa-3', 'le-etapa-4'];
  const NOMES = ['Conferir a lista', 'Dados da criança', 'Materiais', 'Enviar'];
  const texto = document.getElementById('le-passo-atual');
  const links = Array.from(document.querySelectorAll('.le-etapas a'));
  const barra = document.getElementById('le-barra');
  const btnContinuar = document.getElementById('btn-continuar');
  const acoes = document.querySelector('.acoes-finais');
  const mq = window.matchMedia('(max-width: 640px)');
  let passo = -1;
  let agendado = false;

  function atualizar() {
    agendado = false;
    if (!mq.matches || document.body.dataset.leEstado !== 'resultado') return;

    // Passo atual = última etapa cujo topo já passou de ~40% da altura da tela
    const linha = window.innerHeight * 0.4;
    let atual = 0;
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= linha) atual = i;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) atual = ids.length - 1;

    if (atual !== passo) {
      passo = atual;
      if (texto) texto.textContent = `Passo ${atual + 1} de 4 · ${NOMES[atual]}`;
      links.forEach((a, i) => {
        if (i === atual) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
      });
    }

    // A barra compacta some quando o CTA completo (etapa 4) já está na tela
    const ctaVisivel = acoes && acoes.getBoundingClientRect().top < window.innerHeight - 8;
    if (barra) barra.classList.toggle('visivel', !ctaVisivel);
  }

  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(atualizar);
  }
  window.addEventListener('scroll', agendar, { passive: true });
  window.addEventListener('resize', agendar);
  if (mq.addEventListener) mq.addEventListener('change', agendar);
  window.atualizarOrientacaoMobile = agendar;

  // Teclado aberto: a barra sairia da frente do campo que a pessoa está preenchendo
  const campoDeTexto = (el) => el && el.matches && el.matches('input, textarea');
  document.addEventListener('focusin', (e) => {
    if (campoDeTexto(e.target) && e.target.closest('#estado-resultado')) document.body.classList.add('le-digitando');
  });
  document.addEventListener('focusout', (e) => {
    if (!campoDeTexto(e.relatedTarget)) document.body.classList.remove('le-digitando');
  });

  if (btnContinuar) {
    btnContinuar.addEventListener('click', () => {
      sinalizarPendentes(); // mesmo gatilho do passo 4 na navegação
      const etapa4 = document.getElementById('le-etapa-4');
      const jaNoEnvio = etapa4 && etapa4.getBoundingClientRect().top < 140;
      // Já no passo 4 (CTA ainda abaixo da dobra): leva até o botão de envio
      scrollPara(jaNoEnvio ? acoes : etapa4, jaNoEnvio ? 'end' : 'start');
      trackEvent('school_list_continue_to_send', { items_included: estado.rascunho.itens.filter(x => x.incluso).length });
    });
  }
}
iniciarOrientacaoMobile();

// =============== FAB x CTA DE ANÁLISE (só esta página) ===============
// O botão flutuante global do WhatsApp encostava no "Analisar". Enquanto o formulário de upload está visível,
// a classe abaixo o esconde no mobile (CSS). Fora dele, o FAB segue como nas outras páginas.
(function observarFormularioUpload() {
  const card = document.querySelector('#estado-upload .form-card');
  if (!card || !('IntersectionObserver' in window)) return;
  new IntersectionObserver((entradas) => {
    document.body.classList.toggle('le-fab-oculto', entradas.some(en => en.isIntersecting));
  }).observe(card);
})();

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
  trackEvent('school_list_restore', { lists_count: estado.listas.length + (temRascunho ? 1 : 0), has_draft: temRascunho });
})();
