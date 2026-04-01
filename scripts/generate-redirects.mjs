import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const products = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/products.json', import.meta.url)), 'utf-8'));
const all = products.televizoare || [];
const lines = [];
all.forEach(p => {
  lines.push(`/out/${p.slug}/ ${p.affiliate} 302`);
  lines.push(`/out/${p.slug} ${p.affiliate} 302`);
});
writeFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), lines.join('\n') + '\n');
console.log(`Generated ${lines.length} redirects`);
