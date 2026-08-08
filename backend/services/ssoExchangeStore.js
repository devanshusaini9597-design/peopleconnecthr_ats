/**
 * One-time SSO exchange codes.
 *
 * After a successful SAML ACS validation, we don't want to put a long-lived
 * JWT directly in a browser-history-visible redirect URL. Instead we mint a
 * short-lived, single-use code, redirect the browser with just that code,
 * and the frontend immediately exchanges it (POST /api/sso/exchange) for
 * the real JWT.
 *
 * NOTE: this is an in-memory store — fine for a single backend instance.
 * If you run multiple backend instances behind a load balancer, replace
 * this with a shared store (Redis) so any instance can serve the exchange.
 */
const CODE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const store = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [code, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(code);
  }
};
setInterval(cleanup, 60 * 1000).unref?.();

const createCode = (payload) => {
  const code = require('crypto').randomBytes(24).toString('hex');
  store.set(code, { payload, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
};

const consumeCode = (code) => {
  const entry = store.get(code);
  if (!entry) return null;
  store.delete(code); // single-use
  if (entry.expiresAt < Date.now()) return null;
  return entry.payload;
};

module.exports = { createCode, consumeCode };
