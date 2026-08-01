/**
 * Field-level encryption for sensitive data at rest (API keys, OAuth tokens,
 * SMTP passwords, etc. stored in IntegrationConfig.credentials).
 *
 * AES-256-GCM: authenticated encryption, random IV per record.
 * Key comes from process.env.INTEGRATION_ENCRYPTION_KEY — a 32-byte key,
 * either as a 64-char hex string or any string (hashed down to 32 bytes with
 * sha256 so ops doesn't have to generate exactly-32-byte secrets by hand).
 *
 * Generate one with: `openssl rand -hex 32` (put it in backend/.env as
 * INTEGRATION_ENCRYPTION_KEY — never commit it, never reuse JWT_SECRET here).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

let cachedKey = null;

const getKey = () => {
  if (cachedKey) return cachedKey;

  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('INTEGRATION_ENCRYPTION_KEY environment variable is required in production to store integration credentials securely.');
    }
    console.warn('⚠️  INTEGRATION_ENCRYPTION_KEY not set — using an insecure development-only key. Set this before storing real credentials.');
    cachedKey = crypto.createHash('sha256').update('dev-only-insecure-key-CHANGE-ME').digest();
    return cachedKey;
  }

  // Accept either a 64-char hex string (32 bytes) or an arbitrary passphrase.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, 'hex');
  } else {
    cachedKey = crypto.createHash('sha256').update(raw).digest();
  }
  return cachedKey;
};

/**
 * Encrypts a JS value (object/string/etc.) into a single opaque string safe
 * to store in a Mongoose Mixed field.
 * @param {*} value
 * @returns {string} format: "v1:<ivBase64>:<tagBase64>:<ciphertextBase64>"
 */
const encrypt = (value) => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
};

/**
 * Decrypts a string produced by encrypt(). Returns null if input isn't in
 * the expected encrypted format (e.g. legacy plaintext record).
 * @param {string} payload
 * @returns {*}
 */
const decrypt = (payload) => {
  if (typeof payload !== 'string' || !payload.startsWith('v1:')) {
    return null;
  }
  const [, ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return null;

  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith('v1:');

module.exports = { encrypt, decrypt, isEncrypted };
