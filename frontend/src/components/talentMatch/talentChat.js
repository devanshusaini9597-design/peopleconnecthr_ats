function tidy(value) {
  return String(value || '')
    .replace(/\b(candidates?|people|profiles?|please|just|the|a|an|from|list|shortlist)\b/gi, ' ')
    .replace(/[.…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function interpretMessage(text, job = {}) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const roleName = job.role || job.title || '';
  const jobLocation = job.location || (Array.isArray(job.locations) ? job.locations.filter(Boolean).join(', ') : '');

  if (/^(reset|start over|clear|show all|show everyone|original list)\b/.test(lower)) {
    return {
      reset: true,
      constraints: {},
      summary: (count) => `Extra filters cleared. ${count} ${count === 1 ? 'person matches' : 'people match'} the requisition.`,
    };
  }

  const excludeRoles = [];
  const roles = [];
  const locations = [];

  const removeParts = lower.split(/\b(?:remove|drop|exclude|without|hide)\b/i).slice(1);
  for (const part of removeParts) {
    const chunk = part.split(/\b(?:i want|i need|keep|show|find|only|and then|then|also)\b/i)[0] || '';
    const phrase = tidy(chunk.replace(/\bfrom(?:\s+the)?\s+list\b/gi, ' ').replace(/[.,;]+/g, ' '));
    if (phrase.length > 2 && phrase.length < 64) excludeRoles.push(phrase);
  }

  const onlyMatch = lower.match(/\b(?:want\s+|need\s+|show\s+|keep\s+)?only\s+([a-z0-9][a-z0-9 +/#\-]{1,48}?)(?:\s+in\s+the\s+list|\s+roles?\b|\s*$|\s+in\s+[a-z]|\s+please\b)/i)
    || lower.match(/\b(?:keep|show|find|looking for)\s+([a-z0-9][a-z0-9 +/#\-]{1,48}?)\s+roles?\b/i);
  if (onlyMatch) {
    const phrase = tidy(onlyMatch[1]);
    if (phrase.length > 2) roles.push(phrase);
  }

  if (/only this role|same role|this role only/.test(lower) && roleName) roles.push(roleName);
  if (/only (?:the )?(?:job )?location|same location|remove (?:other|mixed) (?:locations|cities)/.test(lower) && jobLocation) {
    locations.push(jobLocation);
  }

  const inCity = lower.match(/\b(?:in|at|near|based in|located in)\s+([a-z][a-z.\s]{1,28}?)(?:\s+(?:only|please|thanks|now)\b|[.,;]|$)/i);
  if (inCity) {
    const place = tidy(inCity[1].replace(/\bthe\s+list\b/gi, ''));
    if (place.length > 2 && place !== 'list') locations.push(place);
  }

  if (!roles.length && !excludeRoles.length) {
    const cleaned = tidy(
      lower
        .replace(/^(i want|i need|show me|find me|please|can you|could you|get me)\s+/, '')
        .replace(/\b(?:in|at|near|based in|located in)\s+[a-z][a-z.\s]{1,28}/, '')
    );
    if (
      cleaned.length > 2
      && cleaned.length < 56
      && cleaned.split(' ').length <= 7
      && /manager|executive|officer|recruiter|developer|engineer|sales|analyst|consultant|head|lead|specialist|advisor|branch|casa/.test(cleaned)
    ) roles.push(cleaned);
  }

  if (!locations.length && !roles.length && !excludeRoles.length) {
    return {
      reset: false,
      constraints: {},
      summary: () => 'Tell me which titles to keep or remove, or a city to filter.',
    };
  }

  return {
    reset: false,
    constraints: {
      locations: [...new Set(locations)],
      roles: [...new Set(roles)],
      skills: [],
      industries: [],
      excludeRoles: [...new Set(excludeRoles)],
    },
    summary: (count) => {
      const bits = [];
      if (excludeRoles[0]) bits.push(`removed ${excludeRoles[0]}`);
      if (roles[0]) bits.push(`kept ${roles[0]}`);
      if (locations[0]) bits.push(`in ${locations[0]}`);
      const who = count === 1 ? 'person remains' : 'people remain';
      return `${count} ${who}${bits.length ? ` — ${bits.join('; ')}` : ''}.`;
    },
  };
}

export function parseTalentInstruction(text, job = {}) {
  return interpretMessage(text, job);
}

const GENERIC_ROLE = new Set(['manager', 'executive', 'officer', 'head', 'lead', 'senior', 'junior', 'associate', 'specialist']);
const STATE_WORD = new Set(['maharashtra', 'karnataka', 'gujarat', 'telangana', 'tamil', 'nadu', 'pradesh', 'bengal', 'rajasthan', 'haryana', 'punjab', 'kerala', 'delhi']);

function roleHits(position, phrase) {
  const pos = String(position || '').toLowerCase();
  const raw = String(phrase || '').toLowerCase().trim();
  if (!raw || !pos) return false;
  if (pos.includes(raw)) return true;
  const tokens = raw.split(/[^a-z0-9+#]+/).filter((token) => token.length > 2 && !GENERIC_ROLE.has(token));
  if (!tokens.length) {
    const all = raw.split(/[^a-z0-9+#]+/).filter((token) => token.length > 2);
    return all.length > 0 && all.every((token) => pos.includes(token));
  }
  const needed = tokens.length >= 2 ? Math.min(2, tokens.length) : tokens.length;
  return tokens.filter((token) => pos.includes(token)).length >= needed;
}

export function rowMatchesConstraints(row, constraints) {
  if (!constraints) return true;
  if ((constraints.excludeRoles || []).some((phrase) => roleHits(row.position, phrase))) return false;
  const role = String(constraints.roles?.[0] || '').toLowerCase();
  if (role && !roleHits(row.position, role)) return false;
  const location = String(constraints.locations?.[0] || '').toLowerCase();
  if (location) {
    const cities = location.split(/[^a-z]+/).filter((token) => token.length > 2 && !STATE_WORD.has(token));
    const person = String(row.location || '').toLowerCase();
    const required = cities.length ? cities : location.split(/[^a-z]+/).filter((token) => token.length > 2);
    if (required.length && !required.some((token) => person.includes(token))) return false;
  }
  return true;
}

export function mergeConstraints(current, next) {
  const base = current || {};
  const incoming = next || {};
  const excludeRoles = [
    ...(base.excludeRoles || []),
    ...(incoming.excludeRoles || []),
  ].filter(Boolean);
  return {
    locations: incoming.locations?.length ? incoming.locations : (base.locations || []),
    roles: incoming.roles?.length ? incoming.roles : (base.roles || []),
    skills: incoming.skills?.length ? incoming.skills : (base.skills || []),
    industries: incoming.industries?.length ? incoming.industries : (base.industries || []),
    excludeRoles: [...new Set(excludeRoles)].slice(0, 8),
    strict: true,
  };
}

export function filterChips(constraints) {
  if (!constraints) return [];
  return [
    ...(constraints.roles || []).map((item) => `Keep: ${item}`),
    ...(constraints.excludeRoles || []).map((item) => `Exclude: ${item}`),
    ...(constraints.locations || []).map((item) => `City: ${item}`),
    ...(constraints.skills || []),
    ...(constraints.industries || []),
  ].filter(Boolean);
}
