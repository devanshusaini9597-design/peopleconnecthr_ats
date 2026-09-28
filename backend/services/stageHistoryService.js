/**
 * Single writer for the append-only stage log.
 * Live status updates stay on Candidate.status; this log is the reporting source.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');
const { statusStorageKey, statusesEqual } = require('../utils/candidateStatusHistory');

const SYNTHETIC_SEED = /backfill\s*[—-]\s*current stage seed/i;

function buildStageEvent({
  organizationId,
  candidateId,
  fromStage = null,
  toStage,
  changedAt,
  changedBy = 'System',
  actorId = null,
  createdBy = null,
  spoc = '',
  source = '',
  origin = 'status_change',
  approximate = false,
} = {}) {
  if (!organizationId || !candidateId) return null;
  const to = statusStorageKey(toStage);
  if (!to) return null;
  const from = fromStage ? statusStorageKey(fromStage) : null;
  if (from && statusesEqual(from, to)) return null;
  const at = changedAt instanceof Date ? changedAt : new Date(changedAt || Date.now());
  if (Number.isNaN(at.getTime())) return null;

  const eventKey = crypto
    .createHash('sha1')
    .update([origin, String(candidateId), from || '', to, String(at.getTime())].join('|'))
    .digest('hex');

  return {
    organizationId,
    candidateId,
    fromStage: from,
    toStage: to,
    changedAt: at,
    changedBy: String(changedBy || 'System').slice(0, 120),
    actorId: actorId || null,
    createdBy: createdBy || null,
    spoc: String(spoc || ''),
    source: String(source || ''),
    origin,
    approximate: Boolean(approximate),
    eventKey,
  };
}

function validDate(value) {
  if (!value) return null;
  const at = value instanceof Date ? value : new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Reconstruct events from an embedded statusHistory.
 * Synthetic "current stage" seeds are skipped — those pair today's status
 * with an older timestamp and would fake the cohort.
 * Returns [] when nothing dated can be trusted.
 */
function eventsFromEmbeddedHistory(row) {
  if (!row?.organizationId || !row?._id) return [];
  const hist = (Array.isArray(row.statusHistory) ? row.statusHistory : [])
    .filter((entry) => entry && entry.status && !SYNTHETIC_SEED.test(String(entry.remark || '')))
    .map((entry) => ({ ...entry, at: validDate(entry.updatedAt) }))
    .filter((entry) => entry.at)
    .sort((a, b) => a.at - b.at);

  const events = [];
  let prev = null;
  for (const entry of hist) {
    const event = buildStageEvent({
      organizationId: row.organizationId,
      candidateId: row._id,
      fromStage: prev,
      toStage: entry.status,
      changedAt: entry.at,
      changedBy: entry.updatedBy || 'System',
      createdBy: row.createdBy,
      spoc: row.spoc,
      source: row.source,
      origin: 'backfill',
      approximate: true,
    });
    if (event) {
      events.push(event);
      prev = event.toStage;
    }
  }
  return events;
}

async function recordStageEvents(events, { session } = {}) {
  const docs = (events || []).filter(Boolean);
  if (!docs.length) return 0;
  const StageHistory = require('../models/StageHistory');
  try {
    const inserted = await StageHistory.insertMany(docs, { ordered: false, session });
    return inserted.length;
  } catch (err) {
    const dupesOnly = err?.code === 11000
      || (Array.isArray(err?.writeErrors) && err.writeErrors.every((e) => e.code === 11000));
    const inserted = err?.insertedDocs?.length || 0;
    if (!dupesOnly) {
      logger.warn({ err: err.message }, '[stage-history] insert failed');
    }
    return inserted;
  }
}

function actorFromUpdate(update) {
  const pushed = update?.$push?.statusHistory;
  const entry = Array.isArray(pushed) ? pushed[0] : pushed;
  return {
    changedBy: entry?.updatedBy || 'System',
    changedAt: validDate(update?.$set?.statusEnteredAt) || validDate(entry?.updatedAt) || new Date(),
  };
}

function nextStatusFromUpdate(update) {
  if (!update || Array.isArray(update)) return undefined;
  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, 'status')) {
    return update.$set.status;
  }
  return undefined;
}

function attachStageHistoryHooks(schema) {
  schema.pre('save', async function stageHistorySave() {
    if (!this.organizationId) return;
    if (this.isNew) {
      this.stageLogBackfilledAt = new Date();
      this.$locals.stageEvent = buildStageEvent({
        organizationId: this.organizationId,
        candidateId: this._id,
        fromStage: null,
        toStage: this.status,
        changedAt: this.statusEnteredAt || this.createdAt || new Date(),
        changedBy: 'System',
        createdBy: this.createdBy,
        spoc: this.spoc,
        source: this.source,
        origin: 'create',
      });
      return;
    }
    if (!this.isModified('status')) return;
    const prev = await this.constructor.findById(this._id).select('status').lean();
    if (!prev || statusesEqual(prev.status, this.status)) return;
    const changedAt = this.isModified('statusEnteredAt') && this.statusEnteredAt
      ? this.statusEnteredAt
      : new Date();
    if (!this.isModified('statusEnteredAt')) this.statusEnteredAt = changedAt;
    this.$locals.stageEvent = buildStageEvent({
      organizationId: this.organizationId,
      candidateId: this._id,
      fromStage: prev.status,
      toStage: this.status,
      changedAt,
      changedBy: 'System',
      createdBy: this.createdBy,
      spoc: this.spoc,
      source: this.source,
      origin: 'status_change',
    });
  });

  schema.post('save', async function stageHistorySaved(doc) {
    const event = doc?.$locals?.stageEvent;
    if (!event) return;
    await recordStageEvents([event]);
  });

  async function planQueryEvents() {
    const next = nextStatusFromUpdate(this.getUpdate());
    if (next == null || next === '') return;
    const rows = await this.model
      .find(this.getFilter())
      .select('_id status organizationId createdBy spoc source')
      .lean();
    const { changedBy, changedAt } = actorFromUpdate(this.getUpdate());
    this._stageEvents = rows
      .filter((row) => row.organizationId && !statusesEqual(row.status, next))
      .map((row) => buildStageEvent({
        organizationId: row.organizationId,
        candidateId: row._id,
        fromStage: row.status,
        toStage: next,
        changedAt,
        changedBy,
        createdBy: row.createdBy,
        spoc: row.spoc,
        source: row.source,
        origin: 'status_change',
      }))
      .filter(Boolean);
  }

  schema.pre('findOneAndUpdate', planQueryEvents);
  schema.pre('updateOne', planQueryEvents);
  schema.pre('updateMany', planQueryEvents);

  async function commitQueryEvents(result) {
    if (!this._stageEvents?.length) return;
    if (result && result.modifiedCount === 0) return;
    if (result == null) return;
    const session = typeof this.getOptions === 'function' ? this.getOptions().session : null;
    await recordStageEvents(this._stageEvents, { session });
  }

  schema.post('findOneAndUpdate', commitQueryEvents);
  schema.post('updateOne', commitQueryEvents);
  schema.post('updateMany', commitQueryEvents);
}

const backfillInFlight = new Map();

/**
 * One pass per org. Uses dated statusHistory rows only.
 * Candidates with no trustworthy history are marked done and left for live logging.
 */
async function backfillStageHistoryForOrg(organizationId, Candidate) {
  const key = String(organizationId || '');
  if (!key || !Candidate) return { scanned: 0, inserted: 0 };
  if (backfillInFlight.has(key)) return backfillInFlight.get(key);

  const run = (async () => {
    const batch = 400;
    let lastId = null;
    let scanned = 0;
    let inserted = 0;

    for (;;) {
      const q = {
        organizationId,
        stageLogBackfilledAt: null,
      };
      if (lastId) q._id = { $gt: lastId };
      const rows = await Candidate.find(q)
        .select('_id organizationId status statusHistory createdBy spoc source stageLogBackfilledAt')
        .sort({ _id: 1 })
        .limit(batch)
        .lean();
      if (!rows.length) break;

      const events = [];
      const ids = [];
      for (const row of rows) {
        lastId = row._id;
        scanned += 1;
        ids.push(row._id);
        events.push(...eventsFromEmbeddedHistory(row));
      }
      inserted += await recordStageEvents(events);
      await Candidate.collection.updateMany(
        { _id: { $in: ids } },
        { $set: { stageLogBackfilledAt: new Date() } }
      );
      if (rows.length < batch) break;
    }
    return { scanned, inserted };
  })();

  backfillInFlight.set(key, run);
  try {
    return await run;
  } finally {
    backfillInFlight.delete(key);
  }
}

/**
 * For bulkWrite/upsert paths that bypass document hooks.
 * `beforeRows` and `afterRows` are the same candidate query, taken around the write.
 * New ids are creates. Same id with a different status is a move. Timestamp is the write time.
 */
async function recordCandidateStatusDiff(beforeRows, afterRows, meta = {}) {
  const before = new Map((beforeRows || []).map((row) => [String(row._id), row]));
  const changedBy = meta.changedBy || 'System';
  const events = [];
  for (const row of afterRows || []) {
    if (!row?.organizationId || !row.status) continue;
    const prev = before.get(String(row._id));
    if (!prev) {
      events.push(buildStageEvent({
        organizationId: row.organizationId,
        candidateId: row._id,
        fromStage: null,
        toStage: row.status,
        changedAt: new Date(),
        changedBy,
        createdBy: row.createdBy,
        spoc: row.spoc,
        source: row.source,
        origin: 'create',
      }));
      continue;
    }
    if (statusesEqual(prev.status, row.status)) continue;
    events.push(buildStageEvent({
      organizationId: row.organizationId,
      candidateId: row._id,
      fromStage: prev.status,
      toStage: row.status,
      changedAt: new Date(),
      changedBy,
      createdBy: row.createdBy,
      spoc: row.spoc,
      source: row.source,
      origin: 'status_change',
    }));
  }
  return recordStageEvents(events);
}

module.exports = {
  SYNTHETIC_SEED,
  buildStageEvent,
  eventsFromEmbeddedHistory,
  recordStageEvents,
  recordCandidateStatusDiff,
  attachStageHistoryHooks,
  backfillStageHistoryForOrg,
};
