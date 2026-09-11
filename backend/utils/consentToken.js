const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/authMiddleware');

function consentTokenForCandidate(candidateId) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`messaging-consent:${String(candidateId)}`)
    .digest('hex')
    .slice(0, 32);
}

function consentTokenValid(candidateId, token) {
  const provided = String(token || '');
  const expected = consentTokenForCandidate(candidateId);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { consentTokenForCandidate, consentTokenValid };
