import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../public/assets/images/products', import.meta.url));
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const products = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/products.json', import.meta.url)), 'utf-8'));
const all = products.televizoare || [];

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function getImageUrl(slug) {
  // Build eMAG URL from linkuri.txt
  const linkuri = readFileSync(fileURLToPath(new URL('../linkuri.txt', import.meta.url)), 'utf-8');
  const lines = linkuri.trim().split('\n');
  for (const line of lines) {
    const parts = line.split(' - ');
    const url = parts[0].trim();
    if (url.includes('emag.ro')) {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'ro-RO,ro;q=0.9' },
      });
      const html = await res.text();
      const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
      if (ogMatch) return { url, imgUrl: ogMatch[1] };
    }
  }
  return null;
}

async function downloadImage(imgUrl, slug) {
  const outPath = OUT_DIR + '/' + slug + '.webp';
  if (existsSync(outPath)) { console.log('  SKIP (exists)'); return; }
  try {
    const res = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buffer = Buffer.from(await res.arrayBuffer());
    const sharp = (await import('sharp')).default;
    await sharp(buffer).resize(500, 500, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).webp({ quality: 85 }).toFile(outPath);
    console.log('  OK');
  } catch (e) { console.log('  FAIL: ' + e.message); }
}

const linkuri = readFileSync(fileURLToPath(new URL('../linkuri.txt', import.meta.url)), 'utf-8');
const lines = linkuri.trim().split('\n');

console.log('Downloading ' + all.length + ' images...\n');
for (const p of all) {
  console.log(p.slug + ':');
  const outPath = OUT_DIR + '/' + p.slug + '.webp';
  if (existsSync(outPath)) { console.log('  SKIP (exists)'); continue; }

  // Find matching eMAG URL
  const line = lines.find(l => {
    const name = l.split(' - ').pop().trim().toLowerCase();
    return name.includes(p.slug.split('-')[0]) || l.toLowerCase().includes(p.slug.replace(/-/g, '').slice(0, 8));
  });

  if (!line) {
    // Try by index
    const idx = all.indexOf(p);
    if (idx < lines.length) {
      const pageUrl = lines[idx].split(' - ')[0].trim();
      console.log('  Fetching from: ' + pageUrl.slice(0, 60) + '...');
      try {
        const res = await fetch(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'ro-RO,ro;q=0.9' },
        });
        const html = await res.text();
        const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
        if (ogMatch) {
          await downloadImage(ogMatch[1], p.slug);
        } else { console.log('  NO IMAGE'); }
      } catch (e) { console.log('  ERROR: ' + e.message); }
    } else { console.log('  NO MATCH'); }
  } else {
    const pageUrl = line.split(' - ')[0].trim();
    console.log('  Fetching from: ' + pageUrl.slice(0, 60) + '...');
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'ro-RO,ro;q=0.9' },
      });
      const html = await res.text();
      const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
      if (ogMatch) {
        await downloadImage(ogMatch[1], p.slug);
      } else { console.log('  NO IMAGE'); }
    } catch (e) { console.log('  ERROR: ' + e.message); }
  }
  await delay(2000 + Math.random() * 2000);
}
console.log('\nDone!');
