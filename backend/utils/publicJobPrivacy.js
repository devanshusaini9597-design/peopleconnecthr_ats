/**
 * Public careers pages must not leak client / legal-entity names.
 * Internal ATS still stores and shows the real client.
 * Own-company hires may show the organisation name.
 */

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEEP_UPPER = new Set(['IT', 'ITES', 'BPO', 'FMCG', 'BFSI', 'HR', 'CEO', 'CTO', 'CFO']);

function titleCaseWords(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/[A-Za-z][A-Za-z']*/g, (word) => {
    const upper = word.toUpperCase();
    if (KEEP_UPPER.has(upper) || (word.length <= 3 && word === upper && /[A-Z]{2,}/.test(word))) {
      return upper;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

const DOMAIN_LINES = {
  BANKING: 'For A Leading Bank',
  BFSI: 'For A Leading Bank',
  'LIFE INSURANCE': 'For A Leading Life Insurance Company',
  'GENERAL INSURANCE': 'For A Leading General Insurance Company',
  'HEALTH INSURANCE': 'For A Leading Health Insurance Company',
  INSURANCE: 'For A Leading Insurance Company',
  'IT / SOFTWARE': 'For A Leading IT / Software Company',
  'ITES / BPO': 'For A Leading ITES / BPO Company',
  MANUFACTURING: 'For A Leading Manufacturing Organisation',
  'PHARMA / HEALTHCARE': 'For A Leading Pharma / Healthcare Organisation',
  FMCG: 'For A Leading FMCG Organisation',
  RETAIL: 'For A Leading Retail Organisation',
  'REAL ESTATE': 'For A Leading Real-Estate Organisation',
  EDUCATION: 'For A Leading Education Organisation',
  TELECOM: 'For A Leading Telecom Organisation',
};

function publicDomainLabel(industry) {
  const raw = String(industry || '').trim();
  if (!raw) return '';
  const key = raw.toUpperCase().replace(/\s+/g, ' ');
  if (DOMAIN_LINES[key]) return DOMAIN_LINES[key];
  if (/\bbank/i.test(raw)) return 'For A Leading Bank';
  if (/insur/i.test(raw)) return 'For A Leading Insurance Company';
  return titleCaseWords(`For a leading ${raw.toLowerCase().replace(/\s+/g, ' ')} organisation`);
}

function normOrgName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b(PVT|LTD|LIMITED|PRIVATE|LLP|INC|LLC)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOwnCompanyHire(clientName, orgName) {
  const client = String(clientName || '').trim();
  if (!client) return true;
  const org = String(orgName || '').trim();
  if (!org) return false;
  return normOrgName(client) === normOrgName(org);
}

function publicEmployerLabel({ industry, clientName, orgName } = {}) {
  if (isOwnCompanyHire(clientName, orgName)) {
    return titleCaseWords(orgName);
  }
  return publicDomainLabel(industry);
}

function scrubPublicJobHtml(html, clientName) {
  let out = String(html || '');
  out = out.replace(/<p[^>]*>\s*(?:<strong>)?\s*(?:Client\s*Name|Legal\s*Entity)\s*(?:<\/strong>)?\s*[:\-–]\s*[\s\S]*?<\/p>/gi, '');
  out = out.replace(/(?:Client\s*Name|Legal\s*Entity)\s*[:\-–]\s*[^\n<]+/gi, '');
  const name = String(clientName || '').trim();
  if (name.length >= 4) {
    out = out.replace(new RegExp(escapeRegex(name), 'gi'), '');
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = {
  titleCaseWords,
  publicDomainLabel,
  isOwnCompanyHire,
  publicEmployerLabel,
  scrubPublicJobHtml,
};
