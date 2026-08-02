/**
 * Dedupe Service — fuzzy duplicate detection by normalized email / phone / name.
 * Not LLM-based; deterministic normalization + grouping.
 */

const Candidate = require('../models/Candidate');

const normalizeEmail = (email) => {
  if (!email) return '';
  return String(email).trim().toLowerCase();
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(-10);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
};

const normalizeName = (name) => {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/** Levenshtein distance for short name comparison */
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
};

const namesLikelyMatch = (a, b) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen <= 3) return false;
  return levenshtein(na, nb) <= Math.floor(maxLen * 0.2);
};

const phonesLikelyMatch = (a, b) => {
  const pa = normalizePhone(a);
  const pb = normalizePhone(b);
  return pa.length >= 7 && pa === pb;
};

const buildCandidateKey = (c) => ({
  id: String(c._id),
  name: c.name,
  email: c.email,
  contact: c.contact || c.phone,
  normalizedEmail: normalizeEmail(c.email),
  normalizedPhone: normalizePhone(c.contact || c.phone),
  normalizedName: normalizeName(c.name)
});

/**
 * Find duplicate groups within an organization.
 * @param {string} organizationId
 * @param {{ candidateId?: string, limit?: number }} [options]
 */
const findDuplicates = async (organizationId, options = {}) => {
  const query = { organizationId };
  if (options.candidateId) {
    query._id = options.candidateId;
  }

  const candidates = await Candidate.find(query)
    .select('name email contact phone createdAt')
    .lean();

  if (options.candidateId && candidates.length === 1) {
    const target = buildCandidateKey(candidates[0]);
    const all = await Candidate.find({ organizationId, _id: { $ne: target.id } })
      .select('name email contact phone createdAt')
      .lean();

    const matches = all.filter((c) => {
      const other = buildCandidateKey(c);
      if (target.normalizedEmail && other.normalizedEmail && target.normalizedEmail === other.normalizedEmail) return true;
      if (phonesLikelyMatch(target.contact, other.contact)) return true;
      if (namesLikelyMatch(target.name, other.name) && (
        (target.normalizedEmail && other.normalizedEmail && target.normalizedEmail.slice(0, 5) === other.normalizedEmail.slice(0, 5)) ||
        phonesLikelyMatch(target.contact, other.contact)
      )) return true;
      return false;
    });

    return {
      groups: matches.length
        ? [{ key: 'candidate_match', reason: 'email_phone_or_name', members: [candidates[0], ...matches] }]
        : [],
      totalGroups: matches.length ? 1 : 0
    };
  }

  const keyed = candidates.map(buildCandidateKey);
  const parent = {};
  const find = (i) => {
    if (parent[i] === undefined) parent[i] = i;
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (i, j) => {
    parent[find(i)] = find(j);
  };

  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      const a = keyed[i];
      const b = keyed[j];
      let match = false;
      if (a.normalizedEmail && b.normalizedEmail && a.normalizedEmail === b.normalizedEmail) match = true;
      else if (phonesLikelyMatch(a.contact, b.contact)) match = true;
      else if (namesLikelyMatch(a.name, b.name) && a.normalizedEmail && b.normalizedEmail) {
        const [ea, eb] = [a.normalizedEmail.split('@')[0], b.normalizedEmail.split('@')[0]];
        if (ea === eb || levenshtein(ea, eb) <= 2) match = true;
      }
      if (match) union(i, j);
    }
  }

  const groupsMap = new Map();
  keyed.forEach((k, idx) => {
    const root = find(idx);
    if (!groupsMap.has(root)) groupsMap.set(root, []);
    groupsMap.get(root).push(candidates[idx]);
  });

  const groups = [...groupsMap.values()]
    .filter((members) => members.length > 1)
    .map((members) => ({
      key: normalizeEmail(members[0].email) || normalizePhone(members[0].contact) || normalizeName(members[0].name),
      reason: 'email_phone_or_name',
      members
    }));

  const limit = options.limit || 50;
  return {
    groups: groups.slice(0, limit),
    totalGroups: groups.length
  };
};

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  findDuplicates
};
