/**
 * Unified multi-channel inbox domain logic.
 */
const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const Candidate = require('../models/Candidate');
const { sendEmail } = require('./emailService');
const { getAdapter } = require('../adapters');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function hasChannelConsent(candidate, channel) {
  if (!candidate) return true;
  const consent = candidate.messagingConsent || {};
  if (channel === 'email') return consent.email !== false;
  if (channel === 'sms') return !!consent.sms;
  if (channel === 'whatsapp') return !!consent.whatsapp;
  return true;
}

async function sendViaChannel({ orgId, user, channel, toAddress, subject, body, bodyHtml }) {
  if (channel === 'email') {
    await sendEmail(
      toAddress,
      subject || 'Message from recruiting team',
      bodyHtml || `<p>${body.replace(/\n/g, '<br/>')}</p>`,
      body,
      { userId: user.id || user._id }
    );
    return;
  }
  if (channel === 'sms') {
    const adapter = await getAdapter(orgId, 'sms');
    if (!adapter) throw new Error('SMS is not configured. Connect SMS in Integrations.');
    await adapter.send({ to: toAddress, message: body });
    return;
  }
  if (channel === 'whatsapp') {
    const adapter = await getAdapter(orgId, 'whatsapp');
    if (!adapter) throw new Error('WhatsApp is not configured. Connect WhatsApp in Integrations.');
    if (typeof adapter.sendWhatsApp === 'function') {
      await adapter.sendWhatsApp({ to: toAddress, message: body });
    } else {
      await adapter.send({ to: toAddress, message: body });
    }
  }
}

async function getInboxStats(organizationId) {
  const base = { organizationId, archived: { $ne: true } };
  const [totalThreads, unreadAgg, msgStats] = await Promise.all([
    MessageThread.countDocuments(base),
    MessageThread.aggregate([
      { $match: base },
      { $group: { _id: null, unread: { $sum: '$unreadCount' } } },
    ]),
    Message.aggregate([
      { $match: { organizationId } },
      { $group: { _id: '$direction', count: { $sum: 1 } } },
    ]),
  ]);

  const inbound = msgStats.find((m) => m._id === 'inbound')?.count || 0;
  const outbound = msgStats.find((m) => m._id === 'outbound')?.count || 0;
  const replyRate = outbound > 0 ? Math.round((inbound / outbound) * 100) : 0;

  return {
    totalThreads,
    unreadCount: unreadAgg[0]?.unread || 0,
    inboundCount: inbound,
    outboundCount: outbound,
    replyRate,
  };
}

async function listThreads(organizationId, query) {
  const { q = '', archived = 'false', channel } = query;
  const filter = {
    organizationId,
    archived: archived === 'true',
  };
  if (channel && channel !== 'all') filter.channel = channel;
  if (q.trim()) {
    filter.$or = [
      { subject: { $regex: q.trim(), $options: 'i' } },
      { 'participants.candidateName': { $regex: q.trim(), $options: 'i' } },
      { 'participants.candidateEmail': { $regex: q.trim(), $options: 'i' } },
      { lastMessagePreview: { $regex: q.trim(), $options: 'i' } },
    ];
  }

  return MessageThread.find(filter).sort({ lastMessageAt: -1 }).limit(100).lean();
}

async function getThread(organizationId, threadId) {
  const thread = await MessageThread.findOne({ _id: threadId, organizationId }).lean();
  if (!thread) throw httpError('Thread not found', 404);

  const messages = await Message.find({
    threadId: thread._id,
    organizationId,
  })
    .sort({ sentAt: 1 })
    .lean();

  return { thread, messages };
}

async function createOutbound(organizationId, user, body) {
  const {
    candidateId,
    channel = 'email',
    subject = '',
    body: messageBody = '',
    bodyHtml = '',
    threadId = null,
  } = body;

  if (!String(messageBody || '').trim()) {
    throw httpError('Message body is required');
  }
  if (!['email', 'sms', 'whatsapp'].includes(channel)) {
    throw httpError('Invalid channel');
  }

  let thread = null;
  if (threadId) {
    thread = await MessageThread.findOne({ _id: threadId, organizationId });
    if (!thread) throw httpError('Thread not found', 404);
  }

  const resolvedCandidateId = candidateId || thread?.candidateId || null;
  let candidate = null;
  if (resolvedCandidateId) {
    candidate = await Candidate.findOne({ _id: resolvedCandidateId, organizationId });
    if (candidateId && !candidate) throw httpError('Candidate not found', 404);
    if (candidate && !hasChannelConsent(candidate, channel)) {
      throw httpError(`Candidate has not consented to ${channel} messages`, 403);
    }
  }

  const toAddress =
    channel === 'email'
      ? candidate?.email || thread?.participants?.candidateEmail || body.toAddress || ''
      : candidate?.contact ||
        candidate?.phone ||
        thread?.participants?.candidatePhone ||
        body.toAddress ||
        '';

  if (!toAddress) throw httpError('No recipient address available');

  let sendStatus = 'sent';
  let errorMessage = '';
  try {
    await sendViaChannel({
      orgId: organizationId,
      user,
      channel,
      toAddress,
      subject: subject || thread?.subject || 'Message from recruiting team',
      body: messageBody,
      bodyHtml,
    });
  } catch (err) {
    sendStatus = 'failed';
    errorMessage = err.message;
  }

  if (!thread && resolvedCandidateId) {
    thread = await MessageThread.findOne({
      organizationId,
      candidateId: resolvedCandidateId,
      archived: false,
    }).sort({ lastMessageAt: -1 });
  }

  if (!thread) {
    thread = await MessageThread.create({
      organizationId,
      candidateId: resolvedCandidateId,
      subject: subject || `Conversation with ${candidate?.name || toAddress}`,
      channel,
      participants: {
        candidateName: candidate?.name || '',
        candidateEmail: candidate?.email || '',
        candidatePhone: candidate?.contact || candidate?.phone || '',
      },
      unreadCount: 0,
      lastMessageAt: new Date(),
      lastMessagePreview: messageBody.slice(0, 160),
      lastDirection: 'outbound',
      createdBy: user.id || user._id,
    });
  } else {
    thread.channel = thread.channel === channel ? channel : 'mixed';
    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = messageBody.slice(0, 160);
    thread.lastDirection = 'outbound';
    if (subject) thread.subject = subject;
    await thread.save();
  }

  const message = await Message.create({
    organizationId,
    threadId: thread._id,
    candidateId: resolvedCandidateId,
    channel,
    direction: 'outbound',
    fromName: user.name || 'Recruiter',
    fromAddress: user.email || '',
    toAddress,
    subject,
    body: messageBody,
    bodyHtml,
    status: sendStatus,
    isRead: true,
    sentBy: user.id || user._id,
    errorMessage,
    sentAt: new Date(),
  });

  if (sendStatus === 'failed') {
    const err = httpError(errorMessage || 'Failed to send', 502);
    err.data = { thread, message };
    throw err;
  }

  return { thread, message };
}

async function markThreadRead(organizationId, threadId) {
  const thread = await MessageThread.findOneAndUpdate(
    { _id: threadId, organizationId },
    { $set: { unreadCount: 0 } },
    { new: true }
  );
  if (!thread) throw httpError('Thread not found', 404);
  await Message.updateMany(
    { threadId: thread._id, organizationId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return thread;
}

async function updateThread(organizationId, threadId, body) {
  const update = {};
  if (typeof body.archived === 'boolean') update.archived = body.archived;
  if (typeof body.starred === 'boolean') update.starred = body.starred;
  if (body.subject != null) update.subject = body.subject;

  const thread = await MessageThread.findOneAndUpdate(
    { _id: threadId, organizationId },
    { $set: update },
    { new: true }
  );
  if (!thread) throw httpError('Thread not found', 404);
  return thread;
}

async function updateMessagingConsent(organizationId, candidateId, body) {
  const { email, sms, whatsapp } = body;
  const update = {};
  if (typeof email === 'boolean') update['messagingConsent.email'] = email;
  if (typeof sms === 'boolean') update['messagingConsent.sms'] = sms;
  if (typeof whatsapp === 'boolean') update['messagingConsent.whatsapp'] = whatsapp;
  update['messagingConsent.updatedAt'] = new Date();

  const candidate = await Candidate.findOneAndUpdate(
    { _id: candidateId, organizationId },
    { $set: update },
    { new: true }
  ).select('name email messagingConsent');

  if (!candidate) throw httpError('Candidate not found', 404);
  return candidate;
}

module.exports = {
  hasChannelConsent,
  getInboxStats,
  listThreads,
  getThread,
  createOutbound,
  markThreadRead,
  updateThread,
  updateMessagingConsent,
};
