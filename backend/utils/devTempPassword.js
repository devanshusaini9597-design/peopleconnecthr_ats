const crypto = require('crypto');

function flagOn(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function allowedDomains() {
  const raw = String(process.env.DEV_TEMP_PASSWORD_DOMAIN || 'skillnixrecruitment.com').trim();
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

function emailOnAllowedDomain(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return allowedDomains().some((domain) => normalized.endsWith(`@${domain}`));
}

function orgMatchesPin(organizationId) {
  const pin = String(process.env.DEV_TEMP_PASSWORD_ORGANIZATION_ID || '').trim();
  if (!pin || !organizationId) return false;
  return String(organizationId) === pin;
}

function isTempPasswordEnabledInThisEnv() {
  if (String(process.env.NODE_ENV || '').trim() !== 'production') return true;
  return flagOn('DEV_TEMP_PASSWORD_IN_PRODUCTION');
}

function passwordMatches(password) {
  const configured = String(process.env.DEV_TEMP_PASSWORD || '').trim();
  if (!configured || configured.length < 8) return false;
  const supplied = Buffer.from(String(password));
  const expected = Buffer.from(configured);
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(supplied, expected);
}

/**
 * Testing-phase overlay password. Does not change stored hashes.
 * Non-production: domain list (default skillnixrecruitment.com).
 * Production: only if DEV_TEMP_PASSWORD_IN_PRODUCTION=1, and either
 * the user's organizationId matches DEV_TEMP_PASSWORD_ORGANIZATION_ID
 * or their email is on DEV_TEMP_PASSWORD_DOMAIN.
 */
function isDevTempPasswordLogin(email, password, organizationId) {
  if (!isTempPasswordEnabledInThisEnv()) return false;
  if (!passwordMatches(password)) return false;

  const pin = String(process.env.DEV_TEMP_PASSWORD_ORGANIZATION_ID || '').trim();
  if (pin) return orgMatchesPin(organizationId);
  return emailOnAllowedDomain(email);
}

module.exports = { isDevTempPasswordLogin };
