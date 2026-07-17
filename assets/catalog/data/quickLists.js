/* ======================================================
   SARTEC — Catálogo — Listas rápidas (atalhos contextuais)
   itemTags: tags usadas para localizar itens candidatos no
   catálogo (o primeiro item ativo com a tag é usado).
   Ao abrir, o cliente escolhe o que quer — nada é
   adicionado automaticamente.
   ====================================================== */

export const QUICK_LISTS = [
  {
    id: 'volta_as_aulas',
    label: 'Volta às aulas',
    description: 'O essencial para começar o ano letivo bem equipado.',
    icon: '🎒',
    itemTags: ['caderno', 'lapis_grafite', 'borracha', 'apontador', 'caneta_esferografica', 'regua', 'estojo_escolar', 'mochila_escolar'],
  },
  {
    id: 'trabalho_escolar',
    label: 'Trabalho escolar',
    description: 'Cartolina, colas e itens de corte para trabalhos e cartazes.',
    icon: '✂️',
    itemTags: ['cartolina', 'papel_colorido', 'cola_bastao', 'cola_branca', 'tesoura', 'regua', 'caneta_hidrografica'],
  },
  {
    id: 'escritorio_essencial',
    label: 'Escritório essencial',
    description: 'Papel, canetas e organização básica para o dia a dia.',
    icon: '🗂️',
    itemTags: ['papel_sulfite', 'caneta_esferografica', 'clips', 'grampeador', 'grampo', 'pasta_elastico', 'envelope'],
  },
  {
    id: 'desenho_pintura',
    label: 'Desenho e pintura',
    description: 'Blocos, tintas e pincéis para quem gosta de criar.',
    icon: '🎨',
    itemTags: ['bloco_desenho', 'lapis_de_cor', 'tinta_guache', 'pincel_artistico', 'aquarela', 'avental'],
  },
  {
    id: 'embalagem_presente',
    label: 'Embalagem para presente',
    description: 'Caixas, papéis e fitas para deixar o presente pronto.',
    icon: '🎁',
    itemTags: ['caixa_presente', 'papel_presente', 'fita_decorativa', 'laco', 'cartao_mensagem', 'sacola_presente'],
  },
  {
    id: 'organizacao_documentos',
    label: 'Organização de documentos',
    description: 'Pastas, etiquetas e arquivos para manter tudo em ordem.',
    icon: '📁',
    itemTags: ['pasta_catalogo', 'pasta_elastico', 'pasta_l', 'clips', 'etiqueta', 'envelope', 'caixa_arquivo'],
  },
];
