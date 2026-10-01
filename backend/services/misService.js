/**
 * MIS / Marketing contacts — Excel import, list, consent, marketing send.
 * Never writes to Candidate / Application collections.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const MisContact = require('../models/MisContact');
const {
  misListFilter,
  misWriteFilter,
  isMisCompanyRole,
  userIdParts,
  organizationIdMatch,
} = require('../utils/dataScope');
const { normalizeText } = require('../utils/textNormalize');
const { publicSiteBase } = require('./emailBrandLayout');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function assertMisCompany(user) {
  if (!user || !isMisCompanyRole(user) || user.role === 'freelancer') {
    throw httpError('MIS is available to company employees only', 403, { code: 'MIS_COMPANY_ONLY' });
  }
}

function assertMisOwner(user) {
  if (!user || user.role !== 'owner') {
    throw httpError('This MIS action is available to the company owner only', 403, { code: 'MIS_OWNER_ONLY' });
  }
}

/** Owner uploads stay org-shared; employee adds stay personal (visible to self + owner). */
function deskScopeForUser(user) {
  return user?.role === 'owner' ? 'org' : 'personal';
}

const misExportJobs = new Map();
const MIS_EXPORT_TTL_MS = 60 * 60 * 1000;

function scheduleExportCleanup(jobId) {
  setTimeout(() => {
    const job = misExportJobs.get(jobId);
    if (!job) return;
    if (job.filePath) {
      try { fs.unlinkSync(job.filePath); } catch { /* ignore */ }
    }
    misExportJobs.delete(jobId);
  }, MIS_EXPORT_TTL_MS).unref?.();
}

function backendPublicBase() {
  const fromEnv = String(process.env.BACKEND_URL || process.env.API_URL || '')
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${String(process.env.RAILWAY_PUBLIC_DOMAIN).replace(/^https?:\/\//, '')}`;
  }
  // Absolute Railway URL so browser downloads skip the Vercel proxy body limit.
  return 'https://peopleconnecthrats-production.up.railway.app';
}

function signExportDownloadToken(job) {
  const exp = Date.now() + 15 * 60 * 1000;
  const payload = `${job.jobId}:${job.userId}:${job.organizationId}:${exp}`;
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 40);
  return Buffer.from(JSON.stringify({
    jobId: job.jobId,
    userId: job.userId,
    organizationId: job.organizationId,
    exp,
    sig,
  })).toString('base64url');
}

function verifyExportDownloadToken(token) {
  try {
    const raw = JSON.parse(Buffer.from(String(token || ''), 'base64url').toString('utf8'));
    if (!raw?.jobId || !raw?.sig || !raw?.exp) return null;
    if (Date.now() > Number(raw.exp)) return null;
    const payload = `${raw.jobId}:${raw.userId}:${raw.organizationId}:${raw.exp}`;
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payload)
      .digest('hex')
      .slice(0, 40);
    if (expected !== raw.sig) return null;
    return raw;
  } catch {
    return null;
  }
}

function trimStr(v) {
  return String(v ?? '').trim();
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function phoneDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

const TEXT_FIELDS = [
  'name', 'position', 'location', 'state', 'companyName', 'experience',
  'ctc', 'expectedCtc', 'noticePeriod', 'skills', 'product', 'client', 'fls', 'source', 'remark',
  'status',
];

function normalizeMisStatus(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  return s || '';
}

function userCreatedByIds(user) {
  const { userIdStr, userIdObj } = userIdParts(user);
  if (!userIdStr) return [];
  return userIdObj ? [userIdObj, userIdStr] : [userIdStr];
}

/**
 * Narrow list to My contacts / Company directory / All (within misListFilter visibility).
 * desk=mine → rows the user created; desk=company → org-shared (deskScope !== personal).
 * desk=all is owner/admin only — other employees are coerced to mine.
 */
function canUseMisAllDesk(user) {
  return user?.role === 'owner' || user?.role === 'admin';
}

function resolveMisDeskView(user, desk) {
  const view = String(desk || '').toLowerCase().trim();
  if (view === 'mine' || view === 'company') return view;
  if (view === 'all' && canUseMisAllDesk(user)) return 'all';
  // Missing / invalid: owner defaults to all; employees (incl. admin) to mine
  if (!view && user?.role === 'owner') return 'all';
  return 'mine';
}

function applyMisDeskView(filter, user, desk) {
  const view = resolveMisDeskView(user, desk);
  const next = { ...(filter || {}) };
  if (Array.isArray(filter?.$and)) next.$and = [...filter.$and];
  if (view === 'all') return next;
  const andParts = Array.isArray(next.$and) ? [...next.$and] : [];
  if (view === 'mine') {
    const me = userCreatedByIds(user);
    if (!me.length) {
      next._id = { $in: [] };
      return next;
    }
    andParts.push({ createdBy: { $in: me } });
  } else if (view === 'company') {
    andParts.push({ deskScope: { $ne: 'personal' } });
  }
  if (andParts.length) next.$and = andParts;
  return next;
}

function unsubscribeUrlFor(contact) {
  const secret = contact.ensureUnsubscribeSecret();
  const token = MisContact.unsubscribeTokenFor(contact._id, secret);
  const base = (publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const apiBase = (process.env.BACKEND_URL || process.env.API_URL || '').replace(/\/$/, '');
  // Prefer API unsubscribe endpoint (works without frontend route)
  const root = apiBase || base;
  if (!root) return '';
  return `${root}/api/mis/unsubscribe?id=${contact._id}&token=${token}`;
}

const IDS_ONLY_CAP = 1_000_000; // 10 lakh — select-all / bulk ops
const EXPORT_CAP = 1_000_000; // 10 lakh — Excel export

/** Prefer tracker Date; fall back to import timestamp for older rows. */
function misDisplayDate(row) {
  if (row?.recordDate) return new Date(row.recordDate);
  if (row?.createdAt) return new Date(row.createdAt);
  return null;
}

function misListSort() {
  // recordDate first (tracker), then createdAt (import time) for legacy rows
  return { recordDate: -1, createdAt: -1 };
}

function buildMisQueryFilter(user, query = {}) {
  const organizationId = user.organizationId;
  const filter = misListFilter(organizationId, user);
  const escapeRx = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const andParts = [];

  const q = trimStr(query.q);
  if (q) {
    const rx = { $regex: escapeRx(q), $options: 'i' };
    andParts.push({
      $or: [
        { name: rx }, { email: rx }, { phone: rx }, { contact: rx },
        { position: rx }, { companyName: rx }, { location: rx }, { client: rx },
        { skills: rx }, { product: rx }, { source: rx }, { remark: rx },
      ],
    });
  }
  if (query.consent === 'yes') filter.marketingConsent = true;
  if (query.consent === 'no') filter.marketingConsent = false;
  if (query.unsubscribed === '1') filter.unsubscribedAt = { $ne: null };
  if (query.unsubscribed === '0') filter.unsubscribedAt = null;

  const statusFilter = normalizeMisStatus(query.status);
  if (statusFilter && statusFilter !== 'ALL') {
    filter.status = statusFilter;
  }

  if (trimStr(query.location)) {
    const rx = { $regex: escapeRx(trimStr(query.location)), $options: 'i' };
    andParts.push({ $or: [{ location: rx }, { state: rx }] });
  }
  if (trimStr(query.source)) {
    filter.source = { $regex: escapeRx(trimStr(query.source)), $options: 'i' };
  }
  if (trimStr(query.position)) {
    filter.position = { $regex: escapeRx(trimStr(query.position)), $options: 'i' };
  }
  if (trimStr(query.companyName) || trimStr(query.company)) {
    filter.companyName = {
      $regex: escapeRx(trimStr(query.companyName || query.company)),
      $options: 'i',
    };
  }
  if (trimStr(query.client)) {
    filter.client = { $regex: escapeRx(trimStr(query.client)), $options: 'i' };
  }
  if (trimStr(query.product)) {
    filter.product = { $regex: escapeRx(trimStr(query.product)), $options: 'i' };
  }
  if (trimStr(query.skills)) {
    filter.skills = { $regex: escapeRx(trimStr(query.skills)), $options: 'i' };
  }

  // CTC / expected CTC band text (same idea as Candidates when band labels are selected)
  const ctcMinStr = trimStr(query.ctcMin);
  const ctcMaxStr = trimStr(query.ctcMax);
  const expectedCtcMinStr = trimStr(query.expectedCtcMin);
  const expectedCtcMaxStr = trimStr(query.expectedCtcMax);
  const ctcMinNum = parseFloat(ctcMinStr);
  const ctcMaxNum = parseFloat(ctcMaxStr);
  const expectedCtcMinNum = parseFloat(expectedCtcMinStr);
  const expectedCtcMaxNum = parseFloat(expectedCtcMaxStr);
  if (ctcMinStr && Number.isNaN(ctcMinNum)) {
    filter.ctc = { $regex: escapeRx(ctcMinStr), $options: 'i' };
  } else if (ctcMaxStr && Number.isNaN(ctcMaxNum)) {
    filter.ctc = { $regex: escapeRx(ctcMaxStr), $options: 'i' };
  }
  if (expectedCtcMinStr && Number.isNaN(expectedCtcMinNum)) {
    filter.expectedCtc = { $regex: escapeRx(expectedCtcMinStr), $options: 'i' };
  } else if (expectedCtcMaxStr && Number.isNaN(expectedCtcMaxNum)) {
    filter.expectedCtc = { $regex: escapeRx(expectedCtcMaxStr), $options: 'i' };
  }

  // Experience exact-ish match when a single year is chosen (band UI)
  const expMin = trimStr(query.expMin);
  const expMax = trimStr(query.expMax);
  if (expMin && expMin === expMax) {
    filter.experience = { $regex: escapeRx(expMin), $options: 'i' };
  } else if (expMin && !expMax) {
    filter.experience = { $regex: escapeRx(expMin), $options: 'i' };
  } else if (expMax && !expMin) {
    filter.experience = { $regex: escapeRx(expMax), $options: 'i' };
  }

  // Date period:
  // - My desk → createdAt (when this employee added the contact) so cards match the table
  // - Company / All → tracker recordDate with createdAt fallback
  try {
    const { buildDateFilter } = require('../utils/analyticsTime');
    const period = trimStr(query.dateRange || query.period || query.datePeriod);
    const dateFilter = buildDateFilter(period || 'all', query.from || query.dateFrom, query.to || query.dateTo);
    if (dateFilter) {
      const desk = resolveMisDeskView(user, query.desk || query.deskScope || query.view);
      if (desk === 'mine') {
        andParts.push({ createdAt: dateFilter });
      } else {
        andParts.push({
          $or: [
            { recordDate: dateFilter },
            {
              $and: [
                { $or: [{ recordDate: null }, { recordDate: { $exists: false } }] },
                { createdAt: dateFilter },
              ],
            },
          ],
        });
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'MIS date filter skipped');
  }

  if (andParts.length) {
    filter.$and = [...(Array.isArray(filter.$and) ? filter.$and : []), ...andParts];
  }
  return applyMisDeskView(filter, user, query.desk || query.deskScope || query.view);
}

/** Prefer indexed counts over a single $or count when the list has no extra filters. */
async function countMisDesk(user, organizationId, desk = 'all') {
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };
  // Stats use raw desk keys (all/company/mine). Access control for list tab "all"
  // is handled in resolveMisDeskView / applyMisDeskView — not here.
  const view = String(desk || 'all').toLowerCase().trim() || 'all';
  const me = userCreatedByIds(user);
  const countMs = (q) => MisContact.countDocuments(q).maxTimeMS(20000).catch(() => null);

  if (user.role === 'owner') {
    if (view === 'mine') {
      if (!me.length) return 0;
      return countMs({ ...orgMatch, createdBy: { $in: me } });
    }
    if (view === 'company') {
      return countMs({ ...orgMatch, deskScope: { $ne: 'personal' } });
    }
    return countMs(orgMatch);
  }

  // Employees: never include other people's personal desks.
  if (view === 'mine') {
    if (!me.length) return 0;
    return countMs({ ...orgMatch, createdBy: { $in: me } });
  }
  if (view === 'company') {
    return countMs({ ...orgMatch, deskScope: { $ne: 'personal' } });
  }
  // all = company shared + own personal (disjoint — no double-count)
  const [company, personalMine] = await Promise.all([
    countMs({ ...orgMatch, deskScope: { $ne: 'personal' } }),
    me.length
      ? countMs({ ...orgMatch, deskScope: 'personal', createdBy: { $in: me } })
      : Promise.resolve(0),
  ]);
  if (company == null && personalMine == null) return null;
  return (Number(company) || 0) + (Number(personalMine) || 0);
}

function misQueryHasExtraFilters(query = {}) {
  if (trimStr(query.q)) return true;
  if (query.consent === 'yes' || query.consent === 'no') return true;
  if (query.unsubscribed === '1' || query.unsubscribed === '0') return true;
  if (trimStr(query.status) && String(query.status).toUpperCase() !== 'ALL') return true;
  const keys = [
    'location', 'source', 'position', 'companyName', 'company', 'client', 'product', 'skills',
    'ctcMin', 'ctcMax', 'expectedCtcMin', 'expectedCtcMax', 'expMin', 'expMax',
    'dateRange', 'period', 'datePeriod', 'from', 'dateFrom', 'to', 'dateTo',
  ];
  return keys.some((k) => trimStr(query[k]));
}

async function listContacts(user, query = {}) {
  assertMisCompany(user);
  const organizationId = user.organizationId;
  if (!organizationId) throw httpError('Organization required', 403);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const idsOnly = query.idsOnly === '1' || query.idsOnly === 'true' || query.idsOnly === true;
  const filter = buildMisQueryFilter(user, query);
  const desk = resolveMisDeskView(user, query.desk || query.deskScope || query.view);
  const resolveTotal = async () => {
    if (!misQueryHasExtraFilters(query)) {
      const fast = await countMisDesk(user, organizationId, desk);
      if (fast != null) return fast;
    }
    return MisContact.countDocuments(filter).maxTimeMS(20000).catch(() => null);
  };

  if (idsOnly) {
    const idLimit = Math.min(3000, Math.max(1, parseInt(query.idLimit, 10) || 3000));
    const idSkip = Math.max(0, parseInt(query.idSkip, 10) || 0);
    const total = await resolveTotal();
    const idDocs = await MisContact.find(filter)
      .sort(misListSort())
      .select('_id phone contact email name position location state companyName client product skills experience ctc status marketingConsent unsubscribedAt')
      .skip(idSkip)
      .limit(idLimit + 1)
      .maxTimeMS(20000)
      .lean();
    const hasMore = idDocs.length > idLimit;
    const pageDocs = hasMore ? idDocs.slice(0, idLimit) : idDocs;
    const ids = pageDocs.map((d) => String(d._id));
    return {
      ids,
      contacts: pageDocs.map((d) => ({
        _id: String(d._id),
        phone: d.phone || '',
        contact: d.contact || d.phone || '',
        email: d.email || '',
        name: d.name || '',
        position: d.position || '',
        location: d.location || '',
        state: d.state || '',
        companyName: d.companyName || '',
        client: d.client || '',
        product: d.product || '',
        skills: d.skills || '',
        experience: d.experience || '',
        ctc: d.ctc || '',
        status: d.status || 'NEW',
        marketingConsent: d.marketingConsent !== false,
        unsubscribedAt: d.unsubscribedAt || null,
      })),
      total: total == null ? idSkip + ids.length + (hasMore ? 1 : 0) : total,
      capped: false,
      hasMore,
      pagination: {
        page: 1,
        limit: ids.length,
        total: total == null ? idSkip + ids.length + (hasMore ? 1 : 0) : total,
        pages: 1,
        hasMore,
      },
      scope: user.role === 'owner' ? 'owner' : 'employee',
      desk: resolveMisDeskView(user, query.desk || query.view),
    };
  }

  const [rows, total] = await Promise.all([
    MisContact.find(filter)
      .sort(misListSort())
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean(),
    resolveTotal(),
  ]);
  const rowCount = (rows || []).length;
  const floor = (page - 1) * limit + rowCount + (rowCount === limit ? 1 : 0);
  const counted = Number(total);
  const resolvedTotal = Number.isFinite(counted)
    ? (counted === 0 && rowCount > 0 ? floor : counted)
    : floor;

  return {
    rows,
    pagination: {
      page,
      limit,
      total: resolvedTotal,
      pages: Math.max(1, Math.ceil(resolvedTotal / limit)),
      hasMore: page * limit < resolvedTotal,
    },
    scope: user.role === 'owner' ? 'owner' : 'employee',
    desk: resolveMisDeskView(user, query.desk || query.view),
  };
}

/**
 * Secure report/stats identity — never take organizationId / userId from the query string.
 */
function assertMisActor(user) {
  assertMisCompany(user);
  if (!user.organizationId) throw httpError('Organization required', 403);
  if (user.role !== 'owner' && !userCreatedByIds(user).length) {
    throw httpError('User identity required for MIS access', 403, { code: 'MIS_USER_REQUIRED' });
  }
}

/**
 * Report data scope by role (must match list security):
 * - owner → full organisation (all desks)
 * - admin → same as MIS list (shared directory + own personal; never others’ personal)
 * - other employees → only contacts they added
 */
function resolveMisReportScope(user) {
  const organizationId = user.organizationId;
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };
  const me = userCreatedByIds(user);
  const role = user.role;

  if (role === 'owner') {
    return {
      scope: 'organisation',
      dateMode: 'tracker',
      base: orgMatch,
      me,
    };
  }

  if (role === 'admin') {
    return {
      scope: 'visible',
      dateMode: 'tracker',
      base: misListFilter(organizationId, user),
      me,
    };
  }

  // recruiter / sales / hr_* — personal performance only
  return {
    scope: 'self',
    dateMode: 'createdAt',
    base: me.length
      ? { ...orgMatch, createdBy: { $in: me } }
      : { _id: { $in: [] } },
    me,
  };
}

function applyMisPeriodFilter(base, dateFilter, dateMode) {
  if (!dateFilter) return base;
  const next = { ...base };
  const andParts = Array.isArray(base.$and) ? [...base.$and] : [];
  if (dateMode === 'createdAt') {
    andParts.push({ createdAt: dateFilter });
  } else {
    andParts.push({
      $or: [
        { recordDate: dateFilter },
        {
          $and: [
            { $or: [{ recordDate: null }, { recordDate: { $exists: false } }] },
            { createdAt: dateFilter },
          ],
        },
      ],
    });
  }
  if (andParts.length) next.$and = andParts;
  return next;
}

function andMisFilter(base, clause) {
  if (!clause || typeof clause !== 'object') return base;
  const next = { ...base };
  const andParts = Array.isArray(base.$and) ? [...base.$and] : [];
  andParts.push(clause);
  next.$and = andParts;
  return next;
}

/**
 * Scoped MIS dashboard KPIs — identical desk math as the list tabs (countMisDesk).
 * Cards: total / company / mine / newThisMonth.
 */
async function getMisStats(user) {
  assertMisActor(user);
  const organizationId = user.organizationId;
  const me = userCreatedByIds(user);
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };

  let monthRange = null;
  try {
    const { buildDateFilter } = require('../utils/analyticsTime');
    monthRange = buildDateFilter('month');
  } catch (err) {
    logger.warn({ err: err.message }, 'MIS month filter skipped');
  }

  const countMs = (q) => MisContact.countDocuments(q).maxTimeMS(20000).catch(() => 0);
  const newThisMonthQ = (monthRange && me.length)
    ? { ...orgMatch, createdBy: { $in: me }, createdAt: monthRange }
    : { _id: { $in: [] } };

  const [total, company, mine, newThisMonth] = await Promise.all([
    countMisDesk(user, organizationId, 'all').then((n) => (n == null ? 0 : n)),
    countMisDesk(user, organizationId, 'company').then((n) => (n == null ? 0 : n)),
    countMisDesk(user, organizationId, 'mine').then((n) => (n == null ? 0 : n)),
    countMs(newThisMonthQ),
  ]);

  // Consistency check: for non-owners, total must equal company + own personal
  // (already how countMisDesk('all') works). Surface scope for the UI.
  return {
    total: Number(total) || 0,
    mine: Number(mine) || 0,
    company: Number(company) || 0,
    newThisMonth: Number(newThisMonth) || 0,
    scope: user.role === 'owner' ? 'owner' : 'employee',
    createdBySelf: me.length > 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * MIS reports for a period — totals, desks, status mix, duplicacy.
 * Scoped securely by role via resolveMisReportScope (never query-string identity).
 */
async function getMisReports(user, query = {}) {
  assertMisActor(user);

  // Ignore any attempt to spoof another org / user via query
  const safeQuery = { ...(query || {}) };
  delete safeQuery.organizationId;
  delete safeQuery.orgId;
  delete safeQuery.userId;
  delete safeQuery.employeeId;
  delete safeQuery.createdBy;

  const { scope, dateMode, base, me } = resolveMisReportScope(user);

  const period = trimStr(safeQuery.dateRange || safeQuery.period || safeQuery.datePeriod) || 'month';
  const from = safeQuery.from || safeQuery.dateFrom || safeQuery.customFrom;
  const to = safeQuery.to || safeQuery.dateTo || safeQuery.customTo;

  let dateFilter = null;
  let periodLabel = period;
  try {
    const { buildDateFilter, getDateRangeLabel } = require('../utils/analyticsTime');
    dateFilter = buildDateFilter(period === 'all' ? 'all' : period, from, to);
    periodLabel = typeof getDateRangeLabel === 'function'
      ? getDateRangeLabel(period, from, to)
      : (period === 'custom' && from && to ? `${from} → ${to}` : period);
  } catch (err) {
    logger.warn({ err: err.message }, 'MIS reports date filter skipped');
  }

  const periodMatch = applyMisPeriodFilter(base, dateFilter, dateMode);
  const companyPeriod = andMisFilter(periodMatch, { deskScope: { $ne: 'personal' } });
  const personalPeriod = andMisFilter(periodMatch, { deskScope: 'personal' });

  const countMs = (q, ms = 20000) => MisContact.countDocuments(q).maxTimeMS(ms).catch(() => 0);
  const dateExpr = dateMode === 'createdAt'
    ? '$createdAt'
    : { $ifNull: ['$recordDate', '$createdAt'] };

  const [totalInPeriod, companyInPeriod, personalInPeriod, statusAgg, sourceAgg, trendAgg, phoneDupes, emailOverlap, phoneOverlap, allTimeTotal] = await Promise.all([
    countMs(periodMatch),
    countMs(companyPeriod),
    countMs(personalPeriod),
    MisContact.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ['$status', null] }, { $eq: ['$status', ''] }] },
              'NEW',
              { $toUpper: '$status' },
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]).option({ maxTimeMS: 20000 }).catch(() => []),
    MisContact.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: {
            $let: {
              vars: { s: { $trim: { input: { $ifNull: ['$source', ''] } } } },
              in: {
                $cond: [
                  { $or: [{ $eq: ['$$s', null] }, { $eq: ['$$s', ''] }] },
                  'Unspecified',
                  '$$s',
                ],
              },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]).option({ maxTimeMS: 20000 }).catch(() => []),
    MisContact.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: dateExpr,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 120 },
    ]).option({ maxTimeMS: 20000 }).catch(() => []),
    MisContact.aggregate([
      { $match: base },
      {
        $project: {
          phoneKey: {
            $let: {
              vars: {
                raw: { $ifNull: ['$phone', { $ifNull: ['$contact', ''] }] },
              },
              in: {
                $replaceAll: {
                  input: { $replaceAll: { input: '$$raw', find: ' ', replacement: '' } },
                  find: '-',
                  replacement: '',
                },
              },
            },
          },
        },
      },
      { $match: { phoneKey: { $nin: [null, ''] } } },
      { $group: { _id: '$phoneKey', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      {
        $group: {
          _id: null,
          duplicateGroups: { $sum: 1 },
          duplicateRows: { $sum: '$count' },
        },
      },
    ]).option({ maxTimeMS: 20000 }).catch(() => []),
    (async () => {
      try {
        const Candidate = require('../models/Candidate');
        const emails = await MisContact.distinct('email', { ...base, email: { $nin: [null, ''] } });
        if (!emails.length) return 0;
        const orgMatch = organizationIdMatch(user.organizationId) || { organizationId: user.organizationId };
        return Candidate.countDocuments({
          ...orgMatch,
          email: { $in: emails },
        }).maxTimeMS(15000).catch(() => 0);
      } catch {
        return 0;
      }
    })(),
    (async () => {
      try {
        const Candidate = require('../models/Candidate');
        const orgMatch = organizationIdMatch(user.organizationId) || { organizationId: user.organizationId };
        const phones = await MisContact.aggregate([
          { $match: base },
          {
            $project: {
              phoneKey: {
                $trim: {
                  input: { $ifNull: ['$phone', { $ifNull: ['$contact', ''] }] },
                },
              },
            },
          },
          { $match: { phoneKey: { $nin: [null, ''] } } },
          { $group: { _id: '$phoneKey' } },
          { $limit: 20000 },
        ]).option({ maxTimeMS: 15000 });
        const keys = (phones || []).map((p) => p._id).filter(Boolean);
        if (!keys.length) return 0;
        return Candidate.countDocuments({
          ...orgMatch,
          $or: [
            { phone: { $in: keys } },
            { contact: { $in: keys } },
          ],
        }).maxTimeMS(15000).catch(() => 0);
      } catch {
        return 0;
      }
    })(),
    countMs(base, 20000),
  ]);

  const phoneDup = phoneDupes?.[0] || {};
  const companyN = Number(companyInPeriod) || 0;
  const personalN = Number(personalInPeriod) || 0;
  const inPeriod = Number(totalInPeriod) || 0;

  return {
    period,
    periodLabel,
    scope,
    generatedAt: new Date().toISOString(),
    totals: {
      allTime: Number(allTimeTotal) || 0,
      inPeriod,
      companyInPeriod: companyN,
      personalInPeriod: personalN,
    },
    byStatus: (statusAgg || []).map((row) => ({
      status: String(row._id || 'NEW'),
      count: Number(row.count) || 0,
    })),
    bySource: (sourceAgg || []).map((row) => ({
      source: String(row._id || 'Unspecified'),
      count: Number(row.count) || 0,
    })),
    trend: (trendAgg || [])
      .filter((row) => row && row._id)
      .map((row) => ({
        date: String(row._id),
        count: Number(row.count) || 0,
      })),
    deskMix: [
      { label: scope === 'organisation' ? 'Organisation' : 'Shared desk', key: 'company', count: companyN },
      { label: 'Personal records', key: 'personal', count: personalN },
    ].filter((row) => row.count > 0),
    duplicacy: {
      phoneDuplicateGroups: Number(phoneDup.duplicateGroups) || 0,
      phoneDuplicateRows: Number(phoneDup.duplicateRows) || 0,
      emailOverlapWithCandidates: Number(emailOverlap) || 0,
      phoneOverlapWithCandidates: Number(phoneOverlap) || 0,
    },
    // Help UI explain scope without leaking other desks
    meta: {
      role: user.role,
      selfOnly: scope === 'self',
      includesOthersPersonal: scope === 'organisation',
      actorId: me.length ? String(me[0]) : null,
    },
  };
}

const BULK_UPDATE_FIELDS = [
  'source', 'client', 'position', 'companyName', 'location', 'product', 'fls', 'remark',
  'state', 'experience', 'ctc', 'expectedCtc', 'noticePeriod', 'skills', 'status',
];

async function bulkUpdate(user, ids = [], updates = {}) {
  assertMisCompany(user);
  const idList = (ids || []).map(String).filter(Boolean);
  if (!idList.length) throw httpError('No contacts selected');
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw httpError('updates object is required');
  }

  const $set = {};
  for (const key of BULK_UPDATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;
    if (updates[key] == null) continue;
    if (key === 'status') {
      const status = normalizeMisStatus(updates[key]);
      if (!status) continue;
      $set.status = status;
      continue;
    }
    const val = normalizeText(trimStr(updates[key]));
    if (!val) continue;
    $set[key] = val;
  }

  let consentUpdate = null;
  if (typeof updates.marketingConsent === 'boolean') {
    consentUpdate = updates.marketingConsent;
    $set.marketingConsent = consentUpdate;
    if (consentUpdate) $set.unsubscribedAt = null;
  }

  if (!Object.keys($set).length) {
    throw httpError('No valid fields to update. Choose at least one field.');
  }

  const filter = misWriteFilter(user.organizationId, user, { _id: { $in: idList } });
  const result = await MisContact.updateMany(filter, { $set });
  return {
    matched: result.matchedCount ?? result.n ?? 0,
    modified: result.modifiedCount ?? result.nModified ?? 0,
    marketingConsent: consentUpdate,
  };
}

async function getContact(user, id) {
  assertMisCompany(user);
  const filter = misListFilter(user.organizationId, user, { _id: id });
  const row = await MisContact.findOne(filter).populate('createdBy', 'name email');
  if (!row) throw httpError('Contact not found', 404);
  return row;
}

async function createContact(user, body = {}) {
  assertMisCompany(user);
  const organizationId = user.organizationId;
  const email = normalizeEmail(body.email);
  const name = trimStr(body.name);
  if (!name) throw httpError('Name is required');
  if (name.length < 2) throw httpError('Name must be at least 2 characters');
  if (!/^[a-zA-Z\s.''-]+$/.test(name)) {
    throw httpError('Name can only contain letters, spaces, and hyphens');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw httpError('Valid email is required');
  }
  const phone = phoneDigits(body.phone || body.contact);
  if (!phone || phone.length < 7 || phone.length > 15) {
    throw httpError('Valid phone number is required (7–15 digits)');
  }
  const ctc = trimStr(body.ctc);
  if (!ctc) throw httpError('Current CTC is required');

  const existing = await MisContact.findOne({ organizationId, email });
  if (existing) throw httpError('This email already exists in MIS', 409, { code: 'DUPLICATE_EMAIL' });

  const phoneClash = await MisContact.findOne({
    organizationId,
    $or: [{ phone }, { contact: phone }],
  }).select('_id email').lean();
  if (phoneClash) {
    throw httpError('This phone number already exists in MIS', 409, { code: 'DUPLICATE_PHONE' });
  }

  const LocationService = require('./locationService');
  const location = normalizeText(trimStr(body.location));
  let state = trimStr(body.state);
  if (location && !state) {
    state = LocationService.detectState(location) || '';
  }

  const doc = new MisContact({
    organizationId,
    createdBy: user.id || user._id,
    deskScope: deskScopeForUser(user),
    name: normalizeText(name),
    email,
    contact: phone,
    phone,
    ctc: normalizeText(ctc),
    location,
    state: normalizeText(state),
    status: normalizeMisStatus(body.status) || 'NEW',
    marketingConsent: body.marketingConsent !== false,
    source: trimStr(body.source) || 'MIS Manual',
  });
  for (const key of TEXT_FIELDS) {
    if (key === 'name' || key === 'source' || key === 'ctc' || key === 'location' || key === 'state' || key === 'status') continue;
    if (body[key] != null) doc[key] = normalizeText(trimStr(body[key]));
  }
  if (body.recordDate) {
    const { parseRecordDate } = require('../utils/candidateActivityDate');
    const parsed = parseRecordDate(body.recordDate);
    if (parsed) doc.recordDate = parsed;
  }
  doc.ensureUnsubscribeSecret();
  await doc.save();
  return doc;
}

async function updateContact(user, id, body = {}) {
  assertMisCompany(user);
  const filter = misWriteFilter(user.organizationId, user, { _id: id });
  const doc = await MisContact.findOne(filter);
  if (!doc) throw httpError('Contact not found', 404);

  if (body.name != null) doc.name = normalizeText(trimStr(body.name)) || doc.name;
  if (body.email != null) {
    const email = normalizeEmail(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpError('Valid email is required');
    if (email !== doc.email) {
      const clash = await MisContact.findOne({ organizationId: user.organizationId, email, _id: { $ne: doc._id } });
      if (clash) throw httpError('This email already exists in MIS', 409, { code: 'DUPLICATE_EMAIL' });
      doc.email = email;
    }
  }
  if (body.phone != null || body.contact != null) {
    const phone = phoneDigits(body.phone || body.contact);
    doc.phone = phone;
    doc.contact = phone;
  }
  for (const key of TEXT_FIELDS) {
    if (key === 'name') continue;
    if (body[key] != null) {
      if (key === 'status') {
        doc.status = normalizeMisStatus(body[key]) || doc.status || 'NEW';
      } else {
        doc[key] = normalizeText(trimStr(body[key]));
      }
    }
  }
  if (typeof body.marketingConsent === 'boolean') {
    doc.marketingConsent = body.marketingConsent;
    if (body.marketingConsent && doc.unsubscribedAt) {
      // Re-consent clears unsubscribe
      doc.unsubscribedAt = null;
    }
  }
  doc.ensureUnsubscribeSecret();
  await doc.save();
  return doc;
}

async function deleteContact(user, id) {
  assertMisCompany(user);
  const filter = misWriteFilter(user.organizationId, user, { _id: id });
  const doc = await MisContact.findOneAndDelete(filter);
  if (!doc) throw httpError('Contact not found', 404);
  return { deleted: true };
}

async function bulkDelete(user, ids = []) {
  assertMisCompany(user);
  const idList = (ids || []).map(String).filter(Boolean);
  if (!idList.length) throw httpError('No contacts selected');
  const filter = misWriteFilter(user.organizationId, user, { _id: { $in: idList } });
  const result = await MisContact.deleteMany(filter);
  return { deleted: result.deletedCount || 0 };
}

async function bulkUpload(user, file) {
  const { startBulkUploadJob } = require('./misBulkUploadJob');
  return startBulkUploadJob(user, file);
}

function getBulkUploadJob(user, jobId) {
  const { getBulkUploadJob: getJob } = require('./misBulkUploadJob');
  return getJob(user, jobId);
}

async function sendMarketingToMis(user, body = {}) {
  assertMisCompany(user);
  const ids = (body.ids || []).map(String).filter(Boolean);
  if (!ids.length) throw httpError('Select at least one contact');
  if (!trimStr(body.subject) || !trimStr(body.htmlBody)) {
    throw httpError('Subject and message body are required');
  }

  const filter = misListFilter(user.organizationId, user, {
    _id: { $in: ids },
    marketingConsent: true,
    unsubscribedAt: null,
  });
  const contacts = await MisContact.find(filter).select('email name unsubscribeSecret').lean();
  if (!contacts.length) {
    throw httpError('No eligible contacts (need consent and not unsubscribed)');
  }

  // Append unsubscribe footer note when possible
  const { sendMarketing } = require('./emailOutboundService');
  const recipients = contacts.map((c) => c.email);
  // Rebuild docs for URL helper when needed
  const withFooter = `${body.htmlBody}
<p style="margin-top:24px;font-size:12px;color:#64748b;">
  You are receiving this as part of a marketing list. To unsubscribe, reply or use the link in your campaign settings.
</p>`;

  const result = await sendMarketing(user, {
    recipients,
    subject: body.subject,
    htmlBody: withFooter,
    campaignName: body.campaignName || `mis_${Date.now()}`,
    trackOpens: body.trackOpens !== false,
    trackClicks: body.trackClicks !== false,
  });

  return {
    ...result,
    attempted: ids.length,
    eligible: contacts.length,
  };
}

/**
 * Move MIS contacts into Candidates (create Candidate, then remove from MIS).
 * Skips emails/phones already in Candidates and rows missing required phone.
 */
async function moveToCandidates(user, ids = [], options = {}) {
  assertMisOwner(user);
  const idList = (ids || []).map(String).filter(Boolean);
  if (!idList.length) throw httpError('Select at least one MIS contact');

  const removeFromMis = options.removeFromMis !== false;
  const Candidate = require('../models/Candidate');
  const LocationService = require('./locationService');
  const { findOrgPhoneConflict, findOrgEmailConflict } = require('./dedupeService');
  const { enforceSpocOnWrite } = require('../utils/spocIdentity');

  const filter = misListFilter(user.organizationId, user, { _id: { $in: idList } });
  const rows = await MisContact.find(filter).lean();
  if (!rows.length) throw httpError('No MIS contacts found', 404);

  let moved = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  const errors = [];
  const movedIds = [];

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const contact = phoneDigits(row.phone || row.contact);
    const name = trimStr(row.name);
    const ctc = trimStr(row.ctc) || 'TO BE UPDATED';

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      skippedInvalid += 1;
      if (errors.length < 40) errors.push({ id: row._id, email, message: 'Name and valid email required' });
      continue;
    }
    if (!contact || contact.length < 7 || contact.length > 15) {
      skippedInvalid += 1;
      if (errors.length < 40) errors.push({ id: row._id, email, message: 'Valid phone required to move' });
      continue;
    }

    try {
      if (user.organizationId) {
        const emailHit = await findOrgEmailConflict(user.organizationId, email);
        if (emailHit) {
          skippedDuplicate += 1;
          if (errors.length < 40) {
            errors.push({ id: row._id, email, message: `Already a candidate (${emailHit.name || 'existing'})` });
          }
          continue;
        }
        const phoneHit = await findOrgPhoneConflict(user.organizationId, contact);
        if (phoneHit) {
          skippedDuplicate += 1;
          if (errors.length < 40) {
            errors.push({
              id: row._id,
              email,
              message: `Phone already on candidate ${phoneHit.name || ''}`.trim(),
            });
          }
          continue;
        }
      }

      const payload = {
        name: normalizeText(name),
        email,
        contact,
        phone: contact,
        position: normalizeText(trimStr(row.position)),
        companyName: normalizeText(trimStr(row.companyName)),
        location: normalizeText(trimStr(row.location)),
        state: normalizeText(trimStr(row.state)),
        experience: normalizeText(trimStr(row.experience)),
        ctc: normalizeText(ctc),
        expectedCtc: normalizeText(trimStr(row.expectedCtc)),
        noticePeriod: normalizeText(trimStr(row.noticePeriod)),
        skills: normalizeText(trimStr(row.skills)),
        product: normalizeText(trimStr(row.product)),
        client: normalizeText(trimStr(row.client)),
        fls: normalizeText(trimStr(row.fls)),
        source: normalizeText(trimStr(row.source) || 'MIS'),
        remark: trimStr(row.remark),
        status: 'APPLIED',
        organizationId: user.organizationId,
        createdBy: user.id || user._id,
      };
      if (payload.location && !payload.state) {
        payload.state = LocationService.detectState(payload.location) || '';
      }

      const fakeReq = { user, body: payload };
      await enforceSpocOnWrite(fakeReq, { isCreate: true });
      Object.assign(payload, fakeReq.body);

      const doc = new Candidate(payload);
      await doc.save();
      moved += 1;
      movedIds.push(String(row._id));
    } catch (err) {
      skippedInvalid += 1;
      if (errors.length < 40) {
        errors.push({ id: row._id, email, message: err.message || 'Move failed' });
      }
    }
  }

  let deleted = 0;
  if (removeFromMis && movedIds.length) {
    const del = await MisContact.deleteMany(
      misListFilter(user.organizationId, user, { _id: { $in: movedIds } })
    );
    deleted = del.deletedCount || 0;
  }

  return {
    moved,
    deleted,
    skippedDuplicate,
    skippedInvalid,
    total: rows.length,
    errors: errors.slice(0, 30),
    message: `Moved ${moved} to Candidates · ${skippedDuplicate} already there · ${skippedInvalid} skipped`,
  };
}

function exportJobSnapshot(job) {
  const snap = {
    jobId: job.jobId,
    status: job.status,
    filename: job.filename || null,
    count: job.count || 0,
    total: job.total || 0,
    capped: Boolean(job.capped),
    error: job.error || null,
    async: true,
  };
  if (job.status === 'done' && job.filePath && fs.existsSync(job.filePath)) {
    const token = signExportDownloadToken(job);
    const base = backendPublicBase();
    snap.downloadToken = token;
    snap.downloadUrl = `${base}/api/mis/export/download?token=${encodeURIComponent(token)}`;
  }
  return snap;
}

async function runMisExportJob(jobId) {
  const job = misExportJobs.get(jobId);
  if (!job) return;
  const ExcelJS = require('exceljs');
  try {
    job.status = 'processing';
    const total = await MisContact.countDocuments(job.filter);
    job.total = total;

    const outDir = path.join(process.cwd(), 'uploads', 'mis-exports');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
    const filename = `MIS_${stamp}_${jobId.slice(-8)}.xlsx`;
    const filePath = path.join(outDir, filename);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: filePath,
      useStyles: true,
      useSharedStrings: false,
    });
    workbook.creator = 'PeopleConnect MIS';
    const sheet = workbook.addWorksheet('MIS Contacts');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Position', key: 'position', width: 20 },
      { header: 'Company', key: 'companyName', width: 22 },
      { header: 'Location', key: 'location', width: 16 },
      { header: 'Experience', key: 'experience', width: 12 },
      { header: 'CTC', key: 'ctc', width: 12 },
      { header: 'Expected CTC', key: 'expectedCtc', width: 14 },
      { header: 'Notice Period', key: 'noticePeriod', width: 14 },
      { header: 'FLS', key: 'fls', width: 10 },
      { header: 'Client', key: 'client', width: 16 },
      { header: 'Product / Skill', key: 'product', width: 16 },
      { header: 'Skills', key: 'skills', width: 20 },
      { header: 'Source', key: 'source', width: 14 },
      { header: 'Remark', key: 'remark', width: 20 },
      { header: 'Marketing Consent', key: 'consent', width: 16 },
      { header: 'Unsubscribed At', key: 'unsubscribedAt', width: 18 },
      { header: 'Uploaded By', key: 'uploadedBy', width: 18 },
      { header: 'Date', key: 'recordDate', width: 14 },
      { header: 'Imported At', key: 'createdAt', width: 14 },
    ];
    try {
      sheet.getRow(1).font = { bold: true };
    } catch { /* stream writer may ignore style */ }

    const cursor = MisContact.find(job.filter)
      .sort(misListSort())
      .limit(EXPORT_CAP)
      .populate('createdBy', 'name email')
      .cursor();

    let count = 0;
    for await (const row of cursor) {
      const display = misDisplayDate(row);
      sheet.addRow({
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || row.contact || '',
        position: row.position || '',
        companyName: row.companyName || '',
        location: row.location || '',
        experience: row.experience || '',
        ctc: row.ctc || '',
        expectedCtc: row.expectedCtc || '',
        noticePeriod: row.noticePeriod || '',
        fls: row.fls || '',
        client: row.client || '',
        product: row.product || '',
        skills: row.skills || '',
        source: row.source || '',
        remark: row.remark || '',
        consent: row.marketingConsent ? 'Yes' : 'No',
        unsubscribedAt: row.unsubscribedAt
          ? new Date(row.unsubscribedAt).toISOString().slice(0, 10)
          : '',
        uploadedBy: row.createdBy?.name || row.createdBy?.email || '',
        recordDate: display ? display.toISOString().slice(0, 10) : '',
        createdAt: row.createdAt
          ? new Date(row.createdAt).toISOString().slice(0, 10)
          : '',
      }).commit();
      count += 1;
    }

    await workbook.commit();
    job.filePath = filePath;
    job.filename = filename;
    job.count = count;
    job.capped = total > count;
    job.status = 'done';
  } catch (err) {
    job.status = 'error';
    job.error = err.message || 'Export failed';
    logger.error({ err: err.message, jobId }, 'MIS export job failed');
    if (job.filePath) {
      try { fs.unlinkSync(job.filePath); } catch { /* ignore */ }
      job.filePath = null;
    }
  }
}

/**
 * Owner-only async Excel export.
 * Returns a jobId immediately so Vercel/proxy does not time out on large workbooks.
 */
async function startExportContacts(user, body = {}) {
  assertMisOwner(user);
  if (!user.organizationId) throw httpError('Organization required', 403);

  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  let filter;
  if (ids.length) {
    filter = misListFilter(user.organizationId, user, { _id: { $in: ids } });
  } else {
    filter = buildMisQueryFilter(user, body.filters || body.query || {});
  }

  const jobId = `exp_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const job = {
    jobId,
    organizationId: String(user.organizationId),
    userId: String(user.id || user._id),
    filter,
    status: 'queued',
    filePath: null,
    filename: null,
    count: 0,
    total: 0,
    capped: false,
    error: null,
    startedAt: Date.now(),
  };
  misExportJobs.set(jobId, job);
  scheduleExportCleanup(jobId);

  setImmediate(() => {
    runMisExportJob(jobId).catch((err) => {
      const j = misExportJobs.get(jobId);
      if (j) {
        j.status = 'error';
        j.error = err.message || 'Export failed';
      }
    });
  });

  return exportJobSnapshot(job);
}

function getExportJob(user, jobId) {
  assertMisOwner(user);
  const job = misExportJobs.get(String(jobId || ''));
  if (!job) throw httpError('Export job not found or expired', 404, { code: 'JOB_NOT_FOUND' });
  if (String(job.organizationId) !== String(user.organizationId)
    || String(job.userId) !== String(user.id || user._id)) {
    throw httpError('Export job not found or expired', 404, { code: 'JOB_NOT_FOUND' });
  }
  return exportJobSnapshot(job);
}

function resolveExportDownload(token) {
  const raw = verifyExportDownloadToken(token);
  if (!raw) throw httpError('Invalid or expired download link', 403);
  const job = misExportJobs.get(String(raw.jobId));
  if (!job || job.status !== 'done' || !job.filePath) {
    throw httpError('Export file not ready or expired', 404);
  }
  if (String(job.userId) !== String(raw.userId)
    || String(job.organizationId) !== String(raw.organizationId)) {
    throw httpError('Invalid or expired download link', 403);
  }
  if (!fs.existsSync(job.filePath)) {
    throw httpError('Export file missing', 404);
  }
  return {
    filePath: job.filePath,
    filename: job.filename || 'MIS_export.xlsx',
    count: job.count || 0,
    capped: Boolean(job.capped),
  };
}

async function unsubscribePublic({ id, token }) {
  if (!id || !token) throw httpError('Invalid unsubscribe link', 400);
  const contact = await MisContact.findById(id);
  if (!contact) throw httpError('Contact not found', 404);
  const expected = MisContact.unsubscribeTokenFor(contact._id, contact.unsubscribeSecret);
  const a = Buffer.from(String(token));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw httpError('Invalid unsubscribe link', 403);
  }
  contact.marketingConsent = false;
  contact.unsubscribedAt = new Date();
  await contact.save();
  return {
    message: 'You have been unsubscribed from marketing emails.',
    email: contact.email,
  };
}

module.exports = {
  listContacts,
  getMisStats,
  getMisReports,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  bulkDelete,
  bulkUpdate,
  bulkUpload,
  getBulkUploadJob,
  moveToCandidates,
  sendMarketingToMis,
  startExportContacts,
  getExportJob,
  resolveExportDownload,
  unsubscribePublic,
  unsubscribeUrlFor,
  deskScopeForUser,
  resolveMisDeskView,
  canUseMisAllDesk,
};
