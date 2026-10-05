const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Application = require('../models/Application');
const MisContact = require('../models/MisContact');
const Interview = require('../models/Interview');
const TalentPool = require('../models/TalentPool');
const mongoose = require('mongoose');
const {
  isFreelancer,
  jobListFilter,
  applicationListFilter,
  canViewOrgAnalytics,
  misListFilter,
  candidateListScope,
} = require('../utils/dataScope');
const { planHasFeature } = require('../config/planFeatures');
const {
  escapeRegex,
  tokenize,
  scoreOverlap,
  jobFitText,
  candidateFitText,
} = require('../utils/globalSearchMatch');
const {
  parsePeopleFilters,
  peopleFilterParts,
  needsRowRangeFilter,
  rowMatchesRange,
} = require('../utils/peopleSearchFilters');
const logger = require('../utils/logger');

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;
const JOB_SELECT = 'title role department location locations status isPublished jobCode skills clientName industry summary preferredProfile requirements experience description';
const PEOPLE_LIST_SELECT = '_id name email contact phone position location state companyName experience ctc expectedCtc noticePeriod skills product client source status candidateCode spoc pan fls remark createdAt updatedAt appliedAt recordDate marketingConsent unsubscribedAt createdBy';
const CAND_SELECT = PEOPLE_LIST_SELECT;

function rx(q) {
  return { $regex: escapeRegex(q), $options: 'i' };
}

function codeRx(q) {
  return { $regex: `^\\s*${escapeRegex(q)}\\s*$`, $options: 'i' };
}

function denyAll() {
  return { _id: { $in: [] } };
}

/**
 * Same visibility as the Candidates list.
 * Owner / admin / HR manager: company-wide.
 * Recruiter / sales / other employees: own SPOC desk + shared with them.
 * Freelancer: own desk only.
 * Never honor client view=all / userId on this endpoint.
 */
async function resolveCandidateScope(req) {
  const user = req.user || {};
  if (!user.organizationId) return denyAll();
  const viewMode = canViewOrgAnalytics(user) ? 'all' : 'mine';
  return candidateListScope({ user, query: {} }, viewMode);
}

function applyLocation(scope, location, { jobs } = {}) {
  const loc = String(location || '').trim();
  if (!loc) return scope;
  if (jobs) {
    return { $and: [scope, { $or: [{ location: rx(loc) }, { locations: rx(loc) }] }] };
  }
  return { $and: [scope, { location: rx(loc) }] };
}

function emptyTotals() {
  return {
    candidates: 0,
    jobs: 0,
    applications: 0,
    mis: 0,
    interviews: 0,
    jobFit: 0,
    related: 0,
    talentPools: 0,
    people: 0,
  };
}

const MIS_SELECT = PEOPLE_LIST_SELECT;
const ID_LIST_SELECT = '_id name email contact phone position location companyName marketingConsent unsubscribedAt';
const RANGE_SCAN_CAP = 2500;
const COUNT_SCAN_CAP = 20000;

function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

function prefixRx(q) {
  return { $regex: `^${escapeRegex(q)}`, $options: 'i' };
}

function keywordOr(q, searchScope = 'all') {
  const needle = rx(q);
  const prefix = prefixRx(q);
  const scope = String(searchScope || 'all').trim().toLowerCase();
  if (scope === 'name') return { name: needle };
  if (scope === 'email') return { email: needle };
  if (scope === 'position') return { position: needle };
  if (scope === 'skills') return { skills: needle };
  if (scope === 'product') return { product: needle };
  if (scope === 'spoc') return { spoc: needle };
  if (scope === 'company') return { companyName: needle };
  if (scope === 'client') return { client: needle };
  if (scope === 'location') return { $or: [{ location: needle }, { state: needle }] };
  if (scope === 'candidateid' || scope === 'candidatecode' || scope === 'id') {
    return { $or: [{ candidateCode: codeRx(q) }, { candidateCode: needle }, { srNo: needle }] };
  }
  if (scope === 'applicationid' || scope === 'applicationcode') {
    return null;
  }
  return {
    $or: [
      { name: prefix },
      { email: prefix },
      { candidateCode: prefix },
      { position: prefix },
      { companyName: prefix },
      { contact: prefix },
      { name: needle },
      { email: needle },
      { skills: needle },
      { product: needle },
      { location: needle },
      { state: needle },
    ],
  };
}

function activityRange(filters = {}) {
  const period = String(filters.period || '').trim();
  if (!period || period === 'all') return null;
  const { buildDateFilter } = require('../utils/analyticsTime');
  return buildDateFilter(period, filters.from, filters.to);
}

function candidateMongoFilter(scope, q, filters = {}, extraIds = null, searchScope = 'all') {
  const { withActivityDateRange } = require('../utils/candidateActivityDate');
  let filter = { $and: [scope || denyAll()] };
  if (String(q || '').trim().length >= 2) {
    const clause = keywordOr(q, searchScope);
    if (clause) filter.$and.push(clause);
  }
  filter.$and.push(...peopleFilterParts(filters, { mis: false }));
  if (extraIds) filter.$and.push({ _id: { $in: extraIds } });
  const range = activityRange(filters);
  if (range) filter = withActivityDateRange(filter, range);
  return filter;
}

function misMongoFilter(user, q, filters = {}) {
  if (!user?.organizationId) return denyAll();
  const and = [misListFilter(user.organizationId, user)];
  if (String(q || '').trim().length >= 2) {
    const needle = rx(q);
    const prefix = prefixRx(q);
    and.push({
      $or: [
        { name: prefix },
        { email: prefix },
        { position: prefix },
        { companyName: prefix },
        { contact: prefix },
        { name: needle },
        { email: needle },
        { skills: needle },
        { product: needle },
        { location: needle },
      ],
    });
  }
  and.push(...peopleFilterParts(filters, { mis: true }));
  const range = activityRange(filters);
  if (range) and.push({ createdAt: range });
  return { $and: and };
}

function jobMongoFilter(req, q, location) {
  const needle = rx(q);
  return {
    $and: [
      applyLocation(jobListFilter(req), location, { jobs: true }),
      { isTemplate: { $ne: true } },
      {
        $or: [
          { title: needle },
          { role: needle },
          { department: needle },
          { location: needle },
          { locations: needle },
          { clientName: needle },
          { industry: needle },
          { skills: needle },
          { jobCode: codeRx(q) },
          { jobCode: needle },
          { summary: needle },
          { preferredProfile: needle },
        ],
      },
    ],
  };
}

function pageOpts(page = 1, limit = PAGE_SIZE) {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || PAGE_SIZE));
  const p = Math.max(1, Number(page) || 1);
  return { page: p, pageSize, skip: (p - 1) * pageSize };
}

function peopleSort(dateSort, kind) {
  const oldest = dateSort === 'oldest';
  if (kind === 'mis') {
    return oldest ? { recordDate: 1, createdAt: 1 } : { recordDate: -1, createdAt: -1 };
  }
  return oldest ? { appliedAt: 1, updatedAt: 1 } : { appliedAt: -1, updatedAt: -1 };
}

async function attachCreators(rows = []) {
  const ids = [...new Set((rows || []).map((row) => {
    const raw = row?.createdBy;
    if (!raw) return '';
    if (typeof raw === 'object' && raw.name) return '';
    return String(raw._id || raw);
  }).filter((id) => id.length === 24))];
  if (!ids.length) return rows;
  const User = require('../models/User');
  const users = await User.find({ _id: { $in: ids } }).select('name email').lean();
  const map = new Map(users.map((u) => [String(u._id), { _id: u._id, name: u.name, email: u.email }]));
  for (const row of rows) {
    const raw = row.createdBy;
    const key = raw && typeof raw === 'object' ? String(raw._id || '') : String(raw || '');
    const hit = map.get(key);
    if (hit) row.createdBy = hit;
  }
  return rows;
}

async function timedFind(Model, filter, { select, sort, skip, limit, maxTimeMS = 8000 }) {
  const q = Model.find(filter);
  if (select) q.select(select);
  if (sort) q.sort(sort);
  if (skip) q.skip(skip);
  if (limit != null) q.limit(limit);
  return q.maxTimeMS(maxTimeMS).lean();
}

async function findAllSlim(Model, filter, { select, sort } = {}) {
  const q = Model.find(filter);
  if (select) q.select(select);
  if (sort) q.sort(sort);
  const cursor = q.maxTimeMS(120000).lean().cursor({ batchSize: 1000 });
  const rows = [];
  for await (const doc of cursor) rows.push(doc);
  return rows;
}

async function safeCount(Model, filter, maxTimeMS = 45000) {
  try {
    return await Model.countDocuments(filter).maxTimeMS(maxTimeMS);
  } catch (err) {
    logger.warn({ err: err?.message }, 'global search count failed');
    return null;
  }
}

async function matchPageAndCount(Model, filter, { select, sort, skip = 0, pageSize = PAGE_SIZE, rowMatch, stopEarly = false, maxTimeMS = 20000 } = {}) {
  const q = Model.find(filter);
  if (select) q.select(select);
  if (sort) q.sort(sort);
  const cursor = q.maxTimeMS(maxTimeMS).lean().cursor({ batchSize: 400 });
  const rows = [];
  let total = 0;
  let exact = true;
  try {
    for await (const doc of cursor) {
      if (rowMatch && !rowMatch(doc)) continue;
      if (total >= skip && rows.length < pageSize) rows.push(doc);
      total += 1;
      if (stopEarly && total >= skip + pageSize) {
        exact = false;
        break;
      }
    }
  } catch (err) {
    exact = false;
    logger.warn({ err: err?.message }, 'global search range count stopped');
  }
  return { rows, total, exact, hasMore: exact ? total > skip + rows.length : true };
}

async function findIdSlice(Model, filter, { select, skip = 0, limit = 3000, rowMatch, idAfter = '' } = {}) {
  // Prefer _id cursor over skip — large skip offsets get very slow on Mongo.
  const after = String(idAfter || '').trim();
  let scoped = filter;
  if (after && mongoose.Types.ObjectId.isValid(after)) {
    const afterId = new mongoose.Types.ObjectId(after);
    scoped = filter && Object.keys(filter).length
      ? { $and: [filter, { _id: { $gt: afterId } }] }
      : { _id: { $gt: afterId } };
  }
  const useSkip = after ? 0 : Math.max(0, Number(skip) || 0);
  const findOpts = {
    select,
    // Cursor pages need _id order; first page can use natural order (faster / same as list).
    sort: after ? { _id: 1 } : undefined,
    skip: useSkip,
    limit: limit + 1,
    // Bulk select-all / email hydrate needs fuller pages; 12s often returned ~100 rows
    // on range filters and looked like a fixed recipient cap in the UI.
    maxTimeMS: rowMatch ? 60000 : 20000,
  };
  try {
    if (!rowMatch) {
      const docs = await timedFind(Model, scoped, findOpts);
      const hasMore = docs.length > limit;
      return { rows: hasMore ? docs.slice(0, limit) : docs, hasMore };
    }
    const sliced = await matchPageAndCount(Model, scoped, {
      select,
      sort: after ? { _id: 1 } : undefined,
      skip: useSkip,
      pageSize: limit,
      rowMatch,
      stopEarly: false,
      maxTimeMS: 60000,
    });
    return { rows: sliced.rows, hasMore: sliced.hasMore || !sliced.exact };
  } catch (err) {
    logger.warn({ err: err?.message, after, skip: useSkip }, 'global search id slice failed');
    // Soft-fail: return empty chunk so the client can keep page selection instead of hanging.
    return { rows: [], hasMore: false };
  }
}

async function peopleMatchCounts(candFilter, misFilter, rowMatch) {
  if (rowMatch) {
    const [cand, mis] = await Promise.all([
      matchPageAndCount(Candidate, candFilter, {
        select: 'ctc experience location state position companyName skills product client spoc',
        rowMatch,
        maxTimeMS: 60000,
      }),
      matchPageAndCount(MisContact, misFilter, {
        select: 'ctc experience location state position companyName skills product client spoc',
        rowMatch,
        maxTimeMS: 60000,
      }),
    ]);
    const candidatesExact = cand.exact;
    const misExact = mis.exact;
    return {
      candidates: cand.total,
      mis: mis.total,
      people: cand.total + mis.total,
      countsExact: candidatesExact && misExact,
      exact: { candidates: candidatesExact, mis: misExact, people: candidatesExact && misExact },
      capped: !candidatesExact || !misExact,
    };
  }
  const [candidates, mis] = await Promise.all([
    safeCount(Candidate, candFilter),
    safeCount(MisContact, misFilter),
  ]);
  const candidatesExact = candidates != null;
  const misExact = mis != null;
  const candN = candidatesExact ? candidates : 0;
  const misN = misExact ? mis : 0;
  return {
    candidates: candN,
    mis: misN,
    people: candN + misN,
    countsExact: candidatesExact && misExact,
    exact: { candidates: candidatesExact, mis: misExact, people: candidatesExact && misExact },
    capped: !candidatesExact || !misExact,
  };
}

function slicePage(rows, page, limit) {
  const { page: p, pageSize, skip } = pageOpts(page, limit);
  return { rows: (rows || []).slice(skip, skip + pageSize), total: (rows || []).length, page: p, pageSize };
}

async function findAndCount(Model, filter, { select, sort, page = 1, limit = PAGE_SIZE, populate, rowMatch } = {}) {
  const { page: p, pageSize, skip } = pageOpts(page, limit);
  if (typeof rowMatch === 'function') {
    const q = Model.find(filter);
    if (select) q.select(select);
    if (sort) q.sort(sort);
    if (populate) {
      (Array.isArray(populate) ? populate : [populate]).forEach((pop) => q.populate(pop));
    }
    const scanned = await q.limit(RANGE_SCAN_CAP).lean();
    const matched = scanned.filter(rowMatch);
    return {
      rows: matched.slice(skip, skip + pageSize),
      total: matched.length,
      page: p,
      pageSize,
      capped: scanned.length >= RANGE_SCAN_CAP,
    };
  }
  const q = Model.find(filter);
  if (select) q.select(select);
  if (sort) q.sort(sort);
  if (populate) {
    (Array.isArray(populate) ? populate : [populate]).forEach((pop) => q.populate(pop));
  }
  const [rows, total] = await Promise.all([
    q.skip(skip).limit(pageSize).lean(),
    Model.countDocuments(filter),
  ]);
  return { rows, total, page: p, pageSize };
}

function mergeUniquePeople(candidates = [], mis = []) {
  const byEmail = new Map();
  const noEmail = [];
  const take = (row, kind) => {
    const key = emailKey(row.email);
    const base = {
      ...row,
      _kinds: [kind],
      candidateId: kind === 'candidates' ? row._id : null,
      misId: kind === 'mis' ? row._id : null,
    };
    if (!key) {
      noEmail.push(base);
      return;
    }
    const prev = byEmail.get(key);
    if (!prev) {
      byEmail.set(key, base);
      return;
    }
    const kinds = [...new Set([...(prev._kinds || []), kind])];
    if (kind === 'candidates') {
      byEmail.set(key, {
        ...prev,
        ...base,
        misId: prev.misId,
        candidateId: row._id,
        _kinds: kinds,
      });
      return;
    }
    prev.misId = row._id;
    prev._kinds = kinds;
  };
  for (const row of candidates) take(row, 'candidates');
  for (const row of mis) take(row, 'mis');
  return [...byEmail.values(), ...noEmail];
}

function rowDateMs(row = {}) {
  const raw = row.recordDate || row.appliedAt || row.date || row.createdAt || row.updatedAt;
  const t = new Date(raw || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sortPeopleByDate(rows = [], dir = 'latest') {
  const sign = dir === 'oldest' ? 1 : -1;
  return [...rows].sort((a, b) => (rowDateMs(a) - rowDateMs(b)) * sign);
}

async function lookupJobsForFit(req, q) {
  const needle = rx(q);
  return Job.find({
    $and: [
      jobListFilter(req),
      { isTemplate: { $ne: true } },
      {
        $or: [
          { jobCode: codeRx(q) },
          { jobCode: needle },
          { title: needle },
          { role: needle },
        ],
      },
    ],
  })
    .select(JOB_SELECT)
    .limit(8)
    .lean();
}

async function searchApplications(user, q, { candidateIds = [], jobIds = [], page, limit } = {}) {
  const orgId = user.organizationId;
  const appScope = await applicationListFilter(orgId, user);
  const or = [
    { applicationCode: codeRx(q) },
    { applicationCode: rx(q) },
    { stage: rx(q) },
  ];
  if (candidateIds.length) or.push({ candidateId: { $in: candidateIds } });
  if (jobIds.length) or.push({ jobId: { $in: jobIds } });

  return findAndCount(Application, { $and: [appScope, { $or: or }] }, {
    sort: { updatedAt: -1 },
    page,
    limit,
    populate: [
      { path: 'candidateId', select: 'name email' },
      { path: 'jobId', select: 'title jobCode' },
    ],
  });
}

async function searchInterviews(user, q, { jobIds = [], page, limit } = {}) {
  const orgId = user.organizationId;
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  const base = { organizationId: orgId };
  if (isFreelancer(user) || !canViewOrgAnalytics(user)) {
    base.createdBy = user._id || user.id;
  }

  const populate = [
    { path: 'candidateId', select: 'name email' },
    { path: 'jobId', select: 'title jobCode' },
  ];

  if (jobIds.length) {
    const byJob = await findAndCount(Interview, { ...base, jobId: { $in: jobIds } }, {
      sort: { scheduledAt: -1 },
      page,
      limit,
      populate,
    });
    if (byJob.total > 0) return byJob;
  }

  const scanned = await Interview.find(base)
    .populate('candidateId', 'name email')
    .populate('jobId', 'title jobCode')
    .sort({ scheduledAt: -1 })
    .limit(400)
    .lean();
  const needle = String(q || '').toLowerCase();
  const matched = scanned.filter((row) => {
    const hay = `${row.candidateId?.name || ''} ${row.jobId?.title || ''} ${row.jobId?.jobCode || ''} ${row.status || ''} ${row.type || ''}`.toLowerCase();
    return hay.includes(needle);
  });
  return slicePage(matched, page, limit);
}

async function searchTalentPools(user, q, { page, limit } = {}) {
  const orgId = user.organizationId;
  if (!orgId) return { rows: [], total: 0 };
  const needle = rx(q);
  const filter = {
    organizationId: orgId,
    $or: [{ name: needle }, { description: needle }, { industry: needle }, { product: needle }],
  };
  return findAndCount(TalentPool, filter, { select: 'name description industry product color', sort: { updatedAt: -1 }, page, limit });
}

async function searchJobFit(user, q, jobs, { location } = {}) {
  const qNorm = String(q || '').trim().toUpperCase();
  let job = null;
  if (jobs?.length) {
    const exactCode = jobs.find((j) => String(j.jobCode || '').toUpperCase() === qNorm);
    const exactTitle = jobs.find((j) => {
      const title = String(j.title || '').toUpperCase();
      const role = String(j.role || '').toUpperCase();
      return title === qNorm || role === qNorm
        || (qNorm.length >= 3 && (title.includes(qNorm) || role.includes(qNorm)));
    });
    job = exactCode || exactTitle || jobs[0];
  }
  const sourceText = job ? `${jobFitText(job)} ${q}` : q;
  const skillTokens = Array.isArray(job?.skills) ? job.skills.map((s) => String(s || '').trim()).filter((s) => s.length > 1) : [];
  const tokens = [...new Set([...tokenize(sourceText), ...skillTokens.map((s) => s.toLowerCase())])].slice(0, 12);
  if (!tokens.length) return { job, candidates: [] };

  const or = tokens.flatMap((token) => ([
    { skills: rx(token) },
    { position: rx(token) },
    { product: rx(token) },
    { client: rx(token) },
    { companyName: rx(token) },
    { location: rx(token) },
  ]));
  const pool = await Candidate.find({
    $and: [applyLocation(scope || denyAll(), location), { $or: or }],
  })
    .select(CAND_SELECT)
    .limit(500)
    .lean();

  const jobText = job ? jobFitText(job) : sourceText;
  const ranked = pool
    .map((c) => ({
      ...c,
      fitScore: scoreOverlap(jobText, candidateFitText(c)),
      fitJobCode: job?.jobCode || '',
      fitJobTitle: job?.title || job?.role || '',
      source: 'fit',
    }))
    .filter((c) => c.fitScore > 0)
    .sort((a, b) => b.fitScore - a.fitScore);

  return { job, candidates: ranked };
}

async function searchRelatedAi(organizationId, q, orgPlan, job) {
  if (!planHasFeature(orgPlan, 'ai.semanticSearch')) {
    return { results: [], enabled: false };
  }
  const query = job ? `${job.title || job.role || ''} ${jobFitText(job)}`.slice(0, 1500) : q;
  try {
    const { semanticSearch } = require('./aiFeatureService');
    const data = await semanticSearch(organizationId, { query, limit: 40 });
    return {
      enabled: true,
      results: (data.results || []).map((r) => ({
        _id: r.candidateId,
        name: r.name,
        email: r.email,
        position: r.position,
        skills: r.skills,
        similarity: r.similarity,
        source: 'ai',
      })),
    };
  } catch {
    return { enabled: true, results: [] };
  }
}

async function workspaceCounts(req) {
  const totals = emptyTotals();
  const user = req.user || {};
  if (!user.organizationId) {
    return {
      candidates: [],
      jobs: [],
      applications: [],
      mis: [],
      interviews: [],
      jobFit: [],
      related: [],
      talentPools: [],
      relatedJob: null,
      aiEnabled: false,
      totals,
      workspace: true,
      q: '',
      scope: 'desk',
    };
  }
  const candScope = await resolveCandidateScope(req);
  const [candidates, mis, jobs] = await Promise.all([
    Candidate.countDocuments(candScope).maxTimeMS(20000).catch(() => null),
    MisContact.countDocuments(misListFilter(user.organizationId, user)).maxTimeMS(20000).catch(() => null),
    Job.countDocuments({ $and: [jobListFilter(req), { isTemplate: { $ne: true } }] }).maxTimeMS(20000).catch(() => null),
  ]);
  totals.candidates = Number(candidates) || 0;
  totals.mis = Number(mis) || 0;
  totals.jobs = Number(jobs) || 0;
  totals.people = Math.max(0, totals.candidates + totals.mis);
  return {
    candidates: [],
    jobs: [],
    applications: [],
    mis: [],
    interviews: [],
    jobFit: [],
    related: [],
    talentPools: [],
    relatedJob: null,
    aiEnabled: false,
    totals,
    workspace: true,
    q: '',
    scope: canViewOrgAnalytics(user) ? 'organization' : 'desk',
  };
}

async function resolvePeopleMatch(req, rawFilters = {}) {
  const query = String(rawFilters.q || '').trim();
  const location = String(rawFilters.location || '').trim();
  const searchScope = String(rawFilters.searchScope || 'all').trim().toLowerCase() || 'all';
  const filters = parsePeopleFilters({ ...rawFilters, location: rawFilters.location || location }, location);
  let peopleQuery = query;
  if (searchScope === 'location' && query) {
    if (!filters.location || !filters.location.length) filters.location = [query];
    peopleQuery = '';
  }
  const user = req.user || {};
  if (!user.organizationId) {
    return { user, query, filters, searchScope, peopleQuery, candFilter: null, misFilter: null, rowMatch: null };
  }

  const candScope = await resolveCandidateScope(req);
  let extraIds = null;
  const appCode = String(filters.applicationCode || '').trim()
    || ((searchScope === 'applicationid' || searchScope === 'applicationcode') ? query : '');
  if (appCode) {
    const appScope = await applicationListFilter(user.organizationId, user);
    extraIds = await Application.find({
      $and: [appScope, { $or: [{ applicationCode: codeRx(appCode) }, { applicationCode: rx(appCode) }] }],
    }).distinct('candidateId');
  }

  const candFilter = candidateMongoFilter(candScope, peopleQuery, filters, extraIds, searchScope);
  const misFilter = misMongoFilter(user, peopleQuery, filters);
  const rowMatch = needsRowRangeFilter(filters)
    ? (doc) => rowMatchesRange(doc, filters)
    : null;
  return { user, query, filters, searchScope, peopleQuery, candFilter, misFilter, rowMatch };
}

const AUDIENCE_SELECT = '_id name email position location state companyName experience ctc skills product client spoc marketingConsent unsubscribedAt';
const AUDIENCE_CAP = 25000;

async function scanAudience(Model, filter, rowMatch) {
  const cursor = Model.find(filter || denyAll())
    .select(AUDIENCE_SELECT)
    .maxTimeMS(120000)
    .lean()
    .cursor({ batchSize: 500 });
  const rows = [];
  for await (const doc of cursor) {
    if (rowMatch && !rowMatch(doc)) continue;
    rows.push(doc);
    if (rows.length >= AUDIENCE_CAP) break;
  }
  return rows;
}

/**
 * Everyone matching the current search, resolved on the server.
 * Select-all stays a query in the browser; send-time uses this list.
 */
async function collectSearchAudience(req, rawFilters = {}) {
  const match = await resolvePeopleMatch(req, rawFilters);
  if (!match.user?.organizationId || !match.candFilter) {
    return { recipients: [], scanned: 0, capped: false };
  }
  const entity = String(rawFilters.entity || 'all').trim().toLowerCase();
  const requireConsent = rawFilters.requireConsent === true || String(rawFilters.requireConsent || '') === '1';
  const wantCand = entity === 'all' || entity === 'candidates';
  const wantMis = entity === 'all' || entity === 'mis';
  const [candRows, misRows] = await Promise.all([
    wantCand ? scanAudience(Candidate, match.candFilter, match.rowMatch) : Promise.resolve([]),
    wantMis ? scanAudience(MisContact, match.misFilter, match.rowMatch) : Promise.resolve([]),
  ]);

  const byEmail = new Map();
  const take = (row, kind) => {
    const email = String(row?.email || '').trim();
    const key = email.toLowerCase();
    if (!key.includes('@')) return;
    if (row.unsubscribedAt) return;
    if (requireConsent && row.marketingConsent === false) return;
    const prev = byEmail.get(key);
    if (!prev) {
      byEmail.set(key, {
        email,
        name: row.name || '',
        position: row.position || '',
        _id: String(row._id),
        _kinds: [kind],
        candidateId: kind === 'candidates' ? String(row._id) : '',
        misId: kind === 'mis' ? String(row._id) : '',
      });
      return;
    }
    if (!prev._kinds.includes(kind)) prev._kinds.push(kind);
    if (kind === 'candidates') prev.candidateId = String(row._id);
    if (kind === 'mis') prev.misId = String(row._id);
    if (!prev.name && row.name) prev.name = row.name;
  };
  candRows.forEach((row) => take(row, 'candidates'));
  misRows.forEach((row) => take(row, 'mis'));

  return {
    recipients: [...byEmail.values()],
    scanned: candRows.length + misRows.length,
    capped: candRows.length >= AUDIENCE_CAP || misRows.length >= AUDIENCE_CAP,
  };
}

async function runGlobalSearch(req, { q, location = '', filters: rawFilters = {}, page = 1, limit = PAGE_SIZE, statsOnly = false } = {}) {
  if (statsOnly || String(rawFilters.stats || '') === '1') {
    return workspaceCounts(req);
  }
  const dateSort = String(rawFilters.sortDate || rawFilters.sort || 'latest').trim().toLowerCase() === 'oldest'
    ? 'oldest'
    : 'latest';
  const match = await resolvePeopleMatch(req, { ...rawFilters, q: q || rawFilters.q, location: location || rawFilters.location });
  const { query, user, candFilter, misFilter, rowMatch } = match;
  const totals = emptyTotals();
  if (!user.organizationId) {
    return workspaceCounts(req);
  }

  const idsOnly = String(rawFilters.idsOnly || '') === '1';
  const idEntity = String(rawFilters.entity || 'candidates').trim().toLowerCase();

  if (String(rawFilters.countOnly || '') === '1') {
    const counted = await peopleMatchCounts(candFilter, misFilter, rowMatch);
    Object.assign(totals, {
      candidates: counted.candidates,
      mis: counted.mis,
      people: counted.people,
    });
    return {
      candidates: [],
      jobs: [],
      applications: [],
      mis: [],
      people: [],
      interviews: [],
      jobFit: [],
      related: [],
      talentPools: [],
      relatedJob: null,
      aiEnabled: false,
      totals,
      countsExact: counted.countsExact,
      exact: counted.exact,
      floors: null,
      capped: counted.capped,
      q: query,
    };
  }

  if (idsOnly) {
    const idLimit = Math.min(3000, Math.max(1, parseInt(rawFilters.idLimit, 10) || 3000));
    const idSkip = Math.max(0, parseInt(rawFilters.idSkip, 10) || 0);
    const idAfter = String(rawFilters.idAfter || '').trim();
    if (idEntity === 'all') {
      // Separate collections — do not share one idAfter cursor across both.
      const [candSlice, misSlice] = await Promise.all([
        findIdSlice(Candidate, candFilter, { select: ID_LIST_SELECT, skip: idSkip, limit: idLimit, rowMatch }),
        findIdSlice(MisContact, misFilter, { select: ID_LIST_SELECT, skip: idSkip, limit: idLimit, rowMatch }),
      ]);
      const people = mergeUniquePeople(candSlice.rows, misSlice.rows);
      return {
        ids: people.map((row) => String(row._id)),
        people,
        contacts: misSlice.rows,
        candidates: candSlice.rows,
        total: people.length,
        hasMore: Boolean(candSlice.hasMore || misSlice.hasMore),
        capped: false,
        q: query,
      };
    }
    const isMis = idEntity === 'mis';
    const Model = isMis ? MisContact : Candidate;
    const filter = isMis ? misFilter : candFilter;
    const slice = await findIdSlice(Model, filter, {
      select: ID_LIST_SELECT,
      skip: idAfter ? 0 : idSkip,
      limit: idLimit,
      rowMatch,
      idAfter,
    });
    const ids = slice.rows.map((row) => String(row._id));
    return {
      ids,
      people: slice.rows,
      contacts: isMis ? slice.rows : [],
      candidates: isMis ? [] : slice.rows,
      total: ids.length,
      hasMore: slice.hasMore,
      nextAfter: ids.length ? ids[ids.length - 1] : '',
      capped: false,
      q: query,
    };
  }

  const pageSize = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
  const { page: p, skip } = pageOpts(page, pageSize);
  const candSort = peopleSort(dateSort, 'cand');
  const misSort = peopleSort(dateSort, 'mis');

  let candScan;
  let misScan;
  let countsExact = false;
  const exact = { candidates: false, mis: false, people: false };
  const hasMore = { candidates: false, mis: false };
  if (rowMatch) {
    const [candPage, misPage, counted] = await Promise.all([
      matchPageAndCount(Candidate, candFilter, {
        select: PEOPLE_LIST_SELECT, sort: candSort, skip, pageSize, rowMatch, stopEarly: true,
      }),
      matchPageAndCount(MisContact, misFilter, {
        select: PEOPLE_LIST_SELECT, sort: misSort, skip, pageSize, rowMatch, stopEarly: true,
      }),
      peopleMatchCounts(candFilter, misFilter, rowMatch),
    ]);
    candScan = candPage.rows;
    misScan = misPage.rows;
    hasMore.candidates = candPage.hasMore;
    hasMore.mis = misPage.hasMore;
    exact.candidates = Boolean(counted.exact?.candidates);
    exact.mis = Boolean(counted.exact?.mis);
    totals.candidates = counted.candidates;
    totals.mis = counted.mis;
  } else {
    const [candRows, misRows, candCount, misCount] = await Promise.all([
      timedFind(Candidate, candFilter, { select: PEOPLE_LIST_SELECT, sort: candSort, skip, limit: pageSize + 1, maxTimeMS: 12000 }),
      timedFind(MisContact, misFilter, { select: PEOPLE_LIST_SELECT, sort: misSort, skip, limit: pageSize + 1, maxTimeMS: 12000 }),
      safeCount(Candidate, candFilter, 45000),
      safeCount(MisContact, misFilter, 45000),
    ]);
    hasMore.candidates = candRows.length > pageSize;
    hasMore.mis = misRows.length > pageSize;
    candScan = hasMore.candidates ? candRows.slice(0, pageSize) : candRows;
    misScan = hasMore.mis ? misRows.slice(0, pageSize) : misRows;
    exact.candidates = candCount != null && !(candCount === 0 && candScan.length > 0);
    exact.mis = misCount != null && !(misCount === 0 && misScan.length > 0);
    totals.candidates = exact.candidates ? candCount : 0;
    totals.mis = exact.mis ? misCount : 0;
  }

  if (exact.candidates) totals.candidates = Number(totals.candidates) || 0;
  else totals.candidates = 0;
  if (exact.mis) totals.mis = Number(totals.mis) || 0;
  else totals.mis = 0;
  if (!hasMore.candidates && candScan.length) {
    exact.candidates = true;
    totals.candidates = skip + candScan.length;
  }
  if (!hasMore.mis && misScan.length) {
    exact.mis = true;
    totals.mis = skip + misScan.length;
  }
  exact.people = exact.candidates && exact.mis;
  countsExact = exact.people;
  totals.people = exact.people
    ? (Number(totals.candidates) || 0) + (Number(totals.mis) || 0)
    : 0;

  await attachCreators(misScan);
  const mergedAll = sortPeopleByDate(mergeUniquePeople(candScan, misScan), dateSort);

  return {
    candidates: candScan,
    jobs: [],
    applications: [],
    mis: misScan,
    people: mergedAll,
    interviews: [],
    jobFit: [],
    related: [],
    talentPools: [],
    relatedJob: null,
    aiEnabled: false,
    totals,
    // Never send page-size floors — clients must wait for exact totals (or show "…").
    floors: null,
    countsExact,
    exact,
    hasMore,
    page: p,
    pageSize,
    q: query,
  };
}

module.exports = {
  runGlobalSearch,
  searchJobFit,
  collectSearchAudience,
};
