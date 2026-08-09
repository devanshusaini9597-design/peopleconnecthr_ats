/**
 * Company-domain helpers — invite lock + enterprise org allowlist.
 */
const Organization = require('../models/Organization');
const { getEmailDomain, validateWorkEmail } = require('./workEmail');

function parseDomainList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Domains that receive Enterprise plan (not a global unlock). Override via ENTERPRISE_ORG_DOMAINS. */
function getEnterpriseOrgDomains() {
  const fromEnv = parseDomainList(process.env.ENTERPRISE_ORG_DOMAINS);
  return fromEnv.length ? fromEnv : ['skillnix.com'];
}

function isEnterpriseOrgDomain(domain) {
  if (!domain) return false;
  return getEnterpriseOrgDomains().includes(String(domain).toLowerCase().trim());
}

function planForOrgDomain(domain, fallback = 'free_trial') {
  return isEnterpriseOrgDomain(domain) ? 'enterprise' : fallback;
}

/**
 * Collect allowed invite domains for an org (org.domain + allowedDomains + actor email fallback).
 */
function collectOrgInviteDomains({ orgDomain, allowedDomains, actorEmail }) {
  const set = new Set();
  if (orgDomain) set.add(String(orgDomain).toLowerCase().trim());
  (allowedDomains || []).forEach((d) => {
    if (d) set.add(String(d).toLowerCase().trim());
  });
  if (set.size === 0 && actorEmail) {
    const actorDomain = getEmailDomain(actorEmail);
    if (actorDomain) set.add(actorDomain);
  }
  return [...set].filter(Boolean);
}

/**
 * Invitee must use a work email on the same company domain as the org.
 */
function validateInviteEmail({ email, orgDomain, allowedDomains, actorEmail }) {
  const work = validateWorkEmail(email);
  if (!work.valid) return work;

  const inviteDomain = getEmailDomain(email);
  const allowed = collectOrgInviteDomains({ orgDomain, allowedDomains, actorEmail });

  if (allowed.length === 0) {
    return {
      valid: false,
      reason: 'Set your company domain in Organization settings before inviting teammates.',
      code: 'org_domain_required',
    };
  }

  if (!allowed.includes(inviteDomain)) {
    return {
      valid: false,
      reason: `Invite email must use your company domain (${allowed.join(', ')}).`,
      code: 'invite_domain_mismatch',
    };
  }

  return { valid: true, domain: inviteDomain };
}

/**
 * If org domain is on the Enterprise allowlist, ensure plan is enterprise (this org only).
 * Also backfills domain from owner email when missing.
 */
async function ensureOrgPlanForDomain(organizationId, ownerEmail) {
  if (!organizationId) return null;
  const org = await Organization.findById(organizationId);
  if (!org) return null;

  let domain = (org.domain || '').toLowerCase().trim();
  if (!domain && ownerEmail) {
    domain = getEmailDomain(ownerEmail);
    if (domain) {
      org.domain = domain;
      if (!Array.isArray(org.allowedDomains) || org.allowedDomains.length === 0) {
        org.allowedDomains = [domain];
      } else if (!org.allowedDomains.map((d) => String(d).toLowerCase()).includes(domain)) {
        org.allowedDomains.push(domain);
      }
    }
  }

  if (isEnterpriseOrgDomain(domain) && org.plan !== 'enterprise') {
    org.plan = 'enterprise';
    if (org.productPlans) org.productPlans.ats = 'enterprise';
    else org.productPlans = { ats: 'enterprise' };
  }

  if (org.isModified()) await org.save();
  return org;
}

module.exports = {
  getEmailDomain,
  getEnterpriseOrgDomains,
  isEnterpriseOrgDomain,
  planForOrgDomain,
  collectOrgInviteDomains,
  validateInviteEmail,
  ensureOrgPlanForDomain,
};
