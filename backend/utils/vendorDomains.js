/**
 * Platform-operator and optional preview-domain allowlists — no Mongoose.
 * Tenants (including Skillnix) are not special-cased in code; use env / org flags.
 */
const { getEmailDomain } = require('./workEmail');

function parseDomainList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Product operator (People Connect HR). Extra domains only via env. */
function getEnterpriseOrgDomains() {
  const fromEnv = parseDomainList(process.env.ENTERPRISE_ORG_DOMAINS);
  return fromEnv.length ? fromEnv : ['peopleconnecthr.com'];
}

function getPlatformOperatorDomains() {
  const fromEnv = parseDomainList(process.env.PLATFORM_OPERATOR_DOMAINS);
  return fromEnv.length ? fromEnv : ['peopleconnecthr.com'];
}

/**
 * Console login is an email allowlist, not the whole company domain.
 * Set PLATFORM_OPERATOR_EMAILS to add more platform owners.
 */
function getPlatformOperatorEmails() {
  const fromEnv = String(process.env.PLATFORM_OPERATOR_EMAILS || '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes('@'));
  return fromEnv.length ? fromEnv : ['owner@peopleconnecthr.com'];
}

/**
 * Workspaces that must never be archived or plan-downgraded (the vendor
 * tenant that runs this product). Override with VENDOR_PROTECTED_SLUGS.
 */
function getVendorProtectedSlugs() {
  const fromEnv = parseDomainList(process.env.VENDOR_PROTECTED_SLUGS);
  return fromEnv.length ? fromEnv : ['skillnix-recruitment'];
}

function isVendorProtectedOrg(org) {
  const slug = String(org?.slug || '').toLowerCase().trim();
  return Boolean(slug && getVendorProtectedSlugs().includes(slug));
}

function vendorDomainSet() {
  return new Set([...getEnterpriseOrgDomains(), ...getPlatformOperatorDomains()]);
}

/**
 * Unfinished modules: org.atsSettings.internalPreview, or product-operator domains from env.
 * Skillnix is a normal tenant unless that flag / env includes them.
 */
function hasInternalPreviewAccess(user, org) {
  if (!user || user.isDemo || org?.isDemo) return false;
  if (org?.atsSettings?.internalPreview === true) return true;

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
  getPlatformOperatorEmails,
  getVendorProtectedSlugs,
  isVendorProtectedOrg,
  hasInternalPreviewAccess,
};
