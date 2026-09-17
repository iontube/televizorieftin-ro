// televizorieftin.ro eMAG collector — content script.
// Pe o pagina de categorie eMAG (/c): aduna linkuri de produs din primele N pagini,
// apoi fetch /pd din SESIUNEA TA (IP rezidential -> fara WAF), extrage date din JSON-LD,
// filtreaza dupa nr. recenzii, trimite la colector prin background.
(() => {
  if (window.__tvEmag) return; window.__tvEmag = true;

  // TV-uri ieftine au mai putine recenzii decat produsele populare -> prag mic default.
  const DEF = { minReviews: 3, maxPages: 10, pacingMs: 2200 };
  let cfg = { ...DEF };
  let running = false, scanned = 0, sent = 0, failed = 0;
  const seen = new Set();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pid = (u) => (u.match(/\/pd\/([A-Z0-9]+)/i) || [])[1];

  chrome.storage.local.get(DEF, (d) => { cfg = { ...DEF, ...d }; renderCfg(); });

  // ---- UI panel flotant ----
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;right:14px;bottom:14px;width:270px;background:#fff;border:2px solid #0d9488;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.2);font:13px/1.4 system-ui,sans-serif;color:#222;padding:12px';
  box.innerHTML = `
    <div style="font-weight:700;color:#0d9488;margin-bottom:6px">📺 televizorieftin — eMAG</div>
    <label style="display:block;margin:4px 0">Min. recenzii: <input id="tv-min" type="number" min="0" style="width:60px"></label>
    <label style="display:block;margin:4px 0">Pagini/categorie: <input id="tv-pg" type="number" min="1" max="60" style="width:50px"></label>
    <label style="display:block;margin:4px 0">Pauza (ms): <input id="tv-pace" type="number" min="800" step="500" style="width:70px"></label>
    <div id="tv-status" style="margin:8px 0;font-size:12px;color:#555">gata</div>
    <button id="tv-go" style="background:#0d9488;color:#fff;border:0;border-radius:8px;padding:7px 12px;cursor:pointer;font-weight:600;width:100%">Start pe categoria asta</button>
    <div style="margin-top:6px;font-size:11px;color:#888">Deschide o categorie de TV eMAG (ideal filtrata sub 1500 lei) si apasa Start.</div>`;
  const add = () => (document.body ? document.body.appendChild(box) : setTimeout(add, 300));
  add();

  const $ = (id) => box.querySelector(id);
  const status = (t) => { const s = $('#tv-status'); if (s) s.textContent = t; };
  function renderCfg() { $('#tv-min').value = cfg.minReviews; $('#tv-pg').value = cfg.maxPages; $('#tv-pace').value = cfg.pacingMs; }
  function readCfg() {
    cfg.minReviews = +$('#tv-min').value || 0;
    cfg.maxPages = Math.min(60, +$('#tv-pg').value || 10);
    cfg.pacingMs = Math.max(800, +$('#tv-pace').value || 2200);
    chrome.storage.local.set(cfg);
  }
  $('#tv-go').addEventListener('click', () => {
    if (running) { running = false; $('#tv-go').textContent = 'Start pe categoria asta'; return; }
    readCfg();
    if (!/\/c(\/|$|\?)/.test(location.pathname + '/')) { status('Nu esti pe o pagina de categorie (/c).'); return; }
    $('#tv-go').textContent = 'Stop'; run();
  });

  // ---- fetch din sesiunea utilizatorului (same-origin emag) ----
  async function getHtml(url) {
    try { const r = await fetch(url, { credentials: 'include' }); return r.ok ? await r.text() : null; } catch { return null; }
  }

  function parsePd(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let prod = null, crumbs = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      let o; try { o = JSON.parse(s.textContent); } catch { return; }
      const arr = Array.isArray(o) ? o : (o['@graph'] ? o['@graph'] : [o]);
      for (const it of arr) {
        if (it && it['@type'] === 'Product') prod = it;
        if (it && it['@type'] === 'BreadcrumbList') crumbs = (it.itemListElement || []).map((e) => e.name || (e.item && e.item.name)).filter(Boolean);
      }
    });
    if (!prod) return null;
    const off = Array.isArray(prod.offers) ? (prod.offers[0] || {}) : (prod.offers || {});
    const ar = prod.aggregateRating || {};
    const imgs = Array.isArray(prod.image) ? prod.image : (prod.image ? [prod.image] : []);
    const specs = {};
    doc.querySelectorAll('.specifications tr, .product-specifications tr, table tr').forEach((tr) => {
      const c = tr.querySelectorAll('td,th');
      if (c.length >= 2) { const k = c[0].textContent.trim(), v = c[1].textContent.trim(); if (k && v && k.length < 60 && Object.keys(specs).length < 40) specs[k] = v; }
    });
    return {
      id: pid(url), url: url.split('?')[0], name: prod.name || '', sku: prod.sku || prod.mpn || '',
      brand: (prod.brand && (prod.brand.name || prod.brand)) || '',
      price: off.price != null ? +off.price : null, currency: off.priceCurrency || 'RON', availability: off.availability || '',
      rating: ar.ratingValue ? +ar.ratingValue : null, reviewCount: +(ar.reviewCount || ar.ratingCount || 0),
      images: imgs, description: (prod.description || '').slice(0, 1200), specs, breadcrumb: crumbs, scrapedAt: Date.now(),
    };
  }

  let queue = [];
  function enqueue(p) { queue.push(p); if (queue.length >= 8) flush(); }
  function flush() {
    if (!queue.length) return;
    const batch = queue.splice(0);
    chrome.runtime.sendMessage({ type: 'products', items: batch }, (resp) => {
      if (resp && resp.ok) sent += resp.saved; else failed += batch.length;
    });
  }

  async function run() {
    running = true; scanned = 0; status('pornit…');
    const qs = location.search || '';
    const page1html = document.documentElement.outerHTML;
    // Descopera SABLONUL de paginare din link-urile reale de pe pagina (eMAG: /<slug>/pN/c).
    // Robust la formatul exact al URL-ului: nu ghicim, luam din DOM.
    let tmpl;
    const mm = page1html.match(/href="(\/[a-z0-9\-]+)\/p\d+(\/c[^"]*)"/i);
    if (mm) {
      tmpl = (n) => location.origin + mm[1] + '/p' + n + mm[2].replace(/&amp;/g, '&');
    } else {
      const basePath = location.pathname.replace(/\/p\d+(?=\/c)/, '').replace(/\/c\/?$/, '');
      tmpl = (n) => location.origin + basePath + '/p' + n + '/c' + qs;
    }
    const pages = [location.href];
    for (let p = 2; p <= cfg.maxPages; p++) pages.push(tmpl(p));

    const pdUrls = new Set();
    for (const pu of pages) {
      if (!running) break;
      const html = (pu === location.href) ? document.documentElement.outerHTML : await getHtml(pu);
      if (html) {
        for (const m of html.matchAll(/\/[a-z0-9\-]+\/pd\/[A-Z0-9]+/gi)) pdUrls.add(location.origin + m[0]);
        status(`paginare ${pu.split('/').pop().split('?')[0]} • ${pdUrls.size} produse gasite`);
      }
      if (pu !== location.href) await sleep(cfg.pacingMs);
    }

    for (const pu of pdUrls) {
      if (!running) break;
      const id = pid(pu); if (!id || seen.has(id)) continue; seen.add(id);
      const html = await getHtml(pu); scanned++;
      if (html) {
        const prod = parsePd(html, pu);
        if (prod && prod.reviewCount >= cfg.minReviews) enqueue(prod);
      }
      status(`scanate ${scanned}/${pdUrls.size} • trimise ${sent} • esuate ${failed}`);
      await sleep(cfg.pacingMs);
    }
    flush();
    running = false; $('#tv-go').textContent = 'Start pe categoria asta';
    status(`GATA. scanate ${scanned}, trimise ${sent}, esuate ${failed}.`);
  }
})();
