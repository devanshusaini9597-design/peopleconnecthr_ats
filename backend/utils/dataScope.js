/**
 * Tenant + role data scoping.
 * Freelancers are org members but may only read/write their own candidate records.
 * Company ATS lists exclude freelancer desks until a candidate is shared with the viewer.
 */
const mongoose = require('mongoose');

function isFreelancer(user) {
  return Boolean(user && user.role === 'freelancer');
}

function userIdParts(user) {
  const userIdStr = String(user?.id || user?._id || '').trim();
  let userIdObj = null;
  if (userIdStr.length === 24 && /^[a-fA-F0-9]+$/.test(userIdStr)) {
    try {
      userIdObj = new mongoose.Types.ObjectId(userIdStr);
    } catch {
      userIdObj = null;
    }
  }
  return { userIdStr, userIdObj };
}

function createdByFilter(user) {
  const { userIdStr, userIdObj } = userIdParts(user);
  if (!userIdStr) return { createdBy: null };
  return userIdObj
    ? { createdBy: { $in: [userIdObj, userIdStr] } }
    : { createdBy: userIdStr };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Common Skillnix typo class: one accidental doubled letter (AMANPREET → AMANPRREET). */
function singleDuplicateVariants(token) {
  const raw = String(token || '').trim();
  if (!raw || raw.length > 40) return [raw].filter(Boolean);
  const out = new Set([raw]);
  const chars = [...raw];
  for (let i = 0; i < chars.length; i += 1) {
    if (/\s/.test(chars[i])) continue;
    out.add(`${chars.slice(0, i + 1).join('')}${chars[i]}${chars.slice(i + 1).join('')}`);
  }
  return [...out];
}

/**
 * Skillnix: employee stats are keyed by candidate.spoc name.
 * Match full name, first name, email local-part, and single-letter typo variants.
 */
function spocOwnershipClauses(user) {
  const tokens = new Set();
  const name = String(user?.name || '').trim();
  if (name) {
    tokens.add(name);
    const first = name.split(/\s+/).filter(Boolean)[0];
    if (first && first.length >= 2) tokens.add(first);
  }
  const emailLocal = String(user?.email || '').split('@')[0].trim();
  if (emailLocal && emailLocal.length >= 3 && !/^\d+$/.test(emailLocal)) {
    tokens.add(emailLocal);
  }

  const expanded = new Set();
  for (const token of tokens) {
    for (const variant of singleDuplicateVariants(token)) {
      if (variant && variant.length >= 2) expanded.add(variant);
    }
  }

  const clauses = [];
  for (const token of expanded) {
    if (/\s/.test(token)) {
      // Full name / multi-word: exact SPOC value
      clauses.push({ spoc: new RegExp(`^\\s*${escapeRegex(token)}\\s*$`, 'i') });
    } else {
      // Single token: exact OR first word of SPOC ("AMANPREET" → "AMANPREET KAUR")
      clauses.push({ spoc: new RegExp(`^\\s*${escapeRegex(token)}\\s*$`, 'i') });
      clauses.push({ spoc: new RegExp(`^\\s*${escapeRegex(token)}(\\s+|$)`, 'i') });
    }
  }
  return clauses;
}

/** createdBy rows with blank SPOC still belong on the creator's desk. */
function blankSpocCreatedByClause(user) {
  return {
    $and: [
      createdByFilter(user),
      {
        $or: [
          { spoc: { $exists: false } },
          { spoc: null },
          { spoc: '' },
          { spoc: /^\s*$/ },
        ],
      },
    ],
  };
}

/**
 * Careers-page applicants are stamped source "Careers Page".
 * Older rows used spoc "Careers Page", which never matches a recruiter name,
 * so createdBy ownership must still put them on that desk.
 */
function careersCreatedByClause(user) {
  return {
    $and: [
      createdByFilter(user),
      {
        $or: [
          { source: /careers\s*page/i },
          { spoc: /^\s*Careers Page\s*$/i },
        ],
      },
    ],
  };
}

/** Unowned careers applicants (no createdBy) should still appear on company desks. */
function orphanCareersClause() {
  return {
    $and: [
      {
        $or: [
          { source: /careers\s*page/i },
          { spoc: /^\s*Careers Page\s*$/i },
        ],
      },
      {
        $or: [
          { createdBy: { $exists: false } },
          { createdBy: null },
          { createdBy: '' },
        ],
      },
    ],
  };
}

/** Jobs this user owns or is assigned to (ATS Applications + careers intake). */
function jobOwnershipClauses(user) {
  const { userIdStr, userIdObj } = userIdParts(user);
  const email = String(user?.email || '').trim().toLowerCase();
  const orClauses = [];
  const idMatch = userIdObj ? { $in: [userIdObj, userIdStr] } : (userIdStr || null);
  if (idMatch) {
    orClauses.push({ createdBy: idMatch });
    orClauses.push({ hiringManager: idMatch });
    orClauses.push({ assignedRecruiters: idMatch });
  }
  if (email) {
    orClauses.push({ hiringManagers: { $regex: new RegExp(`^\\s*${escapeRegex(email)}\\s*$`, 'i') } });
  }
  return orClauses;
}

async function candidateIdsOnOwnedJobs(organizationId, user) {
  if (!organizationId || isFreelancer(user)) return [];
  if (mongoose.connection.readyState !== 1) return [];
  const orClauses = jobOwnershipClauses(user);
  if (!orClauses.length) return [];
  try {
    const Job = require('../models/Job');
    const Application = require('../models/Application');
    const jobQuery = Job.find({ organizationId, $or: orClauses }).distinct('_id').maxTimeMS(4000);
    const jobIds = await Promise.race([
      jobQuery,
      new Promise((_, reject) => setTimeout(() => reject(new Error('job desk timeout')), 4500)),
    ]);
    if (!jobIds.length) return [];
    return await Promise.race([
      Application.find({
        organizationId,
        jobId: { $in: jobIds },
      }).distinct('candidateId').maxTimeMS(4000),
      new Promise((_, reject) => setTimeout(() => reject(new Error('application desk timeout')), 4500)),
    ]);
  } catch {
    return [];
  }
}

async function mergeDeskWithJobApplicants(user, organizationId, baseFilter) {
  const ids = await candidateIdsOnOwnedJobs(organizationId, user);
  if (!ids.length) return baseFilter;
  const orgMatch = organizationIdMatch(organizationId);
  const extra = orgMatch
    ? { $and: [orgMatch, { _id: { $in: ids } }] }
    : { _id: { $in: ids } };
  return { $or: [baseFilter, extra] };
}

/** Match organizationId whether stored as ObjectId or string. */
function organizationIdMatch(organizationId) {
  if (!organizationId) return null;
  const orgStr = String(organizationId).trim();
  if (!orgStr) return null;
  let orgObj = null;
  if (orgStr.length === 24 && /^[a-fA-F0-9]+$/.test(orgStr)) {
    try {
      orgObj = new mongoose.Types.ObjectId(orgStr);
    } catch {
      orgObj = null;
    }
  }
  return orgObj
    ? { organizationId: { $in: [orgObj, orgStr] } }
    : { organizationId: orgStr };
}

/**
 * Employee desk = SPOC name (with light typo tolerance) OR rows this user created.
 * Recruiters keep their own intake even when SPOC is a client / teammate name.
 * OrganizationId stays a top-level $and so Mongo can use the tenant index.
 */
function freelancerDeskFilter(user, organizationId) {
  const own = createdByFilter(user);
  const { userIdStr, userIdObj } = userIdParts(user);
  const shared = userIdObj
    ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
    : { 'sharedWith.userId': userIdStr };
  const notHidden = userIdObj
    ? { hiddenFromFreelancerIds: { $nin: [userIdObj, userIdStr] } }
    : { hiddenFromFreelancerIds: { $nin: [userIdStr] } };
  const desk = { $and: [{ $or: [own, shared] }, notHidden] };
  const orgMatch = organizationIdMatch(organizationId);
  return orgMatch ? { $and: [orgMatch, desk] } : desk;
}

function employeeDeskFilter(user, organizationId) {
  if (isFreelancer(user)) {
    return freelancerDeskFilter(user, organizationId);
  }

  const spocClauses = spocOwnershipClauses(user);
  const deskOr = [];
  if (spocClauses.length) deskOr.push({ $or: spocClauses });
  const own = createdByFilter(user);
  if (own && own.createdBy !== null) deskOr.push(own);

  const desk = deskOr.length === 1 ? deskOr[0] : (deskOr.length ? { $or: deskOr } : own);

  const orgMatch = organizationIdMatch(organizationId);
  if (!orgMatch) return desk;
  return { $and: [orgMatch, desk] };
}

/** Owner / admin / HR manager may view org-wide dashboard & analytics. */
const ORG_WIDE_ANALYTICS_ROLES = ['owner', 'admin', 'hr_manager'];

function canViewOrgAnalytics(user) {
  return Boolean(user && ORG_WIDE_ANALYTICS_ROLES.includes(user.role));
}

function requestedAnalyticsUserId(req) {
  const raw = req?.query?.userId ?? req?.body?.userId;
  const id = String(raw || '').trim();
  if (!id || id === 'all' || id === 'me') return '';
  return id;
}

function scopeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function assertOrgEmployee(organizationId, userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw scopeError('Invalid employee', 400);
  }
  const User = require('../models/User');
  const target = await User.findOne({ _id: userId, organizationId }).select('_id role name email').lean();
  if (!target) throw scopeError('Employee not found in this organization', 404);
  return target;
}

/**
 * Dashboard / analytics / export filter.
 * - Recruiter / sales: company employee desk (SPOC / createdBy / job ownership),
 *   freelancer-created rows excluded so KPIs match the Candidates table.
 * - Owner / admin / HR manager: organization totals by default;
 *   with ?userId= → that person's company desk (not mixed with freelancer shares).
 */
async function analyticsScope(req) {
  const user = req.user || {};
  const requestedId = requestedAnalyticsUserId(req);

  if (!canViewOrgAnalytics(user)) {
    return companyEmployeeDesk(user, user.organizationId);
  }

  if (!requestedId) {
    const orgMatch = organizationIdMatch(user.organizationId);
    return orgMatch || employeeDeskFilter(user, null);
  }

  // Self or another teammate — same company desk as Candidates (separate from freelancer shares)
  if (String(requestedId) === String(user.id || user._id || '')) {
    return companyEmployeeDesk(user, user.organizationId);
  }

  if (!user.organizationId) {
    throw scopeError('Employee filter requires an organization', 400);
  }

  const target = await assertOrgEmployee(user.organizationId, requestedId);
  return companyEmployeeDesk(
    { id: target._id, role: target.role, name: target.name, email: target.email },
    user.organizationId
  );
}

function analyticsScopeMeta(req) {
  const user = req.user || {};
  const canSelect = canViewOrgAnalytics(user);
  const requestedId = canSelect ? requestedAnalyticsUserId(req) : '';
  return {
    canSelectEmployee: canSelect,
    scope: canSelect && !requestedId ? 'organization' : 'employee',
    scopedUserId: requestedId || (canSelect ? null : String(user.id || user._id || '')),
  };
}

/**
 * Application-centric analytics (Reports Studio).
 * Org-wide for managers; otherwise assignedTo the viewer (or selected employee).
 * Freelancers match submissions they handed off.
 */
async function applicationAnalyticsScope(req) {
  const user = req.user || {};
  const orgId = user.organizationId;
  if (!orgId) return { organizationId: null };

  if (canViewOrgAnalytics(user)) {
    const requestedId = requestedAnalyticsUserId(req);
    if (!requestedId) return { organizationId: orgId };
    if (String(requestedId) !== String(user.id || user._id || '')) {
      await assertOrgEmployee(orgId, requestedId);
    }
    const { userIdStr, userIdObj } = userIdParts({ id: requestedId });
    const assigned = userIdObj
      ? { assignedTo: { $in: [userIdObj, userIdStr] } }
      : { assignedTo: userIdStr };
    return {
      organizationId: orgId,
      $or: [assigned, { 'metadata.submittedBy': userIdStr }],
    };
  }

  if (isFreelancer(user)) {
    return { organizationId: orgId, 'metadata.submittedBy': String(user.id || user._id) };
  }

  const { userIdStr, userIdObj } = userIdParts(user);
  const assigned = userIdObj
    ? { assignedTo: { $in: [userIdObj, userIdStr] } }
    : { assignedTo: userIdStr };
  return {
    organizationId: orgId,
    $or: [assigned, { 'metadata.submittedBy': userIdStr }],
  };
}

/** Write/read one candidate: freelancer = own rows only; others = org (or legacy createdBy). */
function orgOrOwnerScope(req) {
  const user = req.user || {};
  if (isFreelancer(user)) {
    const own = createdByFilter(user);
    if (user.organizationId) {
      return { organizationId: user.organizationId, ...own };
    }
    return own;
  }
  return user.organizationId
    ? { organizationId: user.organizationId }
    : { createdBy: user.id };
}

/**
 * Mutate one candidate: managers/org-wide; recruiters only their SPOC desk or rows shared with them.
 * Prevents employees from editing another employee's desk data.
 */
function candidateWriteScope(req) {
  const user = req.user || {};
  if (isFreelancer(user) || canViewOrgAnalytics(user)) {
    return orgOrOwnerScope(req);
  }

  const desk = employeeDeskFilter(user, user.organizationId);
  const { userIdStr, userIdObj } = userIdParts(user);
  const shared = userIdObj
    ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
    : { 'sharedWith.userId': userIdStr };
  const orgMatch = organizationIdMatch(user.organizationId);
  const sharedFilter = orgMatch ? { $and: [orgMatch, shared] } : shared;
  return { $or: [desk, sharedFilter] };
}

function sharedWithClause(user) {
  const { userIdStr, userIdObj } = userIdParts(user);
  return userIdObj
    ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
    : { 'sharedWith.userId': userIdStr };
}

function queryFlag(req, key) {
  return ['1', 'true', 'yes'].includes(String(req?.query?.[key] || '').toLowerCase());
}

async function orgFreelancerCreatorIds(organizationId) {
  if (!organizationId || mongoose.connection.readyState !== 1) return [];
  try {
    const User = require('../models/User');
    return await User.find({ organizationId, role: 'freelancer' }).distinct('_id');
  } catch {
    return [];
  }
}

/** Company employee desk only — freelancer-created rows are not mixed in. */
async function excludeFreelancerCreated(organizationId, baseFilter) {
  const ids = await orgFreelancerCreatorIds(organizationId);
  if (!ids.length || !baseFilter) return baseFilter;
  return { $and: [baseFilter, { createdBy: { $nin: ids } }] };
}

/** Freelancer records explicitly shared with this staff member. */
async function freelancerHandoffsTo(user, organizationId) {
  const orgMatch = organizationIdMatch(organizationId);
  const ids = await orgFreelancerCreatorIds(organizationId);
  const created = ids.length ? { createdBy: { $in: ids } } : { _id: { $in: [] } };
  const parts = [sharedWithClause(user), created];
  if (orgMatch) parts.unshift(orgMatch);
  return { $and: parts };
}

async function freelancerCreatedInOrg(organizationId) {
  const orgMatch = organizationIdMatch(organizationId);
  const ids = await orgFreelancerCreatorIds(organizationId);
  const created = ids.length ? { createdBy: { $in: ids } } : { _id: { $in: [] } };
  return orgMatch ? { $and: [orgMatch, created] } : created;
}

async function companyEmployeeDesk(user, organizationId) {
  if (isFreelancer(user)) return freelancerDeskFilter(user, organizationId);
  const desk = employeeDeskFilter(user, organizationId);
  const merged = await mergeDeskWithJobApplicants(user, organizationId, desk);
  return excludeFreelancerCreated(organizationId, merged);
}

/**
 * Candidate list filter (sync).
 * Freelancer always own-only (view=all is ignored).
 * Staff mine/all: company desk only. Shared / freelanceOnly: separate handoff list.
 */
function candidateListFilter(req, viewMode) {
  const user = req.user || {};
  const own = createdByFilter(user);
  const sharedClause = sharedWithClause(user);

  if (isFreelancer(user)) {
    return freelancerDeskFilter(user, user.organizationId);
  }

  if (viewMode === 'all') {
    if (canViewOrgAnalytics(user)) {
      return user.organizationId ? { organizationId: user.organizationId } : own;
    }
    return employeeDeskFilter(user, user.organizationId);
  }
  if (viewMode === 'shared') {
    return user.organizationId
      ? { organizationId: user.organizationId, ...sharedClause }
      : sharedClause;
  }
  return employeeDeskFilter(user, user.organizationId);
}

/** SPOC desk OR rows explicitly shared with this user (writes / optional views). */
function deskOrSharedWithMe(user, organizationId) {
  const desk = employeeDeskFilter(user, organizationId);
  const shared = sharedWithClause(user);
  const orgMatch = organizationIdMatch(organizationId);
  const sharedFilter = orgMatch ? { $and: [orgMatch, shared] } : shared;
  return { $or: [desk, sharedFilter] };
}

/** Resume preview/download: same rows the ATS list would show for this view. */
function candidateResumeScope(req) {
  return candidateListFilter(req, req.query?.view);
}

/**
 * Full candidates list scope (async).
 * Managers may pass ?userId= for that employee's company desk.
 * freelanceOnly / view=shared is a separate freelancer-handoff list.
 */
async function candidateListScope(req, viewMode) {
  const user = req.user || {};
  const freelanceOnly = queryFlag(req, 'freelanceOnly');

  if (isFreelancer(user)) {
    return candidateListFilter(req, viewMode);
  }

  if (canViewOrgAnalytics(user)) {
    const requestedId = requestedAnalyticsUserId(req);
    if (requestedId) {
      let targetUser = user;
      if (String(requestedId) !== String(user.id || user._id || '')) {
        if (!user.organizationId) {
          throw scopeError('Employee filter requires an organization', 400);
        }
        const target = await assertOrgEmployee(user.organizationId, requestedId);
        targetUser = {
          id: target._id,
          role: target.role,
          name: target.name,
          email: target.email,
          organizationId: user.organizationId,
        };
      }
      if (isFreelancer(targetUser)) {
        return freelancerDeskFilter(targetUser, user.organizationId);
      }
      if (freelanceOnly || viewMode === 'shared') {
        return freelancerHandoffsTo(targetUser, user.organizationId);
      }
      return companyEmployeeDesk(targetUser, user.organizationId);
    }

    if (freelanceOnly) {
      return freelancerCreatedInOrg(user.organizationId);
    }
    if (viewMode === 'all' || !viewMode) {
      return organizationIdMatch(user.organizationId) || createdByFilter(user);
    }
    if (viewMode === 'shared') {
      return freelancerHandoffsTo(user, user.organizationId);
    }
    return companyEmployeeDesk(user, user.organizationId);
  }

  if (freelanceOnly || viewMode === 'shared') {
    return freelancerHandoffsTo(user, user.organizationId);
  }
  return companyEmployeeDesk(user, user.organizationId);
}

/** Jobs: freelancer sees Open (non-template) mandates only. */
function jobListFilter(req, { isTemplate } = {}) {
  const user = req.user || {};
  const baseFilter = user.organizationId ? { organizationId: user.organizationId } : {};
  if (isTemplate === 'true') {
    return { ...baseFilter, isTemplate: true };
  }
  if (isFreelancer(user)) {
    return {
      ...baseFilter,
      isTemplate: { $ne: true },
      status: { $regex: /^open$/i },
    };
  }
  return {
    ...baseFilter,
    $or: [{ isTemplate: false }, { isTemplate: { $exists: false } }],
  };
}

/** Applications: leadership sees org-wide; others only jobs they created or SPOC; freelancer = own submissions. */
async function applicationListFilter(organizationId, user, extra = {}) {
  const { jobId: extraJobId, ...restExtra } = extra || {};
  const filter = { organizationId, ...restExtra };
  if (isFreelancer(user)) {
    filter['metadata.submittedBy'] = String(user.id || user._id);
    if (extraJobId != null && extraJobId !== 'all') filter.jobId = extraJobId;
    return filter;
  }
  if (canViewOrgAnalytics(user)) {
    if (extraJobId != null && extraJobId !== 'all') filter.jobId = extraJobId;
    return filter;
  }

  const Job = require('../models/Job');
  const { userIdStr, userIdObj } = userIdParts(user);
  const orClauses = jobOwnershipClauses(user);
  const assignedTo = userIdObj
    ? { assignedTo: { $in: [userIdObj, userIdStr] } }
    : (userIdStr ? { assignedTo: userIdStr } : null);

  if (!orClauses.length && !assignedTo) {
    filter.jobId = { $in: [] };
    return filter;
  }

  const scopedJobIds = orClauses.length
    ? await Job.find({
      organizationId,
      $or: orClauses,
    }).distinct('_id')
    : [];

  if (extraJobId != null && extraJobId !== 'all') {
    const requested = String(extraJobId);
    const allowed = scopedJobIds.some((id) => String(id) === requested);
    filter.jobId = extraJobId;
    if (!allowed && assignedTo) {
      Object.assign(filter, assignedTo);
    } else if (!allowed) {
      filter.jobId = { $in: [] };
    }
    return filter;
  }

  const visibility = [{ jobId: { $in: scopedJobIds } }];
  if (assignedTo) visibility.push(assignedTo);
  filter.$or = visibility;
  return filter;
}

/** Company employees who may open MIS (never freelancers / interviewers / readonly). */
const MIS_COMPANY_ROLES = new Set([
  'owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales',
]);

function isMisCompanyRole(user) {
  return Boolean(user && MIS_COMPANY_ROLES.has(user.role));
}

/**
 * MIS list visibility:
 * - Owner: all org contacts
 * - Company employees: org-shared (deskScope !== personal, including legacy) + own personal rows
 * - Freelancer / other roles: empty
 */
function misListFilter(organizationId, user, extra = {}) {
  const { $and: extraAnd, ...restExtra } = extra || {};
  // Match ObjectId + string forms so tenant scoping never accidentally widens.
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };
  const filter = { ...orgMatch, ...restExtra };

  if (!user || isFreelancer(user) || !isMisCompanyRole(user)) {
    filter._id = { $in: [] };
    return filter;
  }
  if (user.role === 'owner') {
    if (Array.isArray(extraAnd) && extraAnd.length) {
      filter.$and = extraAnd;
    }
    return filter;
  }

  const { userIdStr, userIdObj } = userIdParts(user);
  const me = userIdObj ? [userIdObj, userIdStr] : [userIdStr];
  // Index-friendly: org-shared OR own personal (disjoint branches).
  const visibility = {
    $or: [
      { deskScope: { $ne: 'personal' } },
      { deskScope: 'personal', createdBy: { $in: me } },
    ],
  };
  filter.$and = [...(Array.isArray(extraAnd) ? extraAnd : []), visibility];
  return filter;
}

/**
 * MIS mutate scope: owner = all; employees = only rows they created (personal desk).
 */
function misWriteFilter(organizationId, user, extra = {}) {
  const orgMatch = organizationIdMatch(organizationId) || { organizationId };
  if (!user || isFreelancer(user) || !isMisCompanyRole(user)) {
    return { ...orgMatch, _id: { $in: [] }, ...extra };
  }
  if (user.role === 'owner') {
    return misListFilter(organizationId, user, extra);
  }
  const { userIdStr, userIdObj } = userIdParts(user);
  const me = userIdObj ? [userIdObj, userIdStr] : [userIdStr];
  return { ...orgMatch, createdBy: { $in: me }, ...extra };
}

/** Picklists / master data: freelancer sees only values they created. */
function masterDataScope(req) {
  return orgOrOwnerScope(req);
}

/**
 * Hide private freelancer desks from non-manager staff until shared with them.
 * Owner / admin / HR manager always see the full organization (no-op).
 */
async function withoutUnsharedFreelancerDesks(req, baseFilter) {
  if (isFreelancer(req.user) || !req.user?.organizationId || !baseFilter) {
    return baseFilter;
  }
  // Leadership sees all org data, including every freelancer submission
  if (canViewOrgAnalytics(req.user)) {
    return baseFilter;
  }
  if (mongoose.connection.readyState !== 1) return baseFilter;

  const User = require('../models/User');
  let freelancerIds = [];
  try {
    freelancerIds = await User.find({
      organizationId: req.user.organizationId,
      role: 'freelancer',
    }).distinct('_id');
  } catch {
    return baseFilter;
  }
  if (!freelancerIds.length) return baseFilter;

  const { userIdStr, userIdObj } = userIdParts(req.user);
  const me = userIdObj ? [userIdObj, userIdStr] : [userIdStr];
  return {
    $and: [
      baseFilter,
      {
        $nor: [{
          createdBy: { $in: freelancerIds },
          'sharedWith.userId': { $nin: me },
        }],
      },
    ],
  };
}

function rejectFreelancerCompanyMail(req, res, next) {
  if (!isFreelancer(req.user)) return next();
  return res.status(403).json({
    success: false,
    code: 'FREELANCER_NATIVE_MAIL',
    message:
      'Freelance recruiters send email from their own mail app (Outlook, Mail, etc.). Company ZeptoMail and Zoho Campaigns are not available yet.',
  });
}

module.exports = {
  isFreelancer,
  userIdParts,
  rejectFreelancerCompanyMail,
  createdByFilter,
  jobOwnershipClauses,
  employeeDeskFilter,
  freelancerDeskFilter,
  deskOrSharedWithMe,
  spocOwnershipClauses,
  organizationIdMatch,
  orgOrOwnerScope,
  candidateWriteScope,
  masterDataScope,
  candidateListFilter,
  candidateResumeScope,
  candidateListScope,
  jobListFilter,
  applicationListFilter,
  MIS_COMPANY_ROLES,
  isMisCompanyRole,
  misListFilter,
  misWriteFilter,
  withoutUnsharedFreelancerDesks,
  ORG_WIDE_ANALYTICS_ROLES,
  canViewOrgAnalytics,
  requestedAnalyticsUserId,
  analyticsScope,
  analyticsScopeMeta,
  applicationAnalyticsScope,
  assertOrgEmployee,
};
