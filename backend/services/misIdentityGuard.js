/**
 * Directory uniqueness for MIS — live rows plus the durable identity registry.
 */
const MisContact = require('../models/MisContact');
const MisIdentityRegistry = require('../models/MisIdentityRegistry');
const { identityKeys, namesLikelySame, applyIdentityFields, evaluateRecordDate } = require('../utils/misIdentity');
const { organizationIdMatch } = require('../utils/dataScope');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function orgMatch(organizationId) {
  return organizationIdMatch(organizationId) || { organizationId };
}

function leadersMayRestore(user) {
  const role = user?.role;
  return role === 'owner' || role === 'admin' || role === 'hr_manager';
}

async function findLiveClash(organizationId, keys, excludeId) {
  const or = [];
  if (keys.emailKey) {
    or.push({ emailKey: keys.emailKey });
    or.push({ email: keys.emailKey });
  }
  if (keys.phoneKey) or.push({ phoneKey: keys.phoneKey });
  if (!or.length) return null;
  const q = { ...orgMatch(organizationId), $or: or };
  if (excludeId) q._id = { $ne: excludeId };
  return MisContact.findOne(q).select('_id email phone name emailKey phoneKey').lean();
}

async function findRegistryClash(organizationId, keys) {
  const or = [];
  if (keys.emailKey) or.push({ emailKey: keys.emailKey });
  if (keys.phoneKey) or.push({ phoneKey: keys.phoneKey });
  if (!or.length) return null;
  return MisIdentityRegistry.findOne({
    ...orgMatch(organizationId),
    $or: or,
  }).lean();
}

/**
 * Same person with a new mailbox and number — name + organisation match on an existing row.
 */
async function findSimilarLive(organizationId, payload, excludeId) {
  const keys = identityKeys(payload);
  if (!keys.nameKey || keys.nameKey.length < 8 || !keys.companyKey || keys.companyKey.length < 4) {
    return null;
  }
  const q = {
    ...orgMatch(organizationId),
    nameKey: keys.nameKey,
    companyKey: keys.companyKey,
  };
  if (excludeId) q._id = { $ne: excludeId };
  const hit = await MisContact.findOne(q).select('_id email phone name companyName').lean();
  if (hit && namesLikelySame(hit.name, payload.name)) return hit;
  return null;
}

async function assertNewIdentity(user, payload, { excludeId } = {}) {
  const organizationId = user.organizationId;
  const keys = identityKeys(payload);
  const live = await findLiveClash(organizationId, keys, excludeId);
  if (live) {
    throw httpError('This contact is already in the directory', 409, { code: 'DUPLICATE_IDENTITY' });
  }
  const similar = await findSimilarLive(organizationId, payload, excludeId);
  if (similar) {
    throw httpError('This contact is already in the directory', 409, { code: 'DUPLICATE_IDENTITY' });
  }
  const registry = await findRegistryClash(organizationId, keys);
  if (registry) {
    if (registry.status === 'active' && registry.contactId && String(registry.contactId) !== String(excludeId || '')) {
      throw httpError('This contact is already in the directory', 409, { code: 'DUPLICATE_IDENTITY' });
    }
    if (registry.status === 'removed' && !leadersMayRestore(user)) {
      throw httpError('This contact is already on file', 409, { code: 'IDENTITY_ON_FILE' });
    }
  }
  return { keys, registry };
}

async function upsertRegistry(user, contact, { removed = false } = {}) {
  const organizationId = user.organizationId || contact.organizationId;
  const keys = identityKeys(contact);
  const now = new Date();
  const clauses = [];
  if (keys.emailKey) clauses.push({ emailKey: keys.emailKey });
  if (keys.phoneKey) clauses.push({ phoneKey: keys.phoneKey });
  if (!clauses.length) return null;

  const existing = await MisIdentityRegistry.find({
    ...orgMatch(organizationId),
    $or: clauses,
  }).lean();

  const baseSet = {
    organizationId,
    emailKey: keys.emailKey || '',
    phoneKey: keys.phoneKey || '',
    nameKey: keys.nameKey || '',
    companyKey: keys.companyKey || '',
    lastSeenAt: now,
    createdBy: contact.createdBy || user.id || user._id,
  };

  if (removed) {
    baseSet.status = 'removed';
    baseSet.removedAt = now;
    baseSet.contactId = null;
  } else {
    baseSet.status = 'active';
    baseSet.removedAt = null;
    baseSet.contactId = contact._id || null;
  }

  if (existing.length) {
    const ids = existing.map((row) => row._id);
    const keep = ids[0];
    await MisIdentityRegistry.updateOne(
      { _id: keep },
      {
        $set: baseSet,
        $setOnInsert: { firstSeenAt: existing[0].firstSeenAt || now },
      }
    );
    if (ids.length > 1) {
      await MisIdentityRegistry.deleteMany({ _id: { $in: ids.slice(1) } });
    }
    return keep;
  }

  const doc = await MisIdentityRegistry.create({
    ...baseSet,
    firstSeenAt: contact.createdAt || now,
  });
  return doc._id;
}

async function recordRemovedIdentities(user, contacts = []) {
  for (const contact of contacts) {
    try {
      await upsertRegistry(user, contact, { removed: true });
    } catch {
      /* keep delete path available even if registry write fails */
    }
  }
}

function dateGuardError(evalResult) {
  if (evalResult?.ok) return null;
  return httpError(evalResult.message || 'Contact date is not valid', 400, { code: evalResult.code || 'DATE_INVALID' });
}

module.exports = {
  identityKeys,
  applyIdentityFields,
  evaluateRecordDate,
  assertNewIdentity,
  findLiveClash,
  findRegistryClash,
  upsertRegistry,
  recordRemovedIdentities,
  dateGuardError,
  leadersMayRestore,
};
