// Generate the cheap-TV (<=1500 lei) dataset from OUR 2Performant catalog (pretulverde.db).
// Output: src/data/oferte.json — per product: slug, name, brand, price, oldPrice, merchant,
// img (img.televizorieftin.ro neutral host -> shared pool), affiliate (2P deeplink), parsed specs,
// UNIQUE generated SEO prose. Re-run nightly after the catalog rebuild (feed enter/leave reflected).
import Database from '/sites/pretulverde.ro/node_modules/better-sqlite3/lib/index.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DB = '/sites/pretulverde.ro/pretulverde.db';
const CAMPAIGN = JSON.parse(readFileSync('/sites/pretulverde.ro/_data/campaign.json', 'utf8'));
const AFF = '2ace29e87';
const IMG_HOST = 'https://img.televizorieftin.ro';
const SITE_NAME = 'TelevizorIeftin.ro';
const OUT = fileURLToPath(new URL('../src/data/oferte.json', import.meta.url));

const db = new Database(DB, { readonly: true });
// real cheap TV = televizor + a resolution/panel marker + a diagonal, NOT an accessory/book/toy, <=1500 lei
const rows = db.prepare(`SELECT id, slug, title, price, oldPrice, brand, brandSlug, merchant, merchantSlug, img, descr
  FROM products WHERE lower(title) LIKE '%televizor%'
  AND (lower(title) LIKE '%hd ready%' OR lower(title) LIKE '%full hd%' OR lower(title) LIKE '%4k%' OR lower(title) LIKE '%uhd%' OR lower(title) LIKE '%ultra hd%' OR lower(title) LIKE '%smart%' OR lower(title) LIKE '%led%' OR lower(title) LIKE '%qled%' OR lower(title) LIKE '%oled%')
  AND (lower(title) LIKE '% cm%' OR lower(title) LIKE '%cm,%' OR lower(title) LIKE '%inch%' OR lower(title) LIKE '%"%')
  AND lower(title) NOT LIKE '%cablu%' AND lower(title) NOT LIKE '%suport%' AND lower(title) NOT LIKE '%telecomand%'
  AND lower(title) NOT LIKE '%adaptor%' AND lower(title) NOT LIKE '%montaj%' AND lower(title) NOT LIKE '%comod%'
  AND lower(title) NOT LIKE '%fotoliu%' AND lower(title) NOT LIKE '%rama%' AND lower(title) NOT LIKE '%ramă%'
  AND lower(title) NOT LIKE '%casti%' AND lower(title) NOT LIKE '%căști%' AND lower(title) NOT LIKE '%jucarie%' AND lower(title) NOT LIKE '%jucărie%'
  AND lower(title) NOT LIKE '%raft%' AND lower(title) NOT LIKE '%lampa%' AND lower(title) NOT LIKE '%lampă%' AND lower(title) NOT LIKE '%chingi%' AND lower(title) NOT LIKE '%chinga%'
  AND lower(title) NOT LIKE '%stand %' AND lower(title) NOT LIKE '%perete%' AND lower(title) NOT LIKE '%protectie%' AND lower(title) NOT LIKE '%protecție%'
  AND price >= 350 AND price <= 1500
  AND img IS NOT NULL AND img <> '' ORDER BY price DESC`).all();

// ---- helpers ----
const esc = (s) => String(s || '');
const money = (n) => Number(n).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei';
const sl = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 70).replace(/^-+|-+$/g, '');
const seedOf = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

function imgUrl(poolImg, name) {
  const m = /([0-9a-f]{16})\.webp$/.exec(poolImg || '');
  if (!m) return '';
  return `${IMG_HOST}/${sl(name).slice(0, 55).replace(/-+$/, '')}-${m[1]}.webp`;
}

// parse cheap-TV specs from title + descr (resolution-aware: HD Ready / Full HD / 4K)
function parseSpecs(t, descr, brand) {
  const s = (t + ' ' + (descr || '')).toLowerCase();
  let panel = 'LED';
  if (/\boled\b/.test(s)) panel = 'OLED';
  else if (/\bqled\b/.test(s)) panel = 'QLED';
  // resolution
  let rezolutie = 'HD';
  if (/4k|uhd|ultra hd|3840/.test(s)) rezolutie = '4K Ultra HD';
  else if (/full hd|fullhd|1920|1080p/.test(s)) rezolutie = 'Full HD';
  else if (/hd ready|1366|1280 ?x ?720|720p/.test(s)) rezolutie = 'HD Ready';
  // diagonal
  let cm = null, inch = null;
  let mcm = t.match(/(\d{2,3})\s*cm/i); if (mcm) cm = +mcm[1];
  let min = t.match(/(\d{2,3})\s*(?:inch|"|''|inchi|inci)/i); if (min) inch = +min[1];
  if (cm && !inch) inch = Math.round(cm / 2.54);
  if (inch && !cm) cm = Math.round(inch * 2.54);
  // smart platform
  let smart = '';
  if (/tizen/.test(s)) smart = 'Tizen (Samsung)';
  else if (/webos|web os/.test(s)) smart = 'webOS (LG)';
  else if (/google ?tv/.test(s)) smart = 'Google TV';
  else if (/android ?tv/.test(s)) smart = 'Android TV';
  else if (/vidaa/.test(s)) smart = 'Vidaa';
  else if (/smart/.test(s)) smart = 'Smart TV';
  const hdr = /hdr10\+|dolby vision|hdr/.test(s);
  return { brand: brand || '', panel, inch, cm, smart, rezolutie, hdr };
}

// size band for cheap TVs (small diagonals)
function sizeBand(inch) {
  if (!inch) return 'alte';
  if (inch <= 26) return 'mic';        // 22-24"
  if (inch <= 34) return 'mediu';      // 32"
  if (inch <= 42) return 'mare';       // 40"
  return 'xl';                          // 43"+
}

// ---- unique SEO prose: rich variant pools composed by a per-product seed so no two pages read alike ----
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const PREMIUM_BRANDS = new Set(['samsung', 'lg', 'sony', 'philips', 'panasonic']);
const VALUE_BRANDS = new Set(['xiaomi', 'tcl', 'hisense', 'metz', 'sharp', 'thomson', 'kivi']);
function genProse(p, specs) {
  const r = rng(seedOf(p.slug));
  const b = specs.brand || 'acest producător';
  const bl = (specs.brand || '').toLowerCase();
  const price = money(p.price);
  const m = esc(p.merchant).replace(/\/+$/, '');
  const sz = specs.inch ? `${specs.inch} inch (${specs.cm} cm)` : 'diagonala sa';
  const reduced = p.oldPrice > p.price;

  const panelTxt = pick(r, ({
    'OLED': ['un panou OLED cu negru profund și contrast excelent, rar întâlnit la acest preț', 'tehnologie OLED, cu fiecare pixel iluminat individual pentru un contrast greu de egalat'],
    'QLED': ['tehnologie QLED cu puncte cuantice pentru culori mai vii decât un LED clasic', 'un panou QLED cu Quantum Dot, care saturează mai bine culorile la un preț accesibil', 'strat QLED peste panoul LED, pentru culori mai bogate fără să sară de buget'],
    'LED': ['un panou LED retroiluminat, echilibrat pentru vizionarea de zi cu zi', 'un panou LED clasic, suficient pentru filme, seriale și TV prin cablu la un preț mic', 'retroiluminare LED standard, alegerea pragmatică în zona accesibilă'],
  }[specs.panel] || ['un panou LED accesibil']));
  const resTxt = pick(r, ({
    '4K Ultra HD': ['rezoluție 4K Ultra HD (3840x2160), un salt vizibil pe streaming la această diagonală', 'rezoluție 4K (3840x2160), cu de patru ori mai mulți pixeli decât Full HD'],
    'Full HD': ['rezoluție Full HD (1920x1080), clară pentru filme, seriale și sport', 'rezoluție Full HD (1920x1080), exact cât trebuie pentru această diagonală'],
    'HD Ready': ['rezoluție HD Ready (1366x768), potrivită pentru o diagonală mică privită de la 2 metri', 'rezoluție HD Ready (1366x768), suficientă pentru o cameră mică sau bucătărie'],
    'HD': ['o rezoluție HD pentru utilizare de bază'],
  }[specs.rezolutie] || ['o rezoluție potrivită pentru utilizare de bază']));

  const tier = p.price < 600 ? pick(r, ['Este printre cele mai ieftine variante cu Smart TV din această selecție.', 'La acest preț, e una dintre cele mai accesibile oferte pe care le urmărim.'])
    : p.price < 1000 ? pick(r, ['Se așază în zona echilibrată de preț, unde primești cel mai mult pentru bani.', 'Stă în mijlocul segmentului ieftin, cu un raport bun între preț și dotări.'])
    : pick(r, ['Este spre limita superioară a bugetului de televizor ieftin, dar cu specificații pe măsură.', 'E spre capătul de sus al zonei accesibile, justificat de diagonală și dotări.']);
  const brandTxt = PREMIUM_BRANDS.has(bl) ? pick(r, [`${b} aduce un nume cunoscut, cu actualizări software pe termen lung și service ușor de găsit.`, `Fiind ${b}, te poți baza pe fiabilitate și pe un ecosistem de aplicații matur.`])
    : VALUE_BRANDS.has(bl) ? pick(r, [`${b} oferă un raport calitate-preț bun, cu dotări apropiate de brandurile premium la cost mai mic.`, `${b} s-a impus pe segmentul accesibil prin specificații generoase la preț corect.`])
    : pick(r, [`Fiind un brand accesibil, prețul mic e punctul forte, iar panoul vine de la aceiași furnizori ca la mărcile mari.`, `Este un brand bugetar: nu plătești numele, ci ecranul și funcțiile de bază.`]);

  const sizeAdvice = specs.inch
    ? (specs.inch <= 26 ? 'Diagonala mică îl face ideal pentru bucătărie, birou sau o cameră de oaspeți, de la circa 1,5 metri distanță.'
      : specs.inch <= 34 ? 'La 32 inch este alegerea clasică pentru dormitor sau bucătărie, recomandat de la circa 2 metri distanță.'
      : specs.inch <= 42 ? 'La 40 inch acoperă bine un living mic spre mediu, de la circa 2,2 metri distanță.'
      : 'La 43 inch este formatul cel mai popular pentru sufragerie, recomandat de la 2,5 metri distanță.')
    : 'Alege diagonala în funcție de distanța de vizionare din camera ta.';
  const opener = pick(r, [
    `${esc(p.title)} este un televizor ieftin de la ${b}, listat la ${price}${reduced ? ` (redus de la ${money(p.oldPrice)})` : ''} prin ${m}.`,
    `La ${price}${reduced ? `, redus de la ${money(p.oldPrice)},` : ''} ${esc(p.title)} intră în zona accesibilă a pieței, disponibil acum la ${m}.`,
    `Cauți un televizor ieftin și bun? ${esc(p.title)} de la ${b} costă ${price} la ${m} și merită o privire.`,
    `${esc(p.title)} este oferta ${b} pe care o urmărim în segmentul ieftin, la ${price} pe ${m}${reduced ? `, sub prețul vechi de ${money(p.oldPrice)}` : ''}.`,
  ]);
  const visual = pick(r, [`Are ${panelTxt}, cu ${resTxt}.`, `Pe partea de imagine mizează pe ${panelTxt} și ${resTxt}.`, `Ecranul folosește ${panelTxt}, la ${resTxt}.`]);

  // intro = opener + visual + (tier OR brand), order/selection varied by seed
  const extra = r() < 0.5 ? tier : brandTxt;
  const intro = r() < 0.5 ? `${opener} ${visual} ${extra}` : `${opener} ${extra} ${visual}`;

  const connect = pick(r, ['Verifică să aibă cel puțin 2 porturi HDMI și Wi-Fi integrat — esențiale la un televizor ieftin.', 'La buget mic, contează 2 porturi HDMI, un USB și Wi-Fi pentru aplicații.', 'Un port HDMI ARC ajută dacă vrei să atașezi mai târziu un soundbar.']);
  const guide = [
    `${sizeAdvice} ${specs.inch && specs.inch >= 43 && specs.rezolutie === '4K Ultra HD' ? 'La 43 inch, saltul la 4K se vede clar față de Full HD pe Netflix sau YouTube.' : specs.inch && specs.inch <= 34 ? 'La această diagonală nu merită să plătești în plus pentru 4K — diferența nu se observă de la distanță normală.' : 'Potrivește distanța de vizionare ca să profiți de toată diagonala.'}`,
    `${specs.smart ? `Partea de smart rulează pe ${specs.smart}, cu acces la Netflix, YouTube, Prime Video și Disney+ direct din telecomandă.` : 'Dacă nu are sistem smart integrat, îi poți adăuga ieftin un stick (Chromecast, Fire TV).'}${specs.hdr ? ' Suportă HDR, util pentru un contrast mai bun pe conținutul compatibil.' : ''} ${connect}`,
  ];
  const faq = [
    { q: `Cât costă ${esc(p.title)}?`, a: `${esc(p.title)} costă ${price} la ${m}${reduced ? `, redus de la ${money(p.oldPrice)}` : ''}. Prețul este actualizat periodic.` },
    { q: `Ce diagonală are?`, a: specs.inch ? `Are o diagonală de ${specs.inch} inch (${specs.cm} cm). ${sizeAdvice}` : `Verifică diagonala în secțiunea de specificații de mai sus.` },
    { q: `Ce rezoluție are?`, a: `Are ${resTxt}.` },
    { q: `Este Smart TV?`, a: specs.smart ? `Da, rulează pe ${specs.smart}, cu aplicații de streaming integrate.` : `Verifică specificațiile — dacă nu are sistem smart, îi poți adăuga un stick de streaming ieftin.` },
    { q: `De unde îl pot cumpăra?`, a: `Îl găsești la ${m}, prin ${SITE_NAME} — îți arătăm prețul curent și te ducem direct la ofertă.` },
  ];
  return { intro, guide, faq };
}

// ---- honest "modified" date via content-hash ledger (gitignored, persists on server) ----
const LEDGER = fileURLToPath(new URL('../.cache/modified-ledger.json', import.meta.url));
const oldLedger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
const newLedger = {};
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ---- build dataset ----
const seen = new Set();
const products = [];
for (const p of rows) {
  const img = imgUrl(p.img, p.title);
  if (!img) continue;
  const cu = (CAMPAIGN[p.merchantSlug] || {}).c;
  if (!cu) continue;
  const idKey = String(p.id).toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = sl(p.title).slice(0, 58).replace(/-+$/, '');
  let slug = (base ? base + '-' : 'tv-') + idKey;
  if (seen.has(slug)) { let k = 2; while (seen.has(slug + '-' + k)) k++; slug += '-' + k; }
  seen.add(slug);
  const specs = parseSpecs(p.title, p.descr, p.brand);
  const affiliate = `https://event.2performant.com/events/click?ad_type=product_store&aff_code=${AFF}&unique=${encodeURIComponent(p.id)}&campaign_unique=${cu}`;
  const prose = genProse(p, specs);
  const mSlug = (p.merchant || '').replace(/\/+$/, '').split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'magazin';
  const M_NAMES = { evomag: 'evoMAG', dwyn: 'Dwyn', ozone: 'Ozone', flanco: 'Flanco', vonmag: 'Vonmag' };
  const mName = M_NAMES[mSlug] || (mSlug.charAt(0).toUpperCase() + mSlug.slice(1));
  const brandSlug = specs.brand ? sl(specs.brand) : '';
  const band = sizeBand(specs.inch);
  const chash = seedOf(`${p.price}|${p.oldPrice}|${p.title}|${img}|${JSON.stringify(specs)}`);
  const prev = oldLedger[p.id];
  const modified = (prev && prev.h === chash) ? prev.m : BUILD_DATE;
  newLedger[p.id] = { h: chash, m: modified, s: slug, b: brandSlug, z: band, d: BUILD_DATE };
  products.push({
    slug, id: p.id, name: p.title, brand: specs.brand, brandSlug, price: p.price, oldPrice: p.oldPrice > p.price ? p.oldPrice : null,
    merchant: p.merchant, merchantSlug: mSlug, merchantName: mName, img, affiliate, modified, band,
    specs: { Brand: specs.brand || '—', Diagonală: specs.inch ? `${specs.inch}" (${specs.cm} cm)` : '—', Panou: specs.panel, Rezoluție: specs.rezolutie, ...(specs.smart ? { 'Sistem smart': specs.smart } : {}), ...(specs.hdr ? { HDR: 'Da' } : {}) },
    prose,
  });
}

// ---- dropped products -> 301 to a similar surviving one (mirrors the server; never bare 404) ----
const RETAIN_DAYS = 150;
const cutoff = new Date(new Date(BUILD_DATE + 'T00:00:00Z').getTime() - RETAIN_DAYS * 864e5).toISOString().slice(0, 10);
const byBrandBand = {};
for (const p of products) (byBrandBand[`${p.brandSlug}|${p.band}`] ||= []).push(p);
const brandPages = new Set();
{ const bc = {}; for (const p of products) if (p.brandSlug) bc[p.brandSlug] = (bc[p.brandSlug] || 0) + 1; for (const b in bc) if (bc[b] >= 4) brandPages.add(b); }
const dropped = {};
for (const id of Object.keys(oldLedger)) {
  if (newLedger[id]) continue;
  const e = oldLedger[id];
  if (!e || !e.s) continue;
  if ((e.d || '0') < cutoff) continue;
  const sim = byBrandBand[`${e.b}|${e.z}`];
  const target = (sim && sim.length) ? `/tv/${sim[0].slug}/` : (brandPages.has(e.b) ? `/brand/${e.b}/` : '/oferte/');
  dropped[e.s] = target;
  newLedger[id] = e;
}

mkdirSync(fileURLToPath(new URL('../src/data', import.meta.url)), { recursive: true });
writeFileSync(OUT, JSON.stringify(products));
mkdirSync(fileURLToPath(new URL('../.cache', import.meta.url)), { recursive: true });
writeFileSync(LEDGER, JSON.stringify(newLedger));
writeFileSync(fileURLToPath(new URL('../.cache/dropped.json', import.meta.url)), JSON.stringify(dropped));
const changed = products.filter((p) => p.modified === BUILD_DATE).length;
console.log(`  modified-ledger: ${changed}/${products.length} dated today; ${Object.keys(dropped).length} dropped-product 301s active`);
const bands = {}; for (const p of products) bands[p.band] = (bands[p.band] || 0) + 1;
const brands = {}; for (const p of products) brands[p.brand] = (brands[p.brand] || 0) + 1;
console.log(`generated ${products.length} cheap-TV products -> ${OUT}`);
console.log('  by size band:', JSON.stringify(bands));
console.log('  top brands:', Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(', '));
