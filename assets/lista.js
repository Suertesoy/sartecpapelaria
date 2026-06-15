/* ======================================================
   SARTEC — Ferramenta de lista escolar
   Chama /api/analisar-lista para leitura real com IA.
   ITENS_MOCK é usado apenas em localhost como fallback.
   ====================================================== */

const ITENS_MOCK = [
  { id: 'cad_universitario', nome: 'Caderno universitário 96 folhas', icon: '📓', qty: 4, obs: 'Capa dura', categoria: 'cadernos', confianca: 'alta' },
  { id: 'lapis_grafite', nome: 'Lápis grafite nº 2', icon: '✏️', qty: 6, obs: '', categoria: 'lápis', confianca: 'alta' },
  { id: 'borracha_branca', nome: 'Borracha branca', icon: '🧽', qty: 2, obs: 'Sem capa', categoria: 'borrachas', confianca: 'alta' },
  { id: 'apontador', nome: 'Apontador com depósito', icon: '🔻', qty: 1, obs: '', categoria: 'apontadores', confianca: 'alta' },
  { id: 'caneta_azul', nome: 'Caneta esferográfica azul', icon: '🖊️', qty: 4, obs: '', categoria: 'canetas', confianca: 'alta' },
  { id: 'caneta_preta', nome: 'Caneta esferográfica preta', icon: '🖋️', qty: 2, obs: '', categoria: 'canetas', confianca: 'alta' },
  { id: 'lapis_cor', nome: 'Caixa de lápis de cor', icon: '🎨', qty: 1, obs: '24 cores', categoria: 'artes', confianca: 'alta' },
  { id: 'canetinha', nome: 'Caixa de canetinha hidrocor', icon: '🖌️', qty: 1, obs: '12 cores', categoria: 'artes', confianca: 'alta' },
  { id: 'tesoura', nome: 'Tesoura sem ponta', icon: '✂️', qty: 1, obs: '', categoria: 'tesouras', confianca: 'alta' },
  { id: 'cola_bastao', nome: 'Cola bastão', icon: '🩹', qty: 2, obs: '', categoria: 'colas', confianca: 'alta' },
];

const LOADING_MSGS = [
  'Enviando lista para análise...',
  'A IA está lendo os itens...',
  'Identificando materiais escolares...',
  'Organizando os itens para você revisar...',
];

const LIMITE_BYTES = 4 * 1024 * 1024;

let estado = {
  nome: '',
  whatsapp: '',
  itens: [],
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
      estado.itens = dados.itens.map(it => ({ ...it, incluso: true }));
      renderizarResultado();
      trocarEstado('estado-resultado');
      return;
    }

    // API respondeu mas sem itens — fallback localhost ou erro ao usuário
    if (isLocal) {
      estado.itens = ITENS_MOCK.map(it => ({ ...it, incluso: true }));
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
      estado.itens = ITENS_MOCK.map(it => ({ ...it, incluso: true }));
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

function renderizarResultado() {
  grid.innerHTML = estado.itens.map(it => {
    const icone = it.icon || '📦';
    const busca = encodeURIComponent('material escolar ' + it.nome + (it.obs ? ' ' + it.obs : ''));
    return `
    <div class="item-card ${it.incluso ? '' : 'excluido'}" data-id="${it.id}">
      <div class="item-img">${icone}</div>
      <h4>${it.nome}</h4>
      <div class="obs">${it.obs || '&nbsp;'}</div>
      <a href="https://www.google.com/search?tbm=isch&q=${busca}" target="_blank" rel="noopener" class="item-img-buscar">O que é este item?</a>
      <div class="item-controls">
        <div class="qty-control">
          <button class="qty-btn" data-acao="menos" aria-label="Diminuir">−</button>
          <span class="qty-num">${it.qty}</span>
          <button class="qty-btn" data-acao="mais" aria-label="Aumentar">+</button>
        </div>
        <button class="toggle-incluir ${it.incluso ? 'sim' : 'nao'}">
          ${it.incluso ? '✓ Quero' : '✗ Já tenho'}
        </button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.item-card').forEach(card => {
    const id = card.dataset.id;
    const item = estado.itens.find(x => x.id === id);

    card.querySelector('.toggle-incluir').addEventListener('click', () => {
      item.incluso = !item.incluso;
      atualizarUI();
    });

    card.querySelectorAll('.qty-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.acao === 'mais') item.qty += 1;
        else item.qty = Math.max(1, item.qty - 1);
        atualizarUI();
      });
    });
  });

  atualizarContadores();
  atualizarLinkEnviar();
}

function atualizarUI() {
  grid.querySelectorAll('.item-card').forEach(card => {
    const id = card.dataset.id;
    const item = estado.itens.find(x => x.id === id);
    card.classList.toggle('excluido', !item.incluso);
    card.querySelector('.qty-num').textContent = item.qty;
    const tg = card.querySelector('.toggle-incluir');
    tg.className = `toggle-incluir ${item.incluso ? 'sim' : 'nao'}`;
    tg.textContent = item.incluso ? '✓ Quero' : '✗ Já tenho';
  });
  atualizarContadores();
  atualizarLinkEnviar();
}

function atualizarContadores() {
  const inclusos = estado.itens.filter(x => x.incluso);
  const excluidos = estado.itens.filter(x => !x.incluso);
  counterQuero.textContent = `${inclusos.length} ${inclusos.length === 1 ? 'item' : 'itens'}`;
  counterTem.textContent = `${excluidos.length} já tenho`;
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

  const linhasQuero = inclusos
    .map(x => `✅ ${x.qty}x ${x.nome}${x.obs ? ' (' + x.obs + ')' : ''}`)
    .join('\n');

  const linhasTem = excluidos.length > 0
    ? excluidos.map(x => `☑️ ${x.qty}x ${x.nome}${x.obs ? ' (' + x.obs + ')' : ''}`).join('\n')
    : '_Nenhum item marcado como já tenho._';

  const mensagem =
`Olá, Sartec! Sou *${estado.nome}*.

[SITE_LISTA_ESCOLAR]

*Lista escolar organizada pelo site*

*WhatsApp informado no site:*
${estado.whatsapp}

*Itens que quero comprar:*
${linhasQuero}

*Itens que já tenho em casa:*
${linhasTem}

Aguardo o orçamento e a confirmação de disponibilidade.

— Enviado pela ferramenta de lista escolar do site da Sartec`;

  btnEnviar.href = montarWpp(SARTEC.WPP_PRINCIPAL, mensagem);
}

btnMarcarTodosTem.addEventListener('click', () => {
  const algumIncluso = estado.itens.some(x => x.incluso);
  estado.itens.forEach(x => x.incluso = !algumIncluso);
  atualizarUI();
  btnMarcarTodosTem.textContent = algumIncluso
    ? 'Marcar todos como "Quero"'
    : 'Marcar todos como "Já tenho"';
});

btnRecomecar.addEventListener('click', () => {
  if (confirm('Recomeçar do zero? Sua seleção atual será perdida.')) {
    formUpload.reset();
    uploadLabel.textContent = 'Clique ou arraste sua lista aqui';
    trocarEstado('estado-upload');
  }
});
