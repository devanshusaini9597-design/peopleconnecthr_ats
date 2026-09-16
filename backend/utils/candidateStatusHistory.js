/**
 * Enterprise stage-entry tracking for ATS candidates.
 *
 * Data-safety rules:
 * - Never replace / wipe statusHistory — only $push new entries
 * - Never overwrite an existing statusEnteredAt except on a real status change
 * - Soft backfill only fills missing fields (additive)
 */

function statusStorageKey(status) {
  return String(status || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function statusesEqual(a, b) {
  return statusStorageKey(a) === statusStorageKey(b);
}

function buildHistoryEntry({ status, remark, updatedBy, updatedAt } = {}) {
  return {
    status: statusStorageKey(status) || 'APPLIED',
    remark: String(remark || 'Status Updated').slice(0, 500),
    updatedAt: updatedAt instanceof Date ? updatedAt : new Date(updatedAt || Date.now()),
    updatedBy: String(updatedBy || 'Recruiter').slice(0, 120),
  };
}

/**
 * Mongo update fragments for a real status change.
 * Returns null when status is unchanged / missing.
 */
function statusChangeUpdate(prevStatus, nextStatus, meta = {}) {
  if (nextStatus == null || nextStatus === '') return null;
  if (statusesEqual(prevStatus, nextStatus)) return null;

  const at = meta.updatedAt instanceof Date ? meta.updatedAt : new Date(meta.updatedAt || Date.now());
  const entry = buildHistoryEntry({
    status: nextStatus,
    remark: meta.remark,
    updatedBy: meta.updatedBy,
    updatedAt: at,
  });

  return {
    $set: {
      status: statusStorageKey(nextStatus),
      statusEnteredAt: at,
    },
    $push: { statusHistory: entry },
  };
}

/** Seed create-time status + history without wiping caller-provided history. */
function seedCreateStatusFields(doc, meta = {}) {
  if (!doc || typeof doc !== 'object') return doc;
  const status = statusStorageKey(doc.status || 'APPLIED');
  const at =
    (meta.at instanceof Date && meta.at) ||
    (doc.appliedAt instanceof Date && doc.appliedAt) ||
    (doc.createdAt instanceof Date && doc.createdAt) ||
    new Date();

  doc.status = status;
  if (!doc.statusEnteredAt) doc.statusEnteredAt = at;

  if (!Array.isArray(doc.statusHistory) || doc.statusHistory.length === 0) {
    doc.statusHistory = [
      buildHistoryEntry({
        status,
        remark: meta.remark || 'Candidate created',
        updatedBy: meta.updatedBy || 'System',
        updatedAt: at,
      }),
    ];
  }
  return doc;
}

/** Effective "entered current stage at" for aggregations / filters. */
function stageEntryDateExpr() {
  return {
    $ifNull: ['$statusEnteredAt', { $ifNull: ['$appliedAt', '$createdAt'] }],
  };
}

/** Scope filter: current stage was entered inside dateFilter. */
function withStageEntryDateRange(baseFilter = {}, dateFilter) {
  if (!dateFilter) return baseFilter;
  const clauses = [];
  if (dateFilter.$gte) clauses.push({ $gte: [stageEntryDateExpr(), dateFilter.$gte] });
  if (dateFilter.$lte) clauses.push({ $lte: [stageEntryDateExpr(), dateFilter.$lte] });
  if (dateFilter.$lt) clauses.push({ $lt: [stageEntryDateExpr(), dateFilter.$lt] });
  if (!clauses.length) return baseFilter;
  return { ...baseFilter, $expr: { $and: clauses } };
}

/**
 * Pipeline: count by current status for all-time, or by stage-entry date in period.
 * Period attribution uses statusEnteredAt (fallback appliedAt/createdAt) — enterprise
 * "entered this stage in the selected period" while still sitting in that stage.
 */
function buildCurrentStageEntryAgg(userFilter, dateFilter) {
  if (!dateFilter) {
    return [
      { $match: userFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ];
  }

  const rangeClauses = [];
  if (dateFilter.$gte) rangeClauses.push({ $gte: ['$stageEntryDate', dateFilter.$gte] });
  if (dateFilter.$lte) rangeClauses.push({ $lte: ['$stageEntryDate', dateFilter.$lte] });
  if (dateFilter.$lt) rangeClauses.push({ $lt: ['$stageEntryDate', dateFilter.$lt] });

  return [
    { $match: userFilter },
    { $addFields: { stageEntryDate: stageEntryDateExpr() } },
    ...(rangeClauses.length
      ? [{ $match: { $expr: rangeClauses.length === 1 ? rangeClauses[0] : { $and: rangeClauses } } }]
      : []),
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ];
}

const backfillInFlight = new Map();

/**
 * Additive-only backfill:
 * - statusEnteredAt ← appliedAt || createdAt (only when missing)
 * - one history seed for current status when history is empty (does not invent past hops)
 */
async function backfillStatusEnteredAtForOrg(organizationId, Candidate) {
  const key = String(organizationId || '');
  if (!key) return 0;
  if (backfillInFlight.has(key)) return backfillInFlight.get(key);

  const run = (async () => {
    const batch = 400;
    let lastId = null;
    let updated = 0;

    for (;;) {
      const q = {
        organizationId,
        $or: [
          { statusEnteredAt: { $exists: false } },
          { statusEnteredAt: null },
          { statusHistory: { $exists: false } },
          { statusHistory: { $size: 0 } },
          { statusHistory: null },
        ],
      };
      if (lastId) q._id = { $gt: lastId };

      const rows = await Candidate.find(q)
        .select('_id status statusEnteredAt statusHistory appliedAt createdAt')
        .sort({ _id: 1 })
        .limit(batch)
        .lean();
      if (!rows.length) break;

      const ops = [];
      for (const row of rows) {
        lastId = row._id;
        const enteredAt =
          row.statusEnteredAt ||
          (row.appliedAt instanceof Date ? row.appliedAt : null) ||
          (row.createdAt instanceof Date ? row.createdAt : null) ||
          new Date();

        const $set = {};
        if (!row.statusEnteredAt) $set.statusEnteredAt = enteredAt;

        const hist = Array.isArray(row.statusHistory) ? row.statusHistory : [];
        const update = {};
        if (Object.keys($set).length) update.$set = $set;
        if (hist.length === 0 && row.status) {
          update.$push = {
            statusHistory: buildHistoryEntry({
              status: row.status,
              remark: 'Backfill — current stage seed',
              updatedBy: 'System',
              updatedAt: enteredAt,
            }),
          };
        }
        if (!update.$set && !update.$push) continue;
        ops.push({ updateOne: { filter: { _id: row._id }, update } });
      }

      if (ops.length) {
        const res = await Candidate.bulkWrite(ops, { ordered: false });
        updated += (res.modifiedCount || 0) + (res.upsertedCount || 0);
      }
      if (rows.length < batch) break;
    }
    return updated;
  })();

  backfillInFlight.set(key, run);
  try {
    return await run;
  } finally {
    backfillInFlight.delete(key);
  }
}

module.exports = {
  statusStorageKey,
  statusesEqual,
  buildHistoryEntry,
  statusChangeUpdate,
  seedCreateStatusFields,
  stageEntryDateExpr,
  withStageEntryDateRange,
  buildCurrentStageEntryAgg,
  backfillStatusEnteredAtForOrg,
};
