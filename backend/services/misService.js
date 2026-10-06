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
const { clientSafeError } = require('../utils/clientSafeError');

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

/** Only owner uploads land on the shared organisation desk; admin + employees → personal. */
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
 * desk=all → full list visibility for that role (owner: org; others: shared + own personal).
 */
function canUseMisAllDesk(user) {
  if (!user?.role) return false;
  if (user.role === 'owner' || user.role === 'admin') return true;
  return ['hr_manager', 'hr_recruiter', 'recruiter', 'sales'].includes(user.role);
}

function resolveMisDeskView(user, desk) {
  const view = String(desk || '').toLowerCase().trim();
  // Owner has no personal desk — coerce "mine" to organisation overview
  if (view === 'mine' && user?.role === 'owner') {
    return 'all';
  }
  if (view === 'mine' || view === 'company') return view;
  // Owner: all employee personal desks (contacts added by the team)
  if (view === 'employees' && user?.role === 'owner') return 'employees';
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
    // Strict: only contacts THIS user created — never other employees' desks.
    // Applies equally to owner, admin, and every individual employee.
    const me = userCreatedByIds(user);
    if (!me.length) {
      next._id = { $in: [] };
      return next;
    }
    andParts.push({ createdBy: { $in: me } });
  } else if (view === 'company') {
    // Shared organisation directory only (excludes every personal desk)
    andParts.push({ deskScope: { $ne: 'personal' } });
  } else if (view === 'employees') {
    // Owner-only: every employee personal desk
    andParts.push({ deskScope: 'personal' });
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

  // Date period — when filtering "In Candidates", use move date; otherwise contact Date / createdAt
  const movedFlagEarly = String(query.moved || query.movedToCandidates || '').toLowerCase().trim();
  const filteringMoved = movedFlagEarly === '1' || movedFlagEarly === 'yes' || movedFlagEarly === 'moved';
  try {
    const { buildDateFilter } = require('../utils/analyticsTime');
    const period = trimStr(query.dateRange || query.period || query.datePeriod);
    const dateFilter = buildDateFilter(period || 'all', query.from || query.dateFrom, query.to || query.dateTo);
    if (dateFilter) {
      if (filteringMoved) {
        andParts.push({ movedToCandidateAt: dateFilter });
      } else {
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
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'MIS date filter skipped');
  }

  if (andParts.length) {
    filter.$and = [...(Array.isArray(filter.$and) ? filter.$and : []), ...andParts];
  }

  // "In Candidates" filter:
  // - owner → every moved contact in the organisation
  // - admin/employees → only contacts they moved (movedBy)
  // Skip desk tab narrowing so list totals match the KPI cards.
  const movedFlag = String(query.moved || query.movedToCandidates || '').toLowerCase().trim();
  if (movedFlag === '1' || movedFlag === 'yes' || movedFlag === 'moved') {
    const me = userCreatedByIds(user);
    const movedClauses = [{ movedToCandidateAt: { $exists: true, $ne: null } }];
    if (user.role !== 'owner') {
      movedClauses.push(me.length ? { movedBy: { $in: me } } : { _id: { $in: [] } });
    }
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      ...movedClauses,
    ];
    return filter;
  }
  if (movedFlag === '0' || movedFlag === 'no' || movedFlag === 'active') {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      { $or: [{ movedToCandidateAt: null }, { movedToCandidateAt: { $exists: false } }] },
    ];
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
    if (view === 'employees') {
      return countMs({ ...orgMatch, deskScope: 'personal' });
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
  const movedFlag = String(query.moved || query.movedToCandidates || '').toLowerCase().trim();
  if (movedFlag === '1' || movedFlag === 'yes' || movedFlag === 'moved' || movedFlag === '0' || movedFlag === 'no' || movedFlag === 'active') {
    return true;
  }
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
      .select('_id phone contact email name position location state companyName client product skills experience ctc expectedCtc noticePeriod fls source status marketingConsent unsubscribedAt recordDate createdAt movedToCandidateAt movedToCandidateId')
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
        expectedCtc: d.expectedCtc || '',
        noticePeriod: d.noticePeriod || '',
        fls: d.fls || '',
        source: d.source || '',
        status: d.status || 'NEW',
        marketingConsent: d.marketingConsent !== false,
        unsubscribedAt: d.unsubscribedAt || null,
        recordDate: d.recordDate || null,
        createdAt: d.createdAt || null,
        movedToCandidateAt: d.movedToCandidateAt || null,
        movedToCandidateId: d.movedToCandidateId ? String(d.movedToCandidateId) : null,
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

  const [rowsRaw, total] = await Promise.all([
    MisContact.find(filter)
      .sort(misListSort())
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean(),
    resolveTotal(),
  ]);

  // Defense-in-depth: My records must never leak another user's contacts
  let rows = rowsRaw || [];
  if (desk === 'mine') {
    const me = new Set(userCreatedByIds(user).map(String));
    rows = rows.filter((row) => {
      const ownerId = String(row?.createdBy?._id || row?.createdBy || '');
      return ownerId && me.has(ownerId);
    });
  }

  const rowCount = rows.length;
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
 * Who may view organisation-wide MIS reports (and drill into any employee).
 * Matches MIS “All desk” leadership — owner + admin only.
 */
function canViewMisOrgReports(user) {
  return user?.role === 'owner' || user?.role === 'admin';
}

/**
 * Report data scope by role (never trust query identity for non-leaders):
 * - owner / admin → full organisation, or one employee when ?userId= is validated
 * - other employees → only contacts they added (ignore spoofed userId)
 *
 * Period metrics use the contact Date field (recordDate), falling back to upload
 * time (createdAt) only when Date was never set — same as the MIS list table.
 */
async function resolveMisReportScope(user, query = {}) {
  const organizationId = user.organizationId;
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };
  const me = userCreatedByIds(user);
  const canOrg = canViewMisOrgReports(user);

  let requestedUserId = '';
  if (canOrg) {
    const raw = String(query.userId || query.employeeId || '').trim();
    if (raw && raw !== 'all' && raw !== 'me') requestedUserId = raw;
  }

  if (canOrg && requestedUserId) {
    const { assertOrgEmployee } = require('../utils/dataScope');
    const target = await assertOrgEmployee(organizationId, requestedUserId);
    const ids = [target._id, String(target._id)];
    return {
      scope: 'employee',
      dateMode: 'tracker',
      base: { ...orgMatch, createdBy: { $in: ids } },
      me,
      scopedUserId: String(target._id),
      scopedUserName: target.name || (target.email || '').split('@')[0] || 'Employee',
      scopedUserEmail: target.email || '',
      scopedUserRole: target.role || '',
      canSelectEmployee: true,
    };
  }

  if (canOrg) {
    return {
      scope: 'organisation',
      dateMode: 'tracker',
      base: orgMatch,
      me,
      scopedUserId: null,
      scopedUserName: null,
      canSelectEmployee: true,
    };
  }

  // recruiter / sales / hr_* — personal performance only (never company directory)
  return {
    scope: 'self',
    dateMode: 'tracker',
    base: me.length
      ? { ...orgMatch, createdBy: { $in: me } }
      : { _id: { $in: [] } },
    me,
    scopedUserId: me.length ? String(me[0]) : null,
    scopedUserName: null,
    canSelectEmployee: false,
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
 * One-time reset: clear auto-inferred "In Candidates" marks that were never
 * intentional UI moves (email-match / restore heuristics).
 * Future moves via /move-to-candidates still set movedBy + markers correctly.
 */
async function resetFalseMisMoveMarks(user, { force = false } = {}) {
  assertMisCompany(user);
  const organizationId = user.organizationId;
  if (!organizationId) throw httpError('Organization required', 403);

  const Organization = require('../models/Organization');
  const Candidate = require('../models/Candidate');
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };

  if (!force) {
    const org = await Organization.findById(organizationId).select('settings.misFalseMoveResetV1').lean();
    if (org?.settings?.misFalseMoveResetV1) {
      return { skipped: true, clearedMis: 0, clearedCandidates: 0 };
    }
  }

  // Clear every prior move marker so the 5k+ false "In Candidates" rows become normal MIS again.
  const misRes = await MisContact.updateMany(
    {
      ...orgMatch,
      $or: [
        { movedToCandidateAt: { $exists: true, $ne: null } },
        { movedToCandidateId: { $exists: true, $ne: null } },
        { movedBy: { $exists: true, $ne: null } },
      ],
    },
    { $unset: { movedToCandidateAt: 1, movedToCandidateId: 1, movedBy: 1 } }
  );

  const candRes = await Candidate.updateMany(
    {
      ...orgMatch,
      $or: [
        { fromMis: true },
        { misContactId: { $exists: true, $ne: null } },
      ],
    },
    { $set: { fromMis: false, misContactId: null } }
  );

  await Organization.updateOne(
    { _id: organizationId },
    { $set: { 'settings.misFalseMoveResetV1': new Date() } }
  );

  const clearedMis = misRes.modifiedCount || 0;
  const clearedCandidates = candRes.modifiedCount || 0;
  if (clearedMis || clearedCandidates) {
    logger.info(
      { organizationId: String(organizationId), clearedMis, clearedCandidates },
      'Cleared false MIS In Candidates marks'
    );
  }

  return {
    skipped: false,
    clearedMis,
    clearedCandidates,
  };
}

/** @deprecated name kept for route compatibility — now only clears false marks once. */
async function reconcileMisMoveHistory(user, options = {}) {
  return resetFalseMisMoveMarks(user, options);
}

/**
 * Scoped MIS dashboard KPIs — identical desk math as the list tabs (countMisDesk).
 * Cards: total / company / mine / newThisMonth / movedToCandidates.
 */
async function getMisStats(user) {
  assertMisActor(user);
  const organizationId = user.organizationId;
  const me = userCreatedByIds(user);
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };

  let reset = null;
  try {
    reset = await resetFalseMisMoveMarks(user);
  } catch (err) {
    logger.warn({ err: err.message }, 'MIS false-move reset skipped');
  }

  let monthRange = null;
  try {
    const { buildDateFilter } = require('../utils/analyticsTime');
    monthRange = buildDateFilter('month');
  } catch (err) {
    logger.warn({ err: err.message }, 'MIS month filter skipped');
  }

  const countMs = (q) => MisContact.countDocuments(q).maxTimeMS(20000).catch(() => 0);
  const isOwner = user.role === 'owner';

  // Month intake: owner = org-wide by contact Date; others = contacts they added (createdAt).
  let newThisMonthQ = { _id: { $in: [] } };
  if (monthRange) {
    if (isOwner) {
      newThisMonthQ = {
        ...orgMatch,
        $or: [
          { recordDate: monthRange },
          {
            $and: [
              { $or: [{ recordDate: null }, { recordDate: { $exists: false } }] },
              { createdAt: monthRange },
            ],
          },
        ],
      };
    } else if (me.length) {
      newThisMonthQ = { ...orgMatch, createdBy: { $in: me }, createdAt: monthRange };
    }
  }

  // Owner: all MIS→Candidates moves in the org. Others: only moves they performed.
  const movedScopeFilter = isOwner
    ? {
      ...orgMatch,
      movedToCandidateAt: { $exists: true, $ne: null },
    }
    : (me.length
      ? {
        ...orgMatch,
        movedToCandidateAt: { $exists: true, $ne: null },
        movedBy: { $in: me },
      }
      : { _id: { $in: [] } });
  const movedThisMonthFilter = monthRange
    ? { ...movedScopeFilter, movedToCandidateAt: monthRange }
    : { _id: { $in: [] } };
  const activeScopeFilter = misListFilter(organizationId, user, {
    $or: [{ movedToCandidateAt: null }, { movedToCandidateAt: { $exists: false } }],
  });

  const [total, company, mine, employeeRecords, newThisMonth, movedToCandidates, movedThisMonth, activeInMis] = await Promise.all([
    countMisDesk(user, organizationId, 'all').then((n) => (n == null ? 0 : n)),
    countMisDesk(user, organizationId, 'company').then((n) => (n == null ? 0 : n)),
    countMisDesk(user, organizationId, 'mine').then((n) => (n == null ? 0 : n)),
    isOwner
      ? countMs({ ...orgMatch, deskScope: 'personal' })
      : countMisDesk(user, organizationId, 'mine').then((n) => (n == null ? 0 : n)),
    countMs(newThisMonthQ),
    countMs(movedScopeFilter),
    countMs(movedThisMonthFilter),
    countMs(activeScopeFilter),
  ]);

  return {
    total: Number(total) || 0,
    mine: Number(mine) || 0,
    company: Number(company) || 0,
    employeeRecords: Number(employeeRecords) || 0,
    newThisMonth: Number(newThisMonth) || 0,
    movedToCandidates: Number(movedToCandidates) || 0,
    movedThisMonth: Number(movedThisMonth) || 0,
    activeInMis: Number(activeInMis) || 0,
    scope: user.role === 'owner' ? 'owner' : 'employee',
    createdBySelf: me.length > 0,
    reset: reset && !reset.skipped ? {
      clearedMis: reset.clearedMis || 0,
      clearedCandidates: reset.clearedCandidates || 0,
    } : null,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * MIS reports for a period — totals, desks, status mix, integrity / duplicacy.
 * Scoped securely by role via resolveMisReportScope (never trust query identity).
 */
async function getMisReports(user, query = {}) {
  assertMisActor(user);

  // Ignore org spoofing; userId is only consumed inside resolveMisReportScope for owner/admin
  const safeQuery = { ...(query || {}) };
  delete safeQuery.organizationId;
  delete safeQuery.orgId;
  delete safeQuery.createdBy;

  const scopeInfo = await resolveMisReportScope(user, safeQuery);
  const {
    scope,
    dateMode,
    base,
    me,
    scopedUserId = null,
    scopedUserName = null,
    canSelectEmployee = false,
  } = scopeInfo;

  const period = trimStr(safeQuery.dateRange || safeQuery.period || safeQuery.datePeriod) || 'month';
  const from = safeQuery.from || safeQuery.dateFrom || safeQuery.customFrom;
  const to = safeQuery.to || safeQuery.dateTo || safeQuery.customTo;

  let dateFilter = null;
  let periodLabel = period;
  let chartCfg = null;
  let prevFilter = null;
  try {
    const {
      buildDateFilter,
      getDateRangeLabel,
      chartBucketConfig,
      previousPeriodFilter,
    } = require('../utils/analyticsTime');
    dateFilter = buildDateFilter(period === 'all' ? 'all' : period, from, to);
    periodLabel = typeof getDateRangeLabel === 'function'
      ? getDateRangeLabel(period, from, to)
      : (period === 'custom' && from && to ? `${from} → ${to}` : period);
    chartCfg = chartBucketConfig(period === 'all' ? 'month' : period, from, to);
    prevFilter = previousPeriodFilter(period === 'all' ? 'all' : period, from, to);
  } catch (err) {
    logger.warn({ err: err.message }, 'MIS reports date filter skipped');
  }

  // Period stats follow contact Date (recordDate), with upload time only as fallback
  const periodMatch = applyMisPeriodFilter(base, dateFilter, dateMode);
  const prevMatch = prevFilter ? applyMisPeriodFilter(base, prevFilter, dateMode) : null;
  const uploadedMatch = applyMisPeriodFilter(base, dateFilter, 'createdAt');
  const isOrgView = scope === 'organisation';
  const isSelfView = scope === 'self';

  // Integrity: tracker Date placed in this period on contacts that were uploaded earlier
  const periodStart = dateFilter?.$gte || null;
  const recycledMatch = periodStart
    ? andMisFilter(base, {
      recordDate: dateFilter,
      createdAt: { $lt: periodStart },
    })
    : null;
  // Integrity: edits in this period on contacts that were uploaded earlier
  const touchedOldMatch = periodStart
    ? andMisFilter(base, {
      updatedAt: dateFilter,
      createdAt: { $lt: periodStart },
    })
    : null;

  const countMs = (q, ms = 8000) => {
    if (!q) return Promise.resolve(0);
    return MisContact.countDocuments(q).maxTimeMS(ms).catch(() => 0);
  };

  const emptyAgg = Promise.resolve([]);
  const dateExpr = dateMode === 'createdAt'
    ? '$createdAt'
    : { $ifNull: ['$recordDate', '$createdAt'] };

  // One period scan for charts + desk mix + contributors (avoids 5–6 separate heavy queries)
  const periodFacetPromise = MisContact.aggregate([
    { $match: periodMatch },
    {
      $facet: {
        total: [{ $count: 'n' }],
        company: isSelfView
          ? []
          : [{ $match: { deskScope: { $ne: 'personal' } } }, { $count: 'n' }],
        personal: [{ $match: { deskScope: 'personal' } }, { $count: 'n' }],
        byStatus: [
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
          { $limit: 20 },
        ],
        byClient: [
          {
            $group: {
              _id: {
                $cond: [
                  { $or: [{ $eq: ['$client', null] }, { $eq: ['$client', ''] }] },
                  'Unspecified',
                  '$client',
                ],
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
        byTrend: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: dateExpr } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 400 },
        ],
        byContributor: isOrgView
          ? [
            { $group: { _id: '$createdBy', added: { $sum: 1 } } },
            { $sort: { added: -1 } },
            { $limit: 40 },
          ]
          : [],
      },
    },
  ]).option({ maxTimeMS: 12000, allowDiskUse: true }).catch(() => [{}]);

  // Integrity + overlap: period-scoped (not all-time) so reports stay fast
  const [
    periodFacetRows,
    prevInPeriod,
    uploadedInPeriod,
    allTimeTotal,
    recycledCount,
    touchedOldCount,
    phoneDupes,
    emailOverlap,
    phoneOverlap,
    recycledByUserAgg,
    recycledSamples,
  ] = await Promise.all([
    periodFacetPromise,
    countMs(prevMatch, 6000),
    countMs(uploadedMatch, 6000),
    countMs(base, 6000),
    countMs(recycledMatch, 6000),
    countMs(touchedOldMatch, 6000),
    MisContact.aggregate([
      { $match: andMisFilter(periodMatch, { phone: { $nin: [null, ''] } }) },
      { $group: { _id: '$phone', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      {
        $group: {
          _id: null,
          duplicateGroups: { $sum: 1 },
          duplicateRows: { $sum: '$count' },
        },
      },
    ]).option({ maxTimeMS: 6000 }).catch(() => []),
    (async () => {
      try {
        const Candidate = require('../models/Candidate');
        const emailRows = await MisContact.aggregate([
          { $match: andMisFilter(periodMatch, { email: { $nin: [null, ''] } }) },
          { $group: { _id: '$email' } },
          { $limit: 3000 },
        ]).option({ maxTimeMS: 6000 }).catch(() => []);
        const emails = (emailRows || []).map((r) => r._id).filter(Boolean);
        if (!emails.length) return 0;
        const orgMatch = organizationIdMatch(user.organizationId) || { organizationId: user.organizationId };
        return Candidate.countDocuments({
          ...orgMatch,
          email: { $in: emails },
        }).maxTimeMS(6000).catch(() => 0);
      } catch {
        return 0;
      }
    })(),
    (async () => {
      try {
        const Candidate = require('../models/Candidate');
        const phoneRows = await MisContact.aggregate([
          { $match: andMisFilter(periodMatch, { phone: { $nin: [null, ''] } }) },
          { $group: { _id: '$phone' } },
          { $limit: 3000 },
        ]).option({ maxTimeMS: 6000 }).catch(() => []);
        const keys = (phoneRows || []).map((p) => p._id).filter(Boolean);
        if (!keys.length) return 0;
        const orgMatch = organizationIdMatch(user.organizationId) || { organizationId: user.organizationId };
        return Candidate.countDocuments({
          ...orgMatch,
          phone: { $in: keys },
        }).maxTimeMS(6000).catch(() => 0);
      } catch {
        return 0;
      }
    })(),
    isOrgView && recycledMatch
      ? MisContact.aggregate([
        { $match: recycledMatch },
        { $group: { _id: '$createdBy', recycled: { $sum: 1 } } },
        { $sort: { recycled: -1 } },
        { $limit: 40 },
      ]).option({ maxTimeMS: 6000 }).catch(() => [])
      : emptyAgg,
    (isOrgView || scope === 'employee') && recycledMatch
      ? MisContact.find(recycledMatch)
        .select('name email phone recordDate createdAt createdBy')
        .sort({ recordDate: -1 })
        .limit(15)
        .maxTimeMS(6000)
        .lean()
        .catch(() => [])
      : Promise.resolve([]),
  ]);

  const facet = (periodFacetRows && periodFacetRows[0]) || {};
  const statusAgg = facet.byStatus || [];
  const clientAgg = facet.byClient || [];
  const trendAgg = facet.byTrend || [];
  const contributorAgg = facet.byContributor || [];
  const totalInPeriod = facet.total?.[0]?.n || 0;
  const companyInPeriod = facet.company?.[0]?.n || 0;
  const personalInPeriod = facet.personal?.[0]?.n || 0;

  const phoneDup = phoneDupes?.[0] || {};
  const companyN = Number(companyInPeriod) || 0;
  const personalN = Number(personalInPeriod) || 0;
  const inPeriod = Number(totalInPeriod) || 0;
  const prevN = Number(prevInPeriod) || 0;
  const uploadedN = Number(uploadedInPeriod) || 0;
  const recycledN = Number(recycledCount) || 0;
  const touchedN = Number(touchedOldCount) || 0;

  // Fill trend buckets (day or week) so charts are continuous and accurate
  const trendMap = new Map();
  for (const row of trendAgg || []) {
    if (row?._id) trendMap.set(String(row._id), Number(row.count) || 0);
  }
  let trend = [];
  const granularity = chartCfg?.granularity || 'daily';
  if (chartCfg?.dayKeys?.length) {
    if (chartCfg.rollup === 'week') {
      trend = chartCfg.dayKeys.map((bucket) => {
        let count = 0;
        const startKey = bucket.startKey || bucket.key;
        const endKey = bucket.endKey || bucket.key;
        for (const [day, n] of trendMap.entries()) {
          if (day >= startKey && day <= endKey) count += n;
        }
        return {
          date: startKey,
          endDate: endKey,
          label: bucket.day || startKey,
          count,
        };
      });
    } else {
      trend = chartCfg.dayKeys.map((d) => ({
        date: d.key,
        label: d.day || d.key,
        count: trendMap.get(d.key) || 0,
      }));
    }
  } else {
    trend = [...trendMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, label: date, count }));
  }

  // Resolve contributor names for org leaderboard
  let byContributor = [];
  if (isOrgView && (contributorAgg?.length || recycledByUserAgg?.length)) {
    const User = require('../models/User');
    const recycledMap = new Map(
      (recycledByUserAgg || []).map((r) => [String(r._id), Number(r.recycled) || 0])
    );
    const ids = [
      ...new Set([
        ...(contributorAgg || []).map((r) => String(r._id)),
        ...(recycledByUserAgg || []).map((r) => String(r._id)),
      ].filter(Boolean)),
    ];
    const users = ids.length
      ? await User.find({ _id: { $in: ids }, organizationId: user.organizationId })
        .select('name email role')
        .lean()
        .catch(() => [])
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const addedMap = new Map(
      (contributorAgg || []).map((r) => [String(r._id), Number(r.added) || 0])
    );
    byContributor = ids
      .map((id) => {
        const u = userMap.get(id);
        const added = addedMap.get(id) || 0;
        const recycled = recycledMap.get(id) || 0;
        return {
          userId: id,
          name: u?.name || (u?.email || '').split('@')[0] || 'Unknown',
          email: u?.email || '',
          role: u?.role || '',
          added,
          recycledTrackerDates: recycled,
          risk: recycled > 0 && recycled >= Math.max(3, Math.ceil(added * 0.25))
            ? 'high'
            : recycled > 0
              ? 'watch'
              : 'ok',
        };
      })
      .sort((a, b) => b.added - a.added || b.recycledTrackerDates - a.recycledTrackerDates);
  }

  const samples = (recycledSamples || []).map((row) => ({
    id: String(row._id),
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || row.contact || '',
    recordDate: row.recordDate ? new Date(row.recordDate).toISOString().slice(0, 10) : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : null,
    createdBy: row.createdBy ? String(row.createdBy) : null,
  }));

  const deltaPct = prevN > 0
    ? Math.round(((inPeriod - prevN) / prevN) * 100)
    : (inPeriod > 0 ? 100 : 0);

  return {
    period,
    periodLabel,
    scope,
    granularity,
    generatedAt: new Date().toISOString(),
    totals: {
      allTime: Number(allTimeTotal) || 0,
      inPeriod,
      previousPeriod: prevN,
      deltaPct,
      uploadedInPeriod: uploadedN,
      // Company desk counts only for leadership / employee drill-down — never for self reports
      companyInPeriod: isSelfView ? 0 : companyN,
      personalInPeriod: personalN,
    },
    byStatus: (statusAgg || []).map((row) => ({
      status: String(row._id || 'NEW'),
      count: Number(row.count) || 0,
    })),
    byClient: (clientAgg || []).map((row) => ({
      client: String(row._id || 'Unspecified'),
      count: Number(row.count) || 0,
    })),
    trend,
    deskMix: [],
    employeeMix: isOrgView
      ? byContributor
        .filter((row) => (Number(row.added) || 0) > 0)
        .slice(0, 10)
        .map((row) => ({
          label: row.name,
          key: row.userId,
          count: Number(row.added) || 0,
        }))
      : [],
    byContributor,
    duplicacy: {
      phoneDuplicateGroups: Number(phoneDup.duplicateGroups) || 0,
      phoneDuplicateRows: Number(phoneDup.duplicateRows) || 0,
      emailOverlapWithCandidates: Number(emailOverlap) || 0,
      phoneOverlapWithCandidates: Number(phoneOverlap) || 0,
      recycledTrackerDates: recycledN,
      touchedOldContacts: touchedN,
      samples: (isOrgView || scope === 'employee') ? samples : [],
    },
    integrity: {
      trulyNewInPeriod: uploadedN,
      recycledTrackerDates: recycledN,
      touchedOldContacts: touchedN,
      riskLevel: recycledN >= 20 || (recycledN > 0 && recycledN >= Math.ceil(Math.max(inPeriod, 1) * 0.3))
        ? 'high'
        : recycledN > 0 || touchedN >= 50
          ? 'watch'
          : 'ok',
      note: 'Metrics use each contact’s Date field. Upload time applies only when Date is blank. Integrity checks cover the selected period.',
    },
    meta: {
      role: user.role,
      dateMode: dateMode || 'tracker',
      selfOnly: isSelfView,
      includesOthersPersonal: isOrgView,
      canSelectEmployee,
      scopedUserId,
      scopedUserName,
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
  const matched = result.matchedCount ?? result.n ?? 0;
  const modified = result.modifiedCount ?? result.nModified ?? 0;
  if (!matched) {
    throw httpError(
      'No editable contacts in this selection. Employees can only edit records they created.',
      403,
      { code: 'MIS_WRITE_FORBIDDEN' }
    );
  }
  return {
    matched,
    modified,
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
 * Copy MIS contacts into Candidates (keeps MIS row; marks as moved).
 * New candidates are owned by the acting employee (createdBy + SPOC).
 * Skips already-moved rows, existing candidate email/phone conflicts, and invalid rows.
 */
async function moveToCandidates(user, ids = [], options = {}) {
  assertMisCompany(user);
  const idList = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!idList.length) throw httpError('Select at least one MIS contact');

  // Keep MIS history by default. Explicit removeFromMis=true is still allowed for cleanup.
  const removeFromMis = options.removeFromMis === true;
  const Candidate = require('../models/Candidate');
  const LocationService = require('./locationService');
  const { findOrgPhoneConflict, findOrgEmailConflict } = require('./dedupeService');
  const { enforceSpocOnWrite } = require('../utils/spocIdentity');

  const filter = misListFilter(user.organizationId, user, { _id: { $in: idList } });
  const rows = await MisContact.find(filter).lean();
  if (!rows.length) throw httpError('No MIS contacts found', 404);

  const actorId = user.id || user._id;
  let moved = 0;
  let skippedDuplicate = 0;
  let skippedAlreadyMoved = 0;
  let skippedInvalid = 0;
  const errors = [];
  const movedIds = [];
  const movedCandidateIds = [];

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const contact = phoneDigits(row.phone || row.contact);
    const name = trimStr(row.name);
    const ctc = trimStr(row.ctc) || 'TO BE UPDATED';

    if (row.movedToCandidateAt || row.movedToCandidateId) {
      skippedAlreadyMoved += 1;
      if (errors.length < 40) {
        errors.push({ id: row._id, email, message: 'Already moved to Candidates' });
      }
      continue;
    }

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
          // Mark MIS row so the directory reflects the existing candidate link.
          await MisContact.updateOne(
            { _id: row._id, organizationId: user.organizationId, movedToCandidateAt: null },
            {
              $set: {
                movedToCandidateAt: new Date(),
                movedToCandidateId: emailHit._id || null,
                movedBy: actorId,
              },
            }
          );
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
          await MisContact.updateOne(
            { _id: row._id, organizationId: user.organizationId, movedToCandidateAt: null },
            {
              $set: {
                movedToCandidateAt: new Date(),
                movedToCandidateId: phoneHit._id || null,
                movedBy: actorId,
              },
            }
          );
          continue;
        }
      }

      const trackerDate = row.recordDate || row.createdAt || null;
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
        createdBy: actorId,
        fromMis: true,
        misContactId: row._id,
        // Keep original MIS tracker/import date so Candidates sort does not jump to "just now"
        appliedAt: trackerDate ? new Date(trackerDate) : undefined,
        date: trackerDate
          ? new Date(trackerDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : undefined,
      };
      if (payload.location && !payload.state) {
        payload.state = LocationService.detectState(payload.location) || '';
      }

      const fakeReq = { user, body: payload };
      await enforceSpocOnWrite(fakeReq, { isCreate: true });
      Object.assign(payload, fakeReq.body);

      const doc = new Candidate(payload);
      await doc.save();

      await MisContact.updateOne(
        { _id: row._id, organizationId: user.organizationId },
        {
          $set: {
            movedToCandidateAt: new Date(),
            movedToCandidateId: doc._id,
            movedBy: actorId,
          },
        }
      );

      moved += 1;
      movedIds.push(String(row._id));
      movedCandidateIds.push(String(doc._id));
    } catch (err) {
      skippedInvalid += 1;
      if (errors.length < 40) {
        errors.push({
          id: row._id,
          email,
          message: clientSafeError(err, 'This contact could not be moved to Candidates. Check the row and try again.'),
        });
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

  const notFound = Math.max(0, idList.length - rows.length);
  const parts = [
    `Moved ${moved} to Candidates`,
    skippedAlreadyMoved ? `${skippedAlreadyMoved} already moved` : null,
    skippedDuplicate ? `${skippedDuplicate} already in Candidates` : null,
    skippedInvalid ? `${skippedInvalid} skipped` : null,
    notFound ? `${notFound} not found` : null,
  ].filter(Boolean);

  return {
    moved,
    deleted,
    keptInMis: removeFromMis ? 0 : moved,
    skippedDuplicate,
    skippedAlreadyMoved,
    skippedInvalid,
    notFound,
    selected: idList.length,
    total: rows.length,
    candidateIds: movedCandidateIds,
    errors: errors.slice(0, 30),
    message: parts.join(' · '),
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
  reconcileMisMoveHistory,
  resetFalseMisMoveMarks,
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
