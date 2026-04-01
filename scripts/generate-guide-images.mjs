import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../public/assets/images', import.meta.url));
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.OPENAI_API_KEY;

const images = [
  {
    name: 'cum-alegi-televizor-ieftin-2026',
    prompt: 'A modern living room with a 43 inch LED TV on a minimalist stand, warm ambient lighting, cozy Romanian home interior, realistic photography style, no text or logos'
  },
  {
    name: 'televizor-led-vs-qled-comparatie',
    prompt: 'Side by side comparison of two flat screen TVs showing colorful nature content, one LED and one QLED, in a bright showroom setting, clean white background, realistic product photography, no text'
  },
  {
    name: 'televizor-smart-tv-streaming-aplicatii',
    prompt: 'Close up of a smart TV screen showing a streaming app interface with movie thumbnails, modern living room background blurred, warm lighting, realistic photography, no specific brand logos'
  },
  {
    name: 'televizor-32-inch-dormitor-bucatarie',
    prompt: 'A compact 32 inch TV mounted on a bedroom wall above a small wooden desk, cozy European bedroom interior, soft warm lighting, minimalist decor, realistic photography, no text'
  },
  {
    name: 'televizor-43-inch-living-sufragerie',
    prompt: 'A 43 inch TV in a modern Romanian living room on a TV console, family watching content, warm ambient evening lighting, cozy home setting, realistic photography, no text or logos'
  }
];

async function generateImage(img) {
  const outPath = OUT_DIR + '/' + img.name + '.webp';
  if (existsSync(outPath)) { console.log('  SKIP (exists)'); return; }

  console.log('  Generating...');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: img.prompt,
      n: 1,
      size: '1536x1024',
      quality: 'high'
    })
  });

  const data = await res.json();
  if (data.error) { console.log('  ERROR:', data.error.message); return; }

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) { console.log('  NO IMAGE DATA'); return; }

  const buffer = Buffer.from(b64, 'base64');
  const sharp = (await import('sharp')).default;
  await sharp(buffer).webp({ quality: 85 }).toFile(outPath);
  console.log('  OK');
}

console.log('Generating ' + images.length + ' guide images...\n');
for (const img of images) {
  console.log(img.name + ':');
  await generateImage(img);
}
console.log('\nDone!');
