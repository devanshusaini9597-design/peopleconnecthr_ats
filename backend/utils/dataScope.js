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
 * Employee dashboard desk = SPOC name (with light typo tolerance)
 * plus own createdBy rows that have no SPOC yet.
 * Does NOT take createdBy rows stamped with another person's SPOC
 * (managers often import for teammates).
 */
function employeeDeskFilter(user, organizationId) {
  if (isFreelancer(user)) {
    const own = createdByFilter(user);
    const orgMatch = organizationIdMatch(organizationId);
    return orgMatch ? { ...orgMatch, ...own } : own;
  }

  const spocClauses = spocOwnershipClauses(user);
  const deskOr = [];
  if (spocClauses.length) deskOr.push({ $or: spocClauses });
  deskOr.push(blankSpocCreatedByClause(user));

  const desk = deskOr.length === 1 ? deskOr[0] : { $or: deskOr };

  const orgMatch = organizationIdMatch(organizationId);
  if (!orgMatch) return desk;

  return {
    $and: [
      desk,
      {
        $or: [
          orgMatch,
          { organizationId: { $exists: false } },
          { organizationId: null },
        ],
      },
    ],
  };
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
 * - Recruiter / sales: always SPOC-name desk for that user.
 * - Owner / admin / HR manager: organization totals by default;
 *   with ?userId= → that person's SPOC-name desk (any role).
 */
async function analyticsScope(req) {
  const user = req.user || {};
  const requestedId = requestedAnalyticsUserId(req);

  if (!canViewOrgAnalytics(user)) {
    return employeeDeskFilter(user, user.organizationId);
  }

  if (!requestedId) {
    const orgMatch = organizationIdMatch(user.organizationId);
    return orgMatch || employeeDeskFilter(user, null);
  }

  // Self or another teammate — same SPOC desk rule for every role
  if (String(requestedId) === String(user.id || user._id || '')) {
    return employeeDeskFilter(user, user.organizationId);
  }

  if (!user.organizationId) {
    throw scopeError('Employee filter requires an organization', 400);
  }

  const target = await assertOrgEmployee(user.organizationId, requestedId);
  return employeeDeskFilter(
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

/**
 * Candidate list filter.
 * Freelancer always own-only (view=all is ignored).
 * Other roles: view=all → org; shared → sharedWith; else SPOC desk OR shared with me
 * (so hiring-manager SPOCs see freelancer handoffs without switching views).
 */
function candidateListFilter(req, viewMode) {
  const user = req.user || {};
  const own = createdByFilter(user);
  const { userIdStr, userIdObj } = userIdParts(user);
  const sharedClause = userIdObj
    ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
    : { 'sharedWith.userId': userIdStr };

  if (isFreelancer(user)) {
    const { userIdStr, userIdObj } = userIdParts(user);
    const notHidden = userIdObj
      ? { hiddenFromFreelancerIds: { $nin: [userIdObj, userIdStr] } }
      : { hiddenFromFreelancerIds: { $nin: [userIdStr] } };
    const base = user.organizationId
      ? { organizationId: user.organizationId, ...own }
      : own;
    return { ...base, ...notHidden };
  }

  if (viewMode === 'all') {
    return user.organizationId ? { organizationId: user.organizationId } : own;
  }
  if (viewMode === 'shared') {
    return user.organizationId
      ? { organizationId: user.organizationId, ...sharedClause }
      : sharedClause;
  }
  // mine / default — SPOC desk + candidates shared with this user (freelancer handoffs)
  return deskOrSharedWithMe(user, user.organizationId);
}

/** SPOC desk OR rows explicitly shared with this user. */
function deskOrSharedWithMe(user, organizationId) {
  const desk = employeeDeskFilter(user, organizationId);
  const { userIdStr, userIdObj } = userIdParts(user);
  const shared = userIdObj
    ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
    : { 'sharedWith.userId': userIdStr };
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
 * Managers may pass ?userId= to load that employee's SPOC desk (same as analytics).
 */
async function candidateListScope(req, viewMode) {
  const user = req.user || {};

  if (isFreelancer(user)) {
    return candidateListFilter(req, viewMode);
  }

  if (canViewOrgAnalytics(user)) {
    const requestedId = requestedAnalyticsUserId(req);
    if (requestedId) {
      if (String(requestedId) === String(user.id || user._id || '')) {
        return deskOrSharedWithMe(user, user.organizationId);
      }
      if (!user.organizationId) {
        throw scopeError('Employee filter requires an organization', 400);
      }
      const target = await assertOrgEmployee(user.organizationId, requestedId);
      return deskOrSharedWithMe(
        { id: target._id, role: target.role, name: target.name, email: target.email },
        user.organizationId
      );
    }

    if (viewMode === 'all' || !viewMode) {
      // Owner / admin / manager: full organization, including all freelancer candidates
      return organizationIdMatch(user.organizationId) || createdByFilter(user);
    }
    if (viewMode === 'shared') {
      const { userIdStr, userIdObj } = userIdParts(user);
      const shared = userIdObj
        ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
        : { 'sharedWith.userId': userIdStr };
      return user.organizationId
        ? { organizationId: user.organizationId, ...shared }
        : shared;
    }
    // Manager "mine" = own desk + shared handoffs
    return deskOrSharedWithMe(user, user.organizationId);
  }

  // Recruiters: desk + sharedWith (freelancer → hiring-manager handoffs). Never full org.
  if (viewMode === 'shared') {
    const { userIdStr, userIdObj } = userIdParts(user);
    const shared = userIdObj
      ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
      : { 'sharedWith.userId': userIdStr };
    return user.organizationId
      ? { organizationId: user.organizationId, ...shared }
      : shared;
  }
  return deskOrSharedWithMe(user, user.organizationId);
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

/** Applications: freelancer sees only rows they submitted. */
function applicationListFilter(organizationId, user, extra = {}) {
  const filter = { organizationId, ...extra };
  if (isFreelancer(user)) {
    filter['metadata.submittedBy'] = String(user.id || user._id);
  }
  return filter;
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

  const User = require('../models/User');
  const freelancerIds = await User.find({
    organizationId: req.user.organizationId,
    role: 'freelancer',
  }).distinct('_id');
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
  employeeDeskFilter,
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
  withoutUnsharedFreelancerDesks,
  ORG_WIDE_ANALYTICS_ROLES,
  canViewOrgAnalytics,
  requestedAnalyticsUserId,
  analyticsScope,
  analyticsScopeMeta,
  applicationAnalyticsScope,
  assertOrgEmployee,
};
