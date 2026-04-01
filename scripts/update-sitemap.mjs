import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = 'https://televizorieftin.ro';
const now = new Date().toISOString().split('T')[0];
const pages = ['/', '/despre-noi/'];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${base}${p}</loc><lastmod>${now}</lastmod><changefreq>${p === '/' ? 'daily' : 'monthly'}</changefreq><priority>${p === '/' ? '1.0' : '0.5'}</priority></url>`).join('\n')}
</urlset>`;

writeFileSync(fileURLToPath(new URL('../public/sitemap.xml', import.meta.url)), xml);
console.log('Sitemap updated:', now);
