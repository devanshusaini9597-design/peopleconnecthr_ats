/**
 * Deterministic fit score for a person against a job.
 * Uses skills, experience, location, CTC, domain, and title. Resume text is optional.
 * Hard gates (location / CTC / domain) follow what the JD actually states.
 * AI narrative is layered on later; this score always works without an API key.
 */

const {
  parseCtcLpaRange,
  ctcWithinUpto,
  ctcAtLeast,
} = require('./ctcNumeric');

const STOP = new Set([
  'the', 'and', 'for', 'with', 'you', 'our', 'job', 'role', 'will', 'this', 'that',
  'from', 'your', 'are', 'has', 'have', 'not', 'but', 'per', 'via', 'etc', 'years',
  'year', 'yrs', 'experience', 'exp', 'required', 'requirements', 'skills', 'skill',
  'minimum', 'maximum', 'upto', 'above', 'below', 'about', 'must', 'should',
]);

/** Canonical domain → aliases found on JDs and profiles. */
const DOMAIN_GROUPS = [
  { key: 'banking', aliases: ['banking', 'bank', 'bfsi', 'nbfc', 'retail banking', 'corporate banking'] },
  { key: 'insurance', aliases: ['insurance', 'life insurance', 'general insurance', 'li', 'gi', 'bancassurance'] },
  { key: 'home loan', aliases: ['home loan', 'homeloan', 'housing loan', 'mortgage', 'hl'] },
  { key: 'fintech', aliases: ['fintech', 'payments', 'lending'] },
  { key: 'pharma', aliases: ['pharma', 'pharmaceutical', 'healthcare'] },
  { key: 'it', aliases: ['it', 'software', 'information technology', 'saas'] },
  { key: 'fmcg', aliases: ['fmcg', 'fmcg sales'] },
  { key: 'telecom', aliases: ['telecom', 'telecommunications'] },
  { key: 'retail', aliases: ['retail'] },
  { key: 'real estate', aliases: ['real estate', 'realty'] },
  { key: 'manufacturing', aliases: ['manufacturing', 'auto', 'automobile'] },
  { key: 'finance', aliases: ['finance', 'financial services', 'wealth', 'mutual fund', 'mf'] },
];

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phrases(list) {
  const raw = Array.isArray(list) ? list : String(list || '').split(/[,|/]/);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const phrase = norm(item);
    if (phrase.length < 2 || seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
  }
  return out;
}

function yearsOf(text) {
  const source = String(text || '');
  const range = source.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const labelled = source.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i);
  if (labelled) return { min: Number(labelled[1]), max: null };
  return { min: null, max: null };
}

function jobExperience(job) {
  const range = job?.experienceRange;
  if (range && range.min != null && range.min !== '') {
    return {
      min: Number(range.min),
      max: range.max != null && range.max !== '' ? Number(range.max) : null,
    };
  }
  return yearsOf(job?.experience);
}

const BROAD_PLACE = new Set([
  'india', 'indian', 'remote', 'hybrid', 'wfh', 'anywhere', 'multiple', 'pan', 'various',
  'office', 'based', 'city', 'cities', 'location', 'locations',
]);

const STATE_WORD = new Set([
  'andhra', 'arunachal', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana',
  'himachal', 'jharkhand', 'karnataka', 'kerala', 'madhya', 'maharashtra', 'manipur',
  'meghalaya', 'mizoram', 'nagaland', 'odisha', 'orissa', 'punjab', 'rajasthan', 'sikkim',
  'tamil', 'telangana', 'tripura', 'uttar', 'uttarakhand', 'bengal', 'pradesh', 'nadu',
]);

const GENERIC_ROLE = new Set([
  'manager', 'executive', 'officer', 'head', 'lead', 'senior', 'junior', 'associate',
  'specialist', 'consultant', 'engineer', 'analyst', 'coordinator', 'assistant',
]);

/** JD template labels that must not become search keywords (they match almost everyone). */
const JD_NOISE = new Set([
  'title', 'grade', 'client', 'name', 'industry', 'employment', 'type',
  'compensation', 'depending', 'performance', 'current', 'package', 'salary',
  'description', 'summary', 'responsibility', 'responsibilities', 'requirement',
  'requirements', 'qualification', 'qualifications', 'preferred', 'profile',
  'department', 'company', 'organization', 'opening', 'requisition', 'mandate',
  'full-time', 'part-time', 'contract', 'internship', 'freelance',
  'lacs', 'lakh', 'lakhs', 'range', 'min', 'max', 'only',
]);

function placeWords(value) {
  return norm(value).split(' ').filter((token) => token.length > 2 && !STOP.has(token) && !BROAD_PLACE.has(token));
}

function jobPlaces(job) {
  const words = [
    ...placeWords(job?.location),
    ...(Array.isArray(job?.locations) ? job.locations.flatMap((item) => placeWords(item)) : []),
  ];
  return {
    cities: [...new Set(words.filter((token) => !STATE_WORD.has(token)))],
    states: [...new Set(words.filter((token) => STATE_WORD.has(token)))],
  };
}

/** City tokens if the JD names a city; otherwise state tokens. Used to pull the directory. */
const CITY_ALIASES = {
  chennai: ['chennai', 'madras'],
  madras: ['chennai', 'madras'],
  bengaluru: ['bengaluru', 'bangalore'],
  bangalore: ['bengaluru', 'bangalore'],
  mumbai: ['mumbai', 'bombay'],
  bombay: ['mumbai', 'bombay'],
  delhi: ['delhi', 'newdelhi'],
  gurugram: ['gurugram', 'gurgaon'],
  gurgaon: ['gurugram', 'gurgaon'],
  kolkata: ['kolkata', 'calcutta'],
  calcutta: ['kolkata', 'calcutta'],
  hyderabad: ['hyderabad'],
  pune: ['pune'],
};

function expandPlaceTokens(tokens) {
  const out = new Set();
  for (const token of tokens || []) {
    const key = String(token || '').toLowerCase();
    if (!key) continue;
    out.add(key);
    for (const alias of CITY_ALIASES[key] || []) out.add(alias);
  }
  return [...out];
}

function jobLocationTokens(job) {
  const places = jobPlaces(job);
  const base = places.cities.length ? places.cities : places.states;
  return expandPlaceTokens(base);
}

function personPlace(person) {
  return norm([person?.location, person?.state].filter(Boolean).join(' '));
}

function locationRatio(job, person) {
  const places = jobPlaces(job);
  const personLoc = personPlace(person);
  if (!places.cities.length && !places.states.length) return 0.45;
  if (!personLoc) return 0;
  const required = jobLocationTokens(job);
  const hits = required.filter((token) => personLoc.includes(token));
  if (!hits.length) return 0;
  return 1;
}

function titleRatio(job, person) {
  const titleTokens = norm(job?.title || job?.role)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP.has(token));
  const position = norm(person?.position);
  if (!titleTokens.length || !position) return 0;
  const hits = titleTokens.filter((token) => position.includes(token));
  return hits.length / titleTokens.length;
}

function skillFit(jobSkills, personBlob) {
  const skills = phrases(jobSkills);
  if (!skills.length) return null;
  const blob = norm(personBlob);
  let weight = 0;
  const matched = [];
  const missing = [];
  for (const skill of skills) {
    if (blob.includes(skill)) {
      weight += 1;
      matched.push(skill);
      continue;
    }
    const tokens = skill.split(' ').filter((token) => token.length > 2 && !STOP.has(token));
    const tokenHits = tokens.filter((token) => blob.includes(token)).length;
    if (tokens.length && tokenHits / tokens.length >= 0.6) {
      weight += 0.65;
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }
  return { ratio: weight / skills.length, matched, missing };
}

function experienceRatio(jobYears, personYears) {
  if (jobYears.min == null || personYears.min == null) return 0.5;
  const max = jobYears.max != null ? jobYears.max : jobYears.min + 4;
  if (personYears.min >= jobYears.min && personYears.min <= max + 1) return 1;
  if (personYears.min >= jobYears.min - 1) return 0.72;
  if (personYears.min > max) return 0.55;
  return 0.22;
}

function bandFor(score) {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Partial';
  return 'Low';
}

function personBlob(person) {
  return [
    person?.skills,
    person?.product,
    person?.position,
    person?.companyName,
    person?.remark,
    String(person?.resumeText || '').slice(0, 2500),
  ].filter(Boolean).join(' ');
}

function jobDescriptionText(job) {
  const parts = [
    job?.title,
    job?.role,
    job?.summary,
    job?.description,
    job?.preferredProfile,
    job?.department,
    job?.industry,
    job?.clientName,
    job?.grade,
    job?.experience,
    job?.ctc,
    job?.salaryRange?.min != null || job?.salaryRange?.max != null
      ? `CTC ${job?.salaryRange?.min || ''} ${job?.salaryRange?.max || ''}`
      : '',
    Array.isArray(job?.responsibilities) ? job.responsibilities.join(' ') : job?.responsibilities,
    Array.isArray(job?.requirements) ? job.requirements.join(' ') : '',
    Array.isArray(job?.qualifications) ? job.qualifications.join(' ') : '',
    Array.isArray(job?.skills) ? job.skills.join(' ') : job?.skills,
  ];
  return parts.filter(Boolean).join(' ');
}

function toLpaNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Absolute INR (e.g. 300000) → LPA; small numbers are already LPA.
  if (n >= 1000) return Math.round((n / 100000) * 100) / 100;
  return n;
}

/**
 * Read min / max / upto CTC from salary fields + JD wording.
 * Examples: "minimum 3L", "up to 12 LPA", "8-10 L", "max CTC 15L".
 */
function jobCtcConstraint(job) {
  let min = null;
  let max = null;

  const range = job?.salaryRange || {};
  const fromMin = toLpaNumber(range.min);
  const fromMax = toLpaNumber(range.max);
  if (fromMin != null) min = fromMin;
  if (fromMax != null) max = fromMax;

  const ctcField = String(job?.ctc || '').trim();
  if (ctcField) {
    const parsed = parseCtcLpaRange(ctcField);
    if (parsed.min != null) min = min == null ? parsed.min : Math.max(min, parsed.min);
    if (parsed.max != null) max = max == null ? parsed.max : Math.min(max, parsed.max);
    if (/up\s*to|maximum|max\b|not\s+more\s+than|upto/i.test(ctcField) && parsed.max == null && parsed.min != null) {
      max = max == null ? parsed.min : Math.min(max, parsed.min);
      if (!/min|above|at\s+least|\+/i.test(ctcField)) min = null;
    }
    if (/minimum|min\b|at\s+least|and\s+above|\+/i.test(ctcField) && parsed.min != null) {
      min = min == null ? parsed.min : Math.max(min, parsed.min);
    }
  }

  const text = `${ctcField} ${jobDescriptionText(job)}`;
  const take = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  };

  for (const match of text.matchAll(
    /(?:minimum|min\.?|at\s+least)\s*(?:ctc|salary|package)?\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:l(?:pa|acs?|akh(?:s)?)?)?/gi
  )) {
    const n = take(match[1]);
    if (n != null) min = min == null ? n : Math.max(min, n);
  }
  for (const match of text.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:l(?:pa|acs?|akh(?:s)?)?)\s*(?:\+|and\s+above|onwards|or\s+above)/gi
  )) {
    const n = take(match[1]);
    if (n != null) min = min == null ? n : Math.max(min, n);
  }
  for (const match of text.matchAll(
    /(?:up\s*to|upto|maximum|max\.?|not\s+more\s+than|capped\s+at)\s*(?:ctc|salary|package)?\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*(?:l(?:pa|acs?|akh(?:s)?)?)?/gi
  )) {
    const n = take(match[1]);
    if (n != null) max = max == null ? n : Math.min(max, n);
  }
  for (const match of text.matchAll(
    /(?:ctc|salary|package|compensation)\s*(?:range)?\s*(?:of|:|-)?\s*(\d+(?:\.\d+)?)\s*(?:l(?:pa|acs?|akh(?:s)?)?)?\s*(?:-|–|to|and)\s*(\d+(?:\.\d+)?)\s*(?:l(?:pa|acs?|akh(?:s)?)?)?/gi
  )) {
    const a = take(match[1]);
    const b = take(match[2]);
    if (a != null && b != null) {
      min = min == null ? Math.min(a, b) : Math.max(min, Math.min(a, b));
      max = max == null ? Math.max(a, b) : Math.min(max, Math.max(a, b));
    }
  }
  for (const match of text.matchAll(
    /\b(\d+(?:\.\d+)?)\s*(?:l(?:pa|acs?|akh(?:s)?)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(?:l(?:pa|acs?|akh(?:s)?)?)?\b/gi
  )) {
    const a = take(match[1]);
    const b = take(match[2]);
    if (a != null && b != null) {
      min = min == null ? Math.min(a, b) : Math.max(min, Math.min(a, b));
      max = max == null ? Math.max(a, b) : Math.min(max, Math.max(a, b));
    }
  }

  if (min != null && max != null && min > max) {
    const swap = min;
    min = max;
    max = swap;
  }
  return { min, max };
}

function personCtcValue(person) {
  return String(person?.ctc || person?.expectedCtc || '').trim();
}

function findDomainKeysInText(text) {
  const hay = norm(text);
  if (!hay) return [];
  const hits = [];
  for (const group of DOMAIN_GROUPS) {
    if (group.aliases.some((alias) => hay.includes(alias))) hits.push(group.key);
  }
  return [...new Set(hits)];
}

/**
 * Domain rule from industry field + JD.
 * - "any domain" → open
 * - "banking / insurance" or "banking or insurance" → allow listed domains
 * - "banking industry" alone → only banking
 */
function jobDomainRequirement(job) {
  const industry = String(job?.industry || '').trim();
  const jd = jobDescriptionText(job);
  const blob = `${industry} ${jd}`;
  const lower = blob.toLowerCase();

  const anyDomain = /\bany\s+(domain|industry|vertical|background)s?\b|\bopen\s+to\s+all\s+(domains|industries|backgrounds)\b|\bno\s+(specific\s+)?(domain|industry)\s+(preference|required)\b|\ball\s+domains\b/.test(lower);
  if (anyDomain && !/\b(?:only|preferably|must\s+be)\s+(?:from\s+)?(?:banking|insurance|bfsi)/i.test(lower)) {
    return { mode: 'any', domains: [] };
  }

  const fromIndustry = industry
    .split(/[/|,;&+]|\band\b|\bor\b/i)
    .map((part) => findDomainKeysInText(part))
    .flat();

  const fromJd = [];
  for (const match of lower.matchAll(
    /(?:from|in|with)\s+(?:a\s+)?([a-z][a-z\s/,&-]{2,40}?)\s+(?:domain|industry|background|vertical)/gi
  )) {
    fromJd.push(...findDomainKeysInText(match[1]));
  }
  for (const match of lower.matchAll(
    /([a-z][a-z\s]{2,24}?)\s+industry/gi
  )) {
    fromJd.push(...findDomainKeysInText(match[1]));
  }
  // Explicit multi-list near domain wording: banking / insurance, banking or insurance
  for (const match of lower.matchAll(
    /((?:banking|insurance|bfsi|pharma|fintech|fmcg|telecom|retail|it|software|finance|home\s*loan)(?:\s*(?:\/|,|&|and|or)\s*(?:banking|insurance|bfsi|pharma|fintech|fmcg|telecom|retail|it|software|finance|home\s*loan))+)/gi
  )) {
    fromJd.push(...findDomainKeysInText(match[1]));
  }

  const domains = [...new Set([...fromIndustry, ...fromJd])];
  if (!domains.length) return { mode: 'none', domains: [] };
  return { mode: 'allow', domains };
}

function personMatchesDomains(person, domains) {
  if (!domains?.length) return true;
  const blob = [
    person?.product,
    person?.skills,
    person?.position,
    person?.remark,
    person?.companyName,
    String(person?.resumeText || '').slice(0, 1500),
  ].filter(Boolean).join(' ');
  const hits = findDomainKeysInText(blob);
  if (!hits.length) return false;
  return domains.some((domain) => hits.includes(domain));
}

/** Distinct search tokens pulled from the full requisition (title + JD sections). */
function jobSearchTokens(job, max = 14) {
  const priority = [
    ...(Array.isArray(job?.skills) ? job.skills : String(job?.skills || '').split(/[,|/]/)),
    job?.title,
    job?.role,
    job?.industry,
    job?.department,
    job?.preferredProfile,
    job?.location,
    ...(Array.isArray(job?.locations) ? job.locations : []),
  ];
  const jd = norm(jobDescriptionText(job));
  const seen = new Set();
  const out = [];
  const push = (raw) => {
    const parts = norm(raw).split(' ').filter((token) => (
      token.length > 2 && !STOP.has(token) && !BROAD_PLACE.has(token) && !JD_NOISE.has(token)
    ));
    for (const token of parts) {
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= max) return true;
    }
    return false;
  };
  for (const item of priority) {
    if (push(item)) return out;
  }
  for (const token of jd.split(' ')) {
    if (token.length <= 3 || STOP.has(token) || GENERIC_ROLE.has(token) || BROAD_PLACE.has(token) || JD_NOISE.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

/** Overlap between JD narrative and the person's profile / resume. */
function jdFit(job, personText) {
  const jd = norm(jobDescriptionText(job));
  if (jd.length < 48) return null;
  const blob = norm(personText);
  if (!blob) return { ratio: 0, matched: [], detail: 'No profile text to compare with the job description' };

  const tokens = [...new Set(
    jd.split(' ')
      .filter((token) => token.length > 3 && !STOP.has(token) && !GENERIC_ROLE.has(token) && !BROAD_PLACE.has(token))
  )].slice(0, 80);

  if (!tokens.length) return null;

  const matched = tokens.filter((token) => blob.includes(token)).slice(0, 8);
  const ratio = Math.min(1, matched.length / Math.min(14, Math.max(6, Math.ceil(tokens.length * 0.28))));
  let detail = 'Little overlap with the written job description';
  if (matched.length >= 4) detail = `JD themes: ${matched.slice(0, 5).join(', ')}`;
  else if (matched.length) detail = `Some JD overlap: ${matched.join(', ')}`;
  return { ratio, matched, detail };
}

/**
 * @returns {{ score: number, band: string, reasons: string[], matchedSkills: string[], missingSkills: string[] }}
 */
function scorePerson(job, person) {
  const blob = personBlob(person);
  const skillList = [
    ...(Array.isArray(job?.skills) ? job.skills : []),
    ...(Array.isArray(job?.requirements) ? job.requirements : []),
    ...(Array.isArray(job?.qualifications) ? job.qualifications : []),
  ].filter((item) => {
    const text = String(item || '').trim();
    return text.length >= 2 && text.length <= 40;
  });
  const skill = skillFit(skillList, blob);
  const jd = jdFit(job, blob);
  const jobYears = jobExperience(job);
  const personYears = yearsOf(person?.experience);
  const exp = experienceRatio(jobYears, personYears);
  const loc = locationRatio(job, person);
  const title = titleRatio(job, person);

  // Job description is the primary signal when present; skills/role reinforce it.
  let weights;
  if (jd) {
    weights = skill
      ? { jd: 40, skills: 22, role: 16, experience: 12, location: 10 }
      : { jd: 46, skills: 0, role: 24, experience: 16, location: 14 };
  } else {
    weights = skill
      ? { jd: 0, skills: 50, experience: 20, location: 15, role: 15 }
      : { jd: 0, skills: 0, experience: 30, location: 25, role: 45 };
  }

  const factors = [];
  if (weights.jd && jd) {
    factors.push(line('Job description', jd.ratio, weights.jd, jd.detail));
  }
  if (weights.skills) {
    const matched = (skill?.matched || []).slice(0, 4).join(', ');
    const missing = (skill?.missing || []).slice(0, 3).join(', ');
    let detail = 'No skill overlap with this job';
    if (matched && missing) detail = `Matched ${matched}. Missing ${missing}`;
    else if (matched) detail = `Matched ${matched}`;
    else if (missing) detail = `Missing ${missing}`;
    factors.push(line('Skills', skill?.ratio || 0, weights.skills, detail));
  }
  factors.push(line('Role', title, weights.role, roleDetail(job, person, title)));
  factors.push(line('Experience', exp, weights.experience, experienceDetail(jobYears, personYears)));
  factors.push(line('Location', loc, weights.location, locationDetail(job, person, loc)));

  const score = Math.max(0, Math.min(100, factors.reduce((sum, factor) => sum + factor.earned, 0)));
  const reasons = factors.map((factor) => `${factor.label}: ${factor.detail} (${factor.earned}/${factor.max})`);
  const why = factors.map((factor) => `${factor.label}: ${factor.detail}`).join(' · ');
  const brief = factors
    .map((factor) => {
      const ratio = factor.max ? factor.earned / factor.max : 0;
      const tip = String(factor.detail || '').split(/(?<=\.)\s/)[0].trim().slice(0, 56);
      if (ratio >= 0.75) return `${factor.label} fits well`;
      if (ratio >= 0.45) return tip || `${factor.label} partial`;
      return tip ? `${factor.label}: ${tip}` : `${factor.label} needs review`;
    })
    .slice(0, 3)
    .join(' · ');
  const gate = requisitionGate(job, person);
  return {
    score,
    band: bandFor(score),
    reasons,
    why,
    brief,
    factors,
    matchedSkills: skill?.matched || [],
    missingSkills: skill?.missing || [],
    jdThemes: jd?.matched || [],
    qualified: gate.ok,
    qualifyReason: gate.reason,
  };
}

function requisitionGate(job, person) {
  const requiredPlaces = jobLocationTokens(job);
  const personLoc = personPlace(person);
  // Strict location: job city/state must match; blank profile location does not pass.
  if (requiredPlaces.length) {
    if (!personLoc) {
      return { ok: false, reason: 'Location does not match the requisition' };
    }
    if (!requiredPlaces.some((token) => personLoc.includes(token))) {
      return { ok: false, reason: 'Location does not match the requisition' };
    }
  }

  // Strict CTC from salary fields + JD (minimum / maximum / upto / range).
  const ctcRule = jobCtcConstraint(job);
  if (ctcRule.min != null || ctcRule.max != null) {
    const personCtc = personCtcValue(person);
    if (!personCtc) {
      return { ok: false, reason: 'CTC does not match the requisition' };
    }
    if (ctcRule.min != null && !ctcAtLeast(personCtc, ctcRule.min)) {
      return { ok: false, reason: 'CTC does not match the requisition' };
    }
    if (ctcRule.max != null && !ctcWithinUpto(personCtc, ctcRule.max)) {
      return { ok: false, reason: 'CTC does not match the requisition' };
    }
  }

  // Domain: open when JD says any domain; otherwise only listed industries.
  const domainRule = jobDomainRequirement(job);
  if (domainRule.mode === 'allow' && domainRule.domains.length) {
    if (!personMatchesDomains(person, domainRule.domains)) {
      return { ok: false, reason: 'Domain does not match the requisition' };
    }
  }

  const roleTokens = norm(job?.title || job?.role)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP.has(token));
  const specific = roleTokens.filter((token) => !GENERIC_ROLE.has(token));
  const position = norm(person?.position);
  const needed = specific.length ? specific : roleTokens;
  const skillPhrases = phrases(job?.skills);
  const skillMatch = skillPhrases.length
    ? skillFit(skillPhrases, personBlob(person))
    : null;
  const jdMatch = jdFit(job, personBlob(person));
  if (needed.length) {
    const hits = needed.filter((token) => position.includes(token));
    const roleOk = hits.length >= 1;
    const skillOk = Boolean(skillMatch && skillMatch.ratio > 0);
    const jdOk = Boolean(jdMatch && jdMatch.ratio >= 0.28);
    if (!roleOk && !skillOk && !jdOk) {
      return { ok: false, reason: 'Role does not match the requisition' };
    }
  }

  return { ok: true, reason: '' };
}

function line(label, ratio, max, detail) {
  return {
    label,
    earned: Math.round(Math.max(0, Math.min(1, ratio)) * max),
    max,
    detail,
  };
}

function experienceDetail(jobYears, personYears) {
  if (jobYears.min == null) return 'Job has no experience range, so this part is neutral';
  if (personYears.min == null) return 'Not on the profile, so this part is only partial credit';
  const ceiling = jobYears.max != null ? `–${jobYears.max}` : '+';
  return `${personYears.min} yrs against the job’s ${jobYears.min}${ceiling} yrs`;
}

function locationDetail(job, person, ratio) {
  const jobLoc = [job?.location, ...(job?.locations || [])].filter(Boolean).join(', ');
  const personLoc = [person?.location, person?.state].filter(Boolean).join(', ');
  if (!jobLoc) return 'Job has no location, so this part is neutral';
  if (!personLoc) return `Profile has no location. Job is ${jobLoc}`;
  if (ratio >= 0.8) return `${personLoc} matches ${jobLoc}`;
  if (ratio > 0) return `${personLoc} only partly matches ${jobLoc}`;
  return `${personLoc} does not match ${jobLoc}`;
}

function roleDetail(job, person, ratio) {
  const title = job?.title || job?.role || 'the job title';
  const position = person?.position || '';
  if (!position) return `No current role on the profile to compare with ${title}`;
  if (ratio >= 0.5) return `${position} lines up with ${title}`;
  if (ratio > 0) return `${position} only partly lines up with ${title}`;
  return `${position} does not match ${title}`;
}

function jobBrief(job) {
  const responsibilities = Array.isArray(job?.responsibilities)
    ? job.responsibilities.filter(Boolean).slice(0, 12).join('; ')
    : '';
  const requirements = Array.isArray(job?.requirements)
    ? job.requirements.filter(Boolean).slice(0, 12).join('; ')
    : '';
  const qualifications = Array.isArray(job?.qualifications)
    ? job.qualifications.filter(Boolean).slice(0, 8).join('; ')
    : '';
  return [
    `Title: ${job?.title || job?.role || ''}`,
    job?.department ? `Department: ${job.department}` : '',
    job?.industry ? `Industry: ${job.industry}` : '',
    job?.clientName ? `Client: ${job.clientName}` : '',
    job?.location ? `Location: ${job.location}` : '',
    job?.experience ? `Experience: ${job.experience}` : '',
    job?.ctc || job?.salaryRange?.min != null || job?.salaryRange?.max != null
      ? `CTC: ${job.ctc || `${job?.salaryRange?.min || ''}–${job?.salaryRange?.max || ''}`}`
      : '',
    job?.grade ? `Grade: ${job.grade}` : '',
    (job?.skills || []).length ? `Skills: ${(Array.isArray(job.skills) ? job.skills : []).slice(0, 16).join(', ')}` : '',
    job?.preferredProfile ? `Preferred profile: ${norm(job.preferredProfile).slice(0, 600)}` : '',
    responsibilities ? `Responsibilities: ${responsibilities}` : '',
    requirements ? `Requirements: ${requirements}` : '',
    qualifications ? `Qualifications: ${qualifications}` : '',
    `Job description:\n${norm(`${job?.summary || ''} ${job?.description || ''}`).slice(0, 12000)}`,
  ].filter(Boolean).join('\n');
}

module.exports = {
  scorePerson,
  bandFor,
  jobBrief,
  jobDescriptionText,
  jobSearchTokens,
  jobLocationTokens,
  jobCtcConstraint,
  jobDomainRequirement,
  norm,
  requisitionGate,
};
