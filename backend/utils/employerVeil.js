/**
 * Client / employer names stay internal. Outbound mail uses a generic industry label.
 */

function veiledEmployer(industry = '', clientName = '') {
  const blob = `${industry} ${clientName}`.toLowerCase();
  if (/\binsur/.test(blob)) return 'a leading insurance company';
  if (/\bbank|\bbfsi\b|\bnbfc\b/.test(blob)) return 'a leading bank';
  if (/\bpharma|\bhealth/.test(blob)) return 'a leading pharmaceutical company';
  if (/\bit\b|\bsoftware\b|\bsaas\b/.test(blob)) return 'a leading technology company';
  if (/\bfmcg\b/.test(blob)) return 'a leading FMCG company';
  if (/\btelecom/.test(blob)) return 'a leading telecom company';
  if (/\bretail\b/.test(blob)) return 'a leading retail company';
  if (/real estate|\brealty\b/.test(blob)) return 'a leading real estate company';
  if (/\bmanufactur|\bauto/.test(blob)) return 'a leading manufacturing company';
  if (/\bfintech\b|\bfinance\b/.test(blob)) return 'a leading financial services company';
  if (/^a leading\b/i.test(String(clientName || '').trim())) return String(clientName).trim();
  return 'a leading organization';
}

function stripClientName(text, clientName) {
  let s = String(text || '');
  const name = String(clientName || '').trim();
  if (name.length >= 2 && !/^a leading\b/i.test(name)) {
    s = s.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  s = s.replace(/client\s*name\s*[-–:]\s*/gi, ' ');
  return s.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
}

function looksLikeJdDump(text) {
  const s = String(text || '');
  if (!s) return false;
  const keys = [
    /\bjob\s*title\s*:/i,
    /\bindustry\s*:/i,
    /\bemployment\s*type\s*:/i,
    /\bcompensation\s*:/i,
    /\bclient\s*name\b/i,
    /\bgrade\s*:/i,
    /\blocations?\s*:/i,
  ];
  return keys.filter((re) => re.test(s)).length >= 2;
}

function jobEmailSummary(text, clientName) {
  const cleaned = stripClientName(String(text || ''), clientName);
  if (!cleaned) return '';
  if (looksLikeJdDump(cleaned)) return '';
  return cleaned.slice(0, 280);
}

function cleanApplyUrl(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  s = s.replace(/[?&]+$/g, '');
  s = s.replace(/\?&+/g, '?');
  return s;
}

/** Recruiting organization for {{company}} / sign-off — never the client brand. */
function outboundCompany(vars = {}, orgBrand = '') {
  const org = String(orgBrand || vars.orgName || '').trim();
  if (org) return org;
  const raw = String(vars.company || '').trim();
  if (raw && !/^a leading\b/i.test(raw)) return raw;
  return 'Talent Acquisition';
}

module.exports = {
  veiledEmployer,
  stripClientName,
  outboundCompany,
  looksLikeJdDump,
  jobEmailSummary,
  cleanApplyUrl,
};
