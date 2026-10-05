/**
 * Persist inbox attachments to S3 when configured, otherwise local disk.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { putObject, getAssetBuffer, isS3Configured } = require('./s3Service');
const { isAllowedUploadFilename } = require('../utils/uploadAllowlist');

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 5;
const LOCAL_ROOT = path.join(__dirname, '..', 'uploads', 'inbox');

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function safeName(original) {
  return path.basename(String(original || 'file'))
    .replace(/[^\w.\- ()]/g, '_')
    .slice(0, 120) || 'file';
}

async function persistOne(organizationId, file) {
  const filename = safeName(file.originalname || file.filename);
  if (!isAllowedUploadFilename(filename)) {
    throw httpError(`File type not allowed: ${filename}`);
  }
  const buf = Buffer.isBuffer(file.buffer)
    ? file.buffer
    : Buffer.from(file.content || file.buffer || []);
  if (!buf.length) throw httpError('Empty attachment');
  if (buf.length > MAX_BYTES) throw httpError('Each attachment must be 8 MB or smaller');
  const id = crypto.randomBytes(8).toString('hex');
  const contentType = file.mimetype || file.contentType || 'application/octet-stream';
  const key = `inbox/${organizationId}/${id}/${filename}`;
  if (isS3Configured()) {
    const ok = await putObject({ key, body: buf, contentType });
    if (!ok) throw httpError('Could not store attachment', 500);
    return { filename, contentType, size: buf.length, storageKey: key };
  }
  const dir = path.join(LOCAL_ROOT, String(organizationId), id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buf);
  return {
    filename,
    contentType,
    size: buf.length,
    storageKey: `local:${path.join(dir, filename)}`,
  };
}

async function persistMany(organizationId, files = []) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (list.length > MAX_FILES) throw httpError(`At most ${MAX_FILES} attachments`);
  const out = [];
  for (const file of list) {
    out.push(await persistOne(organizationId, file));
  }
  return out;
}

async function readBuffer(storageKey) {
  const key = String(storageKey || '');
  if (key.startsWith('local:')) {
    const p = key.slice(6);
    if (!p.startsWith(LOCAL_ROOT)) throw httpError('Invalid attachment', 400);
    return fs.readFileSync(p);
  }
  if (isS3Configured()) {
    const asset = await getAssetBuffer(key);
    if (asset?.buffer) return asset.buffer;
  }
  throw httpError('Attachment not found', 404);
}

function toZeptoPayload(filename, contentType, buffer) {
  return {
    name: filename,
    mime_type: contentType || 'application/octet-stream',
    content: buffer.toString('base64'),
  };
}

function toSmtpPayload(filename, contentType, buffer) {
  return {
    filename,
    contentType: contentType || 'application/octet-stream',
    content: buffer,
  };
}

module.exports = {
  MAX_BYTES,
  MAX_FILES,
  persistOne,
  persistMany,
  readBuffer,
  toZeptoPayload,
  toSmtpPayload,
};
