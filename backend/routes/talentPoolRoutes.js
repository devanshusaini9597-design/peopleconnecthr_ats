/**
 * Talent Pools — Add-on (feature key: candidates.talentPools)
 *
 * Silver-medalist / passive-candidate database, independent of any single
 * job requisition. Mounted at /api/talent-pools with verifyToken +
 * requireFeature('candidates.talentPools') applied in server.js, so every
 * route here can assume req.user.organizationId is present and entitled.
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TalentPool = require('../models/TalentPool');
const Candidate = require('../models/Candidate');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

// verifyToken is applied where this router is mounted (server.js); gate the
// whole router by plan entitlement here so every route below inherits it.
router.use(requireFeature('candidates.talentPools'));

// GET /api/talent-pools — list pools with live member counts
router.get('/', async (req, res) => {
  try {
    const pools = await TalentPool.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 }).lean();
    const counts = await Candidate.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(req.user.organizationId), talentPoolIds: { $exists: true, $ne: [] } } },
      { $unwind: '$talentPoolIds' },
      { $group: { _id: '$talentPoolIds', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map(c => [String(c._id), c.count]));
    const data = pools.map(p => ({ ...p, memberCount: countMap.get(String(p._id)) || 0 }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/talent-pools — create a pool
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, description = '', color = '#6366f1' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Pool name is required' });

    const pool = await TalentPool.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description,
      color,
      createdBy: req.user.id || req.user._id
    });
    res.status(201).json({ success: true, data: pool });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A talent pool with this name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/talent-pools/:id — rename / restyle a pool
router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, description, color, addOnReject, isDefaultRejectPool } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description;
    if (color !== undefined) update.color = color;

    // Automation flags require candidates.talentPoolAutomation
    if (addOnReject !== undefined || isDefaultRejectPool !== undefined) {
      const { planHasFeature } = require('../config/planFeatures');
      const Organization = require('../models/Organization');
      const org = await Organization.findById(req.user.organizationId).select('plan');
      if (!planHasFeature(org?.plan, 'candidates.talentPoolAutomation')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'Talent pool automation requires a Professional plan or higher.',
          feature: 'candidates.talentPoolAutomation'
        });
      }
      if (addOnReject !== undefined) update.addOnReject = !!addOnReject;
      if (isDefaultRejectPool !== undefined) update.isDefaultRejectPool = !!isDefaultRejectPool;
      if (update.isDefaultRejectPool) {
        await TalentPool.updateMany(
          { organizationId: req.user.organizationId, _id: { $ne: req.params.id } },
          { $set: { isDefaultRejectPool: false } }
        );
      }
    }

    const pool = await TalentPool.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    );
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });
    res.json({ success: true, data: pool });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/talent-pools/suggest — skill/keyword overlap suggestions
router.post('/suggest', requireRecruiterOrAbove, requireFeature('candidates.talentPoolAutomation'), async (req, res) => {
  try {
    const { skills = '', limit = 20 } = req.body;
    const terms = String(skills)
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15);

    if (!terms.length) {
      return res.status(400).json({ success: false, message: 'Provide skills keywords to match' });
    }

    const regexes = terms.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    const candidates = await Candidate.find({
      organizationId: req.user.organizationId,
      $or: [
        { skills: { $in: regexes } },
        { position: { $in: regexes } },
        { remark: { $in: regexes } }
      ]
    })
      .select('name email position skills experience location')
      .limit(Math.min(Number(limit) || 20, 50))
      .lean();

    const scored = candidates.map((c) => {
      const hay = `${c.skills || ''} ${c.position || ''}`.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t.toLowerCase())).length;
      return { ...c, matchScore: Math.round((hits / terms.length) * 100) };
    }).sort((a, b) => b.matchScore - a.matchScore);

    res.json({ success: true, data: scored });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/talent-pools/:id/campaign — enqueue outreach via sequences or inbox log
router.post('/:id/campaign', requireRecruiterOrAbove, requireFeature('candidates.talentPoolAutomation'), async (req, res) => {
  try {
    const { subject = '', body = '', channel = 'email', sequenceId } = req.body;
    const pool = await TalentPool.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    const members = await Candidate.find({
      organizationId: req.user.organizationId,
      talentPoolIds: pool._id
    }).select('_id name email');

    if (!members.length) {
      return res.status(400).json({ success: false, message: 'Pool has no members' });
    }

    // Prefer sequence enrollment when sequenceId provided + sequences entitled
    if (sequenceId) {
      const { planHasFeature } = require('../config/planFeatures');
      const Organization = require('../models/Organization');
      const org = await Organization.findById(req.user.organizationId).select('plan');
      if (!planHasFeature(org?.plan, 'messaging.sequences')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'Campaign via sequences requires messaging.sequences on your plan.',
          feature: 'messaging.sequences'
        });
      }
      const SequenceEnrollment = require('../models/SequenceEnrollment');
      const EmailSequence = require('../models/EmailSequence');
      const sequence = await EmailSequence.findOne({
        _id: sequenceId,
        organizationId: req.user.organizationId,
        isActive: true
      });
      if (!sequence) return res.status(404).json({ success: false, message: 'Sequence not found' });

      let enrolled = 0;
      for (const m of members) {
        try {
          await SequenceEnrollment.create({
            organizationId: req.user.organizationId,
            sequenceId: sequence._id,
            candidateId: m._id,
            status: 'active',
            currentStep: 0,
            nextSendAt: new Date(),
            enrolledBy: req.user.id || req.user._id
          });
          enrolled++;
        } catch { /* duplicate */ }
      }
      return res.json({ success: true, mode: 'sequence', enrolled, total: members.length });
    }

    if (!body.trim()) {
      return res.status(400).json({ success: false, message: 'body is required when not using a sequence' });
    }

    const { planHasFeature } = require('../config/planFeatures');
    const Organization = require('../models/Organization');
    const org = await Organization.findById(req.user.organizationId).select('plan');
    if (!planHasFeature(org?.plan, 'messaging.inbox')) {
      return res.status(403).json({
        success: false,
        code: 'UPGRADE_REQUIRED',
        message: 'Direct pool campaigns require messaging.inbox on your plan.',
        feature: 'messaging.inbox'
      });
    }

    // Create draft outbound threads (actual send goes through inbox API pattern)
    const MessageThread = require('../models/MessageThread');
    const Message = require('../models/Message');
    const { sendEmail } = require('../services/emailService');
    let sent = 0;
    let failed = 0;

    for (const m of members) {
      if (!m.email) { failed++; continue; }
      try {
        if (channel === 'email') {
          await sendEmail(
            m.email,
            subject || `Opportunity from our talent team`,
            `<p>${body.replace(/\n/g, '<br/>')}</p>`,
            body,
            { userId: req.user.id || req.user._id }
          );
        }
        let thread = await MessageThread.findOne({
          organizationId: req.user.organizationId,
          candidateId: m._id,
          archived: false
        }).sort({ lastMessageAt: -1 });
        if (!thread) {
          thread = await MessageThread.create({
            organizationId: req.user.organizationId,
            candidateId: m._id,
            subject: subject || `Talent pool: ${pool.name}`,
            channel: 'email',
            participants: { candidateName: m.name, candidateEmail: m.email },
            lastMessageAt: new Date(),
            lastMessagePreview: body.slice(0, 160),
            lastDirection: 'outbound',
            createdBy: req.user.id || req.user._id
          });
        }
        await Message.create({
          organizationId: req.user.organizationId,
          threadId: thread._id,
          candidateId: m._id,
          channel: 'email',
          direction: 'outbound',
          fromName: req.user.name || 'Recruiter',
          toAddress: m.email,
          subject,
          body,
          status: 'sent',
          isRead: true,
          sentBy: req.user.id || req.user._id
        });
        sent++;
      } catch {
        failed++;
      }
    }

    res.json({ success: true, mode: 'direct', sent, failed, total: members.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/talent-pools/:id — delete a pool and unlink it from candidates
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const pool = await TalentPool.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    await Candidate.updateMany(
      { organizationId: req.user.organizationId, talentPoolIds: pool._id },
      { $pull: { talentPoolIds: pool._id } }
    );

    res.json({ success: true, message: 'Talent pool deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/talent-pools/:id/candidates — list members of a pool
router.get('/:id/candidates', async (req, res) => {
  try {
    const pool = await TalentPool.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    const candidates = await Candidate.find({
      organizationId: req.user.organizationId,
      talentPoolIds: pool._id
    })
      .select('name email contact phone position location experience skills status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: { pool, candidates } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/talent-pools/:id/candidates — add one or more candidates to a pool
// body: { candidateIds: [ObjectId] }
router.post('/:id/candidates', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { candidateIds } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'candidateIds must be a non-empty array' });
    }

    const pool = await TalentPool.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    const orgCandidates = await Candidate.find({
      _id: { $in: candidateIds },
      organizationId: req.user.organizationId
    }).select('_id name talentPoolConsent');

    const optedOut = orgCandidates.filter((c) => c.talentPoolConsent && c.talentPoolConsent.optedIn === false);
    const allowedIds = orgCandidates
      .filter((c) => !(c.talentPoolConsent && c.talentPoolConsent.optedIn === false))
      .map((c) => c._id);

    if (allowedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No candidates added — all selected have opted out of talent-pool retention.',
        skipped: optedOut.map((c) => ({ id: c._id, name: c.name }))
      });
    }

    const result = await Candidate.updateMany(
      { _id: { $in: allowedIds }, organizationId: req.user.organizationId },
      { $addToSet: { talentPoolIds: pool._id } }
    );

    res.json({
      success: true,
      message: optedOut.length
        ? `${result.modifiedCount} added; ${optedOut.length} skipped (opted out of pool retention)`
        : `${result.modifiedCount} candidate(s) added to pool`,
      skipped: optedOut.map((c) => ({ id: c._id, name: c.name }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/talent-pools/:id/candidates/:candidateId — remove one candidate
router.delete('/:id/candidates/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const pool = await TalentPool.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!pool) return res.status(404).json({ success: false, message: 'Talent pool not found' });

    await Candidate.findOneAndUpdate(
      { _id: req.params.candidateId, organizationId: req.user.organizationId },
      { $pull: { talentPoolIds: pool._id } }
    );

    res.json({ success: true, message: 'Candidate removed from pool' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
