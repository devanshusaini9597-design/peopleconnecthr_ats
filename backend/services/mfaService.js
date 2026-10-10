const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const APP_NAME = process.env.MFA_APP_NAME || 'People Connect HR';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(str) {
  const clean = String(str || '').toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(bin % 1e6).padStart(6, '0');
}

function totpAt(secretB32, atMs = Date.now()) {
  const secretBuf = fromBase32(secretB32);
  if (!secretBuf.length) return '';
  const counter = Math.floor(atMs / 30000);
  return hotp(secretBuf, counter);
}

const encryptSecret = (secret) => encrypt(secret);
const decryptSecret = (stored) => {
  if (!stored) return '';
  if (isEncrypted(stored)) return decrypt(stored) || '';
  return stored;
};

const generateSecret = () => toBase32(crypto.randomBytes(20));

const keyUri = (email, secret) => {
  const label = encodeURIComponent(`${APP_NAME}:${email}`);
  const issuer = encodeURIComponent(APP_NAME);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
};

const generateTotp = (secret, atMs = Date.now()) => totpAt(decryptSecret(secret) || secret, atMs);

const verifyTotp = (secret, token) => {
  const plain = decryptSecret(secret);
  if (!plain) return false;
  const code = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const now = Date.now();
  for (const delta of [-1, 0, 1]) {
    if (totpAt(plain, now + delta * 30000) === code) return true;
  }
  return false;
};

const generateBackupCodes = async (count = 10) => {
  const codes = [];
  const hashed = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
    hashed.push({ code: await bcrypt.hash(code, 10), used: false });
  }
  return { plainCodes: codes, hashedCodes: hashed };
};

const verifyBackupCode = async (user, code) => {
  if (!user.mfaBackupCodes?.length || !code) return false;
  const normalized = String(code).replace(/\s/g, '').toUpperCase();
  for (const entry of user.mfaBackupCodes) {
    if (entry.used) continue;
    const match = await bcrypt.compare(normalized, entry.code);
    if (match) {
      entry.used = true;
      return true;
    }
  }
  return false;
};

module.exports = {
  encryptSecret,
  decryptSecret,
  generateSecret,
  keyUri,
  generateTotp,
  verifyTotp,
  generateBackupCodes,
  verifyBackupCode
};
