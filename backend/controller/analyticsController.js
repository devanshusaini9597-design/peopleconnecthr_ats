// backend/controllers/analyticsController.js
const Candidate = require('../models/Candidate');
const Organization = require('../models/Organization');
const User = require('../models/User');
const {
  analyticsScope,
  analyticsScopeMeta,
  canViewOrgAnalytics,
  requestedAnalyticsUserId,
} = require('../utils/dataScope');
const { statusMatchValues, canonCandidateStatus, foldStatusCounts, pipelineList } = require('../utils/statusCanon');
const { monthRanges, lastNDaysRange, DEFAULT_TZ, buildDateFilter, previousPeriodFilter, getDateRangeLabel, chartBucketConfig } = require('../utils/analyticsTime');
const { withActivityDateRange, activityDateExpr, backfillAppliedAtForOrg } = require('../utils/candidateActivityDate');
const {
  backfillStatusEnteredAtForOrg,
} = require('../utils/candidateStatusHistory');
const { backfillStageHistoryForOrg } = require('../services/stageHistoryService');
const { getDashboardPipelineMetrics } = require('../services/pipelineMetricsService');

const DASH_CACHE_TTL_MS = 30_000;
const dashStatsCache = new Map();

function dashboardCacheKey(req) {
  return [
    req.user?.organizationId || '',
    req.user?.id || '',
    req.query.dateRange || 'all',
    req.query.customFrom || '',
    req.query.customTo || '',
    req.query.cohortMonth || '',
    req.query.userId || '',
  ].join('|');
}

function readDashCache(key) {
  const hit = dashStatsCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > DASH_CACHE_TTL_MS) {
    dashStatsCache.delete(key);
    return null;
  }
  return hit.payload;
}

function writeDashCache(key, payload) {
  if (dashStatsCache.size > 200) {
    const oldest = dashStatsCache.keys().next().value;
    dashStatsCache.delete(oldest);
  }
  dashStatsCache.set(key, { at: Date.now(), payload });
}

async function scopedFilter(req, res) {
  try {
    // Owner/admin/manager: full org analytics. Recruiter: own SPOC desk only.
    return await analyticsScope(req);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
    return null;
  }
}

exports.listAnalyticsEmployees = async (req, res) => {
  try {
    if (!canViewOrgAnalytics(req.user)) {
      return res.status(200).json({ success: true, canSelectEmployee: false, employees: [] });
    }
    if (!req.user.organizationId) {
      return res.status(200).json({ success: true, canSelectEmployee: true, employees: [] });
    }
    const users = await User.find({
      organizationId: req.user.organizationId,
      isActive: { $ne: false },
    })
      .select('name email role profilePicture')
      .sort({ name: 1, email: 1 })
      .lean();

    res.status(200).json({
      success: true,
      canSelectEmployee: true,
      employees: users.map((u) => ({
        id: String(u._id),
        name: u.name || (u.email || '').split('@')[0] || 'Teammate',
        email: u.email || '',
        role: u.role || '',
        profilePicture: u.profilePicture || '',
      })),
    });
  } catch (err) {
    console.error('Analytics employees error:', err);
    res.status(500).json({ success: false, message: 'Error listing employees' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const userFilter = await scopedFilter(req, res);
    if (!userFilter) return;

    // 1. Daily CV Submission Tracking (Last 7 days)
    const dailySubmissions = await Candidate.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 7 },
      { $sort: { _id: 1 } }
    ]);

    // 2. Source-wise Performance
    const sourcePerformance = await Candidate.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: "$source", 
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Offer vs Joining Ratio
    const statusCounts = await Candidate.aggregate([
      {
        $match: { ...userFilter, status: { $in: statusMatchValues(['Offer', 'Joined', 'Hired']) } } 
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // 4. Time-to-Hire (Average days)
    const timeToHire = await Candidate.aggregate([
      { $match: { ...userFilter, status: { $in: statusMatchValues(['Joined']) }, hiredDate: { $exists: true } } },
      {
        $project: {
          days: {
            $divide: [
              { $subtract: ["$hiredDate", "$createdAt"] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: "$days" }
        }
      }
    ]);

    res.status(200).json({
      dailySubmissions,
      sourcePerformance,
      statusCounts,
      avgTimeToHire: timeToHire[0]?.avgDays || 0,
      ...analyticsScopeMeta(req),
    });

  } catch (err) {
    console.log("Database Error:", err);
    res.status(500).json({ message: "Error fetching analytics", error: err.message });
  }    
};

// DEI funnel analytics — Add-on (feature: analytics.dei, Enterprise).
// Breaks down the pipeline by optional, self-reported demographic fields
// so an org can spot drop-off skew across the hiring funnel. Never returns
// per-candidate rows — only aggregate counts — since these fields are
// sensitive and this endpoint's whole purpose is to keep them that way.
exports.getDEIAnalytics = async (req, res) => {
  try {
    const userFilter = await scopedFilter(req, res);
    if (!userFilter) return;

    const buildBreakdown = async (field) => {
      const rows = await Candidate.aggregate([
        { $match: { ...userFilter, [field]: { $exists: true, $ne: '' } } },
        { $group: { _id: `$${field}`, total: { $sum: 1 }, hired: { $sum: { $cond: [{ $in: ['$status', statusMatchValues(['Hired', 'Joined'])] }, 1, 0] } } } },
        { $sort: { total: -1 } }
      ]);
      return rows.map(r => ({ label: r._id, total: r.total, hired: r.hired }));
    };

    const [genderIdentity, ethnicity, veteranStatus, disabilityStatus] = await Promise.all([
      buildBreakdown('demographics.genderIdentity'),
      buildBreakdown('demographics.ethnicity'),
      buildBreakdown('demographics.veteranStatus'),
      buildBreakdown('demographics.disabilityStatus')
    ]);

    const totalCandidates = await Candidate.countDocuments(userFilter);
    const selfReportedCount = await Candidate.countDocuments({
      ...userFilter,
      $or: [
        { 'demographics.genderIdentity': { $exists: true, $ne: '' } },
        { 'demographics.ethnicity': { $exists: true, $ne: '' } },
        { 'demographics.veteranStatus': { $exists: true, $ne: '' } },
        { 'demographics.disabilityStatus': { $exists: true, $ne: '' } }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        totalCandidates,
        selfReportedCount,
        selfReportRate: totalCandidates > 0 ? Math.round((selfReportedCount / totalCandidates) * 100) : 0,
        breakdowns: { genderIdentity, ethnicity, veteranStatus, disabilityStatus }
      },
      ...analyticsScopeMeta(req),
    });
  } catch (err) {
    console.error('DEI analytics error:', err);
    res.status(500).json({ success: false, message: 'Error fetching DEI analytics', error: err.message });
  }
};

// Dashboard Stats endpoint - returns all data needed for dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const userFilter = await scopedFilter(req, res);
    if (!userFilter) return;

    const forceRefresh = String(req.query.refresh || '') === '1';
    const cacheKey = dashboardCacheKey(req);
    if (!forceRefresh) {
      const cached = readDashCache(cacheKey);
      if (cached) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(200).json(cached);
      }
    }

    const now = new Date();
    const dateRange = String(req.query.dateRange || 'all').trim();
    const customFrom = req.query.customFrom || '';
    const customTo = req.query.customTo || '';
    const { startOfMonth, startOfNextMonth, startOfLastMonth, timeZone } = monthRanges(now);
    const scopeMeta = analyticsScopeMeta(req);

    if (req.user?.organizationId) {
      setImmediate(() => {
        backfillAppliedAtForOrg(req.user.organizationId, Candidate).catch(() => {});
        backfillStatusEnteredAtForOrg(req.user.organizationId, Candidate)
          .catch(() => {})
          .then(() => backfillStageHistoryForOrg(req.user.organizationId, Candidate))
          .catch(() => {});
      });
    }

    const dateFilter = buildDateFilter(dateRange, customFrom, customTo, now, timeZone);
    const prevFilter = previousPeriodFilter(dateRange, customFrom, customTo, now, timeZone);
    const scopedWithDate = withActivityDateRange(userFilter, dateFilter);
    const scopedPrev = prevFilter ? withActivityDateRange(userFilter, prevFilter) : null;

    // Keep Rejected on the org stage list before metrics; heavy heal stays off the request.
    if (req.user?.organizationId) {
      try {
        const { ensureCorePipelineStages } = require('../services/pipelineStageSync');
        await ensureCorePipelineStages(req.user.organizationId, ['Rejected']);
      } catch (_) { /* non-fatal */ }
      setImmediate(() => {
        const { reconcileOrgPipelineSafe } = require('../services/pipelineStageSync');
        const { healCandidateBlockLettersSafe } = require('../services/candidateCasingHeal');
        Promise.resolve()
          .then(() => reconcileOrgPipelineSafe(req.user.organizationId))
          .catch(() => {})
          .finally(() => healCandidateBlockLettersSafe(req.user.organizationId));
      });
    }

    const DEFAULT_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    const orgStagesPromise = req.user?.organizationId
      ? Organization.findById(req.user.organizationId).select('atsSettings.pipelineStages').lean()
      : Promise.resolve(null);

    const thisPeriodFallback = dateFilter
      ? null
      : Candidate.countDocuments(
          withActivityDateRange(userFilter, { $gte: startOfMonth, $lt: startOfNextMonth }),
          { maxTimeMS: 12000 }
        );
    const lastPeriodFallback = scopedPrev
      ? Candidate.countDocuments(scopedPrev, { maxTimeMS: 12000 })
      : Candidate.countDocuments(
          withActivityDateRange(userFilter, { $gte: startOfLastMonth, $lt: startOfMonth }),
          { maxTimeMS: 12000 }
        );

    const bucketCfg = chartBucketConfig(dateRange, customFrom, customTo, now, timeZone);
    const chartRange = { $gte: bucketCfg.chartStart };
    if (dateFilter?.$lte) chartRange.$lte = dateFilter.$lte;
    else if (dateFilter?.$lt) chartRange.$lt = dateFilter.$lt;

    const queryOpts = { maxTimeMS: 12000 };
    const settled = await Promise.allSettled([
      Candidate.countDocuments(userFilter, queryOpts),
      Candidate.countDocuments(scopedWithDate, queryOpts),
      thisPeriodFallback,
      lastPeriodFallback,
      (async () => {
        const orgDoc = await orgStagesPromise;
        let preferredStages = DEFAULT_STAGES;
        if (Array.isArray(orgDoc?.atsSettings?.pipelineStages) && orgDoc.atsSettings.pipelineStages.length) {
          preferredStages = orgDoc.atsSettings.pipelineStages;
        }
        return getDashboardPipelineMetrics({
          userFilter,
          dateRange,
          dateFilter,
          cohortMonth: req.query.cohortMonth,
          now,
          timeZone,
          preferredStages,
          force: forceRefresh,
        });
      })(),
      Candidate.aggregate([
        { $match: { $and: [scopedWithDate, { position: { $exists: true, $ne: '' } }] } },
        { $group: { _id: '$position', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ], queryOpts),
      Candidate.aggregate([
        { $match: { $and: [scopedWithDate, { source: { $exists: true, $ne: '' } }] } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ], queryOpts),
      Candidate.aggregate([
        // Same desk as ATS directory — not the KPI period window.
        { $match: userFilter },
        { $sort: { createdAt: -1 } },
        { $limit: 8 },
        {
          $project: {
            name: 1,
            position: 1,
            status: 1,
            source: 1,
            createdAt: 1,
          },
        },
      ], queryOpts),
      Candidate.aggregate([
        { $match: userFilter },
        { $addFields: { activityDate: activityDateExpr() } },
        { $match: { activityDate: chartRange } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$activityDate',
                timezone: timeZone || DEFAULT_TZ,
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ], queryOpts),
      Candidate.aggregate([
        { $match: { $and: [scopedWithDate, { location: { $exists: true, $ne: '' } }] } },
        { $group: { _id: '$location', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ], queryOpts),
      Candidate.aggregate([
        { $match: scopedWithDate },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ], queryOpts),
      Candidate.aggregate([
        { $match: { $and: [scopedWithDate, { source: { $exists: true, $ne: '' } }] } },
        {
          $group: {
            _id: '$source',
            total: { $sum: 1 },
            hired: { $sum: { $cond: [{ $in: ['$status', statusMatchValues(['Hired', 'Joined'])] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ], queryOpts),
      Candidate.aggregate([
        { $match: { $and: [scopedWithDate, { position: { $exists: true, $ne: '' } }] } },
        {
          $group: {
            _id: '$position',
            total: { $sum: 1 },
            hired: { $sum: { $cond: [{ $in: ['$status', statusMatchValues(['Hired', 'Joined'])] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ], queryOpts),
      Candidate.aggregate([
        {
          $match: {
            $and: [
              scopedWithDate,
              { status: { $in: statusMatchValues(['Hired', 'Joined']) } },
              { statusEnteredAt: { $type: 'date' } },
            ],
          },
        },
        { $addFields: { activityDate: activityDateExpr() } },
        {
          $project: {
            days: { $divide: [{ $subtract: ['$statusEnteredAt', '$activityDate'] }, 1000 * 60 * 60 * 24] },
          },
        },
        { $match: { days: { $gte: 0, $lte: 3650 } } },
        { $group: { _id: null, avgDays: { $avg: '$days' }, samples: { $sum: 1 } } },
      ], queryOpts),
      Candidate.aggregate([
        {
          $match: {
            ...userFilter,
            status: { $nin: statusMatchValues(['Hired', 'Joined', 'Rejected', 'Dropped']) },
            statusEnteredAt: { $type: 'date' },
          },
        },
        {
          $project: {
            days: { $divide: [{ $subtract: [now, '$statusEnteredAt'] }, 1000 * 60 * 60 * 24] },
          },
        },
        {
          $bucket: {
            groupBy: '$days',
            boundaries: [0, 8, 15, 31, 100000],
            default: 'other',
            output: { count: { $sum: 1 } },
          },
        },
      ], queryOpts),
    ]);

    const pick = (index, fallback) => {
      const row = settled[index];
      if (row.status === 'fulfilled') return row.value;
      console.error('Dashboard stats partial failure:', row.reason?.message || row.reason);
      return fallback;
    };

    const totalCandidatesAllTimeRaw = pick(0, 0);
    const totalCandidates = pick(1, 0);
    const thisPeriodCountRaw = pick(2, 0);
    const lastPeriodCount = pick(3, 0);
    const metrics = pick(4, null) || {
      snapshot: { total: totalCandidatesAllTimeRaw, sum: 0, reconciles: false, stages: [], asOf: 'now' },
      activity: { total: 0, stages: [] },
      cohort: { month: '', label: '', size: 0, stages: [] },
      velocity: [],
      coverage: { candidates: 0, withEvents: 0 },
      fromRollup: false,
      computedAt: now,
    };
    const topPositions = pick(5, []);
    const topSources = pick(6, []);
    const recentRows = pick(7, []);
    const dailySubmissions = pick(8, []);
    const locationBreakdown = pick(9, []);
    const periodStatusRows = pick(10, []);
    const sourceQuality = pick(11, []);
    const positionQuality = pick(12, []);
    const timeToHireRows = pick(13, []);
    const agingRows = pick(14, []);

    const thisPeriodCount = dateFilter ? totalCandidates : (thisPeriodCountRaw || 0);
    const statusCards = (metrics.snapshot?.stages || []).map((row) => ({
      stage: row.stage,
      count: row.count,
    }));
    const stageCount = (name) => statusCards.find((row) => row.stage === name)?.count || 0;
    const totalCandidatesAllTime = Number(metrics.snapshot?.total ?? totalCandidatesAllTimeRaw) || 0;

    const pendingReview = stageCount('Applied') + stageCount('Screening');

    // Period trend (percentage vs the previous period of the same length).
    // All-time has no comparable window, so the trend stays unset.
    const candidateTrend = !dateFilter
      ? null
      : lastPeriodCount > 0
        ? Math.round(((thisPeriodCount - lastPeriodCount) / lastPeriodCount) * 100)
        : thisPeriodCount > 0
          ? 100
          : 0;

    const dailyData = (bucketCfg.dayKeys || []).map((bucket) => {
      if (bucketCfg.rollup === 'week') {
        const count = dailySubmissions.reduce((sum, row) => (
          row._id >= bucket.startKey && row._id <= bucket.endKey ? sum + row.count : sum
        ), 0);
        return { date: bucket.key, day: bucket.day, count };
      }
      const found = dailySubmissions.find((ds) => ds._id === bucket.key);
      return { date: bucket.key, day: bucket.day, count: found ? found.count : 0 };
    });

    // Offer-to-Join ratio — Hired + Joined (aligned with export definition)
    const joinedCount = stageCount('Joined');
    const hiredCount = stageCount('Hired');
    const rejectedCount = stageCount('Rejected');
    const droppedCount = stageCount('Dropped');
    const totalOfferPlusJoined = hiredCount + joinedCount;
    const conversionRate =
      totalCandidatesAllTime > 0 ? Math.round((totalOfferPlusJoined / totalCandidatesAllTime) * 100) : 0;
    const rejectionRate =
      totalCandidatesAllTime > 0
        ? Math.round(((rejectedCount + droppedCount) / totalCandidatesAllTime) * 100)
        : 0;

    const periodPipeline = foldStatusCounts(periodStatusRows);
    const periodStages = pipelineList(periodPipeline, DEFAULT_STAGES, {
      includeZero: true,
      ensureStages: ['Rejected', 'Dropped'],
    });
    const periodHired = (periodPipeline.Hired || 0) + (periodPipeline.Joined || 0);
    const periodRejected = (periodPipeline.Rejected || 0) + (periodPipeline.Dropped || 0);
    const periodHireRate = totalCandidates > 0 ? Math.round((periodHired / totalCandidates) * 100) : 0;
    const periodRejectionRate = totalCandidates > 0 ? Math.round((periodRejected / totalCandidates) * 100) : 0;
    const timeToHire = Array.isArray(timeToHireRows) ? timeToHireRows[0] : null;
    const agingLabels = { 0: '0–7 days', 8: '8–14 days', 15: '15–30 days', 31: '31+ days' };
    const aging = [0, 8, 15, 31].map((boundary) => ({
      label: agingLabels[boundary],
      days: boundary,
      count: (Array.isArray(agingRows) ? agingRows : []).find((row) => row._id === boundary)?.count || 0,
    }));

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const payload = {
      ...scopeMeta,
      dateRange,
      periodLabel: getDateRangeLabel(dateRange, customFrom, customTo),
      customFrom: customFrom || undefined,
      customTo: customTo || undefined,
      // ATS list view that matches these cards
      atsView: scopeMeta.scope === 'organization' ? 'all' : 'mine',
      attribution: {
        snapshot: 'currentStage',
        intake: 'appliedAt',
        activity: 'stageHistory.changedAt',
        cohort: 'record date month, current stage today',
        snapshotCaption: 'As of now',
        intakeCaption: 'Added in the selected period, any current stage',
        activityCaption: 'Stage moves recorded in the selected period',
      },
      cohortMonth: metrics.cohort?.month,
      totalCandidates,
      totalCandidatesAllTime,
      thisMonth: thisPeriodCount,
      lastMonth: lastPeriodCount,
      pendingReview,
      candidateTrend,
      conversionRate,
      rejectionRate,
      generatedAt: now.toISOString(),
      timezone: timeZone || DEFAULT_TZ,
      pipeline: statusCards,
      statusCards,
      metrics: {
        snapshot: metrics.snapshot,
        activity: metrics.activity,
        cohort: metrics.cohort,
        velocity: metrics.velocity,
        coverage: metrics.coverage,
        computedAt: metrics.computedAt,
        fromRollup: Boolean(metrics.fromRollup),
      },
      topPositions: (Array.isArray(topPositions) ? topPositions : []).map((p) => ({ position: p._id, count: p.count })),
      topSources: (Array.isArray(topSources) ? topSources : []).map((s) => ({ source: s._id, count: s.count })),
      recentCandidates: (Array.isArray(recentRows) ? recentRows : []).map((c) => ({
        id: c._id,
        name: c.name,
        position: c.position,
        status: canonCandidateStatus(c.status),
        createdAt: c.createdAt,
        source: c.source,
      })),
      dailySubmissions: dailyData,
      chartLabel: bucketCfg.chartLabel,
      chartDays: bucketCfg.days,
      locationBreakdown: (Array.isArray(locationBreakdown) ? locationBreakdown : []).map((l) => ({ location: l._id, count: l.count })),
      analysis: {
        intake: totalCandidates,
        hired: periodHired,
        rejected: periodRejected,
        hireRate: periodHireRate,
        rejectionRate: periodRejectionRate,
        timeToHireDays: timeToHire?.samples ? Math.round(timeToHire.avgDays * 10) / 10 : null,
        timeToHireSamples: timeToHire?.samples || 0,
        funnel: periodStages.map((row) => ({
          stage: row.stage,
          count: row.count,
          share: totalCandidates > 0 ? Math.round((row.count / totalCandidates) * 100) : 0,
        })),
        sources: (Array.isArray(sourceQuality) ? sourceQuality : []).map((row) => ({
          source: row._id,
          total: row.total,
          hired: row.hired,
          hireRate: row.total > 0 ? Math.round((row.hired / row.total) * 100) : 0,
        })),
        positions: (Array.isArray(positionQuality) ? positionQuality : []).map((row) => ({
          position: row._id,
          total: row.total,
          hired: row.hired,
          hireRate: row.total > 0 ? Math.round((row.hired / row.total) * 100) : 0,
        })),
        aging,
        velocity: metrics.velocity || [],
      },
    };
    writeDashCache(cacheKey, payload);
    res.status(200).json(payload);
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: err.message });
  }
};