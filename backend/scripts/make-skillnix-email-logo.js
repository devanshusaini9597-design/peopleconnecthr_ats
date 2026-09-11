/**
 * Convert the Skillnix wordmark to a true transparent PNG (near-black → alpha)
 * and write it to the public email-brand folders.
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const SRC = process.argv[2];
if (!SRC) {
  console.error('Usage: node scripts/make-skillnix-email-logo.js <source.png>');
  process.exit(1);
}

async function main() {
  const img = await loadImage(SRC);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Solid/near-black background only — keep the purple/cyan mark and white type.
    if (max < 28 && max - min < 10) {
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  const buf = canvas.toBuffer('image/png');
  const dests = [
    path.join(__dirname, '..', 'public', 'email-brand', 'skillnix-logo-email.png'),
    path.join(__dirname, '..', '..', 'frontend', 'public', 'skillnix-logo-email.png'),
    path.join(__dirname, '..', '..', 'frontend', 'public', 'skillnix-logo.png'),
  ];
  for (const dest of dests) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    console.log('wrote', dest, buf.length);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
