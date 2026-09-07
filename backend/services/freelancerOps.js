/**
 * Enterprise desk ops for freelance handoffs:
 * SLA aging, duplicates, reassign SPOC, bulk actions, quality checklist,
 * capacity, audit trail, hard delete, quick-edit candidate.
 */
const User = require('../models/User');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Organization = require('../models/Organization');
const Notification = require('../models/Notification');
const FreelancerSubmission = require('../models/FreelancerSubmission');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const { isFreelancer } = require('../utils/dataScope');
const { findOrgPhoneConflict } = require('./dedupeService');
const logger = require('../utils/logger');

const SPOC_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];
const LEADERSHIP = ['owner', 'admin', 'hr_manager'];
const HARD_DELETE_ROLES = ['owner', 'admin'];

const DEFAULT_DESK = {
  slaDays: 3,
  // 0 = unlimited — freelancers may submit without a per-mandate cap
  maxSubmissionsPerMandate: 0,
  requireResume: false,
  requireNote: false,
  requireNoticePeriod: false,
  requireExpectedCtc: false,
};

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function asId(ref) {
  if (!ref) return '';
  if (typeof ref === 'object' && ref._id) return String(ref._id);
  return String(ref);
}

function submissionScopeQuery(user, id) {
  const query = { _id: id, organizationId: user.organizationId };
  if (isFreelancer(user)) {
    query.freelancerId = user.id;
  } else if (!LEADERSHIP.includes(user.role)) {
    query.spocUserId = user.id;
  }
  return query;
}

async function loadDeskSettings(organizationId) {
  const org = await Organization.findById(organizationId).select('atsSettings.freelanceDesk').lean();
  const raw = org?.atsSettings?.freelanceDesk || {};
  return {
    slaDays: Number(raw.slaDays) > 0 ? Number(raw.slaDays) : DEFAULT_DESK.slaDays,
    maxSubmissionsPerMandate: Number.isFinite(Number(raw.maxSubmissionsPerMandate))
      ? Number(raw.maxSubmissionsPerMandate)
      : DEFAULT_DESK.maxSubmissionsPerMandate,
    requireResume: raw.requireResume === true,
    requireNote: Boolean(raw.requireNote),
    requireNoticePeriod: Boolean(raw.requireNoticePeriod),
    requireExpectedCtc: Boolean(raw.requireExpectedCtc),
  };
}

function buildQuality(candidate, note, settings) {
  const hasResume = Boolean(candidate?.resume || candidate?.resumeText);
  const hasNote = Boolean(String(note || '').trim());
  const hasNotice = Boolean(String(candidate?.noticePeriod || '').trim());
  const hasExpectedCtc = Boolean(String(candidate?.expectedCtc || candidate?.ctc || '').trim());
  const missing = [];
  if (settings.requireResume && !hasResume) missing.push('resume');
  if (settings.requireNote && !hasNote) missing.push('note');
  if (settings.requireNoticePeriod && !hasNotice) missing.push('noticePeriod');
  if (settings.requireExpectedCtc && !hasExpectedCtc) missing.push('expectedCtc');
  return {
    hasResume,
    hasNote,
    hasNotice,
    hasExpectedCtc,
    missing,
    complete: missing.length === 0,
  };
}

function agingDays(createdAt) {
  if (!createdAt) return 0;
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function enrichAging(row, slaDays) {
  const days = agingDays(row.createdAt);
  const awaiting = !row.archivedAt && ['submitted', 'reviewing'].includes(row.status);
  return {
    ...row,
    agingDays: days,
    slaDays,
    slaBreached: awaiting && days >= slaDays,
  };
}

async function writeAudit(user, action, resourceId, details = {}) {
  try {
    await AuditLog.create({
      organizationId: user.organizationId,
      userId: user.id,
      action,
      resource: 'freelancer_submission',
      resourceId: resourceId || undefined,
      details,
    });
  } catch (err) {
    logger.warn({ err }, 'Freelance desk audit write failed');
  }
}

function historyPush(submission, user, action, meta = {}) {
  submission.history = submission.history || [];
  submission.history.push({
    action,
    at: new Date(),
    by: user.id,
    byName: user.name || user.email || '',
    meta,
  });
  if (submission.history.length > 80) {
    submission.history = submission.history.slice(-80);
  }
}

async function findDuplicateCandidates(organizationId, candidate, { excludeId } = {}) {
  const email = String(candidate?.email || '').trim().toLowerCase();
  const phone = String(candidate?.contact || candidate?.phone || '').trim();
  const matches = [];
  if (email) {
    const byEmail = await Candidate.find({
      organizationId,
      email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select('_id name email contact phone createdBy').limit(8).lean();
    for (const row of byEmail) {
      matches.push({
        _id: row._id,
        name: row.name,
        email: row.email,
        contact: row.contact || row.phone || '',
        matchOn: 'email',
      });
    }
  }
  if (phone) {
    try {
      const conflict = await findOrgPhoneConflict(organizationId, phone, { excludeId });
      if (conflict?._id && !matches.some((m) => String(m._id) === String(conflict._id))) {
        matches.push({
          _id: conflict._id,
          name: conflict.name,
          email: conflict.email,
          contact: conflict.contact || conflict.phone || phone,
          matchOn: 'phone',
        });
      }
    } catch {
      /* phone helper optional */
    }
  }
  return matches;
}

async function assertCapacity(user, jobId, settings) {
  // Capacity limits are disabled product-wide (unlimited submissions).
  // Still report usage for optional analytics; never block.
  const used = await FreelancerSubmission.countDocuments({
    organizationId: user.organizationId,
    jobId,
    freelancerId: user.id,
    archivedAt: null,
  });
  return { used, max: 0, remaining: null, unlimited: true };
}

async function validateBeforeSubmit(user, { candidate, jobId, note }) {
  const settings = await loadDeskSettings(user.organizationId);
  const quality = buildQuality(candidate, note, settings);
  if (!quality.complete) {
    throw httpError(
      `Submission incomplete. Missing: ${quality.missing.join(', ')}`,
      400,
      { code: 'QUALITY', missing: quality.missing, quality }
    );
  }
  // Never enforce a submission cap — freelancers can send freely.
  const capacity = await assertCapacity(user, jobId, settings);
  const duplicates = await findDuplicateCandidates(user.organizationId, candidate, {
    excludeId: candidate._id,
  });
  // Hard block: never overwrite / re-add an existing company ATS profile.
  if (duplicates.length) {
    throw httpError(
      'This candidate is already available in the company ATS. The profile was not overwritten or added again. The hiring team has been notified that a freelancer shared a candidate who already exists.',
      409,
      { code: 'DUPLICATE', duplicates, quality, capacity, blocked: true }
    );
  }
  return { settings, quality, capacity, duplicates };
}

async function listReviewers(user) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);
  const people = await User.find({
    organizationId: user.organizationId,
    role: { $in: SPOC_ROLES },
    isActive: { $ne: false },
  }).select('_id name email role profilePicture').sort({ name: 1 }).lean();

  return people.map((p) => ({
    _id: String(p._id),
    name: p.name || '',
    email: p.email || '',
    role: p.role || '',
    profilePicture: p.profilePicture || '',
  }));
}

async function reassignSpoc(user, id, spocUserId) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);
  if (!spocUserId) throw httpError('spocUserId is required');

  const next = await User.findOne({
    _id: spocUserId,
    organizationId: user.organizationId,
    role: { $in: SPOC_ROLES },
    isActive: { $ne: false },
  }).select('_id name email role').lean();
  if (!next) throw httpError('Hiring manager not found', 404);

  const query = { ...submissionScopeQuery(user, id), archivedAt: null };
  const submission = await FreelancerSubmission.findOne(query)
    .populate('spocUserId', 'name email role')
    .populate('candidateId', 'name');
  if (!submission) throw httpError('Submission not found', 404);

  const prevId = asId(submission.spocUserId);
  const prevName = submission.spocUserId?.name
    || submission.spocUserId?.email
    || 'Previous SPOC';
  if (prevId === String(next._id)) {
    return FreelancerSubmission.findById(submission._id)
      .populate('candidateId', 'name email contact position resume noticePeriod expectedCtc ctc phone')
      .populate('jobId', 'title role location jobCode clientName')
      .populate('freelancerId', 'name email lastActiveAt lastLoginAt profilePicture')
      .populate('spocUserId', 'name email role phone');
  }

  submission.spocUserId = next._id;
  submission.reviewedAt = new Date();
  submission.reviewedBy = user.id;
  historyPush(submission, user, 'reassign_spoc', {
    from: prevId,
    fromName: prevName,
    to: String(next._id),
    toName: next.name || next.email || 'New SPOC',
  });
  await submission.save();
  await writeAudit(user, 'freelancer.reassign_spoc', submission._id, {
    from: prevId,
    fromName: prevName,
    to: String(next._id),
    toName: next.name || next.email,
  });

  if (submission.applicationId) {
    try {
      await Application.updateOne(
        { _id: submission.applicationId, organizationId: user.organizationId },
        { $set: { assignedTo: next._id } }
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to sync application assignee after SPOC reassign');
    }
  }

  const candidateName = submission.candidateId?.name || 'a candidate';
  const actorName = user.name || user.email || 'A teammate';

  // New SPOC gains the handoff
  try {
    await Notification.create({
      userId: next._id,
      senderId: user.id,
      senderName: actorName,
      type: 'freelancer_submission',
      title: `Handoff reassigned to you · ${candidateName}`,
      message: `${actorName} moved ${candidateName} to your freelance review desk.`,
      candidateId: submission.candidateId?._id || submission.candidateId,
      candidateName,
      priority: 'high',
      actionRequired: true,
      status: 'pending',
    });
  } catch (err) {
    logger.warn({ err }, 'Reassign notification (new SPOC) failed');
  }

  // Old SPOC loses the handoff — enterprise handoff transfer notice
  if (prevId && prevId !== String(user.id)) {
    try {
      await Notification.create({
        userId: prevId,
        senderId: user.id,
        senderName: actorName,
        type: 'freelancer_submission',
        title: `Handoff moved off your desk · ${candidateName}`,
        message: `${actorName} reassigned ${candidateName} to ${next.name || next.email}. You no longer own this review.`,
        candidateId: submission.candidateId?._id || submission.candidateId,
        candidateName,
        priority: 'medium',
        actionRequired: false,
        status: 'pending',
      });
    } catch (err) {
      logger.warn({ err }, 'Reassign notification (old SPOC) failed');
    }
  }

  return FreelancerSubmission.findById(submission._id)
    .populate('candidateId', 'name email contact position resume noticePeriod expectedCtc ctc phone')
    .populate('jobId', 'title role location jobCode clientName')
    .populate('freelancerId', 'name email lastActiveAt lastLoginAt profilePicture')
    .populate('spocUserId', 'name email role phone');
}

async function bulkDeskAction(user, body = {}) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean).slice(0, 50) : [];
  const action = String(body.action || '').toLowerCase();
  const allowed = ['archive', 'restore', 'submitted', 'reviewing', 'shortlisted', 'selection', 'joined', 'rejected'];
  if (!ids.length) throw httpError('Select at least one handoff');
  if (!allowed.includes(action)) throw httpError('Invalid bulk action');

  const results = { ok: [], failed: [] };
  const { updateSubmissionStatus, archiveSubmission, restoreSubmission } = require('./freelancerService');

  for (const id of ids) {
    try {
      let row;
      if (action === 'archive') row = await archiveSubmission(user, id);
      else if (action === 'restore') row = await restoreSubmission(user, id);
      else {
        row = await updateSubmissionStatus(user, id, {
          status: action,
          feedback: body.feedback,
        });
      }
      results.ok.push({ id, status: row.status, archivedAt: row.archivedAt || null });
    } catch (err) {
      results.failed.push({ id, message: err.message || 'Failed' });
    }
  }
  await writeAudit(user, `freelancer.bulk_${action}`, null, {
    count: results.ok.length,
    failed: results.failed.length,
    ids,
  });
  return results;
}

async function hardDeleteSubmission(user, id, { deleteCandidate = false } = {}) {
  if (!HARD_DELETE_ROLES.includes(user.role)) {
    throw httpError('Only owners and admins can permanently delete handoffs', 403);
  }
  const submission = await FreelancerSubmission.findOne({
    _id: id,
    organizationId: user.organizationId,
  });
  if (!submission) throw httpError('Submission not found', 404);

  const candidateId = submission.candidateId;
  const applicationId = submission.applicationId;
  await FreelancerSubmission.deleteOne({ _id: submission._id });
  await writeAudit(user, 'freelancer.hard_delete', submission._id, {
    candidateId,
    applicationId,
    deleteCandidate: Boolean(deleteCandidate),
  });

  if (applicationId) {
    try {
      await Application.deleteOne({
        _id: applicationId,
        organizationId: user.organizationId,
        'metadata.freelancerSubmission': true,
      });
    } catch (err) {
      logger.warn({ err }, 'Hard delete application cleanup failed');
    }
  }

  if (deleteCandidate && candidateId) {
    const other = await FreelancerSubmission.countDocuments({
      organizationId: user.organizationId,
      candidateId,
    });
    if (other === 0) {
      await Candidate.deleteOne({ _id: candidateId, organizationId: user.organizationId });
      await writeAudit(user, 'freelancer.hard_delete_candidate', candidateId, {});
    }
  }

  return { deleted: true, candidateDeleted: Boolean(deleteCandidate) };
}

async function updateCandidateFromDesk(user, submissionId, body = {}) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);
  const query = { ...submissionScopeQuery(user, submissionId), archivedAt: null };
  const submission = await FreelancerSubmission.findOne(query);
  if (!submission) throw httpError('Submission not found', 404);

  const candidate = await Candidate.findOne({
    _id: submission.candidateId,
    organizationId: user.organizationId,
  });
  if (!candidate) throw httpError('Candidate not found', 404);

  const allowed = ['name', 'email', 'contact', 'phone', 'position', 'noticePeriod', 'expectedCtc', 'ctc', 'location', 'companyName'];
  const changes = {};
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    const next = typeof body[key] === 'string' ? body[key].trim() : body[key];
    if (String(candidate[key] || '') === String(next || '')) continue;
    changes[key] = { from: candidate[key] || '', to: next || '' };
    candidate[key] = next;
  }
  if (!Object.keys(changes).length) {
    return {
      candidate,
      submission,
    };
  }

  await candidate.save();
  submission.candidateSnapshot = {
    name: candidate.name || '',
    email: candidate.email || '',
    contact: candidate.contact || candidate.phone || '',
    position: candidate.position || '',
  };
  historyPush(submission, user, 'edit_candidate', { fields: Object.keys(changes) });
  await submission.save();
  await writeAudit(user, 'freelancer.edit_candidate', submission._id, { changes });

  return {
    candidate,
    submission: await FreelancerSubmission.findById(submission._id)
      .populate('candidateId', 'name email contact position resume noticePeriod expectedCtc ctc phone location companyName')
      .populate('jobId', 'title role location jobCode clientName')
      .populate('freelancerId', 'name email lastActiveAt lastLoginAt profilePicture')
      .populate('spocUserId', 'name email role phone'),
  };
}

async function getPlacementStats(user) {
  const match = { organizationId: new mongoose.Types.ObjectId(user.organizationId) };
  if (isFreelancer(user)) {
    match.freelancerId = new mongoose.Types.ObjectId(user.id);
  } else if (!LEADERSHIP.includes(user.role)) {
    match.spocUserId = new mongoose.Types.ObjectId(user.id);
  }

  const rows = await FreelancerSubmission.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$freelancerId',
        total: { $sum: 1 },
        submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
        reviewing: { $sum: { $cond: [{ $eq: ['$status', 'reviewing'] }, 1, 0] } },
        shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] } },
        selection: { $sum: { $cond: [{ $eq: ['$status', 'selection'] }, 1, 0] } },
        joined: { $sum: { $cond: [{ $eq: ['$status', 'joined'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        archived: { $sum: { $cond: [{ $ne: ['$archivedAt', null] }, 1, 0] } },
      },
    },
  ]);

  const ids = rows.map((r) => r._id).filter(Boolean);
  const people = await User.find({ _id: { $in: ids } }).select('name email profilePicture').lean();
  const byId = new Map(people.map((p) => [String(p._id), p]));

  const desks = rows.map((r) => {
    const person = byId.get(String(r._id)) || {};
    const progress = (r.shortlisted || 0) + (r.selection || 0) + (r.joined || 0);
    const conversion = r.total ? Math.round((progress / r.total) * 100) : 0;
    return {
      freelancerId: r._id,
      name: person.name || person.email || 'Freelance recruiter',
      email: person.email || '',
      profilePicture: person.profilePicture || '',
      total: r.total,
      submitted: r.submitted,
      reviewing: r.reviewing,
      shortlisted: progress,
      selection: r.selection,
      joined: r.joined,
      rejected: r.rejected,
      archived: r.archived,
      conversionRate: conversion,
    };
  }).sort((a, b) => b.shortlisted - a.shortlisted || b.total - a.total);

  const totals = desks.reduce((acc, d) => {
    acc.total += d.total;
    acc.shortlisted += d.shortlisted;
    acc.rejected += d.rejected;
    return acc;
  }, { total: 0, shortlisted: 0, rejected: 0 });

  return {
    desks,
    totals: {
      ...totals,
      conversionRate: totals.total ? Math.round((totals.shortlisted / totals.total) * 100) : 0,
    },
  };
}

async function getDeskSettingsForUser(user) {
  return loadDeskSettings(user.organizationId);
}

async function getMandateCapacity(user, jobId) {
  const settings = await loadDeskSettings(user.organizationId);
  const used = await FreelancerSubmission.countDocuments({
    organizationId: user.organizationId,
    jobId,
    freelancerId: user.id,
    archivedAt: null,
  });
  // Product policy: unlimited submissions per mandate (no remaining / max cap).
  return {
    used,
    max: 0,
    remaining: null,
    unlimited: true,
    settings: { ...settings, maxSubmissionsPerMandate: 0 },
  };
}

async function previewSubmissionQuality(user, { candidateId, note }) {
  const candidate = await Candidate.findOne({
    _id: candidateId,
    organizationId: user.organizationId,
  }).lean();
  if (!candidate) throw httpError('Candidate not found', 404);
  const settings = await loadDeskSettings(user.organizationId);
  const quality = buildQuality(candidate, note, settings);
  const duplicates = await findDuplicateCandidates(user.organizationId, candidate, {
    excludeId: candidate._id,
  });
  return { quality, duplicates, settings };
}

module.exports = {
  DEFAULT_DESK,
  loadDeskSettings,
  buildQuality,
  agingDays,
  enrichAging,
  writeAudit,
  historyPush,
  findDuplicateCandidates,
  validateBeforeSubmit,
  listReviewers,
  reassignSpoc,
  bulkDeskAction,
  hardDeleteSubmission,
  updateCandidateFromDesk,
  getPlacementStats,
  getDeskSettingsForUser,
  getMandateCapacity,
  previewSubmissionQuality,
  submissionScopeQuery,
};
