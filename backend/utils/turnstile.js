/**
 * Cloudflare Turnstile verification for public endpoints (careers OTP).
 */
const logger = require('./logger');

function turnstileKeys() {
  const siteKey = String(process.env.TURNSTILE_SITE_KEY || '').trim();
  const secretKey = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  return { siteKey, secretKey, enabled: Boolean(siteKey && secretKey) };
}

function publicTurnstileConfig() {
  const { siteKey, enabled } = turnstileKeys();
  return { enabled, siteKey: enabled ? siteKey : '' };
}

/**
 * Verify a Turnstile token when keys are configured.
 * When keys are missing, skips (logs in production) so OTP is not bricked before ops set keys.
 */
async function assertTurnstileToken(token, { remoteip } = {}) {
  const { siteKey, secretKey, enabled } = turnstileKeys();
  if (!enabled) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY missing — careers OTP CAPTCHA skipped');
    } else {
      logger.warn('Turnstile keys missing — skipping CAPTCHA in non-production');
    }
    return { skipped: true };
  }

  const response = String(token || '').trim();
  if (!response) {
    const err = new Error('Complete the security check and try again.');
    err.statusCode = 400;
    err.code = 'turnstile_required';
    throw err;
  }

  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', response);
  if (remoteip) body.set('remoteip', String(remoteip));

  let data;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    data = await res.json();
  } catch (err) {
    logger.error({ err: err.message }, 'Turnstile verify request failed');
    const e = new Error('Security check failed. Please try again.');
    e.statusCode = 503;
    e.code = 'turnstile_unavailable';
    throw e;
  }

  if (!data?.success) {
    logger.warn({ codes: data?.['error-codes'], siteKey: siteKey.slice(0, 8) }, 'Turnstile rejected');
    const e = new Error('Security check failed. Please refresh and try again.');
    e.statusCode = 400;
    e.code = 'turnstile_failed';
    throw e;
  }
  return { skipped: false, data };
}

module.exports = {
  turnstileKeys,
  publicTurnstileConfig,
  assertTurnstileToken,
};
