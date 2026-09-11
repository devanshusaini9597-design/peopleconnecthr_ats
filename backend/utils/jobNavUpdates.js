/**
 * Sidebar “new job” badge — same model as Announcements:
 * an Open job is unseen until this user is in job.seenBy (set on Jobs visit).
 */
const mongoose = require('mongoose');

const RECENT_UNSEEN_MS = 14 * 24 * 60 * 60 * 1000;

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  try {
    const s = String(value).trim();
    if (/^[a-fA-F0-9]{24}$/.test(s)) return new mongoose.Types.ObjectId(s);
  } catch {
    /* ignore */
  }
  return null;
}

/** Match org id whether stored as ObjectId or string. */
function organizationIdFilter(organizationId) {
  if (!organizationId) return {};
  const orgStr = String(organizationId).trim();
  const orgObj = asObjectId(organizationId);
  if (orgObj) return { organizationId: { $in: [orgObj, orgStr] } };
  return { organizationId: orgStr };
}

function openJobsSinceFilter(organizationId, since) {
  const when = since instanceof Date ? since : new Date(since);
  return {
    ...organizationIdFilter(organizationId),
    status: 'Open',
    isTemplate: { $ne: true },
    $or: [
      { createdAt: { $gt: when } },
      { openedAt: { $gt: when } },
    ],
  };
}

function userIdVariants(userId) {
  const str = String(userId || '').trim();
  const oid = asObjectId(userId);
  const ids = [];
  if (oid) ids.push(oid);
  if (str) ids.push(str);
  return ids;
}

/** Announcements-style: array field does not contain this user (ObjectId or string). */
function notSeenByClauses(userId) {
  return userIdVariants(userId).map((id) => ({ seenBy: { $ne: id } }));
}

function postedAfterClause(since) {
  const when = since instanceof Date ? since : new Date(since);
  return {
    $or: [
      { createdAt: { $gt: when } },
      { openedAt: { $gt: when } },
    ],
  };
}

function postedByOrAtClause(seenAt) {
  const when = seenAt instanceof Date ? seenAt : new Date(seenAt);
  return {
    $or: [
      { createdAt: { $lte: when } },
      { openedAt: { $lte: when } },
    ],
  };
}

/**
 * Open jobs this user has not seen yet.
 * Cutoff is last Jobs visit; if they have never opened Jobs, last 14 days.
 */
function unseenOpenJobsFilter(organizationId, userId, jobsLastSeenAt) {
  const since = jobsLastSeenAt
    ? new Date(jobsLastSeenAt)
    : new Date(Date.now() - RECENT_UNSEEN_MS);

  return {
    ...organizationIdFilter(organizationId),
    status: 'Open',
    isTemplate: { $ne: true },
    $and: [
      ...notSeenByClauses(userId),
      postedAfterClause(since),
    ],
  };
}

/** Jobs that were already open when the user opened Jobs — do not stamp jobs posted during this visit. */
function markOpenJobsSeenFilter(organizationId, userId, seenAt) {
  return {
    ...organizationIdFilter(organizationId),
    status: 'Open',
    isTemplate: { $ne: true },
    $and: [
      ...notSeenByClauses(userId),
      postedByOrAtClause(seenAt),
    ],
  };
}

function isNewlyOpenTransition(previousStatus, nextStatus) {
  const was = String(previousStatus || '').trim().toLowerCase();
  const next = String(nextStatus || '').trim().toLowerCase();
  return next === 'open' && was !== 'open';
}

/** Bump sidebar fallback counter for every active org member (including the poster). */
async function incrementOrgJobUnseen(organizationId) {
  if (!organizationId) return 0;
  const User = require('../models/User');
  const { organizationIdMatch } = require('./dataScope');
  const logger = require('./logger');
  const orgClause = organizationIdMatch(organizationId);
  if (!orgClause) return 0;
  const result = await User.updateMany(
    {
      ...orgClause,
      isActive: { $ne: false },
    },
    { $inc: { jobsUnseenCount: 1 } }
  );
  const n = Number(result.modifiedCount || result.matchedCount || 0);
  if (!n) {
    logger.warn('[jobs] incrementOrgJobUnseen matched 0 users', {
      orgId: String(organizationId),
    });
  }
  return n;
}

async function countUnseenOpenJobs({ organizationId, userId, jobsLastSeenAt }) {
  const Job = require('../models/Job');
  const filter = unseenOpenJobsFilter(organizationId, userId, jobsLastSeenAt);
  let q = Job.countDocuments(filter);
  if (organizationId && typeof q.setOptions === 'function') {
    q = q.setOptions({ _tenantId: organizationId });
  }
  return q;
}

/** userId may be stored as ObjectId or string depending on write path. */
function userIdFilter(userId) {
  const str = String(userId || '').trim();
  const oid = asObjectId(userId);
  if (oid) return { userId: { $in: [oid, str] } };
  return { userId: str };
}

module.exports = {
  openJobsSinceFilter,
  unseenOpenJobsFilter,
  markOpenJobsSeenFilter,
  isNewlyOpenTransition,
  incrementOrgJobUnseen,
  countUnseenOpenJobs,
  asObjectId,
  organizationIdFilter,
  userIdFilter,
  userIdVariants,
  RECENT_UNSEEN_MS,
};
