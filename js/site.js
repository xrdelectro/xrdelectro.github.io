/**
 * site.js — the docs site (www): nav, footer, buy buttons, photo galleries.
 * No cart here: buying happens on the shop, which data-shop names (set by tools/build-site.py).
 *
 * <a data-buy="odm-ea1">Buy</a> becomes a link to that product in the shop, with its live
 * price and stock when the shop answers. Needs stock.js before this file.
 *
 * The shop runs on our own server behind a home line, www on GitHub Pages: when the shop
 * does not answer, a click on a shop link shows a notice instead of a page that never loads.
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
    ${SHOP ? `<a href="${SHOP}/" data-shop-link>Shop</a>` : ''}
  </div>
</nav>`;
    const footer = document.getElementById('footer-placeholder');
    if (footer) footer.outerHTML = `
<footer><div class="container">Ships from Latvia, EU &nbsp;·&nbsp; <a data-m="jogpAyse/mw">e-mail</a> &nbsp;·&nbsp; <a href="${R}privacy/">Privacy</a></div></footer>`;
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
    const sale = data.sales?.[name];
    if (sale && sale.left > 0 && sale.cents < Math.min(...prices) * 100) {
      return `sale ${(sale.cents / 100).toFixed(2)} € (regular ${Math.min(...prices)} €) · ${sale.left} available`;
    }
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
      if (label) label.textContent = o || (data ? '' : 'the shop is not answering right now');
    }
  }

  // -- is the shop reachable? ------------------------------------------------
  let shopUp = null;  // null: not known yet; a Promise<boolean> while asking

  function askShop() {
    shopUp = fetch(`${SHOP}/healthz`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      .then(r => r.ok, () => false)
      .then(ok => { shopUp = ok; markShopLinks(ok); return ok; });
    return shopUp;
  }

  function markShopLinks(ok) {
    for (const a of document.querySelectorAll('[data-shop-link]')) {
      a.classList.toggle('shop-offline', !ok);
      a.title = ok ? '' : 'The shop is not answering right now';
    }
  }

  function offlineNotice(href) {
    let box = document.getElementById('shop-offline');
    if (!box) {
      box = document.createElement('div');
      box.id = 'shop-offline';
      box.setAttribute('role', 'alert');
      document.body.append(box);
    }
    const text = document.createElement('p');
    text.textContent = 'The shop is not answering right now. It runs on our own server in Latvia and is usually back ' +
      'within minutes. This page will tell you when it is back; you can also write to ';
    const mail = document.querySelector('footer a[data-m], footer a[href^="mailto:"]');
    const addr = document.createElement('a');
    addr.href = mail ? mail.href : '#';
    addr.textContent = mail ? mail.textContent : 'e-mail';
    text.append(addr, '.');
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => { box.remove(); clearInterval(timer); });
    box.replaceChildren(text, close);
    const timer = setInterval(async () => {
      if (!document.body.contains(box)) return clearInterval(timer);
      if (await askShop()) {
        clearInterval(timer);
        const open = document.createElement('a');
        open.href = href;
        open.className = 'buy-btn';
        open.textContent = 'The shop is back: open it';
        box.replaceChildren(open, close);
      }
    }, 15000);
  }

  function guardShopLinks() {
    if (!SHOP) return;
    askShop();
    document.addEventListener('click', async e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || !a.href.startsWith(SHOP + '/') || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (shopUp === true) return;
      e.preventDefault();
      const ok = shopUp === false ? await askShop() : await (shopUp || askShop());
      if (ok) location.href = a.href;
      else offlineNotice(a.href);
    });
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
  guardShopLinks();
})();
