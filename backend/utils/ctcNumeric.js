/**
 * Parse stored CTC strings (10L-12L, 50K-1L, 8.5 LPA) into LPA numbers
 * so "up to X LPA" can include every band at or below the cap.
 */

function parseTokenLpa(raw) {
  const token = String(raw || '').trim().toLowerCase().replace(/,/g, '');
  if (!token) return null;
  if (token.includes('cr')) {
    const n = parseFloat(token);
    return Number.isFinite(n) ? n * 100 : 100;
  }
  if (token.endsWith('l') || token.includes('lpa') || token.includes('lac')) {
    const n = parseFloat(token);
    return Number.isFinite(n) ? n : null;
  }
  if (token.endsWith('k')) {
    const n = parseFloat(token);
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = parseFloat(token);
  return Number.isFinite(n) ? n : null;
}

function parseCtcLpaRange(value) {
  const text = String(value || '').trim();
  if (!text) return { min: null, max: null };
  const upper = text.toUpperCase();
  if (upper.includes('NEGOTIABLE') || upper.includes('CONFIDENTIAL') || upper.includes('NOT DISCLOSED')) {
    return { min: null, max: null };
  }
  const parts = text.split(/[-–—to]+/i).map((p) => p.trim()).filter(Boolean);
  const nums = parts.map(parseTokenLpa).filter((n) => n != null);
  if (!nums.length) {
    const fallback = String(text).toLowerCase().match(/\d+(?:\.\d+)?/g);
    if (!fallback) return { min: null, max: null };
    const parsed = fallback.map((n) => parseFloat(n)).filter((n) => Number.isFinite(n));
    if (!parsed.length) return { min: null, max: null };
    if (/k\b/i.test(text) && !/[lL]/.test(text)) {
      const asLpa = parsed.map((n) => n / 100);
      return { min: Math.min(...asLpa), max: Math.max(...asLpa) };
    }
    return { min: Math.min(...parsed), max: Math.max(...parsed) };
  }
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Ceiling LPA from filter value: "10", "Up to 10 LPA", "10L-12L" → 12 */
function ctcCapLpa(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const asNum = parseFloat(text);
  if (Number.isFinite(asNum) && /^\s*\d+(\.\d+)?\s*$/.test(text)) return asNum;
  const range = parseCtcLpaRange(text);
  if (range.max != null) return range.max;
  return null;
}

/** Floor LPA from filter value: "15", "15 LPA and above", "15L-18L" → 15 */
function ctcFloorLpa(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const asNum = parseFloat(text);
  if (Number.isFinite(asNum) && /^\s*\d+(\.\d+)?\s*$/.test(text)) return asNum;
  const range = parseCtcLpaRange(text);
  if (range.min != null) return range.min;
  if (range.max != null) return range.max;
  return null;
}

function storedCtcHigh(storedCtc) {
  const range = parseCtcLpaRange(storedCtc);
  if (range.max == null && range.min == null) return null;
  return range.max != null ? range.max : range.min;
}

function ctcWithinUpto(storedCtc, cap) {
  if (cap == null || !Number.isFinite(Number(cap))) return true;
  const high = storedCtcHigh(storedCtc);
  if (high == null) return false;
  return high <= Number(cap) + 1e-9;
}

function ctcAtLeast(storedCtc, floor) {
  if (floor == null || !Number.isFinite(Number(floor))) return true;
  const high = storedCtcHigh(storedCtc);
  if (high == null) return false;
  return high + 1e-9 >= Number(floor);
}

function parseExperienceYears(value) {
  const nums = String(value || '').match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  return Math.max(...nums.map((n) => parseFloat(n)));
}

function experienceInRange(stored, min, max) {
  const years = parseExperienceYears(stored);
  if (years == null) return min == null && max == null;
  if (min != null && Number.isFinite(min) && years < min) return false;
  if (max != null && Number.isFinite(max) && years > max) return false;
  return true;
}

module.exports = {
  parseCtcLpaRange,
  ctcCapLpa,
  ctcFloorLpa,
  ctcWithinUpto,
  ctcAtLeast,
  parseExperienceYears,
  experienceInRange,
};
