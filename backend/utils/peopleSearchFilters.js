const { nearbyCityNames, coordsForPlace, haversineKm, normalizePlace } = require('../data/cityCoordinates');
const { ctcCapLpa, ctcFloorLpa, ctcWithinUpto, ctcAtLeast, experienceInRange } = require('./ctcNumeric');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rx(q) {
  return { $regex: escapeRegex(q), $options: 'i' };
}

function asList(raw) {
  const chunks = Array.isArray(raw) ? raw : [raw];
  const out = [];
  const seen = new Set();
  for (const chunk of chunks) {
    String(chunk || '')
      .split(/\s*\|\s*/)
      .forEach((part) => {
        const val = String(part || '').trim();
        if (!val) return;
        const key = val.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(val);
      });
  }
  return out;
}

function parsePeopleFilters(query = {}, locationFallback = '') {
  const out = {};
  const listKeys = ['position', 'companyName', 'location', 'skills', 'product', 'spoc', 'client', 'status'];
  const scalarKeys = [
    'expMin', 'expMax', 'ctcMin', 'ctcMax', 'expectedCtcMin', 'expectedCtcMax',
    'candidateCode', 'applicationCode', 'period', 'from', 'to', 'locationRadiusKm',
  ];
  for (const key of listKeys) {
    const list = asList(query[key]).flatMap((item) => (
      key === 'location' || key === 'skills'
        ? String(item).split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean)
        : [item]
    ));
    if (list.length) out[key] = [...new Set(list)];
  }
  for (const key of scalarKeys) {
    const val = String(query[key] || '').trim();
    if (val) out[key] = val;
  }
  if (!out.location && String(locationFallback || '').trim()) {
    out.location = asList(locationFallback);
  }
  return out;
}

function hasPeopleFilters(filters = {}) {
  return Object.entries(filters).some(([key, v]) => {
    if (key === 'locationRadiusKm') return false;
    if (Array.isArray(v)) return v.some((item) => String(item || '').trim());
    const val = String(v || '').trim();
    if (!val || val === 'all') return false;
    return true;
  });
}

function tokenRx(name) {
  const token = String(name || '').trim();
  if (!token) return null;
  return {
    $regex: `(^|[^A-Za-z0-9])${escapeRegex(token)}([^A-Za-z0-9]|$)`,
    $options: 'i',
  };
}

function locationTokenRx(name) {
  return tokenRx(name);
}

function orField(field, values) {
  const list = asList(values);
  if (!list.length) return null;
  const clauses = list.map((v) => {
    const needle = tokenRx(v);
    return needle ? { [field]: needle } : null;
  }).filter(Boolean);
  if (!clauses.length) return null;
  if (clauses.length === 1) return clauses[0];
  return { $or: clauses };
}

function locationClause(filters = {}) {
  const terms = asList(filters.location);
  if (!terms.length) return null;
  const radius = Number(filters.locationRadiusKm);
  const km = Number.isFinite(radius) && radius >= 0 ? radius : 50;
  const expanded = new Set();
  for (const term of terms) {
    nearbyCityNames(term, km).forEach((name) => expanded.add(name));
  }
  const needles = [...expanded]
    .map((city) => locationTokenRx(city))
    .filter(Boolean);
  if (!needles.length) return null;
  return {
    $or: needles.flatMap((needle) => [
      { location: needle },
      { state: needle },
    ]),
  };
}

function peopleFilterParts(filters = {}, { mis = false } = {}) {
  const parts = [];
  const pushOr = (field, values) => {
    const clause = orField(field, values);
    if (clause) parts.push(clause);
  };
  pushOr('position', filters.position);
  pushOr('companyName', filters.companyName);
  pushOr('skills', filters.skills);
  pushOr('product', filters.product);
  pushOr('client', filters.client);
  pushOr('spoc', filters.spoc);
  const loc = locationClause(filters);
  if (loc) parts.push(loc);

  if (!mis) {
    pushOr('status', filters.status);
    const code = String(filters.candidateCode || '').trim();
    if (code) {
      parts.push({
        $or: [
          { candidateCode: { $regex: `^\\s*${escapeRegex(code)}\\s*$`, $options: 'i' } },
          { candidateCode: rx(code) },
        ],
      });
    }
  }
  return parts;
}

function textHasAnyToken(hay, values) {
  const list = asList(values);
  if (!list.length) return true;
  const text = String(hay || '');
  if (!text.trim()) return false;
  return list.some((token) => {
    const t = String(token || '').trim();
    if (!t) return false;
    const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(t)}([^A-Za-z0-9]|$)`, 'i');
    return re.test(text);
  });
}

function rowMatchesFields(doc = {}, filters = {}) {
  if (!textHasAnyToken(doc.position, filters.position)) return false;
  if (!textHasAnyToken(doc.companyName, filters.companyName)) return false;
  if (!textHasAnyToken(doc.skills, filters.skills)) return false;
  if (!textHasAnyToken(doc.product, filters.product)) return false;
  if (!textHasAnyToken(doc.client, filters.client)) return false;
  if (!textHasAnyToken(doc.spoc, filters.spoc)) return false;
  return true;
}

function locationRadiusKm(filters = {}) {
  const radius = Number(filters.locationRadiusKm);
  return Number.isFinite(radius) && radius >= 0 ? radius : 50;
}

function rowMatchesLocation(doc = {}, filters = {}) {
  const terms = asList(filters.location);
  if (!terms.length) return true;
  const km = locationRadiusKm(filters);
  const blob = `${doc.location || ''} ${doc.state || ''}`.trim();
  if (!blob) return false;
  const names = new Set();
  for (const term of terms) {
    nearbyCityNames(term, km).forEach((name) => names.add(normalizePlace(name)));
  }
  const hay = normalizePlace(blob);
  const nameHit = [...names].some((name) => name && hay.includes(name));
  const origins = terms.map((term) => coordsForPlace(term)).filter(Boolean);
  const place = coordsForPlace(blob);
  if (origins.length && place) {
    const geoHit = origins.some((origin) => haversineKm(origin, place) <= km + 0.5);
    if (geoHit) return true;
    return nameHit;
  }
  return nameHit;
}

function needsRowRangeFilter(filters = {}) {
  return Boolean(String(filters.ctcMax || filters.ctcMin || filters.expMin || filters.expMax || '').trim());
}

function rowMatchesRange(doc = {}, filters = {}) {
  if (!rowMatchesFields(doc, filters)) return false;
  const floor = ctcFloorLpa(filters.ctcMin);
  const cap = ctcCapLpa(filters.ctcMax);
  if (floor != null && !ctcAtLeast(doc.ctc, floor)) return false;
  if (cap != null && !ctcWithinUpto(doc.ctc, cap)) return false;
  const expMin = filters.expMin !== undefined && filters.expMin !== '' ? parseFloat(filters.expMin) : NaN;
  const expMax = filters.expMax !== undefined && filters.expMax !== '' ? parseFloat(filters.expMax) : NaN;
  const min = Number.isFinite(expMin) ? expMin : null;
  const max = Number.isFinite(expMax) ? expMax : null;
  if ((min != null || max != null) && !experienceInRange(doc.experience, min, max)) return false;
  if (!rowMatchesLocation(doc, filters)) return false;
  return true;
}

module.exports = {
  asList,
  parsePeopleFilters,
  hasPeopleFilters,
  peopleFilterParts,
  locationClause,
  needsRowRangeFilter,
  rowMatchesRange,
  rowMatchesLocation,
  rx,
};
