/**
 * One Position name per organization (catalog rows only).
 * Does not rewrite Candidate.position or Job.title/role — those stay as stored strings.
 */
const { normalizeText } = require('../utils/textNormalize');
const logger = require('../utils/logger');

const ORG_UNIQUE_INDEX = 'organizationId_1_name_1';
const LEGACY_UNIQUE_INDEX = 'createdBy_1_name_1';

function pickKeepPosition(rows) {
  return [...rows].sort((a, b) => {
    const aActive = a.isActive !== false;
    const bActive = b.isActive !== false;
    if (aActive !== bActive) return aActive ? -1 : 1;
    const ta = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    if (ta !== 0) return ta;
    return String(a._id).localeCompare(String(b._id));
  })[0];
}

function groupKey(scopeId, name) {
  const n = normalizeText(String(name || ''));
  if (!scopeId || !n) return null;
  return `${String(scopeId)}\0${n}`;
}

function groupDocs(docs, keyFn) {
  const groups = new Map();
  for (const doc of docs) {
    const key = keyFn(doc);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  return groups;
}

async function dropIndexIfExists(col, name) {
  try {
    await col.dropIndex(name);
    return true;
  } catch (err) {
    if (err.code === 27 || err.codeName === 'IndexNotFound' || /index not found/i.test(String(err.message || ''))) {
      return false;
    }
    throw err;
  }
}

function samePartial(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

async function dropIndexByKeysIfMismatch(col, keys, options) {
  const indexes = await col.indexes();
  const match = indexes.find((idx) => JSON.stringify(idx.key) === JSON.stringify(keys));
  if (!match) return false;
  const uniqueOk = Boolean(match.unique) === Boolean(options.unique);
  const partialOk = samePartial(match.partialFilterExpression, options.partialFilterExpression);
  if (uniqueOk && partialOk && match.name === options.name) return false;
  await dropIndexIfExists(col, match.name);
  return true;
}

async function ensureIndex(col, keys, options) {
  await dropIndexByKeysIfMismatch(col, keys, options);
  const indexes = await col.indexes();
  if (indexes.some((idx) => idx.name === options.name)) return 'exists';
  await col.createIndex(keys, options);
  return 'created';
}

async function mergeDuplicateGroups(col, groups) {
  let kept = 0;
  let removed = 0;
  let renamed = 0;
  for (const [, rows] of groups) {
    const keep = pickKeepPosition(rows);
    if (!keep) continue;
    kept += 1;
    const canonical = normalizeText(String(keep.name || ''));
    if (canonical && keep.name !== canonical) {
      await col.updateOne(
        { _id: keep._id },
        { $set: { name: canonical, updatedAt: new Date() } }
      );
      renamed += 1;
    }
    const extraIds = rows
      .filter((row) => String(row._id) !== String(keep._id))
      .map((row) => row._id);
    if (extraIds.length) {
      const del = await col.deleteMany({ _id: { $in: extraIds } });
      removed += del.deletedCount || extraIds.length;
    }
  }
  return { kept, removed, renamed };
}

function groupNeedsWork(groups) {
  for (const rows of groups.values()) {
    if (rows.length > 1) return true;
    const keep = pickKeepPosition(rows);
    if (keep && normalizeText(String(keep.name || '')) !== keep.name) return true;
  }
  return false;
}

async function findDuplicateNames(col, match, groupId) {
  return col.aggregate([
    { $match: match },
    { $group: { _id: groupId, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $limit: 20 },
  ]).toArray().catch(() => []);
}

async function ensurePositionOrgUniqueness(connection) {
  const db = connection?.db;
  if (!db) {
    throw new Error('Mongo connection is not ready');
  }
  const col = db.collection('positions');

  let droppedLegacy = false;
  let droppedOrg = false;

  // Null org ids cannot use the ObjectId partial unique index; treat as legacy.
  await col.updateMany(
    { organizationId: null },
    { $unset: { organizationId: '' } }
  );

  const docs = await col.find(
    {},
    { projection: { name: 1, organizationId: 1, createdBy: 1, isActive: 1, createdAt: 1 } }
  ).toArray();

  const orgGroups = groupDocs(
    docs.filter((doc) => doc.organizationId != null),
    (doc) => groupKey(doc.organizationId, doc.name)
  );
  const legacyGroups = groupDocs(
    docs.filter((doc) => doc.organizationId == null),
    (doc) => groupKey(doc.createdBy, doc.name)
  );

  const needsMerge = groupNeedsWork(orgGroups) || groupNeedsWork(legacyGroups);
  let orgStats = { kept: orgGroups.size, removed: 0, renamed: 0 };
  let legacyStats = { kept: legacyGroups.size, removed: 0, renamed: 0 };

  if (needsMerge) {
    droppedOrg = await dropIndexIfExists(col, ORG_UNIQUE_INDEX);
    droppedLegacy = await dropIndexIfExists(col, LEGACY_UNIQUE_INDEX);
    orgStats = await mergeDuplicateGroups(col, orgGroups);
    legacyStats = await mergeDuplicateGroups(col, legacyGroups);
  }

  let orgIndex = 'skipped';
  let legacyIndex = 'skipped';
  try {
    orgIndex = await ensureIndex(col, { organizationId: 1, name: 1 }, {
      unique: true,
      name: ORG_UNIQUE_INDEX,
      partialFilterExpression: { organizationId: { $type: 'objectId' } },
    });
  } catch (err) {
    logger.error({ err, leftovers: await findDuplicateNames(col, { organizationId: { $type: 'objectId' } }, { organizationId: '$organizationId', name: '$name' }) }, '[Positions] unique org+name index not applied');
  }

  // This MongoDB rejects $exists:false in partial unique indexes. Keep a query index only.
  try {
    legacyIndex = await ensureIndex(col, { createdBy: 1, name: 1 }, {
      name: LEGACY_UNIQUE_INDEX,
    });
  } catch (err) {
    logger.error({ err }, '[Positions] createdBy+name query index not applied');
  }

  await col.createIndex({ createdBy: 1 }, { name: 'createdBy_1' }).catch(() => {});
  await col.createIndex({ organizationId: 1 }, { name: 'organizationId_1' }).catch(() => {});

  return {
    droppedLegacy,
    droppedOrg,
    org: orgStats,
    legacy: legacyStats,
    orgIndex,
    legacyIndex,
  };
}

module.exports = {
  pickKeepPosition,
  groupKey,
  ensurePositionOrgUniqueness,
  ORG_UNIQUE_INDEX,
  LEGACY_UNIQUE_INDEX,
};
