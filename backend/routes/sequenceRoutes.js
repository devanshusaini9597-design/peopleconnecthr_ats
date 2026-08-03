/**
 * Outreach sequences — Professional+ (messaging.sequences)
 */

const express = require('express');
const router = express.Router();
const EmailSequence = require('../models/EmailSequence');
const SequenceEnrollment = require('../models/SequenceEnrollment');
const Candidate = require('../models/Candidate');
const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { sendEmail } = require('../services/emailService');
const { getAdapter } = require('../adapters');

router.use(requireFeature('messaging.sequences'));

function interpolate(text, candidate) {
  if (!text) return '';
  return text
    .replace(/\{\{candidateName\}\}/gi, candidate?.name || 'there')
    .replace(/\{\{name\}\}/gi, candidate?.name || 'there')
    .replace(/\{\{email\}\}/gi, candidate?.email || '')
    .replace(/\{\{position\}\}/gi, candidate?.position || '');
}

async function sendStep(orgId, candidate, step, user) {
  const channel = step.channel || 'email';
  const body = interpolate(step.body, candidate);
  const subject = interpolate(step.subject || 'Follow-up', candidate);
  const toAddress = channel === 'email'
    ? candidate.email
    : (candidate.contact || candidate.phone);

  if (!toAddress) throw new Error('Candidate has no contact for this channel');

  const consent = candidate.messagingConsent || {};
  if (channel === 'email' && consent.email === false) throw new Error('No email consent');
  if (channel === 'sms' && !consent.sms) throw new Error('No SMS consent');
  if (channel === 'whatsapp' && !consent.whatsapp) throw new Error('No WhatsApp consent');

  if (channel === 'email') {
    await sendEmail(
      toAddress,
      subject,
      `<p>${body.replace(/\n/g, '<br/>')}</p>`,
      body,
      { userId: user?.id || user?._id }
    );
  } else if (channel === 'sms') {
    const adapter = await getAdapter(orgId, 'sms');
    if (!adapter) throw new Error('SMS not configured');
    await adapter.send({ to: toAddress, message: body });
  } else if (channel === 'whatsapp') {
    const adapter = await getAdapter(orgId, 'whatsapp');
    if (!adapter) throw new Error('WhatsApp not configured');
    if (typeof adapter.sendWhatsApp === 'function') {
      await adapter.sendWhatsApp({ to: toAddress, message: body });
    } else {
      await adapter.send({ to: toAddress, message: body });
    }
  }

  // Log into inbox if available
  try {
    let thread = await MessageThread.findOne({
      organizationId: orgId,
      candidateId: candidate._id,
      archived: false
    }).sort({ lastMessageAt: -1 });

    if (!thread) {
      thread = await MessageThread.create({
        organizationId: orgId,
        candidateId: candidate._id,
        subject: subject || 'Sequence message',
        channel,
        participants: {
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          candidatePhone: candidate.contact || candidate.phone || ''
        },
        unreadCount: 0,
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 160),
        lastDirection: 'outbound',
        createdBy: user?.id || user?._id
      });
    } else {
      thread.lastMessageAt = new Date();
      thread.lastMessagePreview = body.slice(0, 160);
      thread.lastDirection = 'outbound';
      await thread.save();
    }

    await Message.create({
      organizationId: orgId,
      threadId: thread._id,
      candidateId: candidate._id,
      channel,
      direction: 'outbound',
      fromName: user?.name || 'Sequence',
      fromAddress: user?.email || '',
      toAddress,
      subject,
      body,
      status: 'sent',
      isRead: true,
      sentBy: user?.id || user?._id,
      sentAt: new Date()
    });
  } catch {
    // Non-fatal: sequence send succeeded even if inbox log fails
  }
}

// GET /api/sequences
router.get('/', async (req, res) => {
  try {
    const sequences = await EmailSequence.find({ organizationId: req.user.organizationId })
      .sort({ createdAt: -1 })
      .lean();

    const ids = sequences.map((s) => s._id);
    const counts = await SequenceEnrollment.aggregate([
      { $match: { sequenceId: { $in: ids } } },
      { $group: { _id: '$sequenceId', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c]));

    const data = sequences.map((s) => ({
      ...s,
      enrollmentCount: countMap.get(String(s._id))?.total || 0,
      activeCount: countMap.get(String(s._id))?.active || 0
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/sequences
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, description = '', triggerType = 'manual', triggerStage = '', steps = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one step is required' });
    }

    const normalizedSteps = steps.map((s, i) => ({
      stepNumber: i + 1,
      channel: ['email', 'sms', 'whatsapp'].includes(s.channel) ? s.channel : 'email',
      delayDays: Math.max(0, Number(s.delayDays) || 0),
      subject: s.subject || '',
      body: s.body || '',
      templateId: s.templateId || null
    }));

    const sequence = await EmailSequence.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description,
      triggerType,
      triggerStage,
      steps: normalizedSteps,
      isActive: true,
      createdBy: req.user.id || req.user._id
    });

    res.status(201).json({ success: true, data: sequence });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/sequences/:id
router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const update = {};
    ['name', 'description', 'triggerType', 'triggerStage', 'isActive'].forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    if (Array.isArray(req.body.steps)) {
      update.steps = req.body.steps.map((s, i) => ({
        stepNumber: i + 1,
        channel: ['email', 'sms', 'whatsapp'].includes(s.channel) ? s.channel : 'email',
        delayDays: Math.max(0, Number(s.delayDays) || 0),
        subject: s.subject || '',
        body: s.body || '',
        templateId: s.templateId || null
      }));
    }

    const sequence = await EmailSequence.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    );
    if (!sequence) return res.status(404).json({ success: false, message: 'Sequence not found' });
    res.json({ success: true, data: sequence });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/sequences/:id
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const sequence = await EmailSequence.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!sequence) return res.status(404).json({ success: false, message: 'Sequence not found' });
    await SequenceEnrollment.deleteMany({ sequenceId: sequence._id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/sequences/:id/enroll — { candidateIds: [] }
router.post('/:id/enroll', requireRecruiterOrAbove, async (req, res) => {
  try {
    const sequence = await EmailSequence.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true
    });
    if (!sequence) return res.status(404).json({ success: false, message: 'Active sequence not found' });

    const candidateIds = Array.isArray(req.body.candidateIds) ? req.body.candidateIds : [];
    if (!candidateIds.length) {
      return res.status(400).json({ success: false, message: 'candidateIds required' });
    }

    const candidates = await Candidate.find({
      _id: { $in: candidateIds },
      organizationId: req.user.organizationId
    });

    let enrolled = 0;
    let skipped = 0;
    for (const candidate of candidates) {
      try {
        const firstDelay = sequence.steps[0]?.delayDays || 0;
        await SequenceEnrollment.create({
          organizationId: req.user.organizationId,
          sequenceId: sequence._id,
          candidateId: candidate._id,
          status: 'active',
          currentStep: 0,
          nextSendAt: new Date(Date.now() + firstDelay * 86400000),
          enrolledBy: req.user.id || req.user._id
        });
        enrolled++;
      } catch {
        skipped++;
      }
    }

    res.status(201).json({ success: true, enrolled, skipped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/sequences/:id/enrollments
router.get('/:id/enrollments', async (req, res) => {
  try {
    const rows = await SequenceEnrollment.find({
      organizationId: req.user.organizationId,
      sequenceId: req.params.id
    })
      .populate('candidateId', 'name email position')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/sequences/process — process due enrollments (manual / cron)
router.post('/process', requireRecruiterOrAbove, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const due = await SequenceEnrollment.find({
      organizationId: orgId,
      status: 'active',
      nextSendAt: { $lte: new Date() }
    }).limit(50);

    let processed = 0;
    let errors = 0;

    for (const enrollment of due) {
      const sequence = await EmailSequence.findOne({ _id: enrollment.sequenceId, isActive: true });
      if (!sequence) {
        enrollment.status = 'cancelled';
        await enrollment.save();
        continue;
      }

      const step = sequence.steps[enrollment.currentStep];
      if (!step) {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
        await enrollment.save();
        continue;
      }

      const candidate = await Candidate.findOne({ _id: enrollment.candidateId, organizationId: orgId });
      if (!candidate) {
        enrollment.status = 'cancelled';
        await enrollment.save();
        continue;
      }

      try {
        await sendStep(orgId, candidate, step, req.user);
        enrollment.currentStep += 1;
        enrollment.lastError = '';
        if (enrollment.currentStep >= sequence.steps.length) {
          enrollment.status = 'completed';
          enrollment.completedAt = new Date();
        } else {
          const nextDelay = sequence.steps[enrollment.currentStep]?.delayDays || 0;
          enrollment.nextSendAt = new Date(Date.now() + nextDelay * 86400000);
        }
        await enrollment.save();
        processed++;
      } catch (err) {
        enrollment.lastError = err.message;
        await enrollment.save();
        errors++;
      }
    }

    res.json({ success: true, processed, errors, due: due.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
