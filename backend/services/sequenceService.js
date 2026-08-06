/**
 * Outreach sequences domain logic.
 */
const EmailSequence = require('../models/EmailSequence');
const SequenceEnrollment = require('../models/SequenceEnrollment');
const Candidate = require('../models/Candidate');
const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const { sendEmail } = require('./emailService');
const { getAdapter } = require('../adapters');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

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

async function listSequences(organizationId) {
  const sequences = await EmailSequence.find({ organizationId })
    .sort({ createdAt: -1 })
    .lean();

  const ids = sequences.map((s) => s._id);
  const counts = await SequenceEnrollment.aggregate([
    { $match: { sequenceId: { $in: ids } } },
    { $group: { _id: '$sequenceId', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c]));

  return sequences.map((s) => ({
    ...s,
    enrollmentCount: countMap.get(String(s._id))?.total || 0,
    activeCount: countMap.get(String(s._id))?.active || 0
  }));
}

async function createSequence(organizationId, user, body) {
  const { name, description = '', triggerType = 'manual', triggerStage = '', steps = [] } = body;
  if (!name?.trim()) throw httpError('Name is required', 400);
  if (!Array.isArray(steps) || steps.length === 0) {
    throw httpError('At least one step is required', 400);
  }

  const normalizedSteps = steps.map((s, i) => ({
    stepNumber: i + 1,
    channel: ['email', 'sms', 'whatsapp'].includes(s.channel) ? s.channel : 'email',
    delayDays: Math.max(0, Number(s.delayDays) || 0),
    subject: s.subject || '',
    body: s.body || '',
    templateId: s.templateId || null
  }));

  return EmailSequence.create({
    organizationId,
    name: name.trim(),
    description,
    triggerType,
    triggerStage,
    steps: normalizedSteps,
    isActive: true,
    createdBy: user.id || user._id
  });
}

async function updateSequence(organizationId, sequenceId, body) {
  const update = {};
  ['name', 'description', 'triggerType', 'triggerStage', 'isActive'].forEach((k) => {
    if (body[k] !== undefined) update[k] = body[k];
  });
  if (Array.isArray(body.steps)) {
    update.steps = body.steps.map((s, i) => ({
      stepNumber: i + 1,
      channel: ['email', 'sms', 'whatsapp'].includes(s.channel) ? s.channel : 'email',
      delayDays: Math.max(0, Number(s.delayDays) || 0),
      subject: s.subject || '',
      body: s.body || '',
      templateId: s.templateId || null
    }));
  }

  const sequence = await EmailSequence.findOneAndUpdate(
    { _id: sequenceId, organizationId },
    { $set: update },
    { new: true }
  );
  if (!sequence) throw httpError('Sequence not found', 404);
  return sequence;
}

async function deleteSequence(organizationId, sequenceId) {
  const sequence = await EmailSequence.findOneAndDelete({
    _id: sequenceId,
    organizationId
  });
  if (!sequence) throw httpError('Sequence not found', 404);
  await SequenceEnrollment.deleteMany({ sequenceId: sequence._id });
  return sequence;
}

async function enrollCandidates(organizationId, user, sequenceId, body) {
  const sequence = await EmailSequence.findOne({
    _id: sequenceId,
    organizationId,
    isActive: true
  });
  if (!sequence) throw httpError('Active sequence not found', 404);

  const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds : [];
  if (!candidateIds.length) {
    throw httpError('candidateIds required', 400);
  }

  const candidates = await Candidate.find({
    _id: { $in: candidateIds },
    organizationId
  });

  let enrolled = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    try {
      const firstDelay = sequence.steps[0]?.delayDays || 0;
      await SequenceEnrollment.create({
        organizationId,
        sequenceId: sequence._id,
        candidateId: candidate._id,
        status: 'active',
        currentStep: 0,
        nextSendAt: new Date(Date.now() + firstDelay * 86400000),
        enrolledBy: user.id || user._id
      });
      enrolled++;
    } catch {
      skipped++;
    }
  }

  return { enrolled, skipped };
}

async function listEnrollments(organizationId, sequenceId) {
  return SequenceEnrollment.find({
    organizationId,
    sequenceId
  })
    .populate('candidateId', 'name email position')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}

async function processDueEnrollments(organizationId, user) {
  const due = await SequenceEnrollment.find({
    organizationId,
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

    const candidate = await Candidate.findOne({ _id: enrollment.candidateId, organizationId });
    if (!candidate) {
      enrollment.status = 'cancelled';
      await enrollment.save();
      continue;
    }

    try {
      await sendStep(organizationId, candidate, step, user);
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

  return { processed, errors, due: due.length };
}

module.exports = {
  interpolate,
  sendStep,
  listSequences,
  createSequence,
  updateSequence,
  deleteSequence,
  enrollCandidates,
  listEnrollments,
  processDueEnrollments,
};
