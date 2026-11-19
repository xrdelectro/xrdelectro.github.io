/**
 * stock.js — stock per product from the parts tree in products.json (BOM entries may name branches)
 * Reads products.json via window.SITE_ROOT prefix (set by each page).
 */

// Pages in subdirectories set <html data-root="../../">.
window.SITE_ROOT = document.documentElement.dataset.root || '';

const Stock = {
  _data: null,

  _loading: null,

  async load() {
    if (this._data) return this._data;
    if (!this._loading) this._loading = this._fetch().finally(() => { this._loading = null; });
    return this._loading;
  },

  async _fetch() {
    const root = window.SITE_ROOT || '';
    const res  = await fetch(`${root}products.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`products.json: ${res.status} ${res.statusText}`);
    this._data = await res.json();
    return this._data;
  },

  /** Stock items of the parts tree as [{ path, id, stock }], in path order (oldest revision first). */
  leaves(data) {
    if (data._leaves) return data._leaves;
    const out = [];
    (function walk(node, path) {
      if (!node || typeof node !== 'object') return;
      if ('stock' in node) { out.push({ path, id: node.id || path, stock: node.stock }); return; }
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}/${k}` : k);
    })(data.parts, '');
    out.sort((a, b) => a.path.localeCompare(b.path));
    Object.defineProperty(data, '_leaves', { value: out });
    return out;
  },

  /** The stock items a BOM key stands for: a leaf id, or every leaf under a branch path. */
  leavesOf(key, data) {
    const all = this.leaves(data);
    const exact = all.filter(l => l.id === key);
    return exact.length ? exact : all.filter(l => l.path === key || l.path.startsWith(key + '/'));
  },

  /**
   * Returns { available, remaining, stockLevel, backordered, notice }
   *
   * available: how many of this product the stock allows, given what the rest of the cart
   *   takes from the same stock items (the server allocates the same way, oldest first).
   * remaining: how many more can be added (available - inCart, >= 0).
   */
  forProduct(productId, cart, data) {
    const product = data.products.find(p => p.id === productId);
    if (!product) return { available: 0, remaining: 0, stockLevel: 'out', backordered: false, notice: '' };

    // Units the other cart lines need from each stock item, allocated in order.
    const free = {};
    this.leaves(data).forEach(l => { free[l.id] = Math.max(0, l.stock); });
    for (const [id, qty] of Object.entries(cart)) {
      const p = id !== productId && data.products.find(x => x.id === id);
      if (!p || !qty) continue;
      for (const [key, per] of Object.entries(p.bom || {})) {
        let need = per * qty;
        for (const l of this.leavesOf(key, data)) {
          const n = Math.min(need, free[l.id] || 0);
          free[l.id] -= n; need -= n;
        }
      }
    }
    let available = Infinity;
    for (const [key, per] of Object.entries(product.bom || {})) {
      const have = this.leavesOf(key, data).reduce((n, l) => n + (free[l.id] || 0), 0);
      available = Math.min(available, Math.floor(have / per));
    }
    if (!Number.isFinite(available)) available = 0;

    const inCart      = cart[productId] || 0;
    const remaining   = Math.max(0, available - inCart);
    const backordered = !!(data.backorder?.allowed && inCart > available);
    let stockLevel;
    if (backordered)          stockLevel = 'backorder';
    else if (remaining === 0) stockLevel = 'out';
    else if (remaining <= 2)  stockLevel = 'low';
    else                      stockLevel = 'in_stock';
    return { available, remaining, stockLevel, backordered, notice: backordered ? (data.backorder?.lead_time_notice || '') : '' };
  },

  /** 'ok', 'at_limit' (none more can be added) or 'over' (cart holds more than stock): for option buttons. */
  optionState(productId, cart, data) {
    const s = this.forProduct(productId, cart, data);
    if ((cart[productId] || 0) > s.available) return 'over';
    return s.remaining === 0 ? 'at_limit' : 'ok';
  },

  stockLabel(stockLevel, remaining) {
    switch (stockLevel) {
      case 'in_stock':  return { text: `${remaining} in stock`, cls: '' };
      case 'low':       return { text: `${remaining} left`,     cls: 'low' };
      case 'out':       return { text: 'Out of stock',          cls: 'out' };
      case 'backorder': return { text: 'Backordered',           cls: 'backorder' };
      default:          return { text: '',                      cls: '' };
    }
  },
};

/**
 * Options — a product group's choices (colour, panel, film…) as rows of buttons.
 * products.json "groups"[group].axes lists the axes; each product's "options" names its value
 * on each axis. The colour axis takes its labels and dots from the products themselves.
 */
const Options = {
  axes(data, group) {
    return data.groups?.[group]?.axes || [{ id: 'colour', label: 'Colour' }];
  },

  /** [{ value, label, hex }] of an axis, in product order. */
  choices(axis, items) {
    const seen = new Map();
    for (const p of items) {
      const v = p.options?.[axis.id];
      if (v == null || seen.has(v)) continue;
      seen.set(v, axis.id === 'colour'
        ? { value: v, label: p.color_label || v, hex: p.color_hex }
        : { value: v, label: axis.choices?.[v] || v });
    }
    return [...seen.values()];
  },

  /** The product with `value` on `axisId` that keeps as many of the current choices as possible. */
  pick(items, current, axisId, value) {
    const cands = items.filter(p => p.options?.[axisId] === value);
    const score = p => Object.entries(current.options || {}).filter(([k, v]) => p.options?.[k] === v).length;
    return cands.sort((a, b) => score(b) - score(a))[0] || current;
  },

  /** Rows of buttons into `box`; `onPick(product)` when one is chosen. */
  render(box, data, items, current, onPick, { hover = false, labels = false } = {}) {
    const cart = Cart.load();
    box.replaceChildren(...this.axes(data, current.group).map(axis => {
      const row = el('div', { class: 'option-row' });
      const opts = this.choices(axis, items);
      if (opts.length < 2 && axis.id !== 'colour') return row;
      if (labels) row.append(el('span', { class: 'option-label' }, axis.label));
      for (const o of opts) {
        const target = this.pick(items, current, axis.id, o.value);
        const st = Stock.optionState(target.id, cart, data);
        const btn = el('button', {
          type: 'button',
          class: `color-radio${current.options?.[axis.id] === o.value ? ' active' : ''}${st !== 'ok' ? ' btn-dim' : ''}${st === 'over' ? ' btn-over' : ''}`,
          title: axis.label,
          onclick: e => { e.stopPropagation(); onPick(target); },
        }, o.hex ? el('span', { class: 'dot', style: `background:${o.hex}` }) : null, o.label);
        if (hover) btn.addEventListener('mouseenter', () => onPick(target));
        row.append(btn);
      }
      return row;
    }));
  },
};
