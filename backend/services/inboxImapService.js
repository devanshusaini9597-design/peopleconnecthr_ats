/**
 * Poll a shared Hostinger (or any IMAP) mailbox and ingest inbound mail
 * into ATS Inbox threads. Matches hiring-contact stamp, plus-tags, and
 * EmailSendLog so staff can see whose campaign a reply belongs to.
 */
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const EmailSendLog = require('../models/EmailSendLog');
const {
  normalizeEmail,
  normalizeSubject,
  conversationRootSubject,
  htmlToText,
  parseHiringContact,
  plusLocalFromAddress,
  subjectsLikelyMatch,
  newestReplyPreview,
  bucketMessagesByOwner,
} = require('./inboxImapMatch');

const { canManageSharedMailbox, assigneeFilter } = require('../utils/inboxAccess');
const attachmentsStore = require('./inboxAttachmentStore');

const FIRST_SYNC_DAYS = 30;

function envMailbox() {
  const user = normalizeEmail(process.env.INBOX_IMAP_USER);
  const pass = String(process.env.INBOX_IMAP_PASS || '').trim();
  if (!user || !pass) return null;
  return {
    host: String(process.env.INBOX_IMAP_HOST || 'imap.hostinger.com').trim() || 'imap.hostinger.com',
    port: Number(process.env.INBOX_IMAP_PORT || 993) || 993,
    user,
    pass,
    organizationId: String(process.env.INBOX_IMAP_ORGANIZATION_ID || '').trim(),
    orgSlug: String(process.env.INBOX_IMAP_ORG_SLUG || '').trim().toLowerCase(),
  };
}

function decryptOrgPassword(passwordEnc) {
  if (!passwordEnc) return '';
  const payload = decrypt(passwordEnc);
  if (payload && typeof payload === 'object' && payload.password) {
    return String(payload.password);
  }
  if (typeof payload === 'string') return payload;
  return '';
}

async function resolveEnvOrg() {
  const env = envMailbox();
  if (!env) return null;
  if (env.organizationId) {
    return Organization.findById(env.organizationId);
  }
  if (env.orgSlug) {
    return Organization.findOne({ slug: env.orgSlug });
  }
  return Organization.findOne({
    $or: [
      { slug: /skillnix/i },
      { name: /skillnix/i },
    ],
  });
}

function envAppliesToOrg(org, env) {
  if (!env) return false;
  if (env.organizationId) return String(org._id) === env.organizationId;
  if (env.orgSlug) return String(org.slug || '').toLowerCase() === env.orgSlug;
  return /skillnix/i.test(String(org.slug || '')) || /skillnix/i.test(String(org.name || ''));
}

function mailboxFromOrg(org, env) {
  const box = org.atsSettings?.sharedInbox || {};
  const useEnv = envAppliesToOrg(org, env);
  const user = normalizeEmail(useEnv && env.user ? env.user : box.user);
  const pass = (useEnv && env.pass) || decryptOrgPassword(box.passwordEnc);
  const host = (useEnv && env.host) || box.host || 'imap.hostinger.com';
  const port = (useEnv && env.port) || box.port || 993;
  if (!user || !pass) return null;
  return {
    host,
    port,
    user,
    pass,
    lastUid: Number(box.lastUid || 0),
    uidValidity: String(box.uidValidity || ''),
  };
}

async function listMailboxTargets() {
  const env = envMailbox();
  const orgs = await Organization.find({
    $or: [
      { 'atsSettings.sharedInbox.enabled': true },
      { 'atsSettings.sharedInbox.passwordEnc': { $gt: '' } },
    ],
  });
  const byId = new Map();
  for (const org of orgs) {
    const cfg = mailboxFromOrg(org, env);
    if (cfg) byId.set(String(org._id), { org, cfg });
  }
  if (env) {
    const envOrg = await resolveEnvOrg();
    if (envOrg) {
      const cfg = mailboxFromOrg(envOrg, env);
      if (cfg) byId.set(String(envOrg._id), { org: envOrg, cfg });
    }
  }
  return [...byId.values()];
}

async function getMailboxStatus(organizationId, user) {
  maybeSplitMergedThreads(organizationId).catch(() => {});
  const org = await Organization.findById(organizationId).lean();
  const canEdit = canManageSharedMailbox(user);
  if (!org) return { connected: false, canEdit };
  const env = envMailbox();
  const cfg = mailboxFromOrg(org, env);
  const box = org.atsSettings?.sharedInbox || {};
  if (!canEdit) {
    return {
      connected: Boolean(cfg),
      user: cfg?.user || box.user || '',
      lastSyncAt: box.lastSyncAt || null,
      canEdit: false,
    };
  }
  return {
    connected: Boolean(cfg),
    viaEnv: Boolean(env && cfg && normalizeEmail(cfg.user) === env.user),
    host: cfg?.host || box.host || 'imap.hostinger.com',
    port: cfg?.port || box.port || 993,
    user: cfg?.user || box.user || '',
    lastSyncAt: box.lastSyncAt || null,
    lastError: box.lastError || '',
    hasPassword: Boolean(box.passwordEnc || (env && env.pass)),
    canEdit: true,
  };
}

async function saveMailbox(organizationId, body = {}) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    const err = new Error('Organization not found');
    err.statusCode = 404;
    throw err;
  }
  org.atsSettings = org.atsSettings || {};
  const prev = org.atsSettings.sharedInbox || {};
  const user = normalizeEmail(body.user);
  const host = String(body.host || prev.host || 'imap.hostinger.com').trim() || 'imap.hostinger.com';
  const port = Number(body.port || prev.port || 993) || 993;
  const enabled = body.enabled !== false;
  let passwordEnc = prev.passwordEnc || '';
  if (String(body.password || '').trim()) {
    passwordEnc = encrypt({ password: String(body.password).trim() });
  }
  if (enabled && !user) {
    const err = new Error('Mailbox email is required');
    err.statusCode = 400;
    throw err;
  }
  if (enabled && !passwordEnc && !envMailbox()) {
    const err = new Error('Mailbox password is required');
    err.statusCode = 400;
    throw err;
  }
  org.atsSettings.sharedInbox = {
    enabled,
    host,
    port,
    user,
    passwordEnc,
    lastUid: prev.lastUid || 0,
    uidValidity: prev.uidValidity || '',
    lastSyncAt: prev.lastSyncAt || null,
    lastError: '',
  };
  org.markModified('atsSettings');
  await org.save();
  return getMailboxStatus(organizationId, { role: 'owner' });
}

async function findAssignedUser(organizationId, { email, name, plusLocal, mailboxUser }) {
  if (email) {
    const byEmail = await User.findOne({
      organizationId,
      email: normalizeEmail(email),
    }).select('_id name email').lean();
    if (byEmail) return byEmail;
  }
  if (plusLocal) {
    const tag = String(plusLocal).toLowerCase();
    const users = await User.find({ organizationId }).select('_id name email').lean();
    const hit = users.find((u) => {
      const local = String(u.email || '').split('@')[0].toLowerCase();
      const nm = String(u.name || '').toLowerCase().replace(/\s+/g, '');
      return local === tag || local.startsWith(tag) || nm.startsWith(tag);
    });
    if (hit) return hit;
  }
  if (name) {
    const re = new RegExp(`^${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const byName = await User.findOne({ organizationId, name: re }).select('_id name email').lean();
    if (byName) return byName;
  }
  return null;
}

async function matchCampaignLog(organizationId, fromEmail, subject) {
  const logs = await EmailSendLog.find({
    organizationId,
    channel: 'marketing',
    'recipients.email': fromEmail,
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();
  return logs.find((log) => subjectsLikelyMatch(log.subject, subject)) || null;
}

async function userById(id) {
  if (!id) return null;
  return User.findById(id).select('_id name email').lean();
}

async function findLastOutboundOwner(organizationId, fromEmail, subject) {
  const msgs = await Message.find({
    organizationId,
    direction: 'outbound',
    sentBy: { $exists: true, $ne: null },
    toAddress: new RegExp(`^${escapeRegex(fromEmail)}$`, 'i'),
  })
    .sort({ sentAt: -1 })
    .limit(50)
    .select('sentBy subject')
    .lean();
  const hit = msgs.find((m) => subjectsLikelyMatch(m.subject, subject)) || msgs[0];
  return userById(hit?.sentBy);
}

function headerIdList(parsed) {
  const raw = []
    .concat(parsed?.inReplyTo || [])
    .concat(parsed?.references || []);
  return raw
    .flatMap((v) => String(v || '').split(/\s+/))
    .map((s) => s.replace(/^<|>$/g, '').trim())
    .filter(Boolean);
}

async function findOwnerByReplyHeaders(organizationId, parsed) {
  const ids = headerIdList(parsed);
  if (!ids.length) return null;
  const msg = await Message.findOne({
    organizationId,
    direction: 'outbound',
    sentBy: { $exists: true, $ne: null },
    externalId: { $in: ids },
  })
    .sort({ sentAt: -1 })
    .select('sentBy')
    .lean();
  return userById(msg?.sentBy);
}

async function findOrCreateThread({
  organizationId,
  candidate,
  fromEmail,
  fromName,
  subject,
  assigned,
  preview,
  sentAt,
}) {
  const root = conversationRootSubject(subject).toLowerCase();
  const pool = await MessageThread.find({
    organizationId,
    'participants.candidateEmail': fromEmail,
    archived: { $ne: true },
    isDraft: { $ne: true },
    $and: [assigneeFilter(assigned || null)],
  }).sort({ lastMessageAt: -1 }).limit(40);

  const existing = pool.find((t) => {
    const tRoot = conversationRootSubject(t.subject).toLowerCase();
    if (root && tRoot && tRoot === root) return true;
    return subjectsLikelyMatch(t.subject, subject);
  }) || null;

  if (existing) {
    existing.lastMessageAt = sentAt || new Date();
    existing.lastMessagePreview = preview;
    existing.lastDirection = 'inbound';
    existing.unreadCount = (existing.unreadCount || 0) + 1;
    existing.channel = existing.channel === 'email' || !existing.channel ? 'email' : 'mixed';
    existing.source = existing.source || 'imap';
    if (assigned) {
      existing.assignedTo = assigned._id;
      existing.assignedName = assigned.name || existing.assignedName || '';
      existing.assignedEmail = assigned.email || existing.assignedEmail || '';
    }
    if (candidate && !existing.candidateId) existing.candidateId = candidate._id;
    if (fromName && !existing.participants?.candidateName) {
      existing.participants = existing.participants || {};
      existing.participants.candidateName = fromName;
    }
    await existing.save();
    return existing;
  }

  return MessageThread.create({
    organizationId,
    candidateId: candidate?._id || null,
    subject: subject || '(no subject)',
    channel: 'email',
    participants: {
      candidateName: fromName || candidate?.name || fromEmail,
      candidateEmail: fromEmail,
      candidatePhone: candidate?.phone || '',
    },
    unreadCount: 1,
    lastMessageAt: sentAt || new Date(),
    lastMessagePreview: preview,
    lastDirection: 'inbound',
    source: 'imap',
    assignedTo: assigned?._id || null,
    assignedName: assigned?.name || '',
    assignedEmail: assigned?.email || '',
    createdBy: assigned?._id || null,
  });
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function previewFrom(text, html) {
  return newestReplyPreview(text, html) || String(text || htmlToText(html) || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

async function saveImapAttachments(organizationId, parsed) {
  const saved = [];
  for (const a of parsed.attachments || []) {
    if (saved.length >= attachmentsStore.MAX_FILES) break;
    const filename = String(a.filename || '').trim();
    if (!filename || !a.content) continue;
    if (a.contentDisposition === 'inline' && /^image\//i.test(String(a.contentType || ''))) continue;
    try {
      saved.push(await attachmentsStore.persistOne(organizationId, {
        originalname: filename,
        buffer: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
        mimetype: a.contentType || 'application/octet-stream',
      }));
    } catch {
      /* skip disallowed or oversized */
    }
  }
  return saved;
}

async function ingestParsed({ org, mailboxUser, uid, uidValidity, parsed }) {
  const fromEmail = normalizeEmail(parsed.from?.value?.[0]?.address || parsed.from?.text);
  const fromName = String(parsed.from?.value?.[0]?.name || parsed.from?.text || '').trim();
  if (!fromEmail) return { skipped: true, reason: 'no-from' };
  if (fromEmail === normalizeEmail(mailboxUser)) return { skipped: true, reason: 'self' };
  if (/noreply|no-reply|mailer-daemon|postmaster@/i.test(fromEmail)) {
    return { skipped: true, reason: 'system' };
  }

  const externalId = `imap:${normalizeEmail(mailboxUser)}:${uidValidity}:${uid}`;
  const already = await Message.findOne({ organizationId: org._id, externalId }).select('_id').lean();
  if (already) return { skipped: true, reason: 'dup' };

  const subject = String(parsed.subject || '').trim();
  const text = String(parsed.text || '');
  const html = parsed.html && typeof parsed.html === 'string'
    ? parsed.html
    : (parsed.html ? String(parsed.html) : '');
  const combined = `${text}\n${html}\n${htmlToText(html)}\n${subject}`;
  const stamp = parseHiringContact(combined);
  const toList = [
    ...(parsed.to?.value || []),
    ...(parsed.cc?.value || []),
  ].map((a) => a.address);
  const plusLocal = toList.map(plusLocalFromAddress).find(Boolean) || '';

  const stampUser = await findAssignedUser(org._id, {
    email: stamp?.email,
    name: stamp?.name,
    plusLocal,
  });

  const candidate = await Candidate.findOne({
    organizationId: org._id,
    email: fromEmail,
  }).select('_id name email phone').lean();

  const log = await matchCampaignLog(org._id, fromEmail, subject);
  if (log && Array.isArray(log.recipients)) {
    const rec = log.recipients.find((r) => normalizeEmail(r.email) === fromEmail);
    if (rec && rec.status !== 'replied') {
      await EmailSendLog.updateOne(
        { _id: log._id, 'recipients.email': fromEmail },
        { $set: { 'recipients.$.status': 'replied', 'recipients.$.repliedAt': parsed.date || new Date() } }
      );
    }
  }

  const logUser = await userById(log?.sentByUserId);
  const replyUser = (stampUser || logUser)
    ? null
    : await findOwnerByReplyHeaders(org._id, parsed);
  const outboundUser = (stampUser || logUser || replyUser)
    ? null
    : await findLastOutboundOwner(org._id, fromEmail, subject);
  const assigned = stampUser || logUser || replyUser || outboundUser || null;

  const preview = previewFrom(text, html);
  const thread = await findOrCreateThread({
    organizationId: org._id,
    candidate,
    fromEmail,
    fromName,
    subject,
    assigned,
    preview,
    sentAt: parsed.date || new Date(),
  });

  await Message.create({
    organizationId: org._id,
    threadId: thread._id,
    candidateId: candidate?._id || thread.candidateId || null,
    channel: 'email',
    direction: 'inbound',
    fromName: fromName || fromEmail,
    fromAddress: fromEmail,
    toAddress: mailboxUser,
    subject,
    body: text || htmlToText(html),
    bodyHtml: html,
    status: 'received',
    externalId,
    isRead: false,
    sentAt: parsed.date || new Date(),
    attachments: await saveImapAttachments(org._id, parsed),
  });

  return { ingested: true, threadId: thread._id };
}

async function persistSyncState(orgId, patch) {
  await Organization.updateOne(
    { _id: orgId },
    {
      $set: Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [`atsSettings.sharedInbox.${k}`, v])
      ),
    }
  );
}

async function pollOne({ org, cfg }) {
  const { ImapFlow } = require('imapflow');
  const { simpleParser } = require('mailparser');
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  let ingested = 0;
  let skipped = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uidValidity = String(client.mailbox?.uidValidity || '');
      let lastUid = cfg.lastUid;
      if (cfg.uidValidity && uidValidity && cfg.uidValidity !== uidValidity) {
        lastUid = 0;
      }

      const range = lastUid > 0
        ? { uid: `${lastUid + 1}:*` }
        : { since: new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000) };

      let maxUid = lastUid;
      try {
        for await (const msg of client.fetch(range, { uid: true, source: true })) {
          if (!msg.source) continue;
          maxUid = Math.max(maxUid, msg.uid);
          try {
            const parsed = await simpleParser(msg.source);
            const result = await ingestParsed({
              org,
              mailboxUser: cfg.user,
              uid: msg.uid,
              uidValidity: uidValidity || '0',
              parsed,
            });
            if (result.ingested) ingested += 1;
            else skipped += 1;
          } catch (err) {
            logger.warn({ err: err.message, uid: msg.uid }, '[inbox-imap] message ingest failed');
          }
        }
      } catch (err) {
        logger.warn({ err: err.message }, '[inbox-imap] fetch skipped');
      }
      const uidNext = Number(client.mailbox?.uidNext || 0);
      if (uidNext > 1) maxUid = Math.max(maxUid, uidNext - 1);

      await persistSyncState(org._id, {
        lastUid: maxUid,
        uidValidity,
        lastSyncAt: new Date(),
        lastError: '',
        enabled: true,
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
      });
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
  return { ingested, skipped };
}

async function splitMergedThreads(orgId) {
  const threads = await MessageThread.find({ organizationId: orgId })
    .select('_id assignedTo assignedEmail participants subject organizationId candidateId channel source createdBy')
    .lean();
  let created = 0;
  for (const t of threads) {
    const msgs = await Message.find({ threadId: t._id, organizationId: orgId }).sort({ sentAt: 1 });
    if (msgs.length < 2) continue;
    const { buckets, keepKey } = bucketMessagesByOwner(msgs, t);
    if (buckets.size <= 1) continue;
    const keep = keepKey && buckets.has(keepKey) ? keepKey : [...buckets.keys()][0];
    for (const [key, list] of buckets) {
      if (key === keep) continue;
      let user = null;
      if (key.startsWith('id:')) {
        user = await userById(key.slice(3));
      } else if (key.startsWith('em:')) {
        user = await User.findOne({ organizationId: orgId, email: key.slice(3) }).select('_id name email').lean();
      }
      const last = list[list.length - 1];
      const newThread = await MessageThread.create({
        organizationId: orgId,
        candidateId: t.candidateId || null,
        subject: t.subject || '(no subject)',
        channel: t.channel || 'email',
        participants: t.participants || {},
        source: t.source || 'imap',
        assignedTo: user?._id || null,
        assignedName: user?.name || '',
        assignedEmail: user?.email || (key.startsWith('em:') ? key.slice(3) : ''),
        createdBy: user?._id || null,
        unreadCount: list.filter((m) => m.direction === 'inbound' && !m.isRead).length,
        lastMessageAt: last.sentAt || new Date(),
        lastMessagePreview: String(last.body || '').replace(/\s+/g, ' ').trim().slice(0, 180),
        lastDirection: last.direction || 'inbound',
      });
      await Message.updateMany(
        { _id: { $in: list.map((m) => m._id) } },
        { $set: { threadId: newThread._id } }
      );
      created += 1;
    }
    const remain = await Message.find({ threadId: t._id, organizationId: orgId }).sort({ sentAt: -1 }).limit(1).lean();
    if (remain[0]) {
      await MessageThread.updateOne({ _id: t._id }, {
        $set: {
          lastMessageAt: remain[0].sentAt,
          lastMessagePreview: String(remain[0].body || '').replace(/\s+/g, ' ').trim().slice(0, 180),
          lastDirection: remain[0].direction,
        },
      });
    }
  }
  return { created };
}

const lastSplitAt = new Map();
async function maybeSplitMergedThreads(orgId) {
  const key = String(orgId);
  const now = Date.now();
  if ((lastSplitAt.get(key) || 0) + 60_000 > now) return { created: 0, skipped: true };
  lastSplitAt.set(key, now);
  return splitMergedThreads(orgId);
}

async function pollAllMailboxes() {
  const targets = await listMailboxTargets();
  const results = [];
  for (const target of targets) {
    try {
      const r = await pollOne(target);
      const split = await splitMergedThreads(target.org._id).catch(() => ({ created: 0 }));
      results.push({ orgId: String(target.org._id), ...r, split: split.created });
    } catch (err) {
      logger.error({ err: err.message, orgId: String(target.org._id) }, '[inbox-imap] poll failed');
      await persistSyncState(target.org._id, { lastError: err.message, lastSyncAt: new Date() });
      results.push({ orgId: String(target.org._id), error: err.message });
    }
  }
  return { polled: targets.length, results };
}

async function pollOrganization(organizationId) {
  const targets = await listMailboxTargets();
  const target = targets.find((t) => String(t.org._id) === String(organizationId));
  if (!target) {
    const err = new Error('No IMAP mailbox is connected for this organization');
    err.statusCode = 400;
    throw err;
  }
  try {
    const r = await pollOne(target);
    const split = await splitMergedThreads(target.org._id);
    return { ...r, split: split.created };
  } catch (err) {
    await persistSyncState(target.org._id, { lastError: err.message, lastSyncAt: new Date() });
    throw err;
  }
}

module.exports = {
  getMailboxStatus,
  saveMailbox,
  pollAllMailboxes,
  pollOrganization,
  pollOne,
  ingestParsed,
  splitMergedThreads,
  listMailboxTargets,
};
