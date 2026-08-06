/**
 * Talent pools domain logic — silver-medalist / passive-candidate databases.
 */
const mongoose = require('mongoose');
const TalentPool = require('../models/TalentPool');
const Candidate = require('../models/Candidate');
const { planHasFeature } = require('../config/planFeatures');
const Organization = require('../models/Organization');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function listPools(organizationId) {
  const pools = await TalentPool.find({ organizationId }).sort({ createdAt: -1 }).lean();
  const counts = await Candidate.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), talentPoolIds: { $exists: true, $ne: [] } } },
    { $unwind: '$talentPoolIds' },
    { $group: { _id: '$talentPoolIds', count: { $sum: 1 } } }
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return pools.map((p) => ({ ...p, memberCount: countMap.get(String(p._id)) || 0 }));
}

async function createPool(organizationId, userId, { name, description = '', color = '#6366f1' }) {
  if (!name || !name.trim()) throw httpError('Pool name is required');
  try {
    return await TalentPool.create({
      organizationId,
      name: name.trim(),
      description,
      color,
      createdBy: userId
    });
  } catch (error) {
    if (error.code === 11000) throw httpError('A talent pool with this name already exists', 409);
    throw error;
  }
}

async function updatePool(organizationId, poolId, body) {
  const { name, description, color, addOnReject, isDefaultRejectPool } = body;
  const update = {};
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description;
  if (color !== undefined) update.color = color;

  if (addOnReject !== undefined || isDefaultRejectPool !== undefined) {
    const org = await Organization.findById(organizationId).select('plan');
    if (!planHasFeature(org?.plan, 'candidates.talentPoolAutomation')) {
      throw httpError('Talent pool automation requires a Professional plan or higher.', 403, {
        code: 'UPGRADE_REQUIRED',
        feature: 'candidates.talentPoolAutomation'
      });
    }
    if (addOnReject !== undefined) update.addOnReject = !!addOnReject;
    if (isDefaultRejectPool !== undefined) update.isDefaultRejectPool = !!isDefaultRejectPool;
    if (update.isDefaultRejectPool) {
      await TalentPool.updateMany(
        { organizationId, _id: { $ne: poolId } },
        { $set: { isDefaultRejectPool: false } }
      );
    }
  }

  const pool = await TalentPool.findOneAndUpdate(
    { _id: poolId, organizationId },
    { $set: update },
    { new: true }
  );
  if (!pool) throw httpError('Talent pool not found', 404);
  return pool;
}

async function suggestCandidates(organizationId, { skills = '', limit = 20 }) {
  const terms = String(skills)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);

  if (!terms.length) throw httpError('Provide skills keywords to match');

  const regexes = terms.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const candidates = await Candidate.find({
    organizationId,
    $or: [
      { skills: { $in: regexes } },
      { position: { $in: regexes } },
      { remark: { $in: regexes } }
    ]
  })
    .select('name email position skills experience location')
    .limit(Math.min(Number(limit) || 20, 50))
    .lean();

  return candidates.map((c) => {
    const hay = `${c.skills || ''} ${c.position || ''}`.toLowerCase();
    const hits = terms.filter((t) => hay.includes(t.toLowerCase())).length;
    return { ...c, matchScore: Math.round((hits / terms.length) * 100) };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

async function runCampaign(organizationId, user, poolId, { subject = '', body = '', channel = 'email', sequenceId }) {
  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  const members = await Candidate.find({
    organizationId,
    talentPoolIds: pool._id
  }).select('_id name email');

  if (!members.length) throw httpError('Pool has no members');

  if (sequenceId) {
    const org = await Organization.findById(organizationId).select('plan');
    if (!planHasFeature(org?.plan, 'messaging.sequences')) {
      throw httpError('Campaign via sequences requires messaging.sequences on your plan.', 403, {
        code: 'UPGRADE_REQUIRED',
        feature: 'messaging.sequences'
      });
    }
    const SequenceEnrollment = require('../models/SequenceEnrollment');
    const EmailSequence = require('../models/EmailSequence');
    const sequence = await EmailSequence.findOne({
      _id: sequenceId,
      organizationId,
      isActive: true
    });
    if (!sequence) throw httpError('Sequence not found', 404);

    let enrolled = 0;
    for (const m of members) {
      try {
        await SequenceEnrollment.create({
          organizationId,
          sequenceId: sequence._id,
          candidateId: m._id,
          status: 'active',
          currentStep: 0,
          nextSendAt: new Date(),
          enrolledBy: user.id || user._id
        });
        enrolled++;
      } catch { /* duplicate */ }
    }
    return { mode: 'sequence', enrolled, total: members.length };
  }

  if (!body.trim()) throw httpError('body is required when not using a sequence');

  const org = await Organization.findById(organizationId).select('plan');
  if (!planHasFeature(org?.plan, 'messaging.inbox')) {
    throw httpError('Direct pool campaigns require messaging.inbox on your plan.', 403, {
      code: 'UPGRADE_REQUIRED',
      feature: 'messaging.inbox'
    });
  }

  const MessageThread = require('../models/MessageThread');
  const Message = require('../models/Message');
  const { sendEmail } = require('./emailService');
  let sent = 0;
  let failed = 0;

  for (const m of members) {
    if (!m.email) { failed++; continue; }
    try {
      if (channel === 'email') {
        await sendEmail(
          m.email,
          subject || 'Opportunity from our talent team',
          `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          body,
          { userId: user.id || user._id }
        );
      }
      let thread = await MessageThread.findOne({
        organizationId,
        candidateId: m._id,
        archived: false
      }).sort({ lastMessageAt: -1 });
      if (!thread) {
        thread = await MessageThread.create({
          organizationId,
          candidateId: m._id,
          subject: subject || `Talent pool: ${pool.name}`,
          channel: 'email',
          participants: { candidateName: m.name, candidateEmail: m.email },
          lastMessageAt: new Date(),
          lastMessagePreview: body.slice(0, 160),
          lastDirection: 'outbound',
          createdBy: user.id || user._id
        });
      }
      await Message.create({
        organizationId,
        threadId: thread._id,
        candidateId: m._id,
        channel: 'email',
        direction: 'outbound',
        fromName: user.name || 'Recruiter',
        toAddress: m.email,
        subject,
        body,
        status: 'sent',
        isRead: true,
        sentBy: user.id || user._id
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return { mode: 'direct', sent, failed, total: members.length };
}

async function deletePool(organizationId, poolId) {
  const pool = await TalentPool.findOneAndDelete({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  await Candidate.updateMany(
    { organizationId, talentPoolIds: pool._id },
    { $pull: { talentPoolIds: pool._id } }
  );

  return { message: 'Talent pool deleted' };
}

async function listPoolCandidates(organizationId, poolId) {
  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  const candidates = await Candidate.find({
    organizationId,
    talentPoolIds: pool._id
  })
    .select('name email contact phone position location experience skills status createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return { pool, candidates };
}

async function addCandidates(organizationId, poolId, candidateIds) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    throw httpError('candidateIds must be a non-empty array');
  }

  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  const orgCandidates = await Candidate.find({
    _id: { $in: candidateIds },
    organizationId
  }).select('_id name talentPoolConsent');

  const optedOut = orgCandidates.filter((c) => c.talentPoolConsent && c.talentPoolConsent.optedIn === false);
  const allowedIds = orgCandidates
    .filter((c) => !(c.talentPoolConsent && c.talentPoolConsent.optedIn === false))
    .map((c) => c._id);

  if (allowedIds.length === 0) {
    throw httpError('No candidates added — all selected have opted out of talent-pool retention.', 400, {
      skipped: optedOut.map((c) => ({ id: c._id, name: c.name }))
    });
  }

  const result = await Candidate.updateMany(
    { _id: { $in: allowedIds }, organizationId },
    { $addToSet: { talentPoolIds: pool._id } }
  );

  return {
    message: optedOut.length
      ? `${result.modifiedCount} added; ${optedOut.length} skipped (opted out of pool retention)`
      : `${result.modifiedCount} candidate(s) added to pool`,
    skipped: optedOut.map((c) => ({ id: c._id, name: c.name }))
  };
}

async function removeCandidate(organizationId, poolId, candidateId) {
  const pool = await TalentPool.findOne({ _id: poolId, organizationId });
  if (!pool) throw httpError('Talent pool not found', 404);

  await Candidate.findOneAndUpdate(
    { _id: candidateId, organizationId },
    { $pull: { talentPoolIds: pool._id } }
  );

  return { message: 'Candidate removed from pool' };
}

module.exports = {
  listPools,
  createPool,
  updatePool,
  suggestCandidates,
  runCampaign,
  deletePool,
  listPoolCandidates,
  addCandidates,
  removeCandidate
};
