# Sartec Papelaria

Site público da Sartec Papelaria.

Nova experiência digital para lista escolar, produtos, empresas, escolas parceiras, cópias e impressão.

Projeto em HTML, CSS e JavaScript puro.

## Analytics e métricas

O site tem uma camada de tracking própria em `assets/app.js`, pensada para funcionar com ou sem
ferramenta de analytics instalada — nunca lança erro no console se GA4, Microsoft Clarity ou Vercel
Analytics não estiverem presentes.

### Consentimento (LGPD) — `assets/consent.js`

Primeiro script de todas as páginas, síncrono. Google **Consent Mode v2, modo básico**:

- Tudo começa negado (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`).
  **Nenhuma tag de medição é baixada antes da escolha.**
- Banner com **Aceitar**, **Recusar** (mesmo peso visual) e **Personalizar** (Medição / Publicidade).
  Escolha salva em `localStorage` (`sartec_consent`) por 12 meses.
- Revogar/alterar: link **"Preferências de privacidade"** no rodapé (qualquer elemento com
  `data-abrir-privacidade`). Ao revogar: consentimento volta a `denied`, GA4 é desligado
  (`ga-disable-…`), PostHog faz opt-out e cookies/armazenamento de medição são apagados.
- Medição (GA4 + PostHog) depende da categoria "Medição"; sinais de anúncio do Google, da "Publicidade".

### Ferramentas

- **Google Analytics 4 (GA4)** `G-S5M2P2DX7L` — mesma instalação de antes (um único `config`), agora
  carregada por `consent.js` só após o aceite. Referência para aquisição e atribuição.
- **PostHog** — funis, usabilidade e erros. Desligado enquanto `POSTHOG_KEY` (em `consent.js`) estiver
  vazio, e só ativo nos domínios de produção (`PROD_HOSTS`): dados de teste nunca vão para produção.
  Sem autocapture, rage/dead clicks, heatmaps, exceções automáticas ou gravação de sessão
  (`REPLAY_ENABLED: false` até o mascaramento ser validado). Lista fechada de eventos/propriedades
  (`EVENTOS` em `consent.js`); `before_send` descarta o resto e remove query strings das URLs
  (mantém só `utm_*`, `gclid`/`gbraid`/`wbraid`, `categoria`, `subcategoria`).
- **CRM** — referência para pedidos recebidos e vendas. Nenhum evento do site é venda ou lead confirmado.
- **Vercel Analytics** — suportado por `trackEvent` (`window.va`), se o pacote for adicionado no futuro.

> **Ação pendente no painel do GA4:** a medição otimizada (cliques de saída) enviava o link completo
> do WhatsApp em `link_url`, incluindo `?text=` com nome, WhatsApp, nome da criança e escola.
> `consent.js` agora esconde a query do link durante o clique (testado), mas a correção definitiva é no
> GA4: **Admin → Fluxos de dados → Web → Redação de dados → redigir o parâmetro de consulta `text`**
> (ou desativar "Cliques de saída" na medição otimizada, já coberta por `whatsapp_click`).

### Como funciona

Toda métrica passa por `trackEvent(nome, params)`, em `assets/app.js`. Essa função:
- só envia algo se a pessoa autorizou a medição (`SartecConsent.analyticsPermitido()`);
- envia o evento para `window.gtag` (GA4), para o PostHog (filtrado pela lista fechada) e para
  `window.va` (Vercel Analytics) quando existirem;
- nunca lança erro se nenhuma ferramenta estiver carregada (cada chamada é protegida por `try/catch`);
- sempre inclui `page_path`, `page_title` e `origin_page` automaticamente.

Funções auxiliares disponíveis globalmente: `trackWhatsappClick`, `trackCtaClick`, `trackFaqOpen`,
`trackExternalClick`.

### Eventos principais

| Evento | Onde dispara | Principais parâmetros |
|---|---|---|
| `whatsapp_click` | Qualquer link `wa.me` do site (header, hero, footer, FAB, faixas) | `event_label` (`whatsapp_principal`/`whatsapp_copias`), `target_url` |
| `cta_click` | Cliques em links para `lista-escolar.html`, `produtos.html`, `empresas.html`, `escolas.html`, `copias.html` | `event_label` (ex.: `cta_lista_escolar`) |
| `external_click` | Cliques em Google Maps, Waze e L A Cabral | `event_label` (`maps`/`waze`/`la_cabral`) |
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
| `school_list_submit_whatsapp` | Clique em "Enviar lista" **aprovado na validação** (o WhatsApp abre; o site não sabe se a mensagem foi enviada — não é pedido recebido) | `lists_count`, `items_included`, `items_excluded`, `items_total` |
| `school_list_analysis_failed` | Análise não chegou à revisão | `error_type`: `preparo_arquivo`, `arquivo_grande_demais`, `criancas_diferentes`, `nenhum_item`, `erro_servidor`, `resposta_invalida`, `conexao`; `file_count` |
| `school_list_send_blocked` | Clique em "Enviar lista" barrado pela validação | `reason`: `nome_crianca_ausente`, `preferencia_ausente` |

A etapa de **revisão** começa no mesmo instante de `school_list_analysis_completed` (o estado
`estado-resultado` é aberto ali). Funil da lista: `analysis_started` → `analysis_completed` (revisão
aberta) → `submit_whatsapp`; atrito na revisão = `send_blocked`.

Testes: `node tests/analytics-consent.e2e.mjs` (consentimento, recusa, revogação, eventos, privacidade,
mobile; intercepta todo envio a GA4/PostHog — nada chega a produção) e `node tests/lista-escolar.e2e.mjs`.

### O que NÃO é coletado (privacidade)

- Nome, telefone/WhatsApp ou e-mail digitado em qualquer formulário.
- Nome de arquivos enviados (lista escolar) — apenas a contagem (`file_count`).
- CNPJ ou razão social da empresa.
- Conteúdo de mensagens enviadas para o WhatsApp (o `?text=` dos links `wa.me` fica oculto
  durante o clique; no GA4 o parâmetro `text` também é redigido no painel).
- Termo digitado na busca do catálogo: não vai para nenhuma ferramenta, nem fica na URL
  (o GA4 lê o endereço da página). Os eventos `catalog_search*` levam só `search_term_length` e
  `result_count`. O termo fica em `history.state`; `?q=` de links antigos é retirado da URL por
  `consent.js` antes de qualquer tag carregar.

### Recuperação (rollback seguro)

Deploys anteriores ao commit de consentimento (`feat/consentimento-lgpd`) enviavam ao GA4 o link do
WhatsApp com dados pessoais. **Não use "Instant Rollback" da Vercel para nenhum deploy anterior a
esse commit.** Em caso de problema:

1. **Rollback para um deploy seguro:** promova um deploy de produção que já contenha o
   `assets/consent.js` (todos a partir deste commit).
2. **Hotfix:** corrija em branch a partir da `main` atual e publique (nunca reverta o commit de
   consentimento inteiro).
3. **Chave de emergência do GA4:** em `assets/consent.js`, `GA4_ID: ''` desliga o GA4 por completo
   (nada é carregado, mesmo com aceite); o site continua funcionando normalmente. `POSTHOG_KEY: ''`
   faz o mesmo para o PostHog.
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
