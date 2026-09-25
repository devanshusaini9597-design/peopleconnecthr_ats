const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const APP_NAME = process.env.MFA_APP_NAME || 'SkillNix ATS';

const encryptSecret = (secret) => encrypt(secret);
const decryptSecret = (stored) => {
  if (!stored) return '';
  if (isEncrypted(stored)) return decrypt(stored) || '';
  return stored;
};

const generateSecret = () => authenticator.generateSecret();

const keyUri = (email, secret) =>
  authenticator.keyuri(email, APP_NAME, secret);

const verifyTotp = (secret, token) => {
  const plain = decryptSecret(secret);
  if (!plain) return false;
  try {
    return authenticator.check(String(token).replace(/\s/g, ''), plain);
  } catch (err) {
    return false;
  }
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
  verifyTotp,
  generateBackupCodes,
  verifyBackupCode
};
