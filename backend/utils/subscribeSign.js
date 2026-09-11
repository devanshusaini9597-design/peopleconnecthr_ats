const { JWT_SECRET } = require('../middleware/authMiddleware');
const crypto = require('crypto');

const getSecret = () => (process.env.SUBSCRIBE_SECRET || JWT_SECRET || '').trim();

function signEmail(email) {
  const secret = getSecret();
  if (!secret) throw new Error('SUBSCRIBE_SECRET or JWT_SECRET is required');
  const e = (email || '').toString().toLowerCase().trim();
  return crypto.createHmac('sha256', secret).update(e).digest('hex');
}

function verifySig(email, sig) {
  if (!email || !sig || !getSecret()) return false;
  const expected = signEmail(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { signEmail, verifySig };
