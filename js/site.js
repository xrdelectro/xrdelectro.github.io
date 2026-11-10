/**
 * site.js — the docs site (www): nav, footer, buy buttons, photo galleries.
 * No cart here: buying happens on the shop, which data-shop names (set by tools/build-site.py).
 *
 * <a data-buy="odm-ea1">Buy</a> becomes a link to that product in the shop, with its live
 * price and stock when the shop answers. Needs stock.js before this file.
 */
(() => {
  const d = document.documentElement.dataset;
  const R = d.root || '';
  const SHOP = (d.shop || '').replace(/\/$/, '');

  function inject() {
    const nav = document.getElementById('nav-placeholder');
    if (nav) nav.outerHTML = `
<nav>
  <a class="nav-brand" href="${R}index.html">xrd.lv</a>
  <div class="nav-links">
    <a href="${R}index.html">Products</a>
    <a href="${R}3dp/">Services</a>
    <a href="${R}about.html">About</a>
    ${SHOP ? `<a href="${SHOP}/">Shop</a>` : ''}
  </div>
</nav>`;
    const footer = document.getElementById('footer-placeholder');
    if (footer) footer.outerHTML = `
<footer><div class="container">Ships from Latvia, EU &nbsp;·&nbsp; <a data-m="jogpAyse/mw">e-mail</a></div></footer>`;
    if (!document.title.includes('xrd.lv')) document.title += ' — xrd.lv';
  }

  /** <a data-m="…">: an address stored with each character code + 1 (tools/mask-email.py). */
  function unmaskEmails() {
    for (const a of document.querySelectorAll('a[data-m]')) {
      const addr = String.fromCharCode(...[...a.dataset.m].map(c => c.charCodeAt(0) - 1));
      a.href = `mailto:${addr}`;
      a.textContent = addr;
    }
  }

  async function liveCatalog() {
    const r = await fetch(`${SHOP}/products.json`, { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  /** "120 € · in stock" for the products whose shop page is p/<name>/, or '' if none. */
  function offer(data, name) {
    const ps = data.products.filter(p => (p.page || '').split('?')[0] === `p/${name}/`);
    if (!ps.length) return '';
    const prices = ps.map(p => p.price);
    const from = Math.min(...prices) === Math.max(...prices) ? '' : 'from ';
    const avail = typeof Stock === 'undefined' ? null
      : ps.reduce((n, p) => n + Stock.forProduct(p.id, {}, data).available, 0);
    const stock = avail == null ? '' : avail > 0 ? ' · in stock' : data.backorder?.allowed ? ' · backorder' : ' · out of stock';
    return `${from}${Math.min(...prices)} €${stock}`;
  }

  async function buyButtons() {
    const btns = [...document.querySelectorAll('[data-buy]')];
    if (!btns.length) return;
    if (!SHOP) { btns.forEach(b => { b.hidden = true; }); return; }
    for (const b of btns) b.href = `${SHOP}/p/${b.dataset.buy}/`;
    let data = null;
    try { data = await liveCatalog(); } catch { /* shop not answering: plain links */ }
    for (const b of btns) {
      const o = data && offer(data, b.dataset.buy);
      const label = b.querySelector('.buy-offer');
      if (label) label.textContent = o || (data ? '' : 'price and stock in the shop');
    }
  }

  function galleries() {
    for (const g of document.querySelectorAll('.gallery')) {
      const main = g.querySelector('.gallery-main');
      for (const t of g.querySelectorAll('.gallery-thumbs img')) {
        t.addEventListener('click', () => {
          main.src = t.src;
          main.alt = t.alt;
          g.querySelectorAll('.gallery-thumbs img').forEach(x => x.classList.toggle('active', x === t));
        });
      }
    }
  }

  inject();
  unmaskEmails();
  galleries();
  buyButtons();
})();
