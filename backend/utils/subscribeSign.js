const crypto = require('crypto');

const getSecret = () => (process.env.SUBSCRIBE_SECRET || process.env.JWT_SECRET || 'skillnix-subscribe-secret').trim();

function signEmail(email) {
  const e = (email || '').toString().toLowerCase().trim();
  return crypto.createHmac('sha256', getSecret()).update(e).digest('hex');
}

function verifySig(email, sig) {
  if (!email || !sig) return false;
  const expected = signEmail(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { signEmail, verifySig };
