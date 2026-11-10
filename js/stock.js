/**
 * stock.js — stock computation with cross-product panel constraints
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

  /**
   * Returns { available, remaining, stockLevel, backordered, notice }
   *
   * available: max qty of this specific product before backorder.
   *   Module:  min(free_pcbs, free_brackets, free_panels_of_color)
   *            where "free" = stock minus OTHER products' cart quantities
   *   Panel:   panel_stock minus modules-of-same-color in cart
   *
   * remaining: how many more can be added before backorder (available - inCart, ≥0)
   */
  forProduct(productId, cart, data) {
    const product = data.products.find(p => p.id === productId);
    if (!product) return { available: 0, remaining: 0, stockLevel: 'out', backordered: false, notice: '' };

    const comp       = data.components;
    const c          = product.color_code;
    const panelStock = comp.panels[c]?.stock ?? 0;
    const inCart     = cart[productId] || 0;

    let available;
    if (product.type === 'module') {
      const panelByOthers = cart[`oled-panel-${c}`] || 0;
      const panelAvail    = panelStock - panelByOthers;
      const otherModQty   = ['w','y','g','b'].filter(x => x !== c)
        .reduce((n, x) => n + (cart[`odm-ea1-revD-${x}`] || 0), 0);
      available = Math.min(
        panelAvail,
        comp['pcba-odm-ea1-revD'].stock - otherModQty,
        comp.bracket.stock       - otherModQty
      );
    } else {
      available = panelStock - (cart[`odm-ea1-revD-${c}`] || 0);
    }

    available     = Math.max(0, available);
    const remaining   = Math.max(0, available - inCart);
    const backordered = !!(data.backorder?.allowed && inCart > available);

    let stockLevel;
    if (backordered)          stockLevel = 'backorder';
    else if (remaining === 0) stockLevel = 'out';
    else if (remaining <= 2)  stockLevel = 'low';
    else                      stockLevel = 'in_stock';

    return {
      available, remaining, stockLevel, backordered,
      notice: backordered ? (data.backorder?.lead_time_notice || '') : ''
    };
  },

  /**
   * panelColorState(colorCode, cart, data)
   *
   * Returns the shared panel pool state for a given color.
   * Drives color-button appearance consistently for both the module
   * and bare-panel buttons of the same color.
   *
   *   'ok'       — pool has headroom
   *   'at_limit' — total usage == stock (dim both buttons)
   *   'over'     — total usage  > stock (dim + red both buttons)
   *
   * Total usage = modules_of_color_in_cart + panels_of_color_in_cart
   */
  panelColorState(colorCode, cart, data) {
    const panelStock = data.components.panels[colorCode]?.stock ?? 0;
    const used = (cart[`odm-ea1-revD-${colorCode}`] || 0)
               + (cart[`oled-panel-${colorCode}`]   || 0);
    if (used > panelStock)                        return 'over';
    if (used >= panelStock && panelStock > 0)     return 'at_limit';
    return 'ok';
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
