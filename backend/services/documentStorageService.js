/**
 * Document storage — prefers org BYOK storage adapter (S3/Azure/GCS),
 * optionally wraps payloads with customer-managed KMS, then falls back
 * to platform env-based s3Service.
 */
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { getAdapter } = require('../adapters');
const s3Service = require('./s3Service');

const BYOK_PREFIX = 'byok';

function isByokResume(resumeValue) {
  if (!resumeValue || typeof resumeValue !== 'string') return false;
  return resumeValue.replace(/^\/+/, '').startsWith(`${BYOK_PREFIX}/`);
}

/**
 * Upload resume for an org. Returns { key, storage: 'byok'|'platform'|'local' }.
 */
async function uploadResume({ organizationId, localFilePath, originalName }) {
  const body = fs.readFileSync(localFilePath);
  const ext = path.extname(originalName) || path.extname(localFilePath) || '.pdf';
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const objectPath = `resumes/${uniqueName}`;

  const storage = organizationId ? await getAdapter(organizationId, 'storage') : null;
  if (storage) {
    let payload = body;
    const kms = await getAdapter(organizationId, 'encryption');
    if (kms && typeof kms.encrypt === 'function') {
      try {
        const enc = await kms.encrypt(body);
        // Store ciphertext as base64 buffer when KMS returns ciphertext blob
        payload = Buffer.from(enc.ciphertext || enc, typeof enc.ciphertext === 'string' ? 'base64' : undefined);
        if (!Buffer.isBuffer(payload)) payload = Buffer.from(String(enc.ciphertext || enc), 'utf8');
      } catch (err) {
        console.warn('[documentStorage] KMS encrypt failed, storing plaintext in BYOK bucket:', err.message);
        payload = body;
      }
    }
    const result = await storage.upload({
      path: objectPath,
      body: payload,
      contentType: contentTypeFor(ext)
    });
    const key = `${BYOK_PREFIX}/${result.key || objectPath}`;
    return { key, storage: 'byok' };
  }

  const platform = await s3Service.uploadResumeFromFile(localFilePath, originalName);
  if (platform?.key) return { key: platform.key, storage: 'platform' };
  return { key: null, storage: 'local' };
}

/**
 * Resolve a readable stream for a resume key (BYOK or platform S3).
 */
async function getResumeStream({ organizationId, resumeValue }) {
  const value = String(resumeValue || '').replace(/^\/+/, '').trim();

  if (isByokResume(value) && organizationId) {
    const storage = await getAdapter(organizationId, 'storage');
    if (!storage) return null;
    const objectKey = value.slice(BYOK_PREFIX.length + 1);
    if (typeof storage.getObject === 'function') {
      const obj = await storage.getObject(objectKey);
      let buf = obj.body;
      const kms = await getAdapter(organizationId, 'encryption');
      if (kms && typeof kms.decrypt === 'function' && Buffer.isBuffer(buf)) {
        try {
          const plain = await kms.decrypt(buf.toString('base64'));
          buf = Buffer.isBuffer(plain) ? plain : Buffer.from(String(plain), 'utf8');
        } catch {
          /* serve as stored if decrypt fails */
        }
      }
      return {
        stream: Readable.from(buf),
        contentType: obj.contentType || contentTypeFor(path.extname(objectKey))
      };
    }
    if (typeof storage.getSignedUrl === 'function') {
      const url = await storage.getSignedUrl(objectKey, { expiresIn: 300 });
      return { redirectUrl: url, contentType: contentTypeFor(path.extname(objectKey)) };
    }
    return null;
  }

  if (s3Service.isS3Resume(value)) {
    return s3Service.getResumeStream(value);
  }
  return null;
}

function contentTypeFor(ext) {
  const mime = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };
  return mime[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  uploadResume,
  getResumeStream,
  isByokResume,
  BYOK_PREFIX
};
