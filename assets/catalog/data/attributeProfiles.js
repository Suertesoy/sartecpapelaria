/* ======================================================
   SARTEC — Catálogo — Perfis reutilizáveis de atributos
   Cada perfil define os campos exibidos na gaveta de
   personalização de um item. Nenhum campo além da
   quantidade tem valor obrigatório — todos os demais
   podem ficar em branco / "Sem preferência".
   ====================================================== */

/**
 * @typedef {Object} CatalogAttributeField
 * @property {string} id
 * @property {string} label
 * @property {'quantity'|'text'|'select'|'textarea'} type
 * @property {string} [placeholder]
 * @property {string[]} [options] — para type "select", primeira opção é o padrão ("Sem preferência")
 */

const SEM_PREFERENCIA = 'Sem preferência';

const QUALIDADE_OPTIONS = [SEM_PREFERENCIA, 'Mais econômica', 'Custo-benefício', 'Alta qualidade'];

/** Campo de quantidade — presente em todos os perfis, único com valor padrão. */
const QTY = { id: 'quantidade', label: 'Quantidade', type: 'quantity' };

/** @type {Record<string, { label: string, fields: CatalogAttributeField[] }>} */
export const ATTRIBUTE_PROFILES = {
  simples: {
    label: 'Simples',
    fields: [
      QTY,
      { id: 'preferenciaQualidade', label: 'Preferência de qualidade', type: 'select', options: QUALIDADE_OPTIONS },
      { id: 'observacao', label: 'Observação', type: 'textarea', placeholder: 'Alguma informação extra que ajude no orçamento' },
    ],
  },

  escrita: {
    label: 'Escrita',
    fields: [
      QTY,
      { id: 'cor', label: 'Cor', type: 'text', placeholder: 'Ex: azul, preta, sem preferência' },
      { id: 'espessuraPonta', label: 'Espessura da ponta', type: 'select', options: [SEM_PREFERENCIA, 'Fina', 'Média', 'Grossa'] },
      { id: 'espessuraGrafite', label: 'Espessura do grafite', type: 'select', options: [SEM_PREFERENCIA, '0.5mm', '0.7mm', '0.9mm', '2.0mm (bastão)'] },
      { id: 'unidadeConjunto', label: 'Unidade ou conjunto', type: 'select', options: [SEM_PREFERENCIA, 'Unidade', 'Conjunto', 'Caixa'] },
      { id: 'numeroCores', label: 'Número de cores', type: 'text', placeholder: 'Ex: 12 cores' },
      { id: 'finalidade', label: 'Finalidade', type: 'text', placeholder: 'Ex: escola, escritório, desenho' },
      { id: 'preferenciaQualidade', label: 'Preferência de qualidade', type: 'select', options: QUALIDADE_OPTIONS },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  cadernos: {
    label: 'Cadernos',
    fields: [
      QTY,
      { id: 'numeroMaterias', label: 'Número de matérias', type: 'text', placeholder: 'Ex: 10 matérias' },
      { id: 'numeroFolhas', label: 'Número aproximado de folhas', type: 'text', placeholder: 'Ex: 96 folhas' },
      { id: 'formato', label: 'Formato', type: 'select', options: [SEM_PREFERENCIA, 'Pequeno', 'Universitário', 'Grande'] },
      { id: 'tipoCapa', label: 'Tipo de capa', type: 'select', options: [SEM_PREFERENCIA, 'Capa dura', 'Capa flexível'] },
      { id: 'tipoEncadernacao', label: 'Tipo de encadernação', type: 'select', options: [SEM_PREFERENCIA, 'Costurado', 'Espiral', 'Brochura'] },
      { id: 'corTema', label: 'Cor ou tema', type: 'text', placeholder: 'Ex: azul, personagem, sem preferência' },
      { id: 'preferenciaQualidade', label: 'Preferência de qualidade', type: 'select', options: QUALIDADE_OPTIONS },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  papeis: {
    label: 'Papéis',
    fields: [
      QTY,
      { id: 'tamanho', label: 'Tamanho', type: 'text', placeholder: 'Ex: A4, A3, ofício' },
      { id: 'gramatura', label: 'Gramatura', type: 'text', placeholder: 'Ex: 75g, 180g, 250g' },
      { id: 'cor', label: 'Cor', type: 'text' },
      { id: 'acabamento', label: 'Acabamento', type: 'text', placeholder: 'Ex: fosco, brilhante, texturizado' },
      { id: 'formaVenda', label: 'Folha, bloco, pacote ou rolo', type: 'select', options: [SEM_PREFERENCIA, 'Folha avulsa', 'Bloco', 'Pacote', 'Rolo'] },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  colasFitas: {
    label: 'Colas e fitas',
    fields: [
      QTY,
      { id: 'volumePesoMetragem', label: 'Volume, peso ou metragem', type: 'text', placeholder: 'Ex: 40g, 90ml, 50m' },
      { id: 'aplicacao', label: 'Aplicação', type: 'text', placeholder: 'Ex: papel, embalagem, artesanato' },
      { id: 'superficieUso', label: 'Superfície de uso', type: 'text', placeholder: 'Ex: papel, madeira, tecido' },
      { id: 'largura', label: 'Largura', type: 'text' },
      { id: 'comprimento', label: 'Comprimento', type: 'text' },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  tintas: {
    label: 'Tintas',
    fields: [
      QTY,
      { id: 'cor', label: 'Cor', type: 'text' },
      { id: 'volume', label: 'Volume', type: 'text', placeholder: 'Ex: 15ml, 250ml' },
      { id: 'superficieAplicacao', label: 'Superfície de aplicação', type: 'text', placeholder: 'Ex: papel, tecido, tela' },
      { id: 'tecnica', label: 'Técnica', type: 'text', placeholder: 'Ex: pincel, esponja, spray' },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  organizacao: {
    label: 'Organização',
    fields: [
      QTY,
      { id: 'tamanho', label: 'Tamanho', type: 'text' },
      { id: 'cor', label: 'Cor', type: 'text' },
      { id: 'capacidade', label: 'Capacidade', type: 'text', placeholder: 'Ex: 200 folhas, 5L' },
      { id: 'formato', label: 'Formato', type: 'text' },
      { id: 'material', label: 'Material', type: 'text', placeholder: 'Ex: plástico, papelão, metal' },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  mochilas: {
    label: 'Mochilas',
    fields: [
      QTY,
      { id: 'tamanho', label: 'Tamanho', type: 'select', options: [SEM_PREFERENCIA, 'Pequena', 'Média', 'Grande'] },
      { id: 'corTema', label: 'Cor ou tema', type: 'text' },
      { id: 'faixaEtaria', label: 'Faixa etária', type: 'text', placeholder: 'Ex: infantil, adulto' },
      { id: 'numeroCompartimentos', label: 'Número de compartimentos', type: 'text' },
      { id: 'material', label: 'Material', type: 'text' },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  tecnologia: {
    label: 'Tecnologia',
    fields: [
      QTY,
      { id: 'equipamentoCompativel', label: 'Equipamento compatível', type: 'text', placeholder: 'Ex: notebook, impressora' },
      { id: 'marcaModeloEquipamento', label: 'Marca e modelo do equipamento', type: 'text' },
      { id: 'tipoConexao', label: 'Tipo de conexão', type: 'text', placeholder: 'Ex: USB, Bluetooth' },
      { id: 'referencia', label: 'Referência', type: 'text' },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  presentes: {
    label: 'Presentes',
    fields: [
      QTY,
      { id: 'tamanho', label: 'Tamanho', type: 'text' },
      { id: 'cor', label: 'Cor', type: 'text' },
      { id: 'tema', label: 'Tema', type: 'text' },
      { id: 'ocasiao', label: 'Ocasião', type: 'text', placeholder: 'Ex: aniversário, dia das mães' },
      { id: 'material', label: 'Material', type: 'text' },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },

  brinquedo: {
    label: 'Brinquedos',
    fields: [
      QTY,
      { id: 'tipoBrinquedo', label: 'Tipo de brinquedo', type: 'text', placeholder: 'Ex: quebra-cabeça, boneca, carrinho' },
      { id: 'faixaEtaria', label: 'Faixa etária', type: 'text', placeholder: 'Ex: 3 a 5 anos' },
      { id: 'tema', label: 'Tema', type: 'text' },
      { id: 'observacao', label: 'Observação', type: 'textarea' },
    ],
  },
};

export const ATTRIBUTE_PROFILE_IDS = Object.keys(ATTRIBUTE_PROFILES);

export function getAttributeProfile(profileId) {
  return ATTRIBUTE_PROFILES[profileId] || ATTRIBUTE_PROFILES.simples;
}
