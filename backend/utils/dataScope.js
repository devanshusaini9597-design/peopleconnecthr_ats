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
 * Candidate list filter.
 * Freelancer always own-only (view=all is ignored).
 * Other roles: view=all → org; shared → sharedWith; else own+shared.
 */
function candidateListFilter(req, viewMode) {
  const user = req.user || {};
  const own = createdByFilter(user);
  const { userIdStr, userIdObj } = userIdParts(user);
  const sharedClause = userIdObj
    ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
    : { 'sharedWith.userId': userIdStr };

  if (isFreelancer(user)) {
    return user.organizationId
      ? { organizationId: user.organizationId, ...own }
      : own;
  }

  if (viewMode === 'all') {
    return user.organizationId ? { organizationId: user.organizationId } : own;
  }
  if (viewMode === 'shared') {
    return sharedClause;
  }
  return { $or: [own, sharedClause] };
}

/** Jobs: freelancer sees Open (non-template) mandates only. */
function jobListFilter(req, { isTemplate } = {}) {
  const user = req.user || {};
  const baseFilter = user.organizationId ? { organizationId: user.organizationId } : {};
  if (isTemplate === 'true') {
    return { ...baseFilter, isTemplate: true };
  }
  const nonTemplate = {
    ...baseFilter,
    $or: [{ isTemplate: false }, { isTemplate: { $exists: false } }],
  };
  if (isFreelancer(user)) {
    return { ...nonTemplate, status: 'Open' };
  }
  return nonTemplate;
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
 * Company ATS must not list a freelancer's private desk until that
 * candidate is shared with the viewer (SPOC handoff).
 */
async function withoutUnsharedFreelancerDesks(req, baseFilter) {
  if (isFreelancer(req.user) || !req.user?.organizationId || !baseFilter) {
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

module.exports = {
  isFreelancer,
  createdByFilter,
  orgOrOwnerScope,
  masterDataScope,
  candidateListFilter,
  jobListFilter,
  applicationListFilter,
  withoutUnsharedFreelancerDesks,
};
