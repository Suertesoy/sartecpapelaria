# Sartec Papelaria

Site público da Sartec Papelaria.

Nova experiência digital para lista escolar, produtos, empresas, escolas parceiras, cópias e impressão.

Projeto em HTML, CSS e JavaScript puro.

## Analytics e métricas

O site tem uma camada de tracking própria em `assets/app.js`, pensada para funcionar com ou sem
ferramenta de analytics instalada — nunca lança erro no console se GA4, Microsoft Clarity ou Vercel
Analytics não estiverem presentes.

### Ferramentas previstas

- **Google Analytics 4 (GA4)** — via `window.gtag`. Placeholder de onde colar o script oficial:
  `<!-- GA4: inserir script oficial do Google Analytics aqui -->`, logo no `<head>` de cada página.
- **Microsoft Clarity** — via `<!-- Microsoft Clarity: inserir script oficial do projeto aqui -->`,
  no mesmo local. Nenhum ID foi inventado; os scripts reais devem ser colados manualmente quando as
  contas existirem.
- **Vercel Analytics** — suportado nativamente por `trackEvent` (`window.va`), caso o pacote
  `@vercel/analytics` seja adicionado ao projeto no futuro.

### Como funciona

Toda métrica passa por `trackEvent(nome, params)`, em `assets/app.js`. Essa função:
- envia o evento para `window.gtag` (GA4) e para `window.va` (Vercel Analytics) quando existirem;
- nunca lança erro se nenhuma ferramenta estiver carregada (cada chamada é protegida por `try/catch`);
- sempre inclui `page_path`, `page_title` e `origin_page` automaticamente.

Funções auxiliares disponíveis globalmente: `trackWhatsappClick`, `trackCtaClick`, `trackFaqOpen`,
`trackExternalClick`.

### Eventos principais

| Evento | Onde dispara | Principais parâmetros |
|---|---|---|
| `whatsapp_click` | Qualquer link `wa.me` do site (header, hero, footer, FAB, faixas) | `event_label` (`whatsapp_principal`/`whatsapp_copias`), `target_url` |
| `cta_click` | Cliques em links para `lista-escolar.html`, `produtos.html`, `empresas.html`, `escolas.html`, `copias.html` | `event_label` (ex.: `cta_lista_escolar`) |
| `external_click` | Cliques em Google Maps, Waze e Sartec Digital | `event_label` (`maps`/`waze`/`sartec_digital`) |
| `faq_open` | Abertura de um `<details class="faq-item">` (Cópias, Escolas) | `question_text` |
| `page_engagement_time` | Saída da página (`visibilitychange`/`pagehide`), só se ≥ 3s | `engagement_seconds` |
| `scroll_depth` | Marcos de 25/50/75/90% de rolagem, uma vez por página | `percent` |
| `product_category_filter` | Clique nas categorias da vitrine (`produtos.html`) | `category` |
| `product_whatsapp_click` | Clique em "Consultar no WhatsApp" de um produto | `product_name`, `category` |
| `company_register_cta_click` | Clique em "Cadastrar minha empresa" (`empresas.html`) | — |
| `company_form_attempt` | Clique em "Enviar cadastro pelo WhatsApp" | — |
| `company_form_error` | Validação do formulário de empresa falhou | `missing_fields` (nomes dos campos, nunca valores) |
| `company_form_submit_whatsapp` | Formulário de empresa validado e enviado | `need_type` (opção selecionada) |
| `school_list_upload_file_selected` | Arquivo(s) selecionado(s) na lista escolar | `file_count` |
| `school_list_form_attempt` / `_error` | Tentativa de enviar o formulário de upload / erro de validação | `reason` (nunca o valor digitado) |
| `school_list_analysis_started` / `_completed` | Início e fim da análise da lista (IA) | `file_count` / `item_count` |
| `school_list_item_toggle` | Marcar item como "Quero"/"Não quero" | `action`, `item_id` |
| `school_list_quantity_change` | Alterar quantidade de um item | `action`, `item_id`, `quantity` |
| `school_list_mark_all_toggle` | Botão "Marcar todos" | `new_state` |
| `school_list_restart` | Botão "Limpar pedido" / recomeçar | — |
| `school_list_submit_whatsapp` | Envio final da lista pelo WhatsApp | `lists_count`, `items_included`, `items_excluded`, `items_total` |

### O que NÃO é coletado (privacidade)

- Nome, telefone/WhatsApp ou e-mail digitado em qualquer formulário.
- Nome de arquivos enviados (lista escolar) — apenas a contagem (`file_count`).
- CNPJ ou razão social da empresa.
- Conteúdo de mensagens enviadas para o WhatsApp.
- Qualquer valor digitado em campo de texto — nos eventos de erro, só o **nome do campo** que faltou
  é enviado, nunca o que foi (ou deixou de ser) digitado nele.

### Como validar no console

Abra o site, abra o console do navegador e rode:

```js
trackEvent('test_event', { debug: true })
```

Não deve haver nenhum erro (mesmo sem GA4/Clarity instalados). Para ver o payload de cada evento
disparado automaticamente pelo site (cliques, scroll, etc.), ative o modo debug antes de navegar:

```js
window.SARTEC_DEBUG_ANALYTICS = true
```

e observe os logs `[Sartec Analytics] nome_do_evento {...}` no console.

### Métricas para acompanhar nos primeiros 30 dias

1. **Acessos e engajamento por página** — `page_path` + `page_engagement_time`, para saber quais
   páginas retêm mais atenção.
2. **Taxa de clique em WhatsApp por página** — `whatsapp_click` cruzado com `origin_page`, principal
   indicador de intenção de compra/contato.
3. **Conversão da lista escolar** — proporção entre `school_list_upload_file_selected` →
   `school_list_analysis_completed` → `school_list_submit_whatsapp` (funil de uso da ferramenta).
4. **Erros de formulário** — volume de `school_list_form_error` e `company_form_error`, para
   identificar pontos de atrito antes do envio.
5. **Profundidade de leitura** — `scroll_depth` (75%/90%) nas páginas de Produtos, Empresas e
   Cópias, para saber se o conteúdo abaixo da dobra está sendo visto.
6. **Cliques em categorias de produtos** — `product_category_filter`, para entender quais
   categorias têm mais interesse antes da vitrine final estar pronta.
