const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { resolveAnnouncementRecipientIds } = require('./announcementAudience');
const { toPlainText } = require('../utils/announcementContent');

const PRIVATE_ROOT = path.join(__dirname, '..', 'private-uploads', 'announcements');

function userIdOf(user) {
  return user?.id || user?._id;
}

function sameId(a, b) {
  return String(a || '') === String(b || '');
}

function includesId(list, userId) {
  const id = String(userId || '');
  return (list || []).some((item) => String(item) === id);
}

function authorName(row) {
  const createdBy = row?.createdBy;
  if (createdBy && typeof createdBy === 'object') {
    return createdBy.name || createdBy.email || 'Leadership';
  }
  return 'Leadership';
}

function publicAttachments(row) {
  return (row.attachments || []).map((file) => ({
    _id: file._id,
    name: file.name,
    mime: file.mime || '',
    size: file.size || 0,
  }));
}

function presentAnnouncement(row, userId, { manage = false } = {}) {
  const plain = toPlainText(row.body || '');
  const base = {
    _id: row._id,
    title: row.title,
    body: row.body,
    plain,
    severity: row.severity,
    audience: row.audience,
    status: row.status || 'published',
    startsAt: row.startsAt,
    endsAt: row.endsAt || null,
    isActive: row.isActive !== false,
    pinned: Boolean(row.pinned),
    requiresAck: Boolean(row.requiresAck),
    targets: {
      departments: row.targets?.departments || [],
      locations: row.targets?.locations || [],
      offices: row.targets?.offices || [],
      teamManagerIds: (row.targets?.teamManagerIds || []).map((id) => String(id)),
    },
    attachments: publicAttachments(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    authorName: authorName(row),
    isRead: includesId(row.readBy, userId),
    isDismissed: includesId(row.dismissedBy, userId),
    isAcked: includesId(row.ackedBy, userId),
  };

  if (!manage) return base;

  const authorId = row.createdBy && typeof row.createdBy === 'object'
    ? row.createdBy._id
    : row.createdBy;
  const readers = (row.readBy || []).filter((id) => !sameId(id, authorId));
  return {
    ...base,
    readCount: readers.length,
    dismissedCount: (row.dismissedBy || []).length,
    ackCount: (row.ackedBy || []).length,
    emailDelivery: row.emailDelivery || { status: 'skipped', sent: 0, failed: 0, total: 0 },
  };
}

async function writeAudit(req, action, row, extra = {}) {
  try {
    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: userIdOf(req.user),
      action,
      resource: 'announcement',
      resourceId: row?._id,
      details: {
        title: row?.title || extra.title || '',
        message: extra.message || '',
      },
      ipAddress: req.ip || '',
      userAgent: req.get?.('user-agent') || '',
    });
  } catch {
    /* audit must not block the notice */
  }
}

async function stampUser(announcementId, organizationId, userId, fields) {
  const now = new Date();
  const add = {};
  const dates = {};
  if (fields.seen) {
    add.seenBy = userId;
    dates.seenAt = now;
  }
  if (fields.read) {
    add.readBy = userId;
    dates.readAt = now;
  }
  if (fields.dismiss) {
    add.dismissedBy = userId;
    dates.dismissedAt = now;
  }
  if (fields.ack) {
    add.ackedBy = userId;
    dates.ackedAt = now;
  }

  const set = {};
  for (const [key, value] of Object.entries(dates)) {
    set[`receipts.$[r].${key}`] = value;
  }

  const updated = await Announcement.updateOne(
    { _id: announcementId, organizationId, 'receipts.userId': userId },
    { $addToSet: add, ...(Object.keys(set).length ? { $set: set } : {}) },
    { arrayFilters: [{ 'r.userId': userId }] }
  );

  if (!updated.matchedCount) {
    await Announcement.updateOne(
      { _id: announcementId, organizationId },
      {
        $addToSet: add,
        $push: { receipts: { userId, ...dates } },
      }
    );
  }
}

async function notifyAudience(row, actor, { email = true } = {}) {
  if (!row || row.status === 'draft' || row.audience === 'public' || row.isActive === false) {
    return;
  }
  const actorId = userIdOf(actor);
  try {
    const { notifyMany } = require('../utils/reportingScope');
    const ids = await resolveAnnouncementRecipientIds(row.organizationId, row);
    const plain = toPlainText(row.body || '');
    await notifyMany(ids, {
      type: 'announcement',
      title: row.title,
      message: plain,
      senderId: actorId,
      senderName: actor.name || 'Company',
      priority: row.severity === 'critical' ? 'urgent' : row.severity === 'warning' ? 'high' : 'medium',
      organizationId: row.organizationId,
    }, { skipId: actorId });
  } catch {
    /* in-app notice still stands */
  }

  const shouldEmail = email && row.audience !== 'freelancers' && row.audience !== 'public';
  if (!shouldEmail) {
    await Announcement.updateOne(
      { _id: row._id },
      { $set: { emailDelivery: { status: 'skipped', sent: 0, failed: 0, total: 0, finishedAt: new Date() } } }
    );
    return;
  }

  await Announcement.updateOne(
    { _id: row._id },
    { $set: { 'emailDelivery.status': 'queued' } }
  );

  const { emailAnnouncementToAudience } = require('./announcementEmailService');
  emailAnnouncementToAudience({
    organizationId: row.organizationId,
    announcement: row,
    actorId,
    actorName: actor.name || actor.email || 'Leadership',
  }).then(async (result) => {
    const sent = result?.sent || 0;
    const failed = result?.failed || 0;
    const total = result?.total || sent + failed;
    let status = 'sent';
    if (result?.skipped) status = 'skipped';
    else if (!total && !sent) status = 'skipped';
    else if (sent === 0 && failed > 0) status = 'failed';
    else if (failed > 0) status = 'partial';
    await Announcement.updateOne(
      { _id: row._id },
      { $set: { emailDelivery: { status, sent, failed, total, finishedAt: new Date() } } }
    );
  }).catch(async () => {
    await Announcement.updateOne(
      { _id: row._id },
      { $set: { emailDelivery: { status: 'failed', sent: 0, failed: 0, total: 0, finishedAt: new Date() } } }
    );
  });
}

async function resetEngagement(row, actorId) {
  row.seenBy = actorId ? [actorId] : [];
  row.readBy = actorId ? [actorId] : [];
  row.dismissedBy = [];
  row.ackedBy = [];
  row.receipts = actorId
    ? [{ userId: actorId, seenAt: new Date(), readAt: new Date() }]
    : [];
  row.markModified('seenBy');
  row.markModified('readBy');
  row.markModified('dismissedBy');
  row.markModified('ackedBy');
  row.markModified('receipts');
}

async function receiptRoster(row) {
  const ids = [
    ...(row.readBy || []),
    ...(row.dismissedBy || []),
    ...(row.ackedBy || []),
    ...(row.seenBy || []),
  ];
  const unique = [...new Set(ids.map((id) => String(id)))].filter(Boolean).slice(0, 300);
  const people = unique.length
    ? await User.find({ _id: { $in: unique } }).select('name email role').lean()
    : [];
  const byId = new Map(people.map((person) => [String(person._id), person]));
  const receiptByUser = new Map((row.receipts || []).map((item) => [String(item.userId), item]));

  const mapIds = (list, dateKey) => (list || []).map((id) => {
    const person = byId.get(String(id));
    const receipt = receiptByUser.get(String(id));
    return {
      id: String(id),
      name: person?.name || 'Teammate',
      email: person?.email || '',
      role: person?.role || '',
      at: receipt?.[dateKey] || null,
    };
  });

  const authorId = String(row.createdBy?._id || row.createdBy || '');
  return {
    authorName: authorName(row),
    emailDelivery: row.emailDelivery || { status: 'skipped', sent: 0, failed: 0, total: 0 },
    read: mapIds(row.readBy, 'readAt').filter((person) => person.id !== authorId),
    dismissed: mapIds(row.dismissedBy, 'dismissedAt'),
    acknowledged: mapIds(row.ackedBy, 'ackedAt'),
    seen: mapIds(row.seenBy, 'seenAt').filter((person) => person.id !== authorId),
  };
}

function attachmentDir(organizationId, announcementId) {
  return path.join(PRIVATE_ROOT, String(organizationId), String(announcementId));
}

function safeStoredName(name) {
  const base = path.basename(String(name || ''));
  if (!base || base !== name || base.includes('..')) return null;
  return base;
}

async function removeAnnouncementFiles(row) {
  if (!row?._id || !row.organizationId) return;
  const dir = attachmentDir(row.organizationId, row._id);
  await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publishedMatch() {
  return { $or: [{ status: 'published' }, { status: { $exists: false } }, { status: null }] };
}

module.exports = {
  PRIVATE_ROOT,
  userIdOf,
  presentAnnouncement,
  writeAudit,
  stampUser,
  notifyAudience,
  resetEngagement,
  receiptRoster,
  attachmentDir,
  safeStoredName,
  removeAnnouncementFiles,
  escapeRegex,
  publishedMatch,
  objectId(id) {
    try {
      return new mongoose.Types.ObjectId(String(id));
    } catch {
      return id;
    }
  },
};
