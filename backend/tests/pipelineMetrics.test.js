const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const StageHistory = require('../models/StageHistory');
const {
  eventsFromEmbeddedHistory,
  backfillStageHistoryForOrg,
} = require('../services/stageHistoryService');
const {
  snapshotFromRows,
  cohortFromRows,
  velocityFromEvents,
  computePipelineMetrics,
} = require('../services/pipelineMetricsService');

const stages = ['Applied', 'Screening', 'Interview'];

describe('stage history metrics', () => {
  it('skips synthetic current-stage seeds and keeps dated history', () => {
    const org = new mongoose.Types.ObjectId();
    const id = new mongoose.Types.ObjectId();
    const events = eventsFromEmbeddedHistory({
      _id: id,
      organizationId: org,
      status: 'JOINED',
      statusHistory: [
        { status: 'JOINED', remark: 'Backfill — current stage seed', updatedAt: new Date('2026-05-01'), updatedBy: 'System' },
        { status: 'APPLIED', remark: 'Candidate created', updatedAt: new Date('2026-05-02T00:00:00Z'), updatedBy: 'System' },
        { status: 'SCREENING', remark: 'Status Updated', updatedAt: new Date('2026-09-10T00:00:00Z'), updatedBy: 'Ada' },
      ],
    });
    expect(events.map((event) => event.toStage)).toEqual(['APPLIED', 'SCREENING']);
    expect(events[0].fromStage).toBeNull();
    expect(events[1].fromStage).toBe('APPLIED');
    expect(events[1].changedAt.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(events.every((event) => event.approximate)).toBe(true);
  });

  it('does not invent a timestamp when history is missing', () => {
    expect(eventsFromEmbeddedHistory({
      _id: new mongoose.Types.ObjectId(),
      organizationId: new mongoose.Types.ObjectId(),
      status: 'SCREENING',
      createdAt: new Date('2026-05-01'),
      statusHistory: [],
    })).toEqual([]);
  });

  it('snapshot stages sum to the candidate total', () => {
    const snapshot = snapshotFromRows([
      { status: 'APPLIED' },
      { status: 'applied' },
      { status: 'SCREENING' },
    ], stages);
    expect(snapshot.total).toBe(3);
    expect(snapshot.sum).toBe(3);
    expect(snapshot.reconciles).toBe(true);
    expect(snapshot.stages.find((row) => row.stage === 'Applied').count).toBe(2);
  });

  it('cohort percent is all-time for that created month, not the move month', () => {
    const id = new mongoose.Types.ObjectId();
    const cohort = cohortFromRows(
      [{ _id: id, status: 'SCREENING' }],
      [{ candidateId: id, toStage: 'APPLIED' }, { candidateId: id, toStage: 'SCREENING' }],
      stages
    );
    expect(cohort.size).toBe(1);
    expect(cohort.stages.find((row) => row.stage === 'Applied').percent).toBe(100);
    expect(cohort.stages.find((row) => row.stage === 'Screening').percent).toBe(100);
    expect(cohort.stages.find((row) => row.stage === 'Interview').percent).toBe(0);
  });

  it('velocity is the gap between consecutive moves', () => {
    const id = new mongoose.Types.ObjectId();
    const velocity = velocityFromEvents([
      { candidateId: id, toStage: 'APPLIED', changedAt: new Date('2026-05-01T00:00:00Z') },
      { candidateId: id, toStage: 'SCREENING', changedAt: new Date('2026-05-11T00:00:00Z') },
    ]);
    expect(velocity).toEqual([{ stage: 'Applied', samples: 1, avgDays: 10 }]);
  });

  it('keeps a May hire out of September intake while counting the September move', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const org = new mongoose.Types.ObjectId();
    const id = new mongoose.Types.ObjectId();
    await Candidate.collection.insertOne({
      _id: id,
      organizationId: org,
      name: 'MAY HIRE',
      email: 'may-hire@example.com',
      status: 'SCREENING',
      createdAt: new Date('2026-05-04T00:00:00Z'),
      stageLogBackfilledAt: new Date(),
    });
    await StageHistory.collection.insertMany([
      {
        organizationId: org,
        candidateId: id,
        fromStage: null,
        toStage: 'APPLIED',
        changedAt: new Date('2026-05-04T00:00:00Z'),
        changedBy: 'System',
        origin: 'create',
        approximate: false,
        eventKey: `t-${id}-1`,
      },
      {
        organizationId: org,
        candidateId: id,
        fromStage: 'APPLIED',
        toStage: 'SCREENING',
        changedAt: new Date('2026-09-15T00:00:00Z'),
        changedBy: 'Ada',
        origin: 'status_change',
        approximate: false,
        eventKey: `t-${id}-2`,
      },
    ]);

    const metrics = await computePipelineMetrics({
      userFilter: { organizationId: org },
      dateFilter: {
        $gte: new Date('2026-09-01T00:00:00Z'),
        $lt: new Date('2026-10-01T00:00:00Z'),
      },
      cohortMonth: '2026-05',
      now: new Date('2026-09-22T00:00:00Z'),
      timeZone: 'UTC',
      preferredStages: stages,
    });

    expect(metrics.snapshot.reconciles).toBe(true);
    expect(metrics.snapshot.total).toBe(1);
    expect(metrics.snapshot.stages.find((row) => row.stage === 'Screening').count).toBe(1);
    expect(metrics.activity.stages.find((row) => row.stage === 'Screening').count).toBe(1);
    expect(metrics.activity.stages.find((row) => row.stage === 'Applied').count).toBe(0);
    expect(metrics.activity.total).toBe(1);
    expect(metrics.cohort.month).toBe('2026-05');
    expect(metrics.cohort.size).toBe(1);
    expect(metrics.cohort.stages.find((row) => row.stage === 'Screening').count).toBe(1);
    expect(metrics.cohort.stages.reduce((sum, row) => sum + row.count, 0)).toBe(1);
  });

  it('places an imported candidate in the month on their date column, not the upload month', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const org = new mongoose.Types.ObjectId();
    await Candidate.collection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      organizationId: org,
      name: 'Imported',
      email: 'imported-may@example.com',
      status: 'SCREENING',
      date: '04-05-2026',
      createdAt: new Date('2026-08-15T00:00:00Z'),
      appliedAt: new Date('2026-08-15T00:00:00Z'),
    });

    const may = await computePipelineMetrics({
      userFilter: { organizationId: org },
      dateFilter: null,
      cohortMonth: '2026-05',
      now: new Date('2026-09-22T00:00:00Z'),
      timeZone: 'UTC',
      preferredStages: stages,
    });
    const august = await computePipelineMetrics({
      userFilter: { organizationId: org },
      dateFilter: null,
      cohortMonth: '2026-08',
      now: new Date('2026-09-22T00:00:00Z'),
      timeZone: 'UTC',
      preferredStages: stages,
    });

    expect(may.cohort.size).toBe(1);
    expect(august.cohort.size).toBe(0);
  });

  it('writes an append-only event when status changes and backfills only dated history', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const org = new mongoose.Types.ObjectId();
    const created = await Candidate.create({
      organizationId: org,
      name: 'LIVE',
      email: 'live-stage@example.com',
      status: 'Applied',
    });
    const createdEvents = await StageHistory.find({ candidateId: created._id }).lean();
    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0].origin).toBe('create');
    expect(createdEvents[0].toStage).toBe('APPLIED');

    created.status = 'SCREENING';
    await created.save();
    const moved = await StageHistory.find({ candidateId: created._id }).sort({ changedAt: 1 }).lean();
    expect(moved).toHaveLength(2);
    expect(moved[1].fromStage).toBe('APPLIED');
    expect(moved[1].toStage).toBe('SCREENING');

    await expect(StageHistory.updateOne({ _id: moved[0]._id }, { $set: { toStage: 'HIRED' } }))
      .rejects.toThrow(/append-only/);

    const oldId = new mongoose.Types.ObjectId();
    await Candidate.collection.insertOne({
      _id: oldId,
      organizationId: org,
      name: 'OLD',
      email: 'old-stage@example.com',
      status: 'JOINED',
      statusHistory: [
        { status: 'JOINED', remark: 'Backfill — current stage seed', updatedAt: new Date('2026-01-01'), updatedBy: 'System' },
      ],
    });
    const result = await backfillStageHistoryForOrg(org, Candidate);
    expect(result.inserted).toBe(0);
    expect(await StageHistory.countDocuments({ candidateId: oldId })).toBe(0);
    const flagged = await Candidate.collection.findOne({ _id: oldId });
    expect(flagged.stageLogBackfilledAt).toBeInstanceOf(Date);
  });
});
