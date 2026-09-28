/** Public careers copy — hide client names; show own-company name when hiring internally. */

const KEEP_UPPER = new Set(['IT', 'ITES', 'BPO', 'FMCG', 'BFSI', 'HR', 'CEO', 'CTO', 'CFO']);

export function titleCaseWords(value) {
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

export function publicDomainLabel(industry) {
  const raw = String(industry || '').trim();
  if (!raw) return '';
  const key = raw.toUpperCase().replace(/\s+/g, ' ');
  const map = {
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
  if (map[key]) return map[key];
  if (/\bbank/i.test(raw)) return 'For A Leading Bank';
  if (/insur/i.test(raw)) return 'For A Leading Insurance Company';
  return titleCaseWords(`For a leading ${raw.toLowerCase().replace(/\s+/g, ' ')} organisation`);
}

export function publicJobDomain(job, orgName = '') {
  const labeled = String(job?.employerLabel || '').trim();
  if (labeled) return labeled;
  if (job?.ownHire && orgName) return titleCaseWords(orgName);
  return publicDomainLabel(job?.industry);
}
