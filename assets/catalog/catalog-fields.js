/* ======================================================
   SARTEC — Catálogo — Renderização de campos reutilizáveis
   Usado pela gaveta de personalização, item manual e edição
   inline na "Minha lista" — um único lugar define como cada
   tipo de campo (quantidade, texto, seleção, observação) é
   desenhado e lido do formulário.
   ====================================================== */

import { esc } from './catalog-utils.js';

export function renderField(field, value) {
  if (field.type === 'quantity') {
    return `
    <div class="cat-field cat-field-qty" data-field="${field.id}">
      <span class="cat-field-label">${esc(field.label)}</span>
      <div class="cat-qty-stepper">
        <button type="button" class="cat-qty-btn" data-qty-action="menos" aria-label="Diminuir quantidade">−</button>
        <span class="cat-qty-value" data-qty-value>${Number.isFinite(value) ? value : 1}</span>
        <button type="button" class="cat-qty-btn" data-qty-action="mais" aria-label="Aumentar quantidade">+</button>
      </div>
    </div>`;
  }
  if (field.type === 'select') {
    const current = value || field.options[0];
    const options = field.options
      .map((opt) => `<option value="${esc(opt)}" ${opt === current ? 'selected' : ''}>${esc(opt)}</option>`)
      .join('');
    return `<label class="cat-field">${esc(field.label)}<select data-field="${field.id}">${options}</select></label>`;
  }
  if (field.type === 'textarea') {
    return `<label class="cat-field cat-field-full">${esc(field.label)}<textarea data-field="${field.id}" rows="2" placeholder="${esc(field.placeholder || '')}">${esc(value || '')}</textarea></label>`;
  }
  return `<label class="cat-field">${esc(field.label)}<input type="text" data-field="${field.id}" value="${esc(value || '')}" placeholder="${esc(field.placeholder || '')}" /></label>`;
}

export function renderFieldGrid(profile, values = {}, opts = {}) {
  return profile.fields
    .filter((field) => !(opts.skipQuantity && field.type === 'quantity'))
    .map((field) => renderField(field, field.type === 'quantity' ? values.quantity : values[field.id]))
    .join('');
}

export function wireQtySteppers(container) {
  container.querySelectorAll('.cat-qty-stepper').forEach((stepper) => {
    const valueEl = stepper.querySelector('[data-qty-value]');
    stepper.querySelectorAll('.cat-qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        let v = parseInt(valueEl.textContent, 10) || 1;
        v = btn.dataset.qtyAction === 'mais' ? v + 1 : Math.max(1, v - 1);
        valueEl.textContent = String(v);
      });
    });
  });
}

/** Lê quantidade, atributos e observação de um formulário renderizado com renderFieldGrid(). */
export function collectFieldValues(container, profile) {
  const attributes = {};
  let notes;
  let quantity = 1;
  profile.fields.forEach((field) => {
    if (field.type === 'quantity') {
      const el = container.querySelector(`[data-field="${field.id}"] [data-qty-value]`);
      quantity = parseInt(el?.textContent || '1', 10) || 1;
      return;
    }
    const el = container.querySelector(`[data-field="${field.id}"]`);
    if (!el) return;
    const val = (el.value || '').trim();
    if (field.id === 'observacao') {
      notes = val;
      return;
    }
    if (!val || val === 'Sem preferência') return;
    attributes[field.id] = val;
  });
  return { attributes, notes, quantity };
}
