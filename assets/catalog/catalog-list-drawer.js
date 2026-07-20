/* ======================================================
   SARTEC — Catálogo — "Minha lista" (gaveta + barra mobile)
   Edição, remoção, duplicação, reordenação, revisão e envio
   da lista para orçamento pelo WhatsApp.
   ====================================================== */

import {
  subscribe,
  getList,
  getItemCount,
  getTotalQuantity,
  quickAddItem,
  updateItem,
  removeItem,
  undoRemove,
  duplicateItem,
  reorderItems,
  clearList,
} from './catalog-list.js';
import { getItemById, getAttributeProfile, getRelatedItems } from './data/catalog-data.js';
import { openManualItemDrawer } from './catalog-item-drawer.js';
import { celebrateAdd } from './catalog-add-animation.js';
import { renderFieldGrid, wireQtySteppers, collectFieldValues } from './catalog-fields.js';
import { openDrawer, closeDrawer, isDrawerOpen, refreshDrawerBody } from './catalog-drawer.js';
import { showToast } from './catalog-toast.js';
import { buildQuoteMessage, buildQuoteWhatsappUrl } from './catalog-message.js';
import { esc } from './catalog-utils.js';

let reviewState = { generalNote: '', deliveryPreference: 'retirada' };
let expandedInstanceId = null;

function specLines(entry) {
  if (entry.manual) {
    const lines = [];
    if (entry.attributes?.categoria) lines.push(`Categoria: ${entry.attributes.categoria}`);
    if (entry.attributes?.cor) lines.push(`Cor: ${entry.attributes.cor}`);
    if (entry.attributes?.especificacao) lines.push(entry.attributes.especificacao);
    return lines;
  }
  const item = getItemById(entry.catalogItemId);
  if (!item) return [];
  const profile = getAttributeProfile(item.attributeProfile);
  const lines = [];
  profile.fields.forEach((field) => {
    if (field.type === 'quantity' || field.id === 'observacao') return;
    const valor = entry.attributes?.[field.id];
    if (!valor || valor === 'Sem preferência') return;
    lines.push(`${field.label}: ${valor}`);
  });
  return lines;
}

function renderRow(entry, index, total) {
  const specs = specLines(entry);
  const editing = expandedInstanceId === entry.instanceId;
  const item = entry.catalogItemId ? getItemById(entry.catalogItemId) : null;
  const isOrphan = !!entry.catalogItemId && !item;

  return `
    <li class="cat-list-row" data-instance-id="${esc(entry.instanceId)}">
      <div class="cat-list-row-main">
        <div class="cat-list-row-heading">
          <strong>${esc(entry.name)}</strong>
          ${entry.manual ? '<span class="cat-list-manual-badge">Adicionado manualmente</span>' : ''}
          ${isOrphan ? '<span class="cat-list-manual-badge cat-list-orphan-badge">Fora do catálogo atual</span>' : ''}
        </div>
        ${specs.length ? `<div class="cat-list-row-specs">${specs.map(esc).join(' · ')}</div>` : ''}
        ${entry.notes ? `<div class="cat-list-row-notes">Obs: ${esc(entry.notes)}</div>` : ''}
      </div>
      <div class="cat-list-row-controls">
        <div class="cat-qty-stepper">
          <button type="button" class="cat-qty-btn" data-action="qty-menos" aria-label="Diminuir quantidade de ${esc(entry.name)}">−</button>
          <span class="cat-qty-value" data-qty-value>${entry.quantity}</span>
          <button type="button" class="cat-qty-btn" data-action="qty-mais" aria-label="Aumentar quantidade de ${esc(entry.name)}">+</button>
        </div>
        <div class="cat-list-row-actions">
          <button type="button" class="cat-list-row-btn" data-action="edit">${editing ? 'Fechar edição' : 'Editar'}</button>
          <button type="button" class="cat-list-row-btn" data-action="duplicate">Duplicar</button>
          <button type="button" class="cat-list-row-btn cat-list-row-btn-danger" data-action="remove">Remover</button>
          <button type="button" class="cat-list-row-btn cat-list-row-icon" data-action="move-up" aria-label="Mover ${esc(entry.name)} para cima" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="cat-list-row-btn cat-list-row-icon" data-action="move-down" aria-label="Mover ${esc(entry.name)} para baixo" ${index === total - 1 ? 'disabled' : ''}>↓</button>
        </div>
      </div>
      ${editing ? `<div class="cat-list-row-edit">${renderEditForm(entry, item)}</div>` : ''}
    </li>
  `;
}

function renderEditForm(entry, item) {
  if (entry.manual) {
    return `
      <form class="cat-field-grid" data-edit-form>
        <label class="cat-field cat-field-full">Nome do produto<input type="text" data-field="name" value="${esc(entry.name)}" /></label>
        <label class="cat-field">Cor<input type="text" data-field="cor" value="${esc(entry.attributes?.cor || '')}" /></label>
        <label class="cat-field">Tamanho ou especificação<input type="text" data-field="especificacao" value="${esc(entry.attributes?.especificacao || '')}" /></label>
        <label class="cat-field cat-field-full">Observação<textarea data-field="notes" rows="2">${esc(entry.notes || '')}</textarea></label>
        <div class="cat-drawer-actions">
          <button type="submit" class="cat-drawer-btn-primary">Salvar alterações</button>
        </div>
      </form>
    `;
  }
  if (!item) {
    return `<p class="cat-drawer-hint">Este item não está mais no catálogo — você ainda pode editar nome e observações pelo botão "Remover" e adicionar manualmente.</p>`;
  }
  const profile = getAttributeProfile(item.attributeProfile);
  return `
    <form class="cat-field-grid" data-edit-form>
      ${renderFieldGrid(profile, { ...entry.attributes, observacao: entry.notes }, { skipQuantity: true })}
      <div class="cat-drawer-actions">
        <button type="submit" class="cat-drawer-btn-primary">Salvar alterações</button>
      </div>
    </form>
  `;
}

function complementaryItemsHtml(items) {
  const inListIds = new Set(items.map((it) => it.catalogItemId).filter(Boolean));
  const picked = [];
  const pickedIds = new Set();
  for (const entry of items) {
    if (picked.length >= 4) break;
    if (!entry.catalogItemId) continue;
    const item = getItemById(entry.catalogItemId);
    if (!item) continue;
    const related = getRelatedItems(item, new Set([...inListIds, ...pickedIds]), 4 - picked.length);
    related.forEach((r) => {
      if (!pickedIds.has(r.id)) {
        picked.push(r);
        pickedIds.add(r.id);
      }
    });
  }
  if (picked.length === 0) return '';
  return `
    <div class="cat-list-complementary">
      <p class="cat-suggestions-title">Talvez você também precise</p>
      <div class="cat-suggestions-grid">
        ${picked
          .map(
            (r) => `
          <div class="cat-suggestion-chip" data-item-id="${esc(r.id)}">
            <span>${esc(r.name)}</span>
            <button type="button" class="cat-suggestion-add" data-complementary-add="${esc(r.id)}">+ Adicionar</button>
          </div>`,
          )
          .join('')}
      </div>
    </div>
  `;
}

function reviewSummaryHtml(items) {
  const catalogCount = items.filter((it) => !it.manual).length;
  const manualCount = items.filter((it) => it.manual).length;
  const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);
  const partes = [
    `${catalogCount} ${catalogCount === 1 ? 'tipo de produto' : 'tipos de produto'}`,
    manualCount > 0 ? `${manualCount} ${manualCount === 1 ? 'item manual' : 'itens manuais'}` : null,
    `${totalQty} ${totalQty === 1 ? 'unidade no total' : 'unidades no total'}`,
  ].filter(Boolean);
  return partes.join(' · ');
}

function renderDrawerBody(body) {
  const items = getList();

  if (items.length === 0) {
    body.innerHTML = `
      <p class="cat-list-empty">Sua lista está vazia por enquanto. Explore as categorias e adicione os produtos que você procura.</p>
      <p class="cat-manual-inline"><button type="button" class="cat-link-btn" id="cat-list-open-manual">Não encontrou? Adicione outro item</button></p>
    `;
    body.querySelector('#cat-list-open-manual')?.addEventListener('click', () => {
      window.trackEvent?.('catalog_manual_item_open', { source: 'my_list_empty' });
      openManualItemDrawer({ source: 'my_list_empty' });
    });
    return;
  }

  body.innerHTML = `
    <ul class="cat-list-rows" id="cat-list-rows">
      ${items.map((entry, i) => renderRow(entry, i, items.length)).join('')}
    </ul>

    <p class="cat-manual-inline"><button type="button" class="cat-link-btn" id="cat-list-open-manual">Não encontrou? Adicione outro item</button></p>

    ${complementaryItemsHtml(items)}

    <div class="cat-list-review">
      <p class="cat-list-review-summary">${reviewSummaryHtml(items)}</p>

      <label class="cat-field cat-field-full">Observação geral do pedido
        <textarea id="cat-list-general-note" rows="2" placeholder="Alguma informação que ajude a equipe a montar o orçamento">${esc(reviewState.generalNote)}</textarea>
      </label>

      <fieldset class="cat-list-delivery">
        <legend>Preferência de recebimento</legend>
        <label><input type="radio" name="cat-delivery" value="retirada" ${reviewState.deliveryPreference === 'retirada' ? 'checked' : ''} /> Retirada na loja</label>
        <label><input type="radio" name="cat-delivery" value="entrega" ${reviewState.deliveryPreference === 'entrega' ? 'checked' : ''} /> Entrega</label>
        <label><input type="radio" name="cat-delivery" value="indefinido" ${reviewState.deliveryPreference === 'indefinido' ? 'checked' : ''} /> Ainda não sei</label>
      </fieldset>

      <p class="cat-list-disclaimer">O envio da lista não representa uma compra ou reserva. A equipe da Sartec confirmará as opções disponíveis, os valores e as condições de entrega ou retirada pelo WhatsApp.</p>

      <div class="cat-drawer-actions cat-list-final-actions">
        <button type="button" class="cat-drawer-btn-secondary" id="cat-list-clear">Limpar lista</button>
        <a href="#" id="cat-list-send" class="cat-drawer-btn-primary" target="_blank" rel="noopener">Enviar lista para orçamento</a>
      </div>
    </div>
  `;

  wireQtySteppers(body);
  wireRows(body, items);
  wireReviewControls(body, items);
  wireComplementary(body);
  body.querySelector('#cat-list-open-manual')?.addEventListener('click', () => {
    window.trackEvent?.('catalog_manual_item_open', { source: 'my_list' });
    openManualItemDrawer({ source: 'my_list' });
  });
}

function wireComplementary(body) {
  body.querySelectorAll('[data-complementary-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.complementaryAdd;
      const item = getItemById(id);
      if (!item) return;
      quickAddItem({ catalogItemId: item.id, name: item.name });
      window.trackEvent?.('related_item_add', { item_id: id, source: 'my_list_complementary' });
      celebrateAdd(btn, item.name);
      showToast(`${item.name} adicionado à lista.`);
      refreshDrawerBody(renderDrawerBody);
    });
  });
}

function wireReviewControls(body, items) {
  const noteEl = body.querySelector('#cat-list-general-note');
  noteEl?.addEventListener('input', () => {
    reviewState.generalNote = noteEl.value;
    updateSendLink(body, items);
  });

  body.querySelectorAll('input[name="cat-delivery"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) reviewState.deliveryPreference = radio.value;
      updateSendLink(body, items);
    });
  });

  body.querySelector('#cat-list-clear')?.addEventListener('click', () => {
    if (items.length === 0) return;
    if (confirm('Tem certeza que deseja limpar toda a sua lista?')) {
      const clearedCount = items.length;
      clearList();
      window.trackEvent?.('item_remove', { action: 'clear_all', list_item_count: clearedCount });
    }
  });

  updateSendLink(body, items);

  const sendLink = body.querySelector('#cat-list-send');
  sendLink?.addEventListener('click', (e) => {
    const url = sendLink.getAttribute('href');
    if (!url || url === '#') {
      e.preventDefault();
      showToast('Não foi possível montar o link do WhatsApp. Tente novamente em instantes.');
      return;
    }
    window.trackEvent?.('quote_whatsapp_click', {
      list_item_count: getItemCount(),
      total_quantity: getTotalQuantity(),
      manual_item: items.some((it) => it.manual),
    });
  });
}

function updateSendLink(body, items) {
  const sendLink = body.querySelector('#cat-list-send');
  if (!sendLink) return;
  const message = buildQuoteMessage({
    items,
    generalNote: reviewState.generalNote,
    deliveryPreference: reviewState.deliveryPreference,
  });
  const url = buildQuoteWhatsappUrl(message);
  if (url) sendLink.setAttribute('href', url);
  else sendLink.setAttribute('href', '#');
}

function wireRows(body, items) {
  body.querySelectorAll('.cat-list-row').forEach((row) => {
    const instanceId = row.dataset.instanceId;
    const entry = items.find((it) => it.instanceId === instanceId);
    if (!entry) return;

    row.querySelector('[data-action="qty-menos"]')?.addEventListener('click', () => {
      updateItem(instanceId, { quantity: Math.max(1, entry.quantity - 1) });
      window.trackEvent?.('item_edit', { instance_id: instanceId, action: 'quantity' });
    });
    row.querySelector('[data-action="qty-mais"]')?.addEventListener('click', () => {
      updateItem(instanceId, { quantity: entry.quantity + 1 });
      window.trackEvent?.('item_edit', { instance_id: instanceId, action: 'quantity' });
    });

    row.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      expandedInstanceId = expandedInstanceId === instanceId ? null : instanceId;
      refreshDrawerBody(renderDrawerBody);
    });

    row.querySelector('[data-action="duplicate"]')?.addEventListener('click', () => {
      duplicateItem(instanceId);
      window.trackEvent?.('item_edit', { instance_id: instanceId, action: 'duplicate' });
    });

    row.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
      const idx = items.findIndex((it) => it.instanceId === instanceId);
      const removed = removeItem(instanceId);
      window.trackEvent?.('item_remove', { item_id: removed?.catalogItemId, manual_item: removed?.manual });
      showToast(`${entry.name} removido da lista.`, {
        actionLabel: 'Desfazer',
        onAction: () => undoRemove(removed, idx),
      });
    });

    row.querySelector('[data-action="move-up"]')?.addEventListener('click', () => {
      const order = items.map((it) => it.instanceId);
      const i = order.indexOf(instanceId);
      if (i > 0) {
        [order[i - 1], order[i]] = [order[i], order[i - 1]];
        reorderItems(order);
      }
    });
    row.querySelector('[data-action="move-down"]')?.addEventListener('click', () => {
      const order = items.map((it) => it.instanceId);
      const i = order.indexOf(instanceId);
      if (i < order.length - 1) {
        [order[i + 1], order[i]] = [order[i], order[i + 1]];
        reorderItems(order);
      }
    });

    const editForm = row.querySelector('[data-edit-form]');
    editForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (entry.manual) {
        const name = editForm.querySelector('[data-field="name"]').value.trim() || entry.name;
        const cor = editForm.querySelector('[data-field="cor"]').value.trim();
        const especificacao = editForm.querySelector('[data-field="especificacao"]').value.trim();
        const notes = editForm.querySelector('[data-field="notes"]').value.trim();
        updateItem(instanceId, { name, attributes: { cor, especificacao }, notes });
      } else {
        const item = getItemById(entry.catalogItemId);
        const profile = getAttributeProfile(item?.attributeProfile);
        const { attributes, notes } = collectFieldValues(row, profile);
        updateItem(instanceId, { attributes, notes });
      }
      window.trackEvent?.('item_edit', { instance_id: instanceId, action: 'attributes' });
      expandedInstanceId = null;
      showToast('Alterações salvas.');
    });
  });
}

export function openListDrawer(source = 'header') {
  window.trackEvent?.('list_open', { source, list_item_count: getItemCount(), total_quantity: getTotalQuantity() });
  if (getItemCount() > 0) {
    window.trackEvent?.('quote_review_start', { list_item_count: getItemCount(), total_quantity: getTotalQuantity() });
  }
  openDrawer({
    id: 'my-list',
    title: 'Minha lista',
    size: 'large',
    render: renderDrawerBody,
  });
}

// ---- Contadores reativos (cabeçalho + barra mobile) ----

function updateCounters() {
  const count = getTotalQuantity();
  document.querySelectorAll('[data-cat-list-count]').forEach((el) => {
    el.textContent = String(count);
  });
  document.querySelectorAll('[data-cat-list-count-label]').forEach((el) => {
    el.textContent = count === 0 ? 'Sua lista está vazia' : `${count} ${count === 1 ? 'item' : 'itens'} na lista`;
  });
  document.body.classList.toggle('cat-list-has-items', count > 0);

  if (isDrawerOpen('my-list')) {
    refreshDrawerBody(renderDrawerBody);
  }
}

function mountMobileBar() {
  if (document.getElementById('cat-mobile-bar')) return;
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.id = 'cat-mobile-bar';
  bar.className = 'cat-mobile-bar';
  bar.innerHTML = `
    <span class="cat-mobile-bar-icon" aria-hidden="true">📋</span>
    <span class="cat-mobile-bar-text" data-cat-list-count-label>Sua lista está vazia</span>
    <span class="cat-mobile-bar-cta">Ver minha lista</span>
  `;
  bar.addEventListener('click', () => openListDrawer('mobile_bar'));
  document.body.appendChild(bar);
}

export function initListUI() {
  mountMobileBar();
  document.querySelectorAll('[data-cat-open-list]').forEach((btn) => {
    btn.addEventListener('click', () => openListDrawer('header'));
  });
  subscribe(updateCounters);
  updateCounters();
}
