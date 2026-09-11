const TeamTag = require('../models/TeamTag');
const User = require('../models/User');
const {
  asId,
  getManager,
  listDirectReports,
  listMentionables,
  tagHandleFromName,
  claimDirectReport,
  releaseDirectReport,
  canAssignReportsTo,
} = require('../utils/reportingScope');

const TAG_COLORS = ['brand', 'teal', 'amber', 'sky', 'rose', 'violet'];
const MAX_TAGS = 40;
const MAX_MEMBERS = 50;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function serializeUser(row) {
  if (!row) return null;
  return {
    id: String(row._id || row.id),
    name: row.name || (row.email || '').split('@')[0] || 'Teammate',
    email: row.email || '',
    role: row.role || '',
  };
}

function serializeTag(tag, actorId, memberMap = {}) {
  const members = (tag.memberIds || [])
    .map((id) => memberMap[String(id)] || { id: String(id), name: 'Teammate', email: '', role: '' });
  return {
    id: String(tag._id),
    name: tag.name,
    handle: tag.handle,
    color: tag.color || 'brand',
    memberIds: (tag.memberIds || []).map((id) => String(id)),
    members,
    memberCount: members.length,
    isOwner: String(tag.createdBy) === String(actorId),
  };
}

async function memberMapForOrg(organizationId, ids) {
  const unique = [...new Set((ids || []).map((id) => asId(id)).filter(Boolean))];
  if (!unique.length) return {};
  const rows = await User.find({
    organizationId,
    _id: { $in: unique },
  }).select('_id name email role').lean();
  const map = {};
  rows.forEach((row) => { map[String(row._id)] = serializeUser(row); });
  return map;
}

async function listOrgTags(organizationId) {
  if (!organizationId) return [];
  return TeamTag.find({ organizationId }).select('name handle memberIds').lean();
}

async function getOverview(user) {
  const organizationId = user.organizationId;
  const actorId = user.id || user._id;
  const [manager, reports, tags, colleagues] = await Promise.all([
    getManager(organizationId, actorId),
    listDirectReports(organizationId, actorId),
    TeamTag.find({ organizationId, createdBy: actorId }).sort({ name: 1 }).lean(),
    listMentionables(organizationId, { excludeId: actorId }),
  ]);
  const memberIds = tags.flatMap((t) => t.memberIds || []);
  const map = await memberMapForOrg(organizationId, memberIds);
  const reportIds = new Set(reports.map((r) => String(r._id)));
  return {
    manager: serializeUser(manager),
    reports: reports.map(serializeUser),
    tags: tags.map((tag) => serializeTag(tag, actorId, map)),
    colleagues: colleagues.filter((c) => c.role !== 'freelancer' && !reportIds.has(String(c.id))),
    canReassign: canAssignReportsTo(user),
  };
}

async function addReport(user, targetUserId) {
  return claimDirectReport({
    organizationId: user.organizationId,
    actor: user,
    targetUserId,
  });
}

async function removeReport(user, targetUserId) {
  return releaseDirectReport({
    organizationId: user.organizationId,
    actor: user,
    targetUserId,
  });
}

async function assertMembersInOrg(organizationId, memberIds) {
  const ids = [...new Set((memberIds || []).map((id) => asId(id)).filter(Boolean))];
  if (ids.length > MAX_MEMBERS) throw httpError(`A tag can have at most ${MAX_MEMBERS} people`);
  if (!ids.length) return [];
  const rows = await User.find({
    organizationId,
    _id: { $in: ids },
    role: { $ne: 'freelancer' },
  }).select('_id').lean();
  if (rows.length !== ids.length) {
    throw httpError('Every tagged person must be in your organization');
  }
  return rows.map((r) => r._id);
}

async function createTag(user, { name, color, memberIds }) {
  const label = String(name || '').trim();
  if (label.length < 2) throw httpError('Give the tag a name');
  const handle = tagHandleFromName(label);
  if (!handle || handle.length < 2) throw httpError('Use letters or numbers in the tag name');

  const count = await TeamTag.countDocuments({
    organizationId: user.organizationId,
    createdBy: user.id || user._id,
  });
  if (count >= MAX_TAGS) throw httpError(`You can create up to ${MAX_TAGS} tags`);

  const existing = await TeamTag.findOne({ organizationId: user.organizationId, handle });
  if (existing) throw httpError(`@${handle} is already used in this company`);

  const members = await assertMembersInOrg(user.organizationId, memberIds);
  const tag = await TeamTag.create({
    organizationId: user.organizationId,
    createdBy: user.id || user._id,
    name: label,
    handle,
    color: TAG_COLORS.includes(color) ? color : 'brand',
    memberIds: members,
  });
  const map = await memberMapForOrg(user.organizationId, members);
  return serializeTag(tag.toObject(), user.id || user._id, map);
}

async function canEditTag(user, tag) {
  if (!tag) return false;
  if (String(tag.createdBy) === String(user.id || user._id)) return true;
  return canAssignReportsTo(user);
}

async function updateTag(user, tagId, { name, color, memberIds }) {
  const tag = await TeamTag.findOne({ _id: tagId, organizationId: user.organizationId });
  if (!tag) throw httpError('Tag not found', 404);
  if (!(await canEditTag(user, tag))) throw httpError('You can only edit tags you created', 403);

  if (typeof name === 'string' && name.trim()) {
    const label = name.trim();
    const handle = tagHandleFromName(label);
    if (!handle || handle.length < 2) throw httpError('Use letters or numbers in the tag name');
    if (handle !== tag.handle) {
      const clash = await TeamTag.findOne({
        organizationId: user.organizationId,
        handle,
        _id: { $ne: tag._id },
      });
      if (clash) throw httpError(`@${handle} is already used in this company`);
      tag.handle = handle;
    }
    tag.name = label;
  }
  if (color && TAG_COLORS.includes(color)) tag.color = color;
  if (Array.isArray(memberIds)) {
    tag.memberIds = await assertMembersInOrg(user.organizationId, memberIds);
  }
  await tag.save();
  const map = await memberMapForOrg(user.organizationId, tag.memberIds);
  return serializeTag(tag.toObject(), user.id || user._id, map);
}

async function deleteTag(user, tagId) {
  const tag = await TeamTag.findOne({ _id: tagId, organizationId: user.organizationId });
  if (!tag) throw httpError('Tag not found', 404);
  if (!(await canEditTag(user, tag))) throw httpError('You can only delete tags you created', 403);
  await tag.deleteOne();
  return { deleted: true };
}

module.exports = {
  getOverview,
  addReport,
  removeReport,
  createTag,
  updateTag,
  deleteTag,
  listOrgTags,
};
