/* ======================================================
   SARTEC — Catálogo — Matriz de itens relacionados
   Chave: tag "conceito" presente em item.tags.
   Valor: lista de tags "conceito" relacionadas, em ordem
   de prioridade (acessório necessário > mesma atividade >
   complemento de outra categoria > descoberta).
   Itens sem entrada aqui recebem sugestões por tags em
   comum (fallback), conforme catalog-data.js.
   ====================================================== */

export const RELATED_ITEMS_MATRIX = {
  caderno: ['caneta_esferografica', 'lapis_grafite', 'borracha', 'etiqueta_escolar'],
  agenda: ['caneta_gel', 'marca_texto', 'bloco_adesivo', 'caneta_tecnica'],
  fichario: ['refil_fichario', 'acessorios_fichario', 'caneta_esferografica', 'pasta_l'],

  caneta_esferografica: ['caderno', 'papel_sulfite', 'corretivo', 'estojo_escolar'],
  lapis_grafite: ['borracha', 'apontador', 'caderno', 'regua'],
  lapis_de_cor: ['apontador', 'livro_para_colorir', 'bloco_desenho', 'estojo_escolar'],
  lapiseira: ['grafite_lapiseira', 'borracha', 'caderno', 'regua'],
  marcador_quadro_branco: ['quadro_branco', 'apagador_quadro', 'refil_marcador_quadro', 'ima'],

  papel_sulfite: ['pasta_l', 'clips', 'grampeador', 'envelope'],
  cartolina: ['cola_bastao', 'cola_branca', 'tesoura', 'regua'],
  bloco_desenho: ['lapis_de_cor', 'caneta_hidrografica', 'tinta_guache', 'pincel_artistico'],
  eva: ['cola_eva_isopor', 'tesoura', 'glitter', 'palitos_hastes'],
  plastico_adesivo: ['tesoura', 'estilete', 'regua', 'plastico_encapar'],

  cola_bastao: ['cartolina', 'papel_colorido', 'tesoura', 'livro_atividades'],
  cola_branca: ['cartolina', 'papel_colorido', 'pincel_artistico', 'palitos_hastes'],
  cola_quente: ['eva', 'feltro', 'palitos_hastes', 'enfeites_artesanato'],
  fita_embalagem: ['caixa_embalagem', 'plastico_bolha', 'etiqueta', 'marcador_permanente'],

  tinta_guache: ['pincel_artistico', 'bloco_desenho', 'avental', 'acessorios_pintura'],
  tinta_tecido: ['pincel_artistico', 'stencil', 'avental', 'verniz'],
  tela_pintura: ['tinta_acrilica', 'pincel_artistico', 'cavalete', 'verniz'],
  massa_modelar: ['palitos_hastes', 'avental', 'kit_modelagem'],

  tesoura: ['cola_bastao', 'cartolina', 'eva', 'regua'],
  regua: ['lapis_grafite', 'caderno', 'esquadro', 'compasso'],
  pasta_elastico: ['etiqueta', 'papel_sulfite', 'clips', 'envelope'],
  grampeador: ['grampo', 'clips', 'perfurador', 'pasta_catalogo'],
  quadro_branco: ['marcador_quadro_branco', 'apagador_quadro', 'refil_marcador_quadro', 'ima'],

  mochila_escolar: ['estojo_escolar', 'caderno', 'lancheira', 'garrafa'],
  estojo_escolar: ['caneta_esferografica', 'lapis_grafite', 'borracha', 'apontador'],
  lancheira: ['garrafa', 'mochila_escolar', 'etiqueta_escolar'],

  livro_para_colorir: ['lapis_de_cor', 'giz_de_cera', 'caneta_hidrografica', 'apontador'],

  caixa_presente: ['papel_presente', 'fita_decorativa', 'laco', 'cartao_mensagem'],
  sacola_presente: ['papel_seda', 'fita_decorativa', 'cartao_mensagem', 'adesivo_decorativo'],

  cartucho: ['papel_sulfite', 'etiqueta_impressao', 'envelope', 'pasta_l'],
  toner: ['papel_sulfite', 'etiqueta_impressao', 'envelope', 'pasta_l'],
};
