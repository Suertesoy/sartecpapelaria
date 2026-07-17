/* ======================================================
   SARTEC — Catálogo — Gaveta de personalização e item manual
   Um único formulário reutilizável por perfil de atributos
   (seção 11 do briefing) — nada obrigatório além da
   quantidade, sempre com "Sem preferência" como padrão.
   ====================================================== */

import { getAttributeProfile } from './data/catalog-data.js';
import { addCustomItem, getItemCount, getTotalQuantity } from './catalog-list.js';
import { openDrawer, closeDrawer } from './catalog-drawer.js';
import { showToast } from './catalog-toast.js';
import { esc } from './catalog-utils.js';
import { renderFieldGrid, wireQtySteppers, collectFieldValues } from './catalog-fields.js';

/**
 * Abre a gaveta de personalização de um item do catálogo.
 * @param {import('./data/catalog-data.js').CatalogItem} item
 * @param {{ categoryId?: string, subcategoryId?: string, source?: string, onAdded?: (instanceId: string) => void }} [context]
 */
export function openPersonalizeDrawer(item, context = {}) {
  const profile = getAttributeProfile(item.attributeProfile);

  openDrawer({
    id: 'personalize-' + item.id,
    title: item.name,
    render(body) {
      body.innerHTML = `
        ${item.shortDescription ? `<p class="cat-drawer-desc">${esc(item.shortDescription)}</p>` : ''}
        <p class="cat-drawer-hint">Todos os campos abaixo são opcionais — deixe em branco ou "Sem preferência" se não tiver certeza. A equipe da Sartec confirma marcas, modelos e valores pelo WhatsApp.</p>
        <form class="cat-field-grid" id="cat-personalize-form">
          ${renderFieldGrid(profile)}
        </form>
        <div class="cat-drawer-actions">
          <button type="button" class="cat-drawer-btn-secondary" id="cat-personalize-cancel">Cancelar</button>
          <button type="submit" form="cat-personalize-form" class="cat-drawer-btn-primary">Adicionar à lista</button>
        </div>
      `;
      wireQtySteppers(body);
      body.querySelector('#cat-personalize-cancel').addEventListener('click', () => closeDrawer());
      body.querySelector('#cat-personalize-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const { attributes, notes, quantity } = collectFieldValues(body, profile);
        const instanceId = addCustomItem({ catalogItemId: item.id, name: item.name, quantity, attributes, notes });
        window.trackEvent?.('item_custom_add', {
          item_id: item.id,
          category_id: context.categoryId,
          subcategory_id: context.subcategoryId,
          source: context.source || 'card',
          list_item_count: getItemCount(),
          total_quantity: getTotalQuantity(),
        });
        closeDrawer();
        showToast(`${item.name} adicionado à lista.`);
        context.onAdded?.(instanceId);
      });
    },
  });
}

/**
 * Abre a gaveta de item adicionado manualmente.
 * @param {{ prefillName?: string, source?: string, onAdded?: (instanceId: string) => void }} [opts]
 */
export function openManualItemDrawer(opts = {}) {
  const { prefillName = '', source = 'manual_button' } = opts;

  openDrawer({
    id: 'manual-item',
    title: 'Adicionar item manualmente',
    render(body) {
      body.innerHTML = `
        <p class="cat-drawer-desc">Não encontrou o que procurava? Descreva o item — a equipe da Sartec confirma disponibilidade, marcas e valores pelo WhatsApp.</p>
        <form class="cat-field-grid" id="cat-manual-form" novalidate>
          <label class="cat-field cat-field-full">Nome do produto <span class="cat-field-req" aria-hidden="true">*</span>
            <input type="text" id="cat-manual-nome" value="${esc(prefillName)}" placeholder="Ex: Pasta azul com divisórias" aria-describedby="cat-manual-nome-erro" />
          </label>
          <p id="cat-manual-nome-erro" class="cat-field-erro" hidden>Informe o nome do produto.</p>
          <div class="cat-field cat-field-qty" data-field="quantidade">
            <span class="cat-field-label">Quantidade</span>
            <div class="cat-qty-stepper">
              <button type="button" class="cat-qty-btn" data-qty-action="menos" aria-label="Diminuir quantidade">−</button>
              <span class="cat-qty-value" data-qty-value>1</span>
              <button type="button" class="cat-qty-btn" data-qty-action="mais" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
          <label class="cat-field">Cor<input type="text" id="cat-manual-cor" /></label>
          <label class="cat-field">Tamanho ou especificação<input type="text" id="cat-manual-especificacao" /></label>
          <label class="cat-field cat-field-full">Observação<textarea id="cat-manual-obs" rows="2"></textarea></label>
        </form>
        <div class="cat-drawer-actions">
          <button type="button" class="cat-drawer-btn-secondary" id="cat-manual-cancel">Cancelar</button>
          <button type="submit" form="cat-manual-form" class="cat-drawer-btn-primary">Adicionar à lista</button>
        </div>
      `;
      wireQtySteppers(body);
      const nomeInput = body.querySelector('#cat-manual-nome');
      const nomeErro = body.querySelector('#cat-manual-nome-erro');

      body.querySelector('#cat-manual-cancel').addEventListener('click', () => closeDrawer());
      body.querySelector('#cat-manual-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = nomeInput.value.trim();
        if (!nome) {
          nomeErro.hidden = false;
          nomeInput.setAttribute('aria-invalid', 'true');
          nomeInput.focus();
          return;
        }
        nomeErro.hidden = true;
        nomeInput.removeAttribute('aria-invalid');

        const quantity = parseInt(body.querySelector('[data-qty-value]').textContent, 10) || 1;
        const cor = body.querySelector('#cat-manual-cor').value.trim();
        const especificacao = body.querySelector('#cat-manual-especificacao').value.trim();
        const notes = body.querySelector('#cat-manual-obs').value.trim();

        const instanceId = addCustomItem({ manual: true, name: nome, quantity, attributes: { cor, especificacao }, notes });
        window.trackEvent?.('manual_item_add', { source, list_item_count: getItemCount(), total_quantity: getTotalQuantity() });
        closeDrawer();
        showToast(`${nome} adicionado à lista.`);
        opts.onAdded?.(instanceId);
      });

      setTimeout(() => nomeInput.focus(), 50);
    },
  });
}
