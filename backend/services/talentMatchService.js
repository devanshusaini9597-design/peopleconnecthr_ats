/**
 * Rank candidates or MIS contacts against one job.
 * Structured fit always runs. Optional AI pass rewrites the top of the list
 * with a reason, using the platform key or the org's connected provider.
 */
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const MisContact = require('../models/MisContact');
const { getAdapter } = require('../adapters');
const { platformAiConfig } = require('../adapters/platformAi');
const aiAdapterFactory = require('../adapters/aiAdapter');
const { candidateListScope, misListFilter, jobListFilter } = require('../utils/dataScope');
const { scorePerson, bandFor, jobBrief, jobSearchTokens, jobLocationTokens } = require('../utils/talentMatchScore');
const { parseJsonLoose } = require('./aiFeatureHelpers');
const logger = require('../utils/logger');

/** Keep related matches returned to the client (paginated in UI). */
const RESULT_KEEP = 20000;
const RESUME_RESCORING = 60;
const AI_EXPLAIN_LIMIT = 12;
const AI_RERANK_LIMIT = 40;
/** Safety cap while walking keyword matches (no city on the job). */
const SCAN_HARD_CAP = 25000;
/** City jobs: pull that city only. Cap stays under Railway’s HTTP window. */
const LOCATION_SCAN_CAP = 15000;
const BATCH_SIZE = 1500;
const LOCATION_BATCH = 8000;
const QUERY_MS = 8000;
const LOCATION_QUERY_MS = 12000;
const SCAN_BUDGET_MS = 14000;
const LOCATION_SCAN_BUDGET_MS = 20000;
const MIN_RELATED_SCORE = 28;

/** Platform AI for Suggested talent — does not require BYOK / credits integration. */
async function getTalentAiAdapter(organizationId) {
  try {
    const byok = await getAdapter(organizationId, 'ai');
    if (byok) return byok;
  } catch {
    /* fall through to platform key */
  }
  const platform = platformAiConfig();
  if (!platform) return null;
  try {
    return aiAdapterFactory.createAiAdapter(platform);
  } catch {
    return null;
  }
}

function httpError(message, statusCode = 400, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return RESULT_KEEP;
  return Math.min(RESULT_KEEP, Math.max(5, Math.round(n)));
}

function toRow(person, source, fit) {
  const phone = String(person.phone || person.contact || '').trim();
  return {
    id: String(person._id),
    source,
    name: person.name || '',
    email: person.email || '',
    phone,
    position: person.position || '',
    location: person.location || '',
    companyName: person.companyName || '',
    experience: person.experience || '',
    skills: person.skills || '',
    noticePeriod: person.noticePeriod || '',
    product: person.product || '',
    remark: person.remark || '',
    ctc: person.ctc || '',
    expectedCtc: person.expectedCtc || '',
    marketingConsent: person.marketingConsent !== false,
    unsubscribed: Boolean(person.unsubscribedAt),
    hasResume: source === 'candidate' ? undefined : false,
    qualified: Boolean(fit.qualified),
    qualifyReason: fit.qualifyReason || '',
    score: fit.score,
    fitScore: fit.score,
    band: fit.band,
    reasons: fit.reasons,
    why: fit.why || '',
    brief: fit.brief || '',
    factors: fit.factors || [],
    matchedSkills: fit.matchedSkills,
    missingSkills: fit.missingSkills,
    aiReason: '',
    strengths: [],
    gaps: [],
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jobTokens(job) {
  return jobSearchTokens(job, 18);
}

async function fetchBatch(model, filter, select, sort, limit, afterId = null, queryMs = QUERY_MS) {
  const query = afterId
    ? { $and: [filter, { _id: { $gt: afterId } }] }
    : filter;
  try {
    let q = model.find(query).select(select).limit(limit).maxTimeMS(queryMs).lean();
    if (sort) q = q.sort(sort);
    const rows = await q;
    return { rows, timedOut: false };
  } catch (err) {
    const timedOut = err?.code === 50 || /time limit|maxTimeMS/i.test(String(err?.message || ''));
    if (timedOut) return { rows: [], timedOut: true };
    throw err;
  }
}

function maxObjectId(rows, current = null) {
  let max = current;
  for (const row of rows) {
    if (!row?._id) continue;
    if (!max || String(row._id) > String(max)) max = row._id;
  }
  return max;
}

/** Cursor-walk matches (no skip — stable on large directories). */
async function fetchAllMatching(
  model,
  filter,
  select,
  sort,
  hardCap = SCAN_HARD_CAP,
  budgetMs = SCAN_BUDGET_MS,
  queryMs = QUERY_MS,
  batchSize = BATCH_SIZE,
) {
  const out = [];
  let afterId = null;
  const started = Date.now();
  while (out.length < hardCap && (Date.now() - started) < budgetMs) {
    const take = Math.min(batchSize, hardCap - out.length);
    const { rows, timedOut } = await fetchBatch(
      model,
      filter,
      select,
      afterId ? { _id: 1 } : sort,
      take,
      afterId,
      queryMs,
    );
    if (timedOut) break;
    if (!rows.length) break;
    out.push(...rows);
    afterId = maxObjectId(rows, afterId);
    if (rows.length < take) break;
  }
  return out;
}

function keywordFilter(baseFilter, tokens) {
  if (!tokens.length) return null;
  // Keep the $or compact — too many regex branches times out Mongo.
  const use = tokens.slice(0, 8);
  return {
    $and: [
      baseFilter,
      {
        $or: use.flatMap((token) => {
          const rx = new RegExp(escapeRegex(token), 'i');
          return [
            { position: rx },
            { skills: rx },
            { product: rx },
            { location: rx },
          ];
        }),
      },
    ],
  };
}

function locationFilter(baseFilter, job) {
  const tokens = jobLocationTokens(job);
  if (!tokens.length) return null;
  const rx = new RegExp(tokens.map(escapeRegex).join('|'), 'i');
  return {
    $and: [
      baseFilter,
      { $or: [{ location: rx }, { state: rx }] },
    ],
  };
}

async function scanDirectory(model, filter, select, job, source, sort) {
  const locFilter = locationFilter(filter, job);
  let people = [];
  let pullMode = 'keyword';
  let sampleCap = SCAN_HARD_CAP;

  try {
    if (locFilter) {
      pullMode = 'location';
      sampleCap = LOCATION_SCAN_CAP;
      try {
        people = await model.find(locFilter)
          .select(select)
          .limit(LOCATION_SCAN_CAP)
          .maxTimeMS(LOCATION_QUERY_MS)
          .lean();
      } catch {
        people = await fetchAllMatching(
          model,
          locFilter,
          select,
          null,
          LOCATION_SCAN_CAP,
          LOCATION_SCAN_BUDGET_MS,
          LOCATION_QUERY_MS,
          LOCATION_BATCH,
        );
      }
    } else {
      const keyed = keywordFilter(filter, jobTokens(job));
      if (keyed) {
        people = await fetchAllMatching(model, keyed, select, sort, SCAN_HARD_CAP);
      }
      if (people.length < 150) {
        pullMode = people.length ? 'keyword+recent' : 'recent';
        const recent = await fetchAllMatching(model, filter, select, sort, Math.min(4000, SCAN_HARD_CAP));
        const byId = new Map(people.map((person) => [String(person._id), person]));
        for (const person of recent) byId.set(String(person._id), person);
        people = [...byId.values()];
      }
    }
  } catch (err) {
    try {
      const fallback = await fetchBatch(
        model,
        locFilter || filter,
        select,
        null,
        2500,
        null,
        LOCATION_QUERY_MS,
      );
      people = fallback.rows;
      pullMode = locFilter ? 'location' : 'recent';
    } catch {
      people = [];
    }
  }

  const scored = people
    .map((person) => toRow(person, source, scorePerson(job, person)))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // Hard gates: wrong location / CTC / domain never surface via score alone.
  const HARD_FAIL = new Set([
    'Location does not match the requisition',
    'CTC does not match the requisition',
    'Domain does not match the requisition',
  ]);
  const hardOk = scored.filter((row) => !HARD_FAIL.has(row.qualifyReason));
  const related = hardOk.filter((row) => row.qualified || row.score >= MIN_RELATED_SCORE);
  const ranked = (related.length ? related : hardOk).slice(0, RESULT_KEEP);
  const hitCap = people.length >= sampleCap;
  return {
    ranked,
    scanned: people.length,
    sampleCap,
    matchCount: ranked.length,
    pullMode,
    fullDirectory: pullMode === 'location' && !hitCap,
  };
}

function mergeDirectories(parts) {
  const byEmail = new Map();
  const withoutEmail = [];
  let scanned = 0;
  for (const part of parts) {
    scanned += part.scanned || 0;
    for (const row of part.ranked || []) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email) {
        withoutEmail.push(row);
        continue;
      }
      const existing = byEmail.get(email);
      if (!existing) {
        byEmail.set(email, row);
        continue;
      }
      const winner = row.score > existing.score ? { ...row } : { ...existing };
      winner.source = existing.source === row.source ? existing.source : 'both';
      byEmail.set(email, winner);
    }
  }
  const ranked = [...byEmail.values(), ...withoutEmail]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, RESULT_KEEP);
  const fullDirectory = parts.length > 0 && parts.every((part) => part.fullDirectory);
  const pullMode = parts.some((part) => part.pullMode === 'location')
    ? 'location'
    : (parts[0]?.pullMode || 'keyword');
  const sampleCap = Math.max(...parts.map((part) => part.sampleCap || SCAN_HARD_CAP), SCAN_HARD_CAP);
  return { ranked, scanned, fullDirectory, pullMode, sampleCap };
}

async function loadRanked(user, source, job) {
  const empty = {
    ranked: [], scanned: 0, sampleCap: SCAN_HARD_CAP, matchCount: 0, pullMode: 'keyword', fullDirectory: false,
  };
  if (source === 'all') {
    const [candidates, mis] = await Promise.all([
      loadRanked(user, 'candidates', job).catch(() => empty),
      loadRanked(user, 'mis', job).catch(() => empty),
    ]);
    return mergeDirectories([candidates, mis]);
  }
  if (source === 'mis') {
    return scanDirectory(
      MisContact,
      misListFilter(user.organizationId, user),
      'name email phone contact position location state companyName experience skills product remark marketingConsent unsubscribedAt ctc expectedCtc',
      job,
      'mis',
      { updatedAt: -1 }
    );
  }
  const scope = await candidateListScope({ user, query: { view: 'all' } }, 'all');
  return scanDirectory(
    Candidate,
    scope,
    'name email phone contact position location state companyName experience skills product noticePeriod ctc expectedCtc',
    job,
    'candidate',
    { createdAt: -1 }
  );
}

async function rescoreTopWithResumes(job, ranked) {
  const top = ranked.slice(0, RESUME_RESCORING);
  if (!top.length) return ranked;
  const ids = top.map((row) => row.id).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const resumes = await Candidate.find({ _id: { $in: ids } })
    .select('resumeText')
    .maxTimeMS(QUERY_MS)
    .lean();
  const byId = new Map(resumes.map((row) => [String(row._id), String(row.resumeText || '').slice(0, 2500)]));

  const rescored = top.map((row) => {
    const resumeText = byId.get(row.id) || '';
    if (!resumeText) return { ...row, hasResume: false };
    const fit = scorePerson(job, {
      skills: row.skills,
      product: row.product,
      remark: row.remark,
      position: row.position,
      companyName: row.companyName,
      location: row.location,
      experience: row.experience,
      ctc: row.ctc,
      expectedCtc: row.expectedCtc,
      resumeText,
    });
    return {
      ...row,
      hasResume: true,
      score: fit.score,
      fitScore: fit.score,
      band: fit.band,
      reasons: fit.reasons,
      why: fit.why,
      brief: fit.brief || '',
      factors: fit.factors,
      matchedSkills: fit.matchedSkills,
      missingSkills: fit.missingSkills,
      qualified: fit.qualified,
      qualifyReason: fit.qualifyReason || '',
    };
  });

  const rest = ranked.slice(RESUME_RESCORING).map((row) => ({ ...row, hasResume: false }));
  return [...rescored, ...rest].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

async function explainTop(adapter, job, rows, limit = AI_EXPLAIN_LIMIT) {
  const keep = Math.min(Math.max(1, Number(limit) || AI_EXPLAIN_LIMIT), AI_RERANK_LIMIT);
  const slice = rows.slice(0, keep);
  const people = slice.map((row) => [
    `ID: ${row.id}`,
    row.position ? `Title: ${row.position}` : '',
    row.location ? `Location: ${row.location}` : '',
    row.experience ? `Experience: ${row.experience}` : '',
    row.skills ? `Skills: ${row.skills}` : '',
    row.product ? `Domain: ${row.product}` : '',
    row.companyName ? `Company: ${row.companyName}` : '',
    row.reasons?.length ? `Fit notes: ${row.reasons.join('; ')}` : '',
  ].filter(Boolean).join('\n')).join('\n---\n');

  const raw = await adapter.generateText({
    prompt: `You are an enterprise recruiting analyst. Rank each person against this requisition.
Return JSON only: {"people":[{"id":string,"score":number,"reason":string,"strengths":[string],"gaps":[string]}]}
Scores are integers 0-100. Reason is one short sentence.
Rules:
1) The written JOB DESCRIPTION and responsibilities are the primary signal — weight them highest.
2) Prefer people whose current title is a natural fit for titles/duties described in the JD (not only an exact title match).
3) Then consider skills, experience band, location, and industry.
4) Do not invent employers, degrees, or skills that are not in the profile.

JOB:
${jobBrief(job)}

PEOPLE:
${people}`,
    maxTokens: 1800,
  });

  const parsed = parseJsonLoose(raw, { people: [] });
  const notes = new Map(
    (Array.isArray(parsed?.people) ? parsed.people : [])
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item])
  );

  const merged = rows.map((row, index) => {
    if (index >= keep) return row;
    const note = notes.get(row.id);
    const aiScore = Number(note?.score);
    if (!note || !Number.isFinite(aiScore)) return row;
    const blended = Math.max(0, Math.min(100, Math.round((row.fitScore * 0.45) + (aiScore * 0.55))));
    return {
      ...row,
      score: blended,
      band: bandFor(blended),
      aiReason: String(note.reason || '').slice(0, 400),
      strengths: Array.isArray(note.strengths) ? note.strengths.slice(0, 4).map(String) : [],
      gaps: Array.isArray(note.gaps) ? note.gaps.slice(0, 4).map(String) : [],
    };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return { rows: merged, explained: merged.some((row) => row.aiReason) };
}

function cleanTerms(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter((item) => item.length >= 2).slice(0, 6);
}

function applyConstraints(job, constraints) {
  if (!constraints || typeof constraints !== 'object') return job;
  const next = { ...job, locations: Array.isArray(job.locations) ? [...job.locations] : [] };
  const locations = cleanTerms(constraints.locations);
  const roles = cleanTerms(constraints.roles);
  const skills = cleanTerms(constraints.skills);
  const industries = cleanTerms(constraints.industries);
  if (locations.length) {
    next.location = locations.join(', ');
    next.locations = locations;
  }
  if (roles.length) {
    next.role = roles[0];
    next.title = roles[0];
  }
  if (skills.length) next.skills = skills;
  if (industries.length) next.industry = industries.join(', ');
  return next;
}

function rolePhraseHits(position, phrase) {
  const pos = String(position || '').toLowerCase();
  const raw = String(phrase || '').toLowerCase().trim();
  if (!raw || !pos) return false;
  if (pos.includes(raw)) return true;
  const tokens = raw.split(/[^a-z0-9+#]+/).filter((token) => token.length > 2);
  if (!tokens.length) return false;
  const needed = tokens.length >= 3 ? Math.ceil(tokens.length * 0.7) : tokens.length;
  return tokens.filter((token) => pos.includes(token)).length >= needed;
}

function applyResultFilters(rows, constraints) {
  const list = Array.isArray(rows) ? rows : [];
  const c = normalizeConstraints(constraints);
  return list.filter((row) => {
    if (c.excludeRoles.some((phrase) => rolePhraseHits(row.position, phrase))) return false;
    if (c.locations.length) {
      const person = String(row.location || '').toLowerCase();
      const ok = c.locations.some((place) => {
        const tokens = String(place).toLowerCase().split(/[^a-z]+/).filter((token) => token.length > 2);
        return tokens.some((token) => person.includes(token)) || person.includes(String(place).toLowerCase());
      });
      if (!ok) return false;
    }
    // Role "keep" is applied via scoring (applyConstraints). Only hard-filter when the
    // phrase clearly appears nowhere near the person's title after ranking.
    if (c.roles.length && c.roles.every((phrase) => !rolePhraseHits(row.position, phrase))) {
      const pos = String(row.position || '').toLowerCase();
      const anyToken = c.roles.some((phrase) => String(phrase).toLowerCase().split(/[^a-z0-9+#]+/).filter((t) => t.length > 3).some((t) => pos.includes(t)));
      if (!anyToken) return false;
    }
    return true;
  });
}

async function rankForJob(user, body = {}) {
  const organizationId = user?.organizationId;
  if (!organizationId) throw httpError('Organization required', 400);

  const source = body.source === 'mis' ? 'mis' : body.source === 'all' ? 'all' : 'candidates';
  const jobId = String(body.jobId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(jobId)) throw httpError('jobId is required', 400);

  const jobQuery = { ...jobListFilter({ user, query: {} }), _id: jobId };
  const job = await Job.findOne(jobQuery).lean();
  if (!job) throw httpError('Job not found', 404);

  const limit = clampLimit(body.limit);
  const matchJob = applyConstraints(job, body.constraints);

  let scannedResult;
  try {
    scannedResult = await loadRanked(user, source, matchJob);
  } catch (err) {
    const msg = String(err?.message || 'Could not rank this job');
    logger.error({ err, jobId }, 'Suggested talent scan failed');
    scannedResult = {
      ranked: [],
      scanned: 0,
      sampleCap: SCAN_HARD_CAP,
      matchCount: 0,
      pullMode: 'keyword',
      fullDirectory: false,
      error: msg.slice(0, 180),
    };
  }

  let ranked = scannedResult.ranked;
  const scanned = scannedResult.scanned;
  if (source === 'candidates' || source === 'all') {
    try {
      ranked = await rescoreTopWithResumes(matchJob, ranked);
    } catch {
      /* keep fit scores without resume enrich */
    }
  }

  let ai = { available: false, explained: false, message: '', mode: 'fit' };
  let adapter = null;
  try {
    adapter = await getTalentAiAdapter(organizationId);
  } catch (err) {
    adapter = null;
    ai.message = err.message;
  }
  ai.available = Boolean(adapter);

  // AI notes are optional enrichment only — never required for ranking / Re-rank.
  // Re-rank uses full JD fit scores; explain=true adds notes when platform AI works.
  const wantExplain = Boolean(body.explain) && ranked.length > 0;
  if (wantExplain) {
    if (!adapter) {
      ai.message = 'AI notes unavailable right now. The list was still re-ranked from the full job description (no AI credits needed).';
      ai.mode = 'fit';
    } else {
      try {
        const explained = await explainTop(adapter, matchJob, ranked, AI_EXPLAIN_LIMIT);
        ranked = explained.rows;
        ai.explained = explained.explained;
        ai.mode = explained.explained ? 'smart' : 'fit';
        if (!explained.explained) {
          ai.message = 'AI did not return notes. Fit scores from the job description are unchanged.';
        }
      } catch (err) {
        const raw = String(err.message || 'AI explanation failed');
        const credits = /credit|quota|billing|insufficient|rate limit|429/i.test(raw);
        ai.message = credits
          ? 'AI notes need provider credits. The match list was still re-ranked from the full job description.'
          : raw;
        ai.mode = 'fit';
      }
    }
  } else {
    ai.mode = 'fit';
  }

  return {
    job: {
      id: String(job._id),
      title: matchJob.title || matchJob.role || '',
      jobCode: job.jobCode || '',
      location: matchJob.location || '',
      industry: matchJob.industry || '',
      skills: Array.isArray(matchJob.skills) ? matchJob.skills.slice(0, 8) : [],
    },
    source,
    scanned,
    sampleCap: scannedResult.sampleCap || SCAN_HARD_CAP,
    resultCap: RESULT_KEEP,
    fullDirectory: Boolean(scannedResult.fullDirectory),
    pullMode: scannedResult.pullMode || 'keyword',
    results: applyResultFilters(ranked, body.constraints).slice(0, limit).map(({ remark, ...row }) => row),
    ai,
    agent: { available: ai.available, mode: ai.mode === 'smart' ? 'smart' : 'fit' },
    constraints: body.constraints && typeof body.constraints === 'object'
      ? {
        locations: cleanTerms(body.constraints.locations),
        roles: cleanTerms(body.constraints.roles),
        skills: cleanTerms(body.constraints.skills),
        industries: cleanTerms(body.constraints.industries),
        excludeRoles: cleanTerms(body.constraints.excludeRoles),
      }
      : emptyConstraints(),
  };
}

function emptyConstraints() {
  return { locations: [], roles: [], skills: [], industries: [], excludeRoles: [] };
}

function normalizeConstraints(input) {
  if (!input || typeof input !== 'object') return emptyConstraints();
  return {
    locations: cleanTerms(input.locations),
    roles: cleanTerms(input.roles).filter((item) => item.length <= 64),
    skills: cleanTerms(input.skills),
    industries: cleanTerms(input.industries),
    excludeRoles: cleanTerms(input.excludeRoles || input.exclude_roles).filter((item) => item.length <= 64),
  };
}

function mergeConstraintState(current, next, reset) {
  if (reset) return emptyConstraints();
  const base = normalizeConstraints(current);
  const incoming = normalizeConstraints(next);
  return {
    locations: incoming.locations.length ? incoming.locations : base.locations,
    roles: incoming.roles.length ? incoming.roles : base.roles,
    skills: incoming.skills.length ? incoming.skills : base.skills,
    industries: incoming.industries.length ? incoming.industries : base.industries,
    excludeRoles: incoming.excludeRoles.length
      ? [...new Set([...(base.excludeRoles || []), ...incoming.excludeRoles])].slice(0, 8)
      : (base.excludeRoles || []),
  };
}

function constraintsActive(constraints) {
  const c = normalizeConstraints(constraints);
  return ['locations', 'roles', 'skills', 'industries', 'excludeRoles'].some((key) => c[key].length > 0);
}

function presentConstraints(constraints) {
  const c = normalizeConstraints(constraints);
  const parts = [];
  if (c.roles.length) parts.push(`keep role ${c.roles.join(', ')}`);
  if (c.excludeRoles.length) parts.push(`exclude ${c.excludeRoles.join(', ')}`);
  if (c.locations.length) parts.push(`location ${c.locations.join(', ')}`);
  if (c.skills.length) parts.push(`skills ${c.skills.join(', ')}`);
  if (c.industries.length) parts.push(`industry ${c.industries.join(', ')}`);
  return parts.join('; ');
}

function tidyPhrase(value) {
  return String(value || '')
    .replace(/\b(candidates?|people|profiles?|please|just|the|a|an|from|list|shortlist)\b/gi, ' ')
    .replace(/[.…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deterministic parse for free-form recruiter chat (compound keep/remove/city). */
function parseTalentIntent(message, job = {}) {
  const raw = String(message || '').trim();
  const lower = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const roleName = job.role || job.title || '';
  const jobLocation = job.location || '';
  const empty = emptyConstraints();

  if (/^(reset|start over|clear|show everyone|back to the requisition|original list)\b/.test(lower)) {
    return {
      reply: 'Restored the full requisition shortlist. Extra filters are cleared.',
      reset: true,
      constraints: empty,
      tools: ['set_filters', 're_rank'],
    };
  }

  const excludeRoles = [];
  const roles = [];
  const locations = [];

  const removeParts = lower.split(/\b(?:remove|drop|exclude|without|hide)\b/i).slice(1);
  for (const part of removeParts) {
    const chunk = part
      .split(/\b(?:i want|i need|keep|show|find|only|and then|then|also)\b/i)[0]
      || '';
    const phrase = tidyPhrase(
      chunk
        .replace(/\bfrom(?:\s+the)?\s+list\b/gi, ' ')
        .replace(/[.,;]+/g, ' ')
    );
    if (phrase.length > 2 && phrase.length < 64) excludeRoles.push(phrase);
  }

  const onlyMatch = lower.match(/\b(?:want\s+|need\s+|show\s+|keep\s+)?only\s+([a-z0-9][a-z0-9 +/#\-]{1,48}?)(?:\s+in\s+the\s+list|\s+roles?\b|\s*$|\s+in\s+[a-z]|\s+please\b)/i)
    || lower.match(/\b(?:keep|show|find|looking for)\s+([a-z0-9][a-z0-9 +/#\-]{1,48}?)\s+roles?\b/i);
  if (onlyMatch) {
    const phrase = tidyPhrase(onlyMatch[1]);
    if (phrase.length > 2) roles.push(phrase);
  }

  if (/only this role|same role|this role only/.test(lower) && roleName) roles.push(roleName);
  if (/only (?:the )?(?:job )?location|same location|job city only/.test(lower) && jobLocation) {
    locations.push(jobLocation);
  }

  const city = lower.match(/\b(?:in|at|near|based in|located in)\s+([a-z][a-z.\s]{1,28}?)(?:\s+(?:only|please|thanks|now)\b|[.,;]|$)/i);
  if (city) {
    const place = tidyPhrase(city[1].replace(/\bthe\s+list\b/gi, ''));
    if (place.length > 2 && place !== 'list') locations.push(place);
  }

  if (!roles.length && !excludeRoles.length) {
    const free = lower
      .replace(/^(i want|i need|show me|find me|can you|could you|please|get me)\s+/i, '')
      .replace(/\b(?:in|at|near|based in|located in)\s+[a-z][a-z.\s]{1,28}/i, '')
      .trim();
    const cleaned = tidyPhrase(free);
    if (
      cleaned.length > 3
      && cleaned.length < 56
      && cleaned.split(/\s+/).length <= 7
      && /manager|executive|officer|recruiter|developer|engineer|sales|analyst|consultant|head|lead|specialist|advisor|cashier|teller|relationship|casa|branch/.test(cleaned)
    ) {
      roles.push(cleaned);
    }
  }

  const constraints = {
    locations: [...new Set(locations)].slice(0, 6),
    roles: [...new Set(roles)].slice(0, 6),
    skills: [],
    industries: [],
    excludeRoles: [...new Set(excludeRoles)].slice(0, 8),
  };

  if (constraintsActive(constraints)) {
    const bits = [];
    if (constraints.excludeRoles.length) bits.push(`removed ${constraints.excludeRoles.join(', ')}`);
    if (constraints.roles.length) bits.push(`kept ${constraints.roles.join(', ')}`);
    if (constraints.locations.length) bits.push(`in ${constraints.locations.join(', ')}`);
    return {
      reply: `Updating the shortlist — ${bits.join('; ')}.`,
      reset: false,
      constraints,
      tools: ['set_filters', 're_rank'],
    };
  }

  if (/\?/.test(raw) || /^(why|who|what|how|tell|explain)\b/.test(lower)) {
    return {
      reply: `This shortlist is for ${roleName || 'this role'}${jobLocation ? ` in ${jobLocation}` : ''}. Ask about a person, or tell me which titles to keep or remove.`,
      reset: false,
      constraints: empty,
      tools: ['answer', 'explain_top'],
    };
  }

  return {
    reply: 'Tell me which titles to keep or remove, or a city to filter — for example “remove branch sales manager, keep only branch manager”.',
    reset: false,
    constraints: empty,
    tools: ['answer'],
  };
}

function fallbackTalentReply(message, job) {
  return parseTalentIntent(message, job);
}

function shortlistDigest(rows = []) {
  return (rows || []).slice(0, 12).map((row, index) => (
    `${index + 1}. ${row.name || 'Unknown'} | ${row.position || '—'} | ${row.location || '—'} | score ${row.score}${row.aiReason ? ` | ${String(row.aiReason).slice(0, 120)}` : ''}`
  )).join('\n');
}

async function planAgentTurn(adapter, job, message, history, constraints, shortlistPreview) {
  const raw = await adapter.generateText({
    prompt: `You are a senior recruiting talent agent in an ATS. Talk like a helpful ChatGPT colleague: clear, specific, and action-oriented.
Decide tools for this turn and return JSON only:
{"reply":"2-4 friendly sentences","reset":false,"locations":[],"roles":[],"excludeRoles":[],"skills":[],"industries":[],"tools":["set_filters","re_rank","explain_top","answer"]}

Rules:
- Free-form conversation is expected. Interpret natural language (keep / remove / find / only / in city / why / explain).
- Use set_filters when narrowing, widening, keeping, or removing people by role/city/skill/industry.
- Put roles to KEEP in "roles". Put roles/titles to REMOVE in "excludeRoles" (e.g. "branch operation executive").
- Use re_rank whenever filters change, or when they ask to refresh / find better matches / re-rank.
- Use explain_top when they ask why someone matches or want AI notes on top people.
- Use answer for pure questions that do not change the list.
- Set reset true only when they want the original requisition shortlist.
- Leave lists empty when not changing that filter.
- Never invent people who are not in SHORTLIST PREVIEW. Use real names/titles from it when answering "why".
- reply should sound human and confirm what you will do.

JOB
Title: ${job.title || job.role || ''}
Location: ${job.location || ''}
Industry: ${job.industry || ''}
Skills: ${(job.skills || []).slice(0, 8).join(', ')}

CURRENT FILTERS
${presentConstraints(constraints) || 'none'}

SHORTLIST PREVIEW
${shortlistPreview || 'none yet'}

CONVERSATION
${history || 'none'}

USER
${message}`,
    maxTokens: 550,
  });
  const parsed = parseJsonLoose(raw, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const tools = Array.isArray(parsed.tools)
    ? parsed.tools.map(String).filter((tool) => ['set_filters', 're_rank', 'explain_top', 'answer'].includes(tool))
    : [];
  return {
    reply: String(parsed.reply || '').slice(0, 900),
    reset: Boolean(parsed.reset),
    constraints: normalizeConstraints(parsed),
    tools: tools.length ? tools : (Boolean(parsed.reset) || constraintsActive(parsed) ? ['set_filters', 're_rank'] : ['answer']),
  };
}

async function composeNaturalReply(adapter, {
  job, message, history, constraints, results, planReply, changed,
}) {
  if (!adapter) return planReply;
  try {
    const count = Array.isArray(results) ? results.length : null;
    const digest = shortlistDigest(results || []);
    const raw = await adapter.generateText({
      prompt: `You are a recruiting talent agent. Write a natural ChatGPT-style reply (2-5 short sentences).
Confirm what you did, mention the result count if known, and invite a follow-up. No markdown bullets. No inventing people.

JOB: ${job.title || job.role || ''} · ${job.location || ''}
FILTERS: ${presentConstraints(constraints) || 'none'}
LIST CHANGED: ${changed ? 'yes' : 'no'}
COUNT: ${count == null ? 'unknown' : count}
TOP PEOPLE:
${digest || 'n/a'}

DRAFT NOTES: ${planReply || ''}
HISTORY:
${history || 'none'}
USER: ${message}

Reply:`,
      maxTokens: 280,
    });
    const text = String(raw || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    return text.slice(0, 900) || planReply;
  } catch {
    return planReply;
  }
}

async function replyToTalentChat(user, body = {}) {
  const jobId = String(body.jobId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(jobId)) throw httpError('jobId is required', 400);
  const source = body.source === 'mis' ? 'mis' : body.source === 'all' ? 'all' : 'candidates';
  const job = await Job.findOne({ ...jobListFilter({ user, query: {} }), _id: jobId }).lean();
  if (!job) throw httpError('Job not found', 404);
  const message = String(body.message || '').trim().slice(0, 1200);
  if (!message) throw httpError('message is required', 400);

  const historyItems = (Array.isArray(body.history) ? body.history : []).slice(-10);
  const history = historyItems
    .map((item) => `${item?.role === 'user' ? 'User' : 'Assistant'}: ${String(item?.text || '').slice(0, 400)}`)
    .join('\n');
  const previewRows = Array.isArray(body.previewResults) ? body.previewResults.slice(0, 12) : [];

  let constraints = normalizeConstraints(body.constraints);
  const steps = [];
  let plan = null;
  let adapter = null;
  try {
    adapter = await getTalentAiAdapter(user.organizationId);
  } catch {
    adapter = null;
  }

  const localPlan = parseTalentIntent(message, job);
  if (adapter) {
    try {
      plan = await planAgentTurn(adapter, job, message, history, constraints, shortlistDigest(previewRows));
      if (plan) steps.push({ tool: 'plan', detail: 'Understood your request' });
    } catch {
      plan = null;
    }
  }
  if (!plan) {
    plan = localPlan;
    steps.push({ tool: 'fallback', detail: adapter ? 'Used local rules after plan failed' : 'Fit-score mode; local rules' });
  } else if (!plan.reset && !constraintsActive(plan.constraints) && constraintsActive(localPlan.constraints)) {
    // AI answered conversationally but missed the filter intent — apply local keep/remove/city
    plan = {
      ...plan,
      constraints: localPlan.constraints,
      tools: [...new Set([...(plan.tools || []), 'set_filters', 're_rank'])],
      reply: plan.reply && !/^ask me anything/i.test(plan.reply) ? plan.reply : localPlan.reply,
    };
    steps.push({ tool: 'local_filters', detail: presentConstraints(localPlan.constraints) || 'Applied local filters' });
  } else if (!plan.reset && constraintsActive(localPlan.constraints)) {
    // Merge any exclude/keep the model missed
    plan = {
      ...plan,
      constraints: mergeConstraintState(plan.constraints, localPlan.constraints, false),
      tools: [...new Set([...(plan.tools || []), ...(localPlan.tools || [])])],
    };
  }

  const useFilters = plan.reset || plan.tools.includes('set_filters') || constraintsActive(plan.constraints);
  if (useFilters) {
    constraints = mergeConstraintState(constraints, plan.constraints, plan.reset);
    steps.push({
      tool: 'set_filters',
      detail: plan.reset ? 'Cleared filters' : (presentConstraints(constraints) || 'Updated filters'),
    });
  }

  const needRank = plan.reset
    || plan.tools.includes('re_rank')
    || plan.tools.includes('explain_top')
    || useFilters
    || Boolean(body.forceRank);
  let ranked = null;
  if (needRank) {
    steps.push({ tool: 're_rank', detail: 'Updating the shortlist' });
    ranked = await rankForJob(user, {
      jobId,
      source,
      limit: clampLimit(body.limit || 5000),
      constraints,
      smart: false,
      explain: false,
    });
    if (ranked?.results) {
      ranked.results = applyResultFilters(ranked.results, constraints);
    }
    if (plan.tools.includes('explain_top') || /\bwhy\b|\bexplain\b/i.test(message)) {
      steps.push({ tool: 'explain_top', detail: 'Added match notes' });
    }
  } else if (previewRows.length && constraintsActive(constraints)) {
    ranked = {
      results: applyResultFilters(previewRows, constraints),
      scanned: body.scanned,
      job: body.jobPreview,
      ai: { available: Boolean(adapter), explained: false, message: '', mode: adapter ? 'smart' : 'fit' },
      agent: { available: Boolean(adapter), mode: adapter ? 'smart' : 'fit' },
    };
  }

  const results = ranked?.results || null;
  const count = results?.length;
  let reply = plan.reply;
  if (needRank && Number.isFinite(count)) {
    const filterLabel = presentConstraints(constraints);
    if (plan.reset) {
      reply = `Cleared the extra filters. ${count} ${count === 1 ? 'person matches' : 'people match'} the requisition.`;
    } else if (filterLabel) {
      reply = `Done — ${count} ${count === 1 ? 'person matches' : 'people match'} (${filterLabel}).`;
    } else if (!reply) {
      reply = `${count} ${count === 1 ? 'person is' : 'people are'} on the shortlist.`;
    }
  } else if (!reply) {
    reply = 'Ask me to keep a role, remove a title, filter a city, or explain why someone matches.';
  }

  reply = await composeNaturalReply(adapter, {
    job,
    message,
    history,
    constraints,
    results: results || previewRows,
    planReply: reply,
    changed: Boolean(needRank || useFilters),
  });

  return {
    reply: String(reply).slice(0, 900),
    reset: Boolean(plan.reset),
    constraints,
    steps,
    results,
    scanned: ranked?.scanned ?? null,
    job: ranked?.job || {
      id: String(job._id),
      title: job.title || job.role || '',
      jobCode: job.jobCode || '',
      location: job.location || '',
      industry: job.industry || '',
      skills: Array.isArray(job.skills) ? job.skills.slice(0, 8) : [],
    },
    ai: ranked?.ai || { available: Boolean(adapter), explained: false, message: '', mode: adapter ? 'smart' : 'fit' },
    agent: ranked?.agent || { available: Boolean(adapter), mode: adapter ? 'smart' : 'fit' },
    source,
  };
}

module.exports = {
  rankForJob,
  replyToTalentChat,
  mergeDirectories,
  locationFilter,
  keywordFilter,
  RESULT_KEEP,
};
