/**
 * One-shot: Hostinger-style social icons (white glyph on charcoal rounded square).
 * Writes PNGs to backend/public/email-brand/social and frontend/public/email-brand/social.
 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const SIZE = 72;
const BG = '#4a4a4a';
const FG = '#ffffff';
const RADIUS = 16;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function base() {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = BG;
  roundedRect(ctx, 0, 0, SIZE, SIZE, RADIUS);
  ctx.fill();
  ctx.fillStyle = FG;
  ctx.strokeStyle = FG;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { canvas, ctx };
}

function linkedin({ ctx }) {
  ctx.font = '700 32px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('in', SIZE / 2, SIZE / 2 + 1);
}

function facebook({ ctx }) {
  ctx.font = '700 38px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('f', SIZE / 2 + 1, SIZE / 2 + 1);
}

function instagram({ ctx }) {
  ctx.lineWidth = 4;
  roundedRect(ctx, 18, 18, 36, 36, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(48, 24, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function twitter({ ctx }) {
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(22, 22);
  ctx.lineTo(50, 50);
  ctx.moveTo(50, 22);
  ctx.lineTo(22, 50);
  ctx.stroke();
}

function youtube({ ctx }) {
  ctx.beginPath();
  ctx.moveTo(29, 24);
  ctx.lineTo(50, 36);
  ctx.lineTo(29, 48);
  ctx.closePath();
  ctx.fill();
}

function github({ ctx }) {
  ctx.beginPath();
  ctx.arc(SIZE / 2, 30, 14, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.arc(SIZE / 2, 38, 16, Math.PI * 0.85, Math.PI * 0.15, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(29, 28, 2.2, 0, Math.PI * 2);
  ctx.arc(43, 28, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

const ICONS = {
  linkedin,
  facebook,
  instagram,
  twitter,
  youtube,
  github,
};

function writePng(name, draw) {
  const { canvas, ctx } = base();
  draw({ canvas, ctx });
  return canvas.toBuffer('image/png');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const dirs = [
    path.join(__dirname, '..', 'public', 'email-brand', 'social'),
    path.join(__dirname, '..', '..', 'frontend', 'public', 'email-brand', 'social'),
  ];
  dirs.forEach(ensureDir);
  for (const [name, draw] of Object.entries(ICONS)) {
    const buf = writePng(name, draw);
    for (const dir of dirs) {
      fs.writeFileSync(path.join(dir, `${name}.png`), buf);
    }
    console.log(`wrote ${name}.png`);
  }
}

main();
