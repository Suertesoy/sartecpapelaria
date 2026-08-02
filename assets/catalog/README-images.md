# Imagens do catálogo — estratégia

- **Fonte oficial**: `assets/catalog/images/<id-do-produto>.png` (2048×2048, RGBA transparente). Nunca editar, recomprimir ou apagar estes arquivos diretamente — são os assets fonte do catálogo. Metadados de geração ficam em `assets/catalog/images/manifest.json`.
- **Camada derivada (frontend)**: `assets/catalog/images/webp/<id-do-produto>.webp` (até 640×640, qualidade 82), gerada a partir dos PNGs via `node assets/catalog/generate-webp.mjs` (usa a devDependency `sharp`, não usada em runtime). Redução observada: ~203 MB → ~5 MB (~97%).
- **Renderização**: `cardMediaHtml()` em `catalog-app.js` usa `<picture>` com `<source type="image/webp">` apontando para a variante derivada e `<img>` apontando para o PNG original como fallback definitivo. O `onerror` do `<img>` continua sendo o único gatilho do estado de placeholder — se o navegador não tiver a fonte WebP disponível, ele cai para o `src` do `<img>` (PNG).
- **Associação produto → imagem**: por convenção de `id` (`item.id` do catálogo == nome do arquivo). Não há mapa manual; a cobertura é auditada contra `manifest.json` e o disco.

## Ao adicionar um novo produto/imagem

1. Colocar o PNG fonte em `assets/catalog/images/<id>.png` e registrar a entrada em `manifest.json`.
2. Rodar `node assets/catalog/generate-webp.mjs` para gerar a variante WebP correspondente.
3. Rodar `node assets/catalog/validate-catalog-images.mjs` para confirmar 0 pendências (produto sem imagem, referência quebrada, WebP faltando, órfã ou duplicada).
