// Procesor produse eMAG (din colector) -> src/data/emag-tvs.json + imagini WebP locale.
// Flux: /dump colector -> filtreaza TV reale (350-1500 lei, are diagonala, nu accesorii)
//   -> enrich (inch din cm/nume, rezolutie, panou, smart, an, brand) -> slug stabil
//   -> deeplink profitshare lps/9/ZmA -> descarca imaginea full-res -> WebP 500x500 local.
// Rulare: node scripts/gen-emag.mjs [--no-img]  (--no-img sare descarcarea imaginilor, doar JSON)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COLLECTOR = 'https://tvieftin-emag-collector.flat-scene-36ff.workers.dev';
const SECRET = 'tvief_emag_2026';
const DEEPLINK = (url) => 'https://l.profitshare.ro/lps/9/ZmA/?redirect=' + encodeURIComponent(url);
const OUT_JSON = fileURLToPath(new URL('../src/data/emag-tvs.json', import.meta.url));
const IMG_DIR = fileURLToPath(new URL('../public/assets/images/products', import.meta.url));
const NO_IMG = process.argv.includes('--no-img');
if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true });

const ACCESSORY = /\b(suport|telecomand|cablu|soundbar|hus[ae]|stand|adaptor|carcas|protec[tț]|montaj|garan[tț]|abonament|kit |ram[ăa] |perete|consol[ăa] tv|comod[ăa]|dulap|picioare|troll|stick)\b/i;
const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 66).replace(/-+$/, '');

const spec = (p, ...needles) => {
  for (const [k, v] of Object.entries(p.specs || {})) {
    const kl = k.toLowerCase();
    if (needles.some((n) => kl.includes(n))) return String(v);
  }
  return '';
};
// cm -> inch standard (cu toleranta)
function toInch(p) {
  const nameInch = (p.name || '').match(/(\d{2})\s*(inch|inci|")/i);
  if (nameInch) return snapInch(+nameInch[1]);
  const dia = spec(p, 'diagonal');
  const cm = (dia.match(/(\d{2,3})\s*cm/) || [])[1];
  if (cm) return cmToInch(+cm);
  return null;
}
function cmToInch(cm) {
  const map = [[58, 61, 24], [78, 82, 32], [98, 102, 40], [106, 110, 43], [122, 128, 50], [136, 141, 55], [160, 166, 65]];
  for (const [lo, hi, inch] of map) if (cm >= lo && cm <= hi) return inch;
  return snapInch(Math.round(cm / 2.54));
}
function snapInch(n) { return [24, 32, 40, 43, 50, 55, 65].reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a); }

function resolutionOf(p) {
  const s = (spec(p, 'claritate', 'rezolut') + ' ' + p.name).toLowerCase();
  if (/(4k|ultra hd|uhd|2160)/.test(s)) return '4K';
  if (/(full hd|fhd|1080)/.test(s)) return 'Full HD';
  if (/(hd ready|hd\b|1366|720)/.test(s)) return 'HD';
  return '';
}
function panelOf(p) {
  const s = (spec(p, 'tehnologie display', 'tip display', 'panou') + ' ' + p.name).toUpperCase();
  if (/QLED/.test(s)) return 'QLED';
  if (/OLED/.test(s)) return 'OLED';
  return 'LED';
}
function smartOf(p) {
  const tip = spec(p, 'tip tv').toLowerCase();
  const os = spec(p, 'sistem de operare', 'platforma');
  return /smart/.test(tip) || /smart/i.test(p.name) || !!os;
}

async function fetchDump() {
  const r = await fetch(COLLECTOR + '/dump?k=' + SECRET);
  const j = await r.json();
  return j.products || [];
}

async function downloadImg(rawUrl, slug) {
  const out = IMG_DIR + '/' + slug + '.webp';
  if (existsSync(out)) return true;
  let url = String(rawUrl).replace(/&amp;/g, '&').replace(/width=\d+/, 'width=600').replace(/height=\d+/, 'height=600');
  if (!/width=/.test(url)) url += (url.includes('?') ? '&' : '?') + 'width=600&height=600';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    const sharp = (await import('sharp')).default;
    await sharp(buf).resize(500, 500, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).webp({ quality: 82 }).toFile(out);
    return true;
  } catch (e) { console.log('  IMG FAIL', slug, e.message); return false; }
}

const raw = await fetchDump();
console.log('din colector:', raw.length);

// FILTRARE
const kept = [];
for (const p of raw) {
  if (!p.price || p.price < 350 || p.price > 1500) continue;
  if (ACCESSORY.test(p.name)) continue;
  if (!/televizor|\btv\b|smart tv/i.test((p.breadcrumb || []).join(' ') + ' ' + p.name)) continue;
  const inch = toInch(p);
  if (!inch) continue; // fara diagonala = nu-l putem incadra
  kept.push({
    id: p.id,
    slug: slugify(p.name) + '-' + String(p.id).toLowerCase(),
    name: p.name,
    brand: p.brand || '',
    brandSlug: slugify(p.brand || ''),
    price: Math.round(p.price),
    rating: p.rating || null,
    reviews: p.reviewCount || 0,
    inch,
    resolution: resolutionOf(p),
    panel: panelOf(p),
    smart: smartOf(p),
    os: spec(p, 'sistem de operare', 'platforma') || '',
    year: (spec(p, 'an aparitie', 'an lansare').match(/20\d\d/) || [''])[0],
    url: p.url,
    affiliate: DEEPLINK(p.url),
    img: '/assets/images/products/' + slugify(p.name) + '-' + String(p.id).toLowerCase() + '.webp',
    rawImg: (p.images || [])[0] || '',
  });
}
// dedup pe slug
const byId = {}; for (const k of kept) byId[k.slug] = k;
const list = Object.values(byId).sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.price - b.price);
console.log('TV valide dupa filtrare:', list.length);

// distributie
const dist = {}; for (const p of list) dist[p.inch + '"'] = (dist[p.inch + '"'] || 0) + 1;
console.log('pe diagonala:', dist);
const res = {}; for (const p of list) res[p.resolution || '?'] = (res[p.resolution || '?'] || 0) + 1;
console.log('pe rezolutie:', res);

// imagini
if (!NO_IMG) {
  let ok = 0;
  for (const p of list) { if (await downloadImg(p.rawImg, p.slug)) ok++; }
  console.log('imagini WebP:', ok + '/' + list.length);
}

// scrie JSON (fara rawImg)
writeFileSync(OUT_JSON, JSON.stringify(list.map(({ rawImg, ...r }) => r), null, 0));
console.log('scris', OUT_JSON);
