/* ======================================================
   SARTEC — Catálogo — Matriz de categorias relacionadas
   Usada em "Continue explorando", ao final da grade de uma
   categoria — liga áreas próximas da papelaria sem afirmar
   comportamento de outros clientes.
   ====================================================== */

export const relatedCategories = {
  'cadernos-agendas-fichario': [
    'canetas-lapis-marcadores',
    'mochilas-estojos-lancheiras',
    'acessorios-escolares-geometria',
    'organizacao-escritorio',
  ],

  'canetas-lapis-marcadores': [
    'cadernos-agendas-fichario',
    'papeis-eva-materiais',
    'arte-pintura-artesanato',
    'organizacao-escritorio',
  ],

  'papeis-eva-materiais': [
    'colas-fitas-adesivos-correcao',
    'arte-pintura-artesanato',
    'acessorios-escolares-geometria',
    'organizacao-escritorio',
  ],

  'colas-fitas-adesivos-correcao': [
    'papeis-eva-materiais',
    'arte-pintura-artesanato',
    'presentes-festas-embalagens',
    'acessorios-escolares-geometria',
  ],

  'arte-pintura-artesanato': [
    'papeis-eva-materiais',
    'colas-fitas-adesivos-correcao',
    'livros-atividades',
    'acessorios-escolares-geometria',
  ],

  'acessorios-escolares-geometria': [
    'cadernos-agendas-fichario',
    'canetas-lapis-marcadores',
    'papeis-eva-materiais',
    'mochilas-estojos-lancheiras',
  ],

  'organizacao-escritorio': [
    'papeis-eva-materiais',
    'canetas-lapis-marcadores',
    'tecnologia-impressao-eletronicos',
    'colas-fitas-adesivos-correcao',
  ],

  'mochilas-estojos-lancheiras': [
    'cadernos-agendas-fichario',
    'canetas-lapis-marcadores',
    'acessorios-escolares-geometria',
    'livros-atividades',
  ],

  'livros-atividades': [
    'canetas-lapis-marcadores',
    'arte-pintura-artesanato',
    'papeis-eva-materiais',
    'acessorios-escolares-geometria',
  ],

  'presentes-festas-embalagens': [
    'colas-fitas-adesivos-correcao',
    'papeis-eva-materiais',
    'arte-pintura-artesanato',
    'livros-atividades',
  ],

  'tecnologia-impressao-eletronicos': [
    'organizacao-escritorio',
    'papeis-eva-materiais',
    'canetas-lapis-marcadores',
    'acessorios-escolares-geometria',
  ],
};

export function getRelatedCategoryIds(categoryId, limit = 4) {
  return (relatedCategories[categoryId] || []).slice(0, limit);
}
