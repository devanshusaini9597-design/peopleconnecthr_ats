/**
 * Vendor / Skillnix domain allowlists — no Mongoose (safe for unit tests).
 */
const { getEmailDomain } = require('./workEmail');

function parseDomainList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function getEnterpriseOrgDomains() {
  const fromEnv = parseDomainList(process.env.ENTERPRISE_ORG_DOMAINS);
  return fromEnv.length
    ? fromEnv
    : ['skillnix.com', 'peopleconnecthr.com', 'devlumiq.com', 'skillnixrecruitment.com'];
}

function getPlatformOperatorDomains() {
  const fromEnv = parseDomainList(process.env.PLATFORM_OPERATOR_DOMAINS);
  return fromEnv.length
    ? fromEnv
    : ['skillnix.com', 'peopleconnecthr.com', 'devlumiq.com', 'skillnixrecruitment.com'];
}

function vendorDomainSet() {
  return new Set([...getEnterpriseOrgDomains(), ...getPlatformOperatorDomains()]);
}

/**
 * Unfinished modules stay available to Skillnix / vendor orgs after deploy.
 * Demo accounts and customer tenants do not get them.
 */
function hasInternalPreviewAccess(user, org) {
  if (!user || user.isDemo || org?.isDemo) return false;

  const vendorDomains = vendorDomainSet();
  const orgDomain = String(org?.domain || '').toLowerCase().trim();
  if (orgDomain && vendorDomains.has(orgDomain)) return true;

  const allowed = Array.isArray(org?.allowedDomains) ? org.allowedDomains : [];
  if (allowed.some((d) => vendorDomains.has(String(d || '').toLowerCase().trim()))) {
    return true;
  }

  const emailDomain = getEmailDomain(user.email);
  return Boolean(emailDomain && vendorDomains.has(emailDomain));
}

module.exports = {
  parseDomainList,
  getEnterpriseOrgDomains,
  getPlatformOperatorDomains,
  hasInternalPreviewAccess,
};
