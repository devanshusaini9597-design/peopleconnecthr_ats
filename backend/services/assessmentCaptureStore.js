/**
 * Persist webcam captures on disk (not Mongo) so the hiring dashboard
 * can load them later. Path: uploads/private/assessments/{org}/{invite}/
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', 'uploads', 'private', 'assessments');

function assertSafeRel(rel) {
  const normalized = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith('private/assessments/')) return null;
  if (normalized.includes('..')) return null;
  return normalized;
}

function absFromRel(rel) {
  const safe = assertSafeRel(rel);
  if (!safe) return null;
  return path.join(__dirname, '..', 'uploads', safe);
}

function saveWebcamCapture({ organizationId, inviteId, dataUrl }) {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const ext = match[1].toLowerCase() === 'png' ? 'png' : match[1].toLowerCase() === 'webp' ? 'webp' : 'jpg';
  let buf;
  try {
    buf = Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
  if (buf.length < 400 || buf.length > 450000) return null;
  const org = String(organizationId || 'unknown');
  const invite = String(inviteId || 'unknown');
  const dir = path.join(ROOT, org, invite);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return {
    rel: `private/assessments/${org}/${invite}/${name}`,
    size: buf.length,
  };
}

function readCaptureAsDataUrl(rel) {
  const abs = absFromRel(rel);
  if (!abs || !fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

module.exports = { saveWebcamCapture, readCaptureAsDataUrl, assertSafeRel };
