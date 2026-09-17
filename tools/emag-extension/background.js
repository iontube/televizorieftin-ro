// televizorieftin.ro eMAG collector — service worker.
// Primeste produse de la content-script si le POST-eaza la colectorul propriu (CF Worker + KV).
// Retry cu backoff: edge-ul workers.dev poate da erori tranzitorii -> nu pierdem batch-uri.
const COLLECTOR = 'https://tvieftin-emag-collector.flat-scene-36ff.workers.dev';
const SECRET = 'tvief_emag_2026';

async function postBatch(items, tries = 4) {
  for (let a = 1; a <= tries; a++) {
    try {
      const r = await fetch(COLLECTOR + '/?k=' + SECRET, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ products: items }),
      });
      if (r.ok) { const j = await r.json(); return j.saved || 0; }
    } catch (_) { /* retry */ }
    await new Promise((res) => setTimeout(res, 700 * a)); // backoff 0.7s,1.4s,2.1s
  }
  return -1; // esuat dupa toate incercarile
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === 'products' && Array.isArray(msg.items)) {
    postBatch(msg.items).then((saved) => {
      if (saved >= 0) {
        chrome.storage.local.get({ totalSent: 0 }, (d) => chrome.storage.local.set({ totalSent: (d.totalSent || 0) + saved }));
        reply({ ok: true, saved });
      } else {
        chrome.storage.local.get({ totalFailed: 0 }, (d) => chrome.storage.local.set({ totalFailed: (d.totalFailed || 0) + msg.items.length }));
        reply({ ok: false, saved: 0 });
      }
    });
    return true; // raspuns async
  }
  if (msg && msg.type === 'getTotal') {
    chrome.storage.local.get({ totalSent: 0, totalFailed: 0 }, (d) => reply(d));
    return true;
  }
});
