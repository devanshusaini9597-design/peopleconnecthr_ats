/**
 * Snapshot, activity, and cohort metrics.
 * Snapshot reads Candidate.status. Activity and cohort read StageHistory.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const StageHistory = require('../models/StageHistory');
const PipelineMetricRollup = require('../models/PipelineMetricRollup');
const { foldStatusCounts, pipelineList, canonCandidateStatus, statusMatchValues } = require('../utils/statusCanon');
const { statusStorageKey, withStageEntryDateRange } = require('../utils/candidateStatusHistory');
const { zonedYmd, zonedTimeToUtc, DEFAULT_TZ } = require('../utils/analyticsTime');
const { resolveAppliedAt } = require('../utils/candidateActivityDate');
const logger = require('../utils/logger');

const ROLLUP_MAX_AGE_MS = 60 * 60 * 1000;
const OPEN_STAGE_NAMES = new Set(['Rejected', 'Dropped']);

function stableStringify(value) {
  if (value == null) return 'null';
  if (value instanceof mongoose.Types.ObjectId) return `oid:${String(value)}`;
  if (value instanceof Date) return `dt:${value.toISOString()}`;
  if (value instanceof RegExp) return `re:${value.toString()}`;
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function scopeKeyFor(userFilter) {
  return crypto.createHash('sha1').update(stableStringify(userFilter || {})).digest('hex').slice(0, 20);
}

function periodKeyFor(dateRange, dateFilter) {
  const range = String(dateRange || 'month');
  if (!dateFilter) return `${range}:all`;
  const gte = dateFilter.$gte ? new Date(dateFilter.$gte).toISOString() : '';
  const lt = dateFilter.$lt ? new Date(dateFilter.$lt).toISOString() : '';
  const lte = dateFilter.$lte ? new Date(dateFilter.$lte).toISOString() : '';
  return `${range}:${gte}:${lt}:${lte}`;
}

function parseCohortMonth(cohortMonth, now, timeZone) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(cohortMonth || '').trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { year, month, key: `${match[1]}-${match[2]}` };
    }
  }
  const [year, month] = zonedYmd(now, timeZone).split('-').map(Number);
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return { year, month, key };
}

function cohortWindow(year, month, timeZone) {
  const start = zonedTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const end = month === 12
    ? zonedTimeToUtc(year + 1, 1, 1, 0, 0, 0, timeZone)
    : zonedTimeToUtc(year, month + 1, 1, 0, 0, 0, timeZone);
  return { start, end };
}

function snapshotFromRows(rows, preferredStages) {
  const folded = foldStatusCounts(rows.map((row) => ({ _id: row.status, count: 1 })));
  const stages = pipelineList(folded, preferredStages, {
    includeZero: true,
    ensureStages: ['Rejected', 'Dropped'],
  });
  const total = rows.length;
  const sum = stages.reduce((n, stage) => n + (stage.count || 0), 0);
  return {
    asOf: 'now',
    total,
    sum,
    reconciles: sum === total,
    stages,
  };
}

function inDateFilter(at, dateFilter) {
  if (!dateFilter) return true;
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return false;
  if (dateFilter.$gte && t < new Date(dateFilter.$gte)) return false;
  if (dateFilter.$gt && t <= new Date(dateFilter.$gt)) return false;
  if (dateFilter.$lt && t >= new Date(dateFilter.$lt)) return false;
  if (dateFilter.$lte && t > new Date(dateFilter.$lte)) return false;
  return true;
}

/** One person per stage. A person who moved twice still counts once. */
function activityFromPeople(events, rows, dateFilter, preferredStages) {
  const sets = new Map();
  const add = (stage, id) => {
    const key = canonCandidateStatus(stage);
    if (!key || key === 'Unspecified' || !id) return;
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key).add(String(id));
  };
  for (const event of events || []) {
    if (!inDateFilter(event.changedAt, dateFilter)) continue;
    add(event.toStage, event.candidateId);
  }
  for (const row of rows || []) {
    if (!row.statusEnteredAt || !inDateFilter(row.statusEnteredAt, dateFilter)) continue;
    add(row.status, row._id);
  }
  const folded = {};
  for (const [stage, set] of sets) folded[stage] = set.size;
  const stages = pipelineList(folded, preferredStages, {
    includeZero: true,
    ensureStages: ['Rejected', 'Dropped'],
  }).map((stage) => ({
    stage: stage.stage,
    count: stage.count,
    label: `Moved to ${stage.stage}`,
  }));
  const people = new Set();
  for (const set of sets.values()) {
    for (const id of set) people.add(id);
  }
  return { total: people.size, stages };
}

/**
 * Percent of a createdAt cohort that has a recorded move into each stage,
 * or is sitting in that stage now. Does not assume a linear funnel.
 */
function cohortFromRows(cohortRows, events, preferredStages) {
  const reachedByCandidate = new Map();
  for (const row of cohortRows) {
    const set = new Set();
    if (row.status) set.add(canonCandidateStatus(row.status));
    reachedByCandidate.set(String(row._id), set);
  }
  for (const event of events) {
    const key = String(event.candidateId);
    if (!reachedByCandidate.has(key)) continue;
    reachedByCandidate.get(key).add(canonCandidateStatus(event.toStage));
  }

  const counts = {};
  for (const set of reachedByCandidate.values()) {
    for (const stage of set) counts[stage] = (counts[stage] || 0) + 1;
  }
  const size = cohortRows.length;
  const stages = pipelineList(counts, preferredStages, {
    includeZero: true,
    ensureStages: ['Rejected', 'Dropped'],
  }).map((stage) => ({
    stage: stage.stage,
    reached: stage.count,
    percent: size > 0 ? Math.round((stage.count / size) * 1000) / 10 : 0,
  }));
  return { size, stages };
}

/** Completed intervals only: entered stage, then left it. */
function velocityFromEvents(events) {
  const byCandidate = new Map();
  for (const event of events) {
    const key = String(event.candidateId);
    if (!byCandidate.has(key)) byCandidate.set(key, []);
    byCandidate.get(key).push(event);
  }
  const totals = new Map();
  for (const list of byCandidate.values()) {
    list.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
    for (let i = 0; i < list.length - 1; i += 1) {
      const stage = canonCandidateStatus(list[i].toStage);
      if (!stage || OPEN_STAGE_NAMES.has(stage)) continue;
      const ms = new Date(list[i + 1].changedAt) - new Date(list[i].changedAt);
      if (!Number.isFinite(ms) || ms < 0) continue;
      const bucket = totals.get(stage) || { sumMs: 0, samples: 0 };
      bucket.sumMs += ms;
      bucket.samples += 1;
      totals.set(stage, bucket);
    }
  }
  return [...totals.entries()]
    .map(([stage, bucket]) => ({
      stage,
      samples: bucket.samples,
      avgDays: Math.round((bucket.sumMs / bucket.samples / 86400000) * 10) / 10,
    }))
    .sort((a, b) => a.stage.localeCompare(b.stage));
}

async function computePipelineMetrics({
  userFilter,
  dateFilter,
  cohortMonth,
  now = new Date(),
  timeZone = DEFAULT_TZ,
  preferredStages,
}) {
  const rows = await Candidate.find(userFilter)
    .select('_id status date appliedAt createdAt statusEnteredAt')
    .lean();

  const snapshot = snapshotFromRows(rows, preferredStages);
  const cohort = parseCohortMonth(cohortMonth, now, timeZone);
  const window = cohortWindow(cohort.year, cohort.month, timeZone);
  const cohortRows = rows.filter((row) => inCohortWindow(row, window));

  const ids = rows.map((row) => row._id);
  let events = [];
  if (ids.length) {
    events = await StageHistory.find({ candidateId: { $in: ids } })
      .select('candidateId toStage changedAt')
      .lean();
  }

    const sitting = snapshotFromRows(cohortRows, preferredStages);
    const withEvents = new Set(events.map((event) => String(event.candidateId)));

    return {
      snapshot,
      activity: activityFromPeople(events, rows, dateFilter, preferredStages),
      cohort: {
        kind: 'record-date',
        month: cohort.key,
        label: new Date(window.start).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone }),
        size: sitting.total,
        reconciles: sitting.reconciles,
        stages: sitting.stages.map((stage) => ({
          stage: stage.stage,
          count: stage.count,
          reached: stage.count,
        })),
      },
    velocity: velocityFromEvents(events),
    coverage: {
      candidates: rows.length,
      withEvents: withEvents.size,
    },
  };
}

function orgIdFromFilter(userFilter) {
  const value = userFilter?.organizationId;
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return value;
  if (value.$in) {
    return value.$in.find((item) => (
      item instanceof mongoose.Types.ObjectId
      || (typeof item === 'string' && /^[a-f0-9]{24}$/i.test(item))
    )) || null;
  }
  return null;
}

async function getDashboardPipelineMetrics(options) {
  const {
    userFilter,
    dateRange = 'month',
    dateFilter,
    cohortMonth,
    now = new Date(),
    timeZone = DEFAULT_TZ,
    preferredStages,
    force = false,
    maxAgeMs = ROLLUP_MAX_AGE_MS,
  } = options;

  const cohort = parseCohortMonth(cohortMonth, now, timeZone);
  const scopeKey = scopeKeyFor(userFilter);
  const periodKey = periodKeyFor(dateRange, dateFilter);
  const organizationId = orgIdFromFilter(userFilter);

  if (!force) {
    const cached = await PipelineMetricRollup.findOne({
      scopeKey,
      periodKey,
      cohortMonth: cohort.key,
    }).lean();
    if (cached?.payload?.cohort?.kind === 'record-date' && cached.computedAt) {
      const age = now.getTime() - new Date(cached.computedAt).getTime();
      if (age >= 0 && age < maxAgeMs) {
        return { ...cached.payload, computedAt: cached.computedAt, fromRollup: true };
      }
    }
  }

  const payload = await computePipelineMetrics({
    userFilter,
    dateFilter,
    cohortMonth: cohort.key,
    now,
    timeZone,
    preferredStages,
  });
  const computedAt = new Date();
  try {
    await PipelineMetricRollup.updateOne(
      { scopeKey, periodKey, cohortMonth: cohort.key },
      {
        $set: {
          organizationId,
          scopeKey,
          periodKey,
          cohortMonth: cohort.key,
          payload,
          computedAt,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    logger.warn({ err: err.message }, '[pipeline-rollup] cache write failed');
  }
  return { ...payload, computedAt, fromRollup: false };
}

function uniqueIds(ids) {
  const seen = new Map();
  for (const id of ids || []) {
    if (!id) continue;
    seen.set(String(id), id);
  }
  return [...seen.values()];
}

function stageStorageKeys(stage) {
  return [...new Set(statusMatchValues([stage]).map((value) => statusStorageKey(value)).filter(Boolean))];
}

/** People who moved into this stage in the period. Same set the activity card opens. */
async function candidateIdsForMove({ userFilter, stage, dateFilter }) {
  const keys = stageStorageKeys(stage);
  const changedAt = {};
  if (dateFilter?.$gte) changedAt.$gte = new Date(dateFilter.$gte);
  if (dateFilter?.$gt) changedAt.$gt = new Date(dateFilter.$gt);
  if (dateFilter?.$lt) changedAt.$lt = new Date(dateFilter.$lt);
  if (dateFilter?.$lte) changedAt.$lte = new Date(dateFilter.$lte);
  const eventQuery = { toStage: { $in: keys } };
  if (Object.keys(changedAt).length) eventQuery.changedAt = changedAt;
  const eventIds = keys.length ? await StageHistory.distinct('candidateId', eventQuery) : [];
  const fromEvents = eventIds.length
    ? await Candidate.find({ $and: [userFilter, { _id: { $in: eventIds } }] }).distinct('_id')
    : [];
  const sitting = await Candidate.find(
    withStageEntryDateRange(
      { $and: [userFilter, { status: { $in: statusMatchValues([stage]) } }] },
      dateFilter
    )
  ).distinct('_id');
  return uniqueIds([...fromEvents, ...sitting]);
}

/** Record date from the candidate date column, then appliedAt, then upload time. */
function inCohortWindow(row, window) {
  const when = resolveAppliedAt(row);
  return Boolean(when && when >= window.start && when < window.end);
}

/** People whose record date is in that month and who sit in this stage today. */
async function candidateIdsForCohortStage({ userFilter, stage, cohortMonth, now = new Date(), timeZone = DEFAULT_TZ }) {
  const cohort = parseCohortMonth(cohortMonth, now, timeZone);
  const window = cohortWindow(cohort.year, cohort.month, timeZone);
  const allowed = new Set(statusMatchValues([stage]));
  const rows = await Candidate.find(userFilter)
    .select('_id status date appliedAt createdAt')
    .lean();
  return rows
    .filter((row) => allowed.has(row.status) && inCohortWindow(row, window))
    .map((row) => row._id);
}

module.exports = {
  scopeKeyFor,
  periodKeyFor,
  parseCohortMonth,
  snapshotFromRows,
  activityFromPeople,
  inDateFilter,
  cohortFromRows,
  velocityFromEvents,
  computePipelineMetrics,
  getDashboardPipelineMetrics,
  candidateIdsForMove,
  candidateIdsForCohortStage,
  ROLLUP_MAX_AGE_MS,
};
