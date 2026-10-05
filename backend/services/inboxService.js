/**
 * Unified multi-channel inbox domain logic.
 */
const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const { sendEmail } = require('./emailService');
const { wrapBrandedEmailHtml, loadOrgEmailBrand } = require('./emailBrandLayout');
const { getAdapter } = require('../adapters');
const {
  canManageSharedMailbox,
  assignedMatch,
  canViewThread,
  threadAssignedToUser,
  isInboxEmployee,
  notSnoozedMatch,
  snoozedMatch,
} = require('../utils/inboxAccess');
const attachmentsStore = require('./inboxAttachmentStore');
const {
  conversationRootSubject,
  groupInboxConversations,
  sameConversation,
  newestReplyPreview,
} = require('./inboxImapMatch');

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

async function sendViaChannel({ orgId, user, channel, toAddress, subject, body, bodyHtml, templateName, languageCode, components, mailFiles = [] }) {
  if (channel === 'email') {
    const brand = await loadOrgEmailBrand(orgId);
    const innerHtml =
      bodyHtml ||
      `<div style="color:#3f3f46;white-space:pre-wrap;line-height:1.7;">${String(body || '')
        .split('\n')
        .map((line) => line || '&nbsp;')
        .join('<br/>')}</div>`;
    const html = wrapBrandedEmailHtml({
      orgName: brand.name,
      logoUrl: brand.logoUrl,
      brandColor: brand.brandColor,
      wordmark: brand.wordmark,
      senderName: '',
      includeSignOff: false,
      bodyHtml: innerHtml,
    });
    const { hiddenHiringContactHtml } = require('./emailBrandLayout');
    const stamped = `${html}${hiddenHiringContactHtml(user.email)}`;
    const zeptoAttachments = [];
    const smtpAttachments = [];
    for (const file of mailFiles) {
      const buf = file.buffer || await attachmentsStore.readBuffer(file.storageKey);
      zeptoAttachments.push(attachmentsStore.toZeptoPayload(file.filename || file.originalname, file.contentType || file.mimetype, buf));
      smtpAttachments.push(attachmentsStore.toSmtpPayload(file.filename || file.originalname, file.contentType || file.mimetype, buf));
    }
    await sendEmail(
      toAddress,
      subject || 'Message from recruiting team',
      stamped,
      body,
      {
        userId: user.id || user._id,
        zeptoAttachments,
        smtpAttachments,
      }
    );
    return { html: stamped };
  }
  if (channel === 'sms') {
    const adapter = await getAdapter(orgId, 'sms');
    if (!adapter) throw new Error('SMS is not configured. Connect SMS in Integrations.');
    const result = await adapter.send({ to: toAddress, message: body });
    return result || {};
  }
  if (channel === 'whatsapp') {
    const adapter = await getAdapter(orgId, 'whatsapp');
    if (!adapter) throw new Error('WhatsApp is not connected. Open Integrations and click Connect WhatsApp.');
    if (typeof adapter.sendWhatsApp === 'function') {
      return (await adapter.sendWhatsApp({
        to: toAddress,
        message: body,
        templateName,
        languageCode,
        components,
      })) || {};
    }
    return (await adapter.send({ to: toAddress, message: body })) || {};
  }
  return {};
}

async function getInboxStats(organizationId, user, query = {}) {
  const wantAll = String(query.assigned || '') === 'all' && canManageSharedMailbox(user);
  const owner = wantAll ? null : assignedMatch(user);
  const scoped = (extra = {}) => {
    const and = [{ organizationId, ...extra }];
    if (owner) and.push(owner);
    return { $and: and };
  };
  const active = { archived: { $ne: true }, isDraft: { $ne: true } };
  const [
    inbox,
    unreadAgg,
    starred,
    snoozed,
    drafts,
    archived,
    msgStats,
  ] = await Promise.all([
    MessageThread.countDocuments(scoped({ ...active, ...notSnoozedMatch() })),
    MessageThread.aggregate([
      { $match: scoped({ ...active, unreadCount: { $gt: 0 }, ...notSnoozedMatch() }) },
      { $group: { _id: null, unread: { $sum: '$unreadCount' }, threads: { $sum: 1 } } },
    ]),
    MessageThread.countDocuments(scoped({ ...active, starred: true })),
    MessageThread.countDocuments(scoped({ isDraft: { $ne: true }, archived: { $ne: true }, ...snoozedMatch() })),
    MessageThread.countDocuments(scoped({ isDraft: true })),
    MessageThread.countDocuments(scoped({ archived: true, isDraft: { $ne: true } })),
    Message.aggregate([
      { $match: { organizationId } },
      { $group: { _id: '$direction', count: { $sum: 1 } } },
    ]),
  ]);

  const inbound = msgStats.find((m) => m._id === 'inbound')?.count || 0;
  const outbound = msgStats.find((m) => m._id === 'outbound')?.count || 0;
  const replyRate = outbound > 0 ? Math.round((inbound / outbound) * 100) : 0;
  const unreadThreads = unreadAgg[0]?.threads || 0;

  let sent = 0;
  try {
    const EmailSendLog = require('../models/EmailSendLog');
    const sentFilter = { organizationId };
    if (!wantAll) {
      sentFilter.sentByUserId = user.id || user._id;
    }
    sent = await EmailSendLog.countDocuments(sentFilter);
  } catch (_) {
    sent = outbound;
  }

  return {
    totalThreads: inbox,
    unreadCount: unreadAgg[0]?.unread || 0,
    inboundCount: inbound,
    outboundCount: outbound,
    replyRate,
    folders: {
      inbox,
      unread: unreadThreads,
      starred,
      snoozed,
      drafts,
      archived,
      sent,
    },
  };
}

function ownerClause(user) {
  return {
    $or: [
      { assignedTo: user.id || user._id },
      { assignedEmail: String(user.email || '').toLowerCase() },
      { createdBy: user.id || user._id },
    ],
  };
}

async function listThreads(organizationId, query, user) {
  const { q = '', archived = 'false', channel, assigned, starred, unread, snoozed, drafts, sent } = query;

  if (sent === 'true') {
    return listSentArchive(organizationId, query, user);
  }

  const and = [
    {
      organizationId,
      archived: archived === 'true',
    },
  ];
  if (drafts === 'true') {
    and[0].isDraft = true;
  } else {
    and.push({ isDraft: { $ne: true } });
  }
  if (starred === 'true') and[0].starred = true;
  if (unread === 'true') and[0].unreadCount = { $gt: 0 };
  if (drafts !== 'true') {
    if (snoozed === 'true') and.push(snoozedMatch());
    else and.push(notSnoozedMatch());
  }
  if (channel && channel !== 'all') and[0].channel = channel;
  const wantAll = assigned === 'all' && canManageSharedMailbox(user);
  if (!wantAll) {
    and.push(assignedMatch(user));
  }
  if (q.trim()) {
    and.push({
      $or: [
        { subject: { $regex: q.trim(), $options: 'i' } },
        { 'participants.candidateName': { $regex: q.trim(), $options: 'i' } },
        { 'participants.candidateEmail': { $regex: q.trim(), $options: 'i' } },
        { lastMessagePreview: { $regex: q.trim(), $options: 'i' } },
        { assignedName: { $regex: q.trim(), $options: 'i' } },
        { assignedEmail: { $regex: q.trim(), $options: 'i' } },
        { draftTo: { $regex: q.trim(), $options: 'i' } },
      ],
    });
  }

  const rows = await MessageThread.find(and.length === 1 ? and[0] : { $and: and })
    .sort({ lastMessageAt: -1 })
    .limit(200)
    .lean();
  return groupInboxConversations(rows);
}

function sendLogThreadId(id) {
  return `sendlog:${String(id)}`;
}

function parseSendLogThreadId(threadId) {
  const raw = String(threadId || '');
  if (!raw.startsWith('sendlog:')) return null;
  return raw.slice('sendlog:'.length);
}

async function listSentArchive(organizationId, query, user) {
  const EmailSendLog = require('../models/EmailSendLog');
  const { q = '', assigned } = query;
  const filter = { organizationId };
  const wantAll = assigned === 'all' && canManageSharedMailbox(user);
  if (!wantAll) {
    filter.sentByUserId = user.id || user._id;
  }
  if (String(q || '').trim()) {
    const re = { $regex: String(q).trim(), $options: 'i' };
    filter.$or = [
      { subject: re },
      { fromEmail: re },
      { campaignName: re },
      { 'recipients.email': re },
      { 'recipients.name': re },
    ];
  }
  const logs = await EmailSendLog.find(filter)
    .sort({ sentAt: -1 })
    .limit(200)
    .select('subject fromEmail replyToEmail recipients sentAt channel provider campaignName emailType archiveKey htmlBody sentByUserId status totals')
    .lean();

  return logs.map((doc) => {
    const first = (doc.recipients || [])[0] || {};
    const more = Math.max(0, (doc.recipients || []).length - 1);
    const toLabel = first.email
      ? (more ? `${first.email} +${more}` : first.email)
      : 'Recipients';
    const preview = String(doc.htmlBody || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    return {
      _id: sendLogThreadId(doc._id),
      organizationId,
      subject: doc.subject || '(no subject)',
      channel: 'email',
      participants: {
        candidateName: first.name || toLabel,
        candidateEmail: first.email || '',
      },
      unreadCount: 0,
      lastMessageAt: doc.sentAt || doc.createdAt,
      lastMessagePreview: preview || `${doc.channel || 'email'} · ${doc.provider || 'sent'}`,
      lastDirection: 'outbound',
      source: 'archive',
      archived: false,
      isDraft: false,
      sendLogId: String(doc._id),
      archiveKey: doc.archiveKey || '',
      assignedTo: doc.sentByUserId || null,
      assignedEmail: '',
      assignedName: '',
    };
  });
}

async function siblingThreads(organizationId, thread, user) {
  const email = String(thread.participants?.candidateEmail || '').trim().toLowerCase();
  if (!email) return [thread];
  const and = [
    { organizationId, isDraft: { $ne: true } },
    { 'participants.candidateEmail': email },
  ];
  if (user && !canManageSharedMailbox(user)) and.push(assignedMatch(user));
  const rows = await MessageThread.find({ $and: and }).sort({ lastMessageAt: 1 }).lean();
  const siblings = rows.filter((row) => sameConversation(thread, row) && canViewThread(row, user));
  return siblings.length ? siblings : [thread];
}

async function hydrateMessageBodies(messages) {
  const list = Array.isArray(messages) ? [...messages] : [];
  let resolveHtmlBody;
  try {
    ({ resolveHtmlBody } = require('./emailArchiveService'));
  } catch {
    return list;
  }
  for (const m of list) {
    if (!m?.archiveKey) continue;
    const short = String(m.bodyHtml || '').length < 800;
    if (!short && String(m.bodyHtml || '').length > 2000) continue;
    try {
      const html = await resolveHtmlBody({ archiveKey: m.archiveKey, htmlBody: m.bodyHtml });
      if (html) m.bodyHtml = html;
    } catch {
      /* keep mongo clip */
    }
  }
  return list;
}

async function getSentArchiveThread(organizationId, sendLogId, user) {
  const EmailSendLog = require('../models/EmailSendLog');
  const doc = await EmailSendLog.findOne({ _id: sendLogId, organizationId }).lean();
  if (!doc) throw httpError('Thread not found', 404);
  const wantAll = canManageSharedMailbox(user);
  if (!wantAll && String(doc.sentByUserId || '') !== String(user.id || user._id || '')) {
    throw httpError('Thread not found', 404);
  }

  let html = doc.htmlBody || '';
  try {
    const { resolveHtmlBody } = require('./emailArchiveService');
    html = await resolveHtmlBody({ archiveKey: doc.archiveKey, htmlBody: doc.htmlBody });
  } catch {
    /* use clip */
  }

  const recipients = doc.recipients || [];
  const first = recipients[0] || {};
  const toLine = recipients.map((r) => r.email).filter(Boolean).join(', ');
  const thread = {
    _id: sendLogThreadId(doc._id),
    organizationId,
    subject: doc.subject || '(no subject)',
    channel: 'email',
    participants: {
      candidateName: first.name || first.email || 'Recipient',
      candidateEmail: first.email || '',
    },
    unreadCount: 0,
    lastMessageAt: doc.sentAt,
    lastMessagePreview: '',
    lastDirection: 'outbound',
    source: 'archive',
    archived: false,
    sendLogId: String(doc._id),
    fromLabel: 'me',
    conversationIds: [sendLogThreadId(doc._id)],
  };
  const message = {
    _id: `sendmsg:${doc._id}`,
    organizationId,
    threadId: thread._id,
    channel: 'email',
    direction: 'outbound',
    fromName: doc.fromEmail || 'ATS',
    fromAddress: doc.fromEmail || '',
    toAddress: toLine,
    subject: doc.subject || '',
    body: doc.textBody || '',
    bodyHtml: html || '',
    status: doc.status || 'sent',
    isRead: true,
    sentAt: doc.sentAt,
    archiveKey: doc.archiveKey || '',
    sentBy: doc.sentByUserId || null,
  };
  return { thread, messages: [message], readOnly: true };
}

async function getThread(organizationId, threadId, user) {
  const sendLogId = parseSendLogThreadId(threadId);
  if (sendLogId) {
    return getSentArchiveThread(organizationId, sendLogId, user);
  }

  const thread = await MessageThread.findOne({ _id: threadId, organizationId }).lean();
  if (!thread) throw httpError('Thread not found', 404);
  if (user && !canViewThread(thread, user)) throw httpError('Thread not found', 404);

  const siblings = await siblingThreads(organizationId, thread, user);
  const ids = siblings.map((t) => t._id);
  const messages = await Message.find({
    threadId: { $in: ids },
    organizationId,
  })
    .sort({ sentAt: 1 })
    .lean();

  let hydrated = await hydrateSentOriginal(organizationId, thread, messages, user);
  hydrated = await hydrateMessageBodies(hydrated);

  const latest = siblings[siblings.length - 1] || thread;
  const unreadCount = siblings.reduce((n, t) => n + Number(t.unreadCount || 0), 0);
  const names = new Set();
  for (const m of hydrated) {
    if (m.direction === 'inbound') names.add(m.fromName || thread.participants?.candidateName || 'Candidate');
    else names.add('me');
  }
  const fromLabel = names.size > 1
    ? `${thread.participants?.candidateName || thread.participants?.candidateEmail || 'Candidate'}, me ${names.size}`
    : (thread.participants?.candidateName || thread.participants?.candidateEmail || 'Conversation');

  return {
    thread: {
      ...latest,
      _id: thread._id,
      subject: conversationRootSubject(latest.subject || thread.subject) || latest.subject,
      unreadCount,
      starred: siblings.some((t) => t.starred),
      conversationIds: ids,
      fromLabel,
    },
    messages: hydrated,
  };
}

async function hydrateSentOriginal(organizationId, thread, messages, user) {
  const list = Array.isArray(messages) ? [...messages] : [];
  const hasFull = list.some((m) => m.direction === 'outbound' && String(m.bodyHtml || '').length > 600);
  if (hasFull) return list;
  const email = String(thread.participants?.candidateEmail || '').trim().toLowerCase();
  if (!email) return list;
  let EmailSendLog;
  try {
    EmailSendLog = require('../models/EmailSendLog');
  } catch {
    return list;
  }
  const logs = await EmailSendLog.find({
    organizationId,
    'recipients.email': email,
    $or: [
      { archiveKey: { $exists: true, $nin: [null, ''] } },
      { htmlBody: { $exists: true, $nin: [null, ''] } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();
  if (!logs.length) return list;
  const root = conversationRootSubject(thread.subject).toLowerCase();
  const log = logs.find((l) => conversationRootSubject(l.subject).toLowerCase() === root) || logs[0];
  let html = log?.htmlBody || '';
  if (log?.archiveKey) {
    try {
      const { getArchivedHtml } = require('./emailArchiveService');
      const fromS3 = await getArchivedHtml(log.archiveKey);
      if (fromS3) html = fromS3;
    } catch {
      /* keep clip */
    }
  }
  if (!html) return list;

  const emptyOutbound = list.find((m) => m.direction === 'outbound' && String(m.bodyHtml || '').length < 600);
  if (emptyOutbound) {
    await Message.updateOne(
      { _id: emptyOutbound._id, organizationId },
      {
        $set: {
          bodyHtml: html.slice(0, 48_000),
          ...(log.archiveKey
            ? { archiveKey: log.archiveKey, archiveMetaKey: log.archiveMetaKey || '' }
            : {}),
        },
      }
    );
    emptyOutbound.bodyHtml = html;
    if (log.archiveKey) emptyOutbound.archiveKey = log.archiveKey;
    return list;
  }
  if (list.some((m) => m.direction === 'outbound')) return list;

  const created = await Message.create({
    organizationId,
    threadId: thread._id,
    candidateId: thread.candidateId || null,
    channel: 'email',
    direction: 'outbound',
    fromName: user?.name || 'You',
    fromAddress: user?.email || log.fromEmail || '',
    toAddress: email,
    subject: log.subject || thread.subject,
    body: log.textBody || log.subject || '',
    bodyHtml: html.slice(0, 48_000),
    archiveKey: log.archiveKey || '',
    archiveMetaKey: log.archiveMetaKey || '',
    status: 'sent',
    isRead: true,
    sentBy: user?.id || user?._id || log.sentByUserId || null,
    sentAt: log.createdAt || (list[0]?.sentAt ? new Date(new Date(list[0].sentAt).getTime() - 1000) : new Date()),
  });
  return [created.toObject(), ...list].sort((a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0));
}

async function findExistingConversation(organizationId, user, { candidateId, toAddress, subject }) {
  const and = [{ organizationId, archived: false, isDraft: { $ne: true } }, ownerClause(user)];
  const root = conversationRootSubject(subject).toLowerCase();
  if (candidateId) {
    const byCandidate = await MessageThread.find({ $and: [...and, { candidateId }] })
      .sort({ lastMessageAt: -1 })
      .limit(40);
    const match = (root
      ? byCandidate.find((t) => conversationRootSubject(t.subject).toLowerCase() === root)
      : null) || (!subject ? byCandidate[0] : null);
    if (match) return match;
  }
  if (toAddress) {
    const byEmail = await MessageThread.find({
      $and: [...and, { 'participants.candidateEmail': String(toAddress).trim().toLowerCase() }],
    })
      .sort({ lastMessageAt: -1 })
      .limit(40);
    const match = (root
      ? byEmail.find((t) => conversationRootSubject(t.subject).toLowerCase() === root)
      : null) || (!subject ? byEmail[0] : null);
    if (match) return match;
  }
  return null;
}

async function createOutbound(organizationId, user, body) {
  const {
    candidateId,
    channel = 'email',
    subject = '',
    body: messageBody = '',
    bodyHtml = '',
    threadId = null,
    templateName = '',
    languageCode = '',
    components,
    files = [],
  } = body;

  let storedHtml = bodyHtml;
  const previewBody = templateName
    ? (String(messageBody || '').trim() || `Template: ${templateName}`)
    : String(messageBody || '').trim();
  if (!previewBody) {
    throw httpError('Message body is required');
  }
  if (!['email', 'sms', 'whatsapp'].includes(channel)) {
    throw httpError('Invalid channel');
  }
  if (channel === 'email' && !String(subject || '').trim() && !threadId) {
    throw httpError('Subject is required');
  }

  const savedAttachments = await attachmentsStore.persistMany(organizationId, files);
  const mailFiles = (files || []).map((f, i) => ({
    ...(savedAttachments[i] || {}),
    buffer: f.buffer,
    filename: savedAttachments[i]?.filename || f.originalname,
    contentType: savedAttachments[i]?.contentType || f.mimetype,
    originalname: f.originalname,
    mimetype: f.mimetype,
  }));

  let thread = null;
  let openedThread = null;
  if (threadId) {
    openedThread = await MessageThread.findOne({ _id: threadId, organizationId });
    if (!openedThread) throw httpError('Thread not found', 404);
    if (!canViewThread(openedThread, user)) throw httpError('Thread not found', 404);
    if (threadAssignedToUser(openedThread, user)) {
      thread = openedThread;
    }
  }

  const resolvedCandidateId = candidateId || thread?.candidateId || openedThread?.candidateId || null;
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
      ? candidate?.email
        || thread?.participants?.candidateEmail
        || openedThread?.participants?.candidateEmail
        || body.toAddress
        || ''
      : candidate?.contact ||
        candidate?.phone ||
        thread?.participants?.candidatePhone ||
        openedThread?.participants?.candidatePhone ||
        body.toAddress
        || '';

  if (!toAddress) throw httpError('No recipient address available');

  let sendStatus = 'sent';
  let errorMessage = '';
  let providerId = '';
  try {
    const sendResult = await sendViaChannel({
      orgId: organizationId,
      user,
      channel,
      toAddress,
      subject: subject || thread?.subject || openedThread?.subject || 'Message from recruiting team',
      body: previewBody,
      bodyHtml,
      templateName,
      languageCode: languageCode || 'en_US',
      components,
      mailFiles,
    });
    providerId = sendResult?.id || sendResult?.sid || sendResult?.messageId || '';
    if (sendResult?.html) storedHtml = sendResult.html;
  } catch (err) {
    sendStatus = 'failed';
    errorMessage = err.message;
  }

  if (!thread) {
    thread = await findExistingConversation(organizationId, user, {
      candidateId: resolvedCandidateId,
      toAddress: channel === 'email' ? toAddress : '',
      subject: subject || openedThread?.subject || '',
    });
  }

  if (body.draftId) {
    const draft = await MessageThread.findOne({
      _id: body.draftId,
      organizationId,
      isDraft: true,
    });
    if (draft && threadAssignedToUser(draft, user)) {
      await Message.deleteMany({ threadId: draft._id, organizationId });
      await MessageThread.deleteOne({ _id: draft._id, organizationId });
    }
  }

  if (!thread) {
    thread = await MessageThread.create({
      organizationId,
      candidateId: resolvedCandidateId,
      subject: subject || openedThread?.subject || `Conversation with ${candidate?.name || toAddress}`,
      channel,
      participants: {
        candidateName: candidate?.name || openedThread?.participants?.candidateName || '',
        candidateEmail: candidate?.email || openedThread?.participants?.candidateEmail || (channel === 'email' ? toAddress : ''),
        candidatePhone: candidate?.contact || candidate?.phone || openedThread?.participants?.candidatePhone || '',
      },
      unreadCount: 0,
      lastMessageAt: new Date(),
      lastMessagePreview: previewBody.slice(0, 160),
      lastDirection: 'outbound',
      createdBy: user.id || user._id,
      assignedTo: user.id || user._id,
      assignedName: user.name || '',
      assignedEmail: String(user.email || '').toLowerCase(),
      isDraft: false,
    });
  } else {
    thread.channel = thread.channel === channel ? channel : 'mixed';
    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = previewBody.slice(0, 160);
    thread.lastDirection = 'outbound';
    if (subject) thread.subject = subject;
    if (!thread.assignedTo) {
      thread.assignedTo = user.id || user._id;
      thread.assignedName = user.name || thread.assignedName || '';
      thread.assignedEmail = String(user.email || thread.assignedEmail || '').toLowerCase();
    }
    thread.snoozedUntil = null;
    thread.isDraft = false;
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
    body: previewBody,
    bodyHtml: storedHtml,
    status: sendStatus,
    isRead: true,
    sentBy: user.id || user._id,
    errorMessage,
    externalId: providerId,
    sentAt: new Date(),
    attachments: savedAttachments,
  });

  if (sendStatus === 'failed') {
    const err = httpError(errorMessage || 'Failed to send', 502);
    err.data = { thread, message };
    throw err;
  }

  return { thread, message };
}

async function recordSentMail(organizationId, user, payload = {}) {
  if (!organizationId || !user || !payload.toAddress) return null;
  try {
    const toAddress = String(payload.toAddress || '').trim().toLowerCase();
    const subject = String(payload.subject || '').trim();
    const previewBody = String(payload.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
    let thread = await findExistingConversation(organizationId, user, {
      candidateId: payload.candidateId || null,
      toAddress,
      subject,
    });
    if (!thread) {
      thread = await MessageThread.create({
        organizationId,
        candidateId: payload.candidateId || null,
        subject: subject || `Conversation with ${payload.candidateName || toAddress}`,
        channel: 'email',
        participants: {
          candidateName: payload.candidateName || '',
          candidateEmail: toAddress,
          candidatePhone: '',
        },
        unreadCount: 0,
        lastMessageAt: new Date(),
        lastMessagePreview: (previewBody || subject).slice(0, 160),
        lastDirection: 'outbound',
        createdBy: user.id || user._id,
        assignedTo: user.id || user._id,
        assignedName: user.name || '',
        assignedEmail: String(user.email || '').toLowerCase(),
        isDraft: false,
      });
    } else {
      thread.lastMessageAt = new Date();
      thread.lastMessagePreview = (previewBody || subject).slice(0, 160);
      thread.lastDirection = 'outbound';
      thread.snoozedUntil = null;
      thread.isDraft = false;
      if (payload.candidateId && !thread.candidateId) thread.candidateId = payload.candidateId;
      await thread.save();
    }
    const message = await Message.create({
      organizationId,
      threadId: thread._id,
      candidateId: payload.candidateId || thread.candidateId || null,
      channel: 'email',
      direction: 'outbound',
      fromName: user.name || 'Recruiter',
      fromAddress: user.email || '',
      toAddress,
      subject,
      body: previewBody || subject,
      bodyHtml: payload.bodyHtml || '',
      status: 'sent',
      isRead: true,
      sentBy: user.id || user._id,
      sentAt: new Date(),
    });
    return { thread, message };
  } catch (err) {
    return null;
  }
}

async function saveDraft(organizationId, user, body) {
  const channel = body.channel || 'email';
  const toAddress = String(body.toAddress || '').trim();
  const subject = String(body.subject || '').trim();
  const messageBody = String(body.body || '').trim();
  if (!toAddress && !subject && !messageBody) {
    throw httpError('Nothing to save');
  }

  let thread = null;
  if (body.draftId) {
    thread = await MessageThread.findOne({ _id: body.draftId, organizationId, isDraft: true });
    if (thread && !threadAssignedToUser(thread, user)) thread = null;
  }
  const preview = newestReplyPreview(messageBody) || messageBody.slice(0, 160);
  const payload = {
    organizationId,
    isDraft: true,
    archived: false,
    channel,
    subject: subject || '(draft)',
    draftTo: toAddress,
    draftBody: messageBody,
    lastMessageAt: new Date(),
    lastMessagePreview: preview,
    lastDirection: 'outbound',
    unreadCount: 0,
    createdBy: user.id || user._id,
    assignedTo: user.id || user._id,
    assignedName: user.name || '',
    assignedEmail: String(user.email || '').toLowerCase(),
    participants: {
      candidateName: body.candidateName || '',
      candidateEmail: channel === 'email' ? toAddress.toLowerCase() : '',
      candidatePhone: channel !== 'email' ? toAddress : '',
    },
  };
  if (thread) {
    Object.assign(thread, payload);
    await thread.save();
    return thread;
  }
  return MessageThread.create(payload);
}

async function markThreadRead(organizationId, threadId, user) {
  const existing = await MessageThread.findOne({ _id: threadId, organizationId });
  if (!existing) throw httpError('Thread not found', 404);
  if (user && !canViewThread(existing, user)) throw httpError('Thread not found', 404);
  const thread = await MessageThread.findOneAndUpdate(
    { _id: threadId, organizationId },
    { $set: { unreadCount: 0 } },
    { new: true }
  );
  if (!thread) throw httpError('Thread not found', 404);
  const siblings = await siblingThreads(organizationId, thread.toObject ? thread.toObject() : thread, user);
  const ids = siblings.map((t) => t._id);
  await MessageThread.updateMany(
    { _id: { $in: ids }, organizationId },
    { $set: { unreadCount: 0 } }
  );
  await Message.updateMany(
    { threadId: { $in: ids }, organizationId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return thread;
}

async function updateThread(organizationId, threadId, body, user) {
  const existing = await MessageThread.findOne({ _id: threadId, organizationId });
  if (!existing) throw httpError('Thread not found', 404);
  if (user && !canViewThread(existing, user)) throw httpError('Thread not found', 404);
  const update = {};
  if (typeof body.archived === 'boolean') update.archived = body.archived;
  if (typeof body.starred === 'boolean') update.starred = body.starred;
  if (body.subject != null) update.subject = body.subject;
  if (typeof body.unread === 'boolean' && body.unread) {
    update.unreadCount = Math.max(existing.unreadCount || 0, 1);
  }
  if (body.snoozedUntil === null || body.snooze === false) {
    update.snoozedUntil = null;
  } else if (body.snoozedUntil) {
    const when = new Date(body.snoozedUntil);
    if (!Number.isFinite(when.getTime())) throw httpError('Invalid snooze time');
    update.snoozedUntil = when;
    update.archived = false;
  }
  if (body.assignedTo) {
    const canAssign = canManageSharedMailbox(user) || threadAssignedToUser(existing, user);
    if (!canAssign) throw httpError('You cannot reassign this conversation', 403);
    const assignee = await User.findOne({
      _id: body.assignedTo,
      organizationId,
    }).select('_id name email role').lean();
    if (!assignee || !isInboxEmployee(assignee)) throw httpError('Choose a company employee');
    update.assignedTo = assignee._id;
    update.assignedName = assignee.name || '';
    update.assignedEmail = String(assignee.email || '').toLowerCase();
  }

  const thread = await MessageThread.findOneAndUpdate(
    { _id: threadId, organizationId },
    { $set: update },
    { new: true }
  );
  if (!thread) throw httpError('Thread not found', 404);
  return thread;
}

async function deleteThread(organizationId, threadId, user) {
  const existing = await MessageThread.findOne({ _id: threadId, organizationId });
  if (!existing) throw httpError('Thread not found', 404);
  if (user && !canViewThread(existing, user)) throw httpError('Thread not found', 404);
  await Message.deleteMany({ threadId: existing._id, organizationId });
  await MessageThread.deleteOne({ _id: existing._id, organizationId });
  return { deleted: true, id: String(existing._id) };
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

async function downloadAttachment(organizationId, user, { threadId, messageId, attachmentId }) {
  const thread = await MessageThread.findOne({ _id: threadId, organizationId }).lean();
  if (!thread || (user && !canViewThread(thread, user))) throw httpError('Thread not found', 404);
  const message = await Message.findOne({ _id: messageId, threadId, organizationId }).lean();
  if (!message) throw httpError('Message not found', 404);
  const att = (message.attachments || []).find((a) => String(a._id) === String(attachmentId));
  if (!att?.storageKey) throw httpError('Attachment not found', 404);
  const buffer = await attachmentsStore.readBuffer(att.storageKey);
  return {
    buffer,
    filename: att.filename || 'attachment',
    contentType: att.contentType || 'application/octet-stream',
  };
}

async function listAssignees(organizationId) {
  const users = await User.find({ organizationId, isActive: { $ne: false } })
    .select('_id name email role')
    .sort({ name: 1 })
    .lean();
  return users.filter(isInboxEmployee).map((u) => ({
    _id: u._id,
    name: u.name || u.email,
    email: u.email,
    role: u.role,
  }));
}

module.exports = {
  hasChannelConsent,
  getInboxStats,
  listThreads,
  getThread,
  createOutbound,
  recordSentMail,
  saveDraft,
  markThreadRead,
  updateThread,
  deleteThread,
  updateMessagingConsent,
  downloadAttachment,
  listAssignees,
};
