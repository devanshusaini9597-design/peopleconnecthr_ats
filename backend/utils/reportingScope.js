/**
 * Reporting line + safe inbox writes.
 * notifications are always per-recipient userId; never fan out org-wide.
 */
const mongoose = require('mongoose');
const logger = require('./logger');

const REPORTS_TO_ROLES = ['owner', 'admin', 'hr_manager'];

function canAssignReportsTo(user) {
  return Boolean(user && REPORTS_TO_ROLES.includes(user.role));
}

function asId(value) {
  const id = String(value || '').trim();
  return mongoose.Types.ObjectId.isValid(id) ? id : '';
}

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function getOrgUser(organizationId, userId, fields = '_id name email role reportsTo isActive') {
  const id = asId(userId);
  if (!organizationId || !id) return null;
  const User = require('../models/User');
  return User.findOne({ _id: id, organizationId }).select(fields).lean();
}

async function wouldCreateCycle(organizationId, targetUserId, managerId) {
  let current = asId(managerId);
  const stop = String(targetUserId);
  const seen = new Set();
  while (current) {
    if (current === stop) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    const row = await getOrgUser(organizationId, current, 'reportsTo');
    current = asId(row?.reportsTo);
  }
  return false;
}

async function setReportsTo({ organizationId, targetUserId, managerId }) {
  const User = require('../models/User');
  const target = await getOrgUser(organizationId, targetUserId);
  if (!target) throw httpError('User not found in this organization', 404);

  const nextId = asId(managerId);
  if (!nextId) {
    const user = await User.findOneAndUpdate(
      { _id: target._id, organizationId },
      { $unset: { reportsTo: 1 } },
      { new: true }
    ).select('-password -inviteToken');
    return user;
  }

  if (nextId === String(target._id)) {
    throw httpError('Someone cannot report to themselves', 400);
  }

  const manager = await getOrgUser(organizationId, nextId);
  if (!manager) throw httpError('Manager must be in the same organization', 400);
  if (manager.isActive === false) throw httpError('Manager invite is still pending', 400);
  if (await wouldCreateCycle(organizationId, target._id, nextId)) {
    throw httpError('That reporting line would loop', 400);
  }

  const user = await User.findOneAndUpdate(
    { _id: target._id, organizationId },
    { $set: { reportsTo: manager._id } },
    { new: true }
  ).select('-password -inviteToken');
  return user;
}

async function getManager(organizationId, userId) {
  const user = await getOrgUser(organizationId, userId, 'reportsTo');
  if (!user?.reportsTo) return null;
  return getOrgUser(organizationId, user.reportsTo, '_id name email role isActive');
}

async function listDirectReports(organizationId, managerId) {
  const User = require('../models/User');
  const id = asId(managerId);
  if (!organizationId || !id) return [];
  return User.find({
    organizationId,
    reportsTo: id,
    isActive: { $ne: false },
  }).select('_id name email role').sort({ name: 1 }).lean();
}

async function listMentionables(organizationId, { excludeId } = {}) {
  const User = require('../models/User');
  if (!organizationId) return [];
  const rows = await User.find({
    organizationId,
    isActive: { $ne: false },
  }).select('_id name email role').sort({ name: 1 }).lean();
  const skip = String(excludeId || '');
  return rows
    .filter((u) => String(u._id) !== skip)
    .map((u) => ({
      id: String(u._id),
      name: u.name || (u.email || '').split('@')[0] || 'Teammate',
      email: u.email || '',
      role: u.role || '',
    }));
}

function tagHandleFromName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function extractTagMemberIds(body, tags) {
  const text = String(body || '').toLowerCase();
  if (!text || !Array.isArray(tags) || !tags.length) return [];
  const hits = new Set();
  const sorted = [...tags].sort((a, b) => String(b.handle || '').length - String(a.handle || '').length);
  for (const tag of sorted) {
    const handle = String(tag.handle || tagHandleFromName(tag.name)).toLowerCase();
    if (!handle || handle.length < 2) continue;
    if (text.includes(`@${handle}`)) {
      (tag.memberIds || []).forEach((id) => {
        const ok = asId(id);
        if (ok) hits.add(ok);
      });
    }
  }
  return [...hits];
}

async function claimDirectReport({ organizationId, actor, targetUserId }) {
  const managerId = actor.id || actor._id;
  const target = await getOrgUser(organizationId, targetUserId);
  if (!target) throw httpError('User not found in this organization', 404);
  if (String(target._id) === String(managerId)) {
    throw httpError('You cannot add yourself', 400);
  }
  if (target.role === 'owner' || target.role === 'freelancer') {
    throw httpError('That person cannot be added to a personal team', 400);
  }
  const current = asId(target.reportsTo);
  if (current && current !== String(managerId) && !canAssignReportsTo(actor)) {
    throw httpError('They already report to someone else. Ask an admin to move them.', 403);
  }
  return setReportsTo({
    organizationId,
    targetUserId: target._id,
    managerId,
  });
}

async function releaseDirectReport({ organizationId, actor, targetUserId }) {
  const managerId = String(actor.id || actor._id);
  const target = await getOrgUser(organizationId, targetUserId);
  if (!target) throw httpError('User not found in this organization', 404);
  const current = asId(target.reportsTo);
  if (current !== managerId && !canAssignReportsTo(actor)) {
    throw httpError('You can only remove people who report to you', 403);
  }
  return setReportsTo({
    organizationId,
    targetUserId: target._id,
    managerId: null,
  });
}

function extractMentionIds(body, teammates) {
  const text = String(body || '');
  if (!text || !Array.isArray(teammates) || !teammates.length) return [];
  const hits = new Set();

  for (const raw of [...text.matchAll(/<@([a-f0-9]{24})>/gi)]) {
    hits.add(String(raw[1]));
  }

  const sorted = [...teammates].sort((a, b) => {
    const an = String(a.name || a.email || '').length;
    const bn = String(b.name || b.email || '').length;
    return bn - an;
  });

  const lower = text.toLowerCase();
  for (const u of sorted) {
    const id = String(u.id || u._id || '');
    if (!id) continue;
    const first = String(u.name || '').trim().split(/\s+/)[0];
    const full = String(u.name || '').trim();
    const email = String(u.email || '').trim();
    const local = email.split('@')[0];
    const needles = [full, first, email, local]
      .map((s) => s && `@${s}`.toLowerCase())
      .filter(Boolean);
    if (needles.some((n) => n.length > 1 && lower.includes(n))) hits.add(id);
  }

  const allowed = new Set(teammates.map((u) => String(u.id || u._id)));
  return [...hits].filter((id) => allowed.has(id));
}

async function notifyUser(userId, payload = {}) {
  const id = asId(userId);
  if (!id || !payload.title || !payload.message || !payload.type) return null;
  const prefsSvc = require('../services/notificationPreferencesService');
  const ok = await prefsSvc.shouldDeliver(id, payload.type, 'inApp', {
    priority: payload.priority || 'medium',
  });
  if (!ok) return null;
  const Notification = require('../models/Notification');
  try {
    return await Notification.create({
      userId: id,
      senderId: payload.senderId || null,
      senderName: payload.senderName || '',
      type: payload.type,
      title: String(payload.title).slice(0, 180),
      message: String(payload.message).slice(0, 2000),
      candidateId: payload.candidateId || undefined,
      candidateName: payload.candidateName || undefined,
      candidatePosition: payload.candidatePosition || undefined,
      relatedEmail: payload.relatedEmail || '',
      linkUrl: payload.linkUrl ? String(payload.linkUrl).slice(0, 500) : '',
      priority: payload.priority || 'medium',
    });
  } catch (err) {
    logger.warn('[notifyUser]', err.message);
    return null;
  }
}

async function notifyMany(userIds, payload, { skipId, skipPrefs = false } = {}) {
  const skip = asId(skipId);
  const unique = [...new Set((userIds || []).map((id) => asId(id)).filter(Boolean))]
    .filter((id) => id !== skip);
  if (!unique.length || !payload.title || !payload.message || !payload.type) return [];
  const prefsSvc = require('../services/notificationPreferencesService');
  const allowed = [];
  for (const id of unique) {
    if (skipPrefs) {
      allowed.push(id);
      continue;
    }
    const ok = await prefsSvc.shouldDeliver(id, payload.type, 'inApp', {
      priority: payload.priority || 'medium',
    });
    if (ok) allowed.push(id);
  }
  if (!allowed.length) return [];
  const Notification = require('../models/Notification');
  const docs = allowed.map((id) => {
    let userOid = id;
    try {
      userOid = new mongoose.Types.ObjectId(String(id));
    } catch {
      userOid = id;
    }
    let senderOid = payload.senderId || null;
    if (senderOid) {
      try {
        senderOid = new mongoose.Types.ObjectId(String(senderOid));
      } catch {
        /* keep */
      }
    }
    return {
      userId: userOid,
      senderId: senderOid,
      senderName: payload.senderName || '',
      type: payload.type,
      title: String(payload.title).slice(0, 180),
      message: String(payload.message).slice(0, 2000),
      candidateId: payload.candidateId || undefined,
      candidateName: payload.candidateName || undefined,
      candidatePosition: payload.candidatePosition || undefined,
      candidateContact: payload.candidateContact || undefined,
      relatedJobId: payload.relatedJobId || undefined,
      relatedEmail: payload.relatedEmail || '',
      linkUrl: payload.linkUrl ? String(payload.linkUrl).slice(0, 500) : '',
      priority: payload.priority || 'medium',
      isRead: false,
      isDismissed: false,
    };
  });
  try {
    return await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    logger.warn('[notifyMany]', err.message);
    return [];
  }
}

async function notifyInvolvedAndManagers({ organizationId, recipientIds, skipId, payload }) {
  const personal = await notifyMany(recipientIds, payload, { skipId });
  const managerIds = [];
  for (const id of [...new Set((recipientIds || []).map((id) => asId(id)).filter(Boolean))]) {
    const manager = await getManager(organizationId, id);
    if (manager?._id) managerIds.push(manager._id);
  }
  const team = await notifyMany(managerIds, {
    ...payload,
    type: 'team_activity',
  }, { skipId });
  return { personal, team };
}

const AUDIENCE_ROLES = {
  admins: ['owner', 'admin', 'hr_manager'],
  recruiters: ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales', 'other', 'interviewer', 'readonly'],
  freelancers: ['freelancer'],
};

async function listAudienceUserIds(organizationId, audience) {
  if (!organizationId || audience === 'public') return [];
  const User = require('../models/User');
  const { organizationIdMatch } = require('./dataScope');
  const orgClause = organizationIdMatch(organizationId);
  if (!orgClause) return [];
  const filter = {
    ...orgClause,
    isActive: { $ne: false },
  };
  if (audience === 'admins') {
    filter.role = { $in: AUDIENCE_ROLES.admins };
  } else if (audience === 'recruiters') {
    filter.role = { $in: AUDIENCE_ROLES.recruiters };
  } else if (audience === 'freelancers') {
    filter.role = { $in: AUDIENCE_ROLES.freelancers };
  } else if (audience === 'all') {
    // Company staff only — freelancers get freelancer-targeted notices separately
    filter.role = { $ne: 'freelancer' };
  } else {
    filter.role = { $ne: 'freelancer' };
  }
  const rows = await User.find(filter).select('_id').lean();
  return rows.map((row) => row._id);
}

async function notifyManagerOf(actor, payload) {
  if (!actor?.organizationId) return null;
  const actorId = actor.id || actor._id;
  const manager = await getManager(actor.organizationId, actorId);
  if (!manager || manager.isActive === false) return null;
  if (String(manager._id) === String(actorId)) return null;
  return notifyUser(manager._id, {
    ...payload,
    type: 'team_activity',
    senderId: actorId,
    senderName: actor.name || actor.email || 'Teammate',
    priority: payload.priority || 'medium',
  });
}

function notificationChannelFilter(channel) {
  if (!channel || channel === 'all') return {};
  if (channel === 'mention') return { type: 'mention' };
  if (channel === 'team') return { type: 'team_activity' };
  if (channel === 'company') return { type: 'announcement' };
  if (channel === 'me') {
    return { type: { $nin: ['mention', 'team_activity', 'announcement', 'system'] } };
  }
  return {};
}

module.exports = {
  REPORTS_TO_ROLES,
  canAssignReportsTo,
  asId,
  getOrgUser,
  wouldCreateCycle,
  setReportsTo,
  getManager,
  listDirectReports,
  listMentionables,
  tagHandleFromName,
  extractTagMemberIds,
  claimDirectReport,
  releaseDirectReport,
  extractMentionIds,
  notifyUser,
  notifyMany,
  notifyInvolvedAndManagers,
  listAudienceUserIds,
  notifyManagerOf,
  notificationChannelFilter,
};
