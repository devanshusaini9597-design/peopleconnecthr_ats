/**
 * Turn ATS location strings into Google JobPosting Place / remote signals.
 */
const { getStateFromLocation } = require('../data/locationToStateMap');

const COUNTRY_HINTS = [
  [/\b(united states|u\.s\.a\.|u\.s\.|\busa\b|\bus\b)\b/i, 'US'],
  [/\b(united kingdom|\buk\b|england|scotland|wales)\b/i, 'GB'],
  [/\b(united arab emirates|\buae\b|dubai|abu dhabi)\b/i, 'AE'],
  [/\b(singapore|\bsg\b)\b/i, 'SG'],
  [/\b(india|\bin\b|bharat)\b/i, 'IN'],
];

const REMOTE_RE = /\b(remote|wfh|work[\s-]?from[\s-]?home|anywhere|work from anywhere)\b/i;
const HYBRID_RE = /\bhybrid\b/i;

function titleCase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function splitLocationTokens(job) {
  const tokens = [];
  const push = (raw) => {
    String(raw || '')
      .split(/[,|/·•;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => tokens.push(t));
  };
  if (Array.isArray(job?.locations) && job.locations.length) {
    job.locations.forEach(push);
  } else {
    push(job?.location);
  }
  return [...new Set(tokens)];
}

function detectCountry(raw) {
  const text = String(raw || '');
  for (const [re, code] of COUNTRY_HINTS) {
    if (re.test(text)) return code;
  }
  const state = getStateFromLocation(text.replace(REMOTE_RE, '').replace(HYBRID_RE, '').trim());
  if (state && state !== 'Unknown') return 'IN';
  return 'IN';
}

function inferWorkplaceType(job) {
  const explicit = String(job?.workplaceType || '').toLowerCase().trim();
  if (explicit === 'remote' || explicit === 'hybrid' || explicit === 'onsite') return explicit;
  const blob = [job?.location, ...(Array.isArray(job?.locations) ? job.locations : [])].join(' ');
  if (REMOTE_RE.test(blob) && !HYBRID_RE.test(blob)) return 'remote';
  if (HYBRID_RE.test(blob)) return 'hybrid';
  return 'onsite';
}

function parseOneLocation(raw) {
  const original = String(raw || '').trim();
  if (!original) return null;
  const remote = REMOTE_RE.test(original);
  const cleaned = original
    .replace(REMOTE_RE, ' ')
    .replace(HYBRID_RE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—,/]+|[-–—,/]+$/g, '')
    .trim();
  const country = detectCountry(original);
  if (!cleaned) {
    return { remote: true, addressCountry: country, addressLocality: '' };
  }
  const state = getStateFromLocation(cleaned);
  return {
    remote,
    addressLocality: titleCase(cleaned),
    addressRegion: state && state !== 'Unknown' ? state : undefined,
    addressCountry: country,
  };
}

function buildSchemaJobLocations(job) {
  const workplaceType = inferWorkplaceType(job);
  const tokens = splitLocationTokens(job);
  const parsed = tokens.map(parseOneLocation).filter(Boolean);
  const places = parsed
    .filter((row) => row.addressLocality)
    .map((row) => ({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: row.addressLocality,
        ...(row.addressRegion ? { addressRegion: row.addressRegion } : {}),
        addressCountry: row.addressCountry || 'IN',
      },
    }));

  const remote = workplaceType === 'remote' || (parsed.length > 0 && parsed.every((row) => row.remote && !row.addressLocality));
  const country = parsed[0]?.addressCountry || detectCountry(tokens.join(' ')) || 'IN';

  return {
    workplaceType,
    remote,
    jobLocation: places.length ? (places.length === 1 ? places[0] : places) : undefined,
    applicantLocationRequirements: remote
      ? { '@type': 'Country', name: country }
      : undefined,
    jobLocationType: remote ? 'TELECOMMUTE' : undefined,
  };
}

module.exports = {
  splitLocationTokens,
  inferWorkplaceType,
  parseOneLocation,
  buildSchemaJobLocations,
  detectCountry,
};
