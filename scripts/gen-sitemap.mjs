// Full sitemap: static + oferte pagination + brand + magazin + all cheap-TV product pages, with images.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://televizorieftin.ro';
const PAGE = 48, MIN_BRAND = 4;
const recPath = fileURLToPath(new URL('../src/data/oferte.json', import.meta.url));
const recs = existsSync(recPath) ? JSON.parse(readFileSync(recPath, 'utf-8')) : [];
const FIXED = '2026-04-01';                                          // static/editorial baseline
const maxMod = (arr) => arr.reduce((m, p) => (p.modified && p.modified > m ? p.modified : m), FIXED);
const allMod = recs.length ? maxMod(recs) : FIXED;

const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const urls = [];
// lastmod = REAL content change, never build time (feedback-lastmod-pattern); img -> Google Images extension
const imgUrl = (u) => (String(u).startsWith('http') ? u : SITE + u);
const add = (loc, pri = '0.6', lastmod = allMod, imgs = null) => {
  const arr = (Array.isArray(imgs) ? imgs : (imgs ? [imgs] : [])).filter(Boolean);
  const imgXml = arr.map((u) => `<image:image><image:loc>${xe(imgUrl(u))}</image:loc></image:image>`).join('');
  urls.push(`  <url><loc>${SITE}${loc}</loc><lastmod>${lastmod}</lastmod><priority>${pri}</priority>${imgXml}</url>`);
};

add('/', '1.0', allMod);
add('/oferte/', '0.9', allMod);
['/despre-noi/', '/contact/', '/disclaimer-afiliere/', '/politica-confidentialitate/', '/politica-cookies/', '/termeni-si-conditii/'].forEach((u) => add(u, '0.3', FIXED));

const lastRec = Math.ceil(recs.length / PAGE);
for (let i = 2; i <= lastRec; i++) add(`/oferte/${i}/`, '0.5', allMod);

const byBrand = {};
for (const p of recs) if (p.brandSlug) (byBrand[p.brandSlug] ||= []).push(p);
for (const [b, items] of Object.entries(byBrand)) {
  if (items.length < MIN_BRAND) continue;
  const bm = maxMod(items);
  add(`/brand/${b}/`, '0.7', bm);
  const lb = Math.ceil(items.length / PAGE);
  for (let i = 2; i <= lb; i++) add(`/brand/${b}/${i}/`, '0.4', bm);
}
const byM = {};
for (const p of recs) if (p.merchantSlug) (byM[p.merchantSlug] ||= []).push(p);
for (const [m, items] of Object.entries(byM)) {
  const mm = maxMod(items);
  add(`/magazin/${m}/`, '0.7', mm);
  const lm = Math.ceil(items.length / PAGE);
  for (let i = 2; i <= lm; i++) add(`/magazin/${m}/${i}/`, '0.4', mm);
}
for (const p of recs) add(`/tv/${p.slug}/`, '0.6', p.modified || allMod, p.img);

// Landing pages (articole categorii) cu TOATE imaginile lor: hero + inline editoriale + poze produse featured.
const landingDir = fileURLToPath(new URL('../src/content/landings', import.meta.url));
const emagPath = fileURLToPath(new URL('../src/data/emag-tvs.json', import.meta.url));
const emag = existsSync(emagPath) ? JSON.parse(readFileSync(emagPath, 'utf-8')) : [];
let REVIEWS = {};
try { ({ REVIEWS } = await import(fileURLToPath(new URL('../src/data/landing-reviews.mjs', import.meta.url)))); } catch { /* none */ }
if (existsSync(landingDir)) {
  for (const file of readdirSync(landingDir).filter((f) => f.endsWith('.md'))) {
    const slug = file.replace(/\.md$/, '');
    const t = readFileSync(`${landingDir}/${file}`, 'utf-8');
    const heroM = t.match(/^hero:\s*"?([^"\n]+?)"?\s*$/m);
    const hero = heroM ? '/assets/images/landings/' + heroM[1].trim() : null;
    const upM = t.match(/^updated:\s*"?([0-9-]+)"?/m);
    const lastmod = upM ? upM[1] : FIXED;
    const inline = [...t.matchAll(/!\[[^\]]*\]\((\/assets\/images\/landings\/[^)]+)\)/g)].map((m) => m[1]);
    const prodImgs = (REVIEWS[slug] || [])
      .map((r) => emag.find((x) => x.name.includes(r.match)))
      .filter(Boolean).map((p) => p.img);
    const imgs = [...new Set([hero, ...inline, ...prodImgs].filter(Boolean))];
    add(`/${slug}/`, '0.8', lastmod, imgs);
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
writeFileSync(fileURLToPath(new URL('../public/sitemap.xml', import.meta.url)), xml);
console.log(`sitemap: ${urls.length} URLs`);
