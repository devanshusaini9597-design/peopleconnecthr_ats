/**
 * Map JD-extracted strings onto org picklists so dropdowns select a real option.
 */

const { parseCtcLpaRange } = require('./ctcNumeric');

function norm(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return norm(value)
    .split(' ')
    .filter((t) => t.length > 1);
}

function overlapScore(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

/** Single generic words that must not swallow a longer extracted title/grade. */
const WEAK_CONTAINS = new Set([
  'MANAGER', 'SENIOR', 'EXECUTIVE', 'HEAD', 'OFFICER', 'ANALYST', 'ASSOCIATE',
  'LEAD', 'SPECIALIST', 'ASSISTANT', 'DEPUTY', 'DIRECTOR', 'CONSULTANT',
]);

function isSafeContains(extracted, catalogItem) {
  const shorter = catalogItem.length <= extracted.length ? catalogItem : extracted;
  const longer = catalogItem.length <= extracted.length ? extracted : catalogItem;
  if (shorter.length < 4) return false;
  const ratio = shorter.length / longer.length;
  if (WEAK_CONTAINS.has(shorter) && ratio < 0.85) return false;
  if (tokens(shorter).length >= 2) return true;
  return ratio >= 0.45;
}

function matchOne(raw, catalog = []) {
  const n = norm(raw);
  if (!n || /^(N\/?A|NA|NIL|NONE|NULL|-|—)$/.test(n)) {
    return { value: '', match: 'none', confidence: 0 };
  }
  const items = [...new Set((catalog || []).map((v) => norm(v)).filter(Boolean))];
  if (!items.length) {
    return { value: n, match: 'raw', confidence: 0.58 };
  }

  const exact = items.find((item) => item === n);
  if (exact) return { value: exact, match: 'exact', confidence: 0.98 };

  const contained = items
    .map((item) => ({ item, len: Math.min(item.length, n.length) }))
    .filter(({ item, len }) => len >= 4 && (item.includes(n) || n.includes(item)) && isSafeContains(n, item))
    .sort((a, b) => b.len - a.len);
  if (contained[0]) {
    return { value: contained[0].item, match: 'contains', confidence: 0.84 };
  }

  let best = { item: '', score: 0 };
  for (const item of items) {
    const score = overlapScore(n, item);
    if (score > best.score) best = { item, score };
  }
  if (best.score >= 0.55) {
    return { value: best.item, match: 'fuzzy', confidence: 0.72 + Math.min(0.15, best.score * 0.15) };
  }

  return { value: n, match: 'raw', confidence: 0.56 };
}

function matchMany(values, catalog = []) {
  const out = [];
  const unmapped = [];
  const seen = new Set();
  for (const raw of values || []) {
    const hit = matchOne(raw, catalog);
    if (!hit.value) continue;
    if (seen.has(hit.value)) continue;
    seen.add(hit.value);
    out.push(hit);
    if (hit.match === 'raw') unmapped.push(hit.value);
  }
  return { values: out.map((h) => h.value), hits: out, unmapped };
}

function parseYearRange(value) {
  const text = String(value || '');
  if (/fresher|^0\s*year/i.test(text) && !/[1-9]/.test(text)) {
    return { min: 0, max: 0 };
  }
  const nums = (text.match(/\d+(?:\.\d+)?/g) || []).map((n) => parseFloat(n)).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  if (nums.length === 1) {
    if (/\+|plus|above|more than|minimum|min\b|at least/i.test(text)) {
      return { min: nums[0], max: nums[0] + 8 };
    }
    return { min: nums[0], max: nums[0] };
  }
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function bandYearRange(label) {
  const n = norm(label);
  if (n === 'FRESHER') return { min: 0, max: 0 };
  return parseYearRange(label);
}

function matchExperience(raw, catalog = []) {
  const fallback = catalog.length
    ? catalog
    : ['FRESHER', '0-1 YEARS', '1-2 YEARS', '2-3 YEARS', '3-5 YEARS', '5-8 YEARS', '8-12 YEARS', '12+ YEARS'];
  const direct = matchOne(raw, fallback);
  if (direct.match === 'exact' || direct.match === 'contains') return direct;

  const parsed = parseYearRange(raw);
  if (!parsed) return direct.value ? direct : { value: '', match: 'none', confidence: 0 };

  let best = { item: '', score: -1 };
  for (const item of fallback.map(norm)) {
    const band = bandYearRange(item);
    if (!band) continue;
    const overlap = Math.max(0, Math.min(parsed.max, band.max) - Math.max(parsed.min, band.min));
    const span = Math.max(parsed.max - parsed.min, 0.5);
    const score = overlap / span;
    const midParsed = (parsed.min + parsed.max) / 2;
    const midBand = (band.min + band.max) / 2;
    const closeness = 1 / (1 + Math.abs(midParsed - midBand));
    const total = score * 0.7 + closeness * 0.3;
    if (total > best.score) best = { item, score: total };
  }
  if (best.item && best.score > 0.35) {
    return { value: best.item, match: 'range', confidence: 0.78 };
  }
  return direct;
}

function matchCtc(raw, catalog = []) {
  if (!String(raw || '').trim()) return { value: '', match: 'none', confidence: 0 };
  if (/negotiable|confidential|not disclosed|as per/i.test(String(raw))) {
    const named = matchOne(raw, catalog.length ? catalog : ['NEGOTIABLE', 'CONFIDENTIAL', 'NOT DISCLOSED']);
    if (named.value) return named;
  }
  const direct = matchOne(raw, catalog);
  if (direct.match === 'exact') return direct;

  const parsed = parseCtcLpaRange(raw);
  if (parsed.min == null && parsed.max == null) return direct;

  let best = { item: '', score: -1 };
  for (const item of (catalog || []).map(norm)) {
    const band = parseCtcLpaRange(item);
    if (band.min == null && band.max == null) continue;
    const a0 = parsed.min != null ? parsed.min : parsed.max;
    const a1 = parsed.max != null ? parsed.max : parsed.min;
    const b0 = band.min != null ? band.min : band.max;
    const b1 = band.max != null ? band.max : band.min;
    if (a0 == null || b0 == null) continue;
    const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    const span = Math.max(a1 - a0, 0.25);
    const score = overlap / span;
    if (score > best.score) best = { item, score };
  }
  if (best.item && best.score > 0.45) {
    return { value: best.item, match: 'range', confidence: 0.8 };
  }
  return direct.value ? { ...direct, confidence: Math.min(direct.confidence, 0.62) } : { value: '', match: 'none', confidence: 0 };
}

const EMPLOYMENT_MAP = [
  { value: 'full_time', keys: ['FULL TIME', 'FULL-TIME', 'PERMANENT', 'FTE', 'REGULAR'] },
  { value: 'part_time', keys: ['PART TIME', 'PART-TIME'] },
  { value: 'contract', keys: ['CONTRACT', 'CONTRACTUAL', 'FIXED TERM', 'CONSULTANT'] },
  { value: 'internship', keys: ['INTERN', 'INTERNSHIP'] },
  { value: 'freelance', keys: ['FREELANCE', 'GIG'] },
];

function matchEmployment(raw) {
  const n = norm(raw).replace(/-/g, ' ');
  if (!n) return { value: '', match: 'none', confidence: 0 };
  for (const row of EMPLOYMENT_MAP) {
    if (row.value === n || row.keys.some((k) => n.includes(k) || k.includes(n))) {
      return { value: row.value, match: 'exact', confidence: 0.93 };
    }
  }
  return { value: '', match: 'none', confidence: 0 };
}

module.exports = {
  norm,
  matchOne,
  matchMany,
  matchExperience,
  matchCtc,
  matchEmployment,
  parseYearRange,
};
