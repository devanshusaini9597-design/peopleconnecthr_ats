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
const { foldStatusCounts, pipelineList, statusMatchValues, canonCandidateStatus } = require('../utils/statusCanon');
const { monthRanges, lastNDaysRange, DEFAULT_TZ, buildDateFilter, previousPeriodFilter, getDateRangeLabel, chartBucketConfig } = require('../utils/analyticsTime');
const { withActivityDateRange, activityDateExpr, backfillAppliedAtForOrg } = require('../utils/candidateActivityDate');

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

    const now = new Date();
    const dateRange = String(req.query.dateRange || 'all').trim();
    const customFrom = req.query.customFrom || '';
    const customTo = req.query.customTo || '';
    const { startOfMonth, startOfNextMonth, startOfLastMonth, timeZone } = monthRanges(now);
    const scopeMeta = analyticsScopeMeta(req);

    if (req.user?.organizationId) {
      setImmediate(() => backfillAppliedAtForOrg(req.user.organizationId, Candidate));
    }

    const dateFilter = buildDateFilter(dateRange, customFrom, customTo, now, timeZone);
    const prevFilter = previousPeriodFilter(dateRange, customFrom, customTo, now, timeZone);
    const scopedWithDate = withActivityDateRange(userFilter, dateFilter);
    const scopedPrev = prevFilter ? withActivityDateRange(userFilter, prevFilter) : null;

    // Heal pipeline / casing, and keep Rejected on the org stage list
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
          withActivityDateRange(userFilter, { $gte: startOfMonth, $lt: startOfNextMonth })
        );
    const lastPeriodFallback = scopedPrev
      ? Candidate.countDocuments(scopedPrev)
      : Candidate.countDocuments(
          withActivityDateRange(userFilter, { $gte: startOfLastMonth, $lt: startOfMonth })
        );

    const bucketCfg = chartBucketConfig(dateRange, customFrom, customTo, now, timeZone);
    const chartRange = { $gte: bucketCfg.chartStart };
    if (dateFilter?.$lte) chartRange.$lte = dateFilter.$lte;
    else if (dateFilter?.$lt) chartRange.$lt = dateFilter.$lt;

    const [
      totalCandidatesAllTime,
      totalCandidates,
      thisPeriodCountRaw,
      lastPeriodCount,
      pipelineCounts,
      org,
      topPositions,
      topSources,
      recentRows,
      dailySubmissions,
      locationBreakdown,
    ] = await Promise.all([
      Candidate.countDocuments(userFilter),
      Candidate.countDocuments(scopedWithDate),
      thisPeriodFallback,
      lastPeriodFallback,
      Candidate.aggregate([
        { $match: scopedWithDate },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      orgStagesPromise,
      Candidate.aggregate([
        { $match: { ...scopedWithDate, position: { $exists: true, $ne: '' } } },
        { $group: { _id: '$position', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Candidate.aggregate([
        { $match: { ...scopedWithDate, source: { $exists: true, $ne: '' } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Candidate.aggregate([
        { $match: scopedWithDate },
        { $addFields: { activityDate: activityDateExpr() } },
        { $sort: { activityDate: -1 } },
        { $limit: 5 },
        {
          $project: {
            name: 1,
            position: 1,
            status: 1,
            source: 1,
            createdAt: '$activityDate',
          },
        },
      ]),
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
      ]),
      Candidate.aggregate([
        { $match: { ...scopedWithDate, location: { $exists: true, $ne: '' } } },
        { $group: { _id: '$location', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const thisPeriodCount = dateFilter ? totalCandidates : (thisPeriodCountRaw || 0);
    let pipeline = foldStatusCounts(pipelineCounts);
    let periodByStatus = pipeline; // same period match as status cards

    let preferredStages = DEFAULT_STAGES;
    if (Array.isArray(org?.atsSettings?.pipelineStages) && org.atsSettings.pipelineStages.length) {
      preferredStages = org.atsSettings.pipelineStages;
    }
    // KPI cards: every org pipeline stage (including zeros)
    const statusCards = pipelineList(pipeline, preferredStages, {
      includeZero: true,
      ensureStages: ['Rejected', 'Dropped'],
    }).map((row) => ({
      stage: row.stage,
      count: row.count,
      thisMonth: periodByStatus[row.stage] || 0,
    }));

    // Pending review (Applied + Screening) — matches Candidates page after ALL-CAPS save
    const pendingReview = (pipeline.Applied || 0) + (pipeline.Screening || 0);

    // Period trend (percentage vs previous period)
    const candidateTrend =
      lastPeriodCount > 0
        ? Math.round(((thisPeriodCount - lastPeriodCount) / lastPeriodCount) * 100)
        : thisPeriodCount > 0
          ? 100
          : 0;

    const dailyData = bucketCfg.dayKeys.map(({ key, day }) => {
      const found = dailySubmissions.find((ds) => ds._id === key);
      return { date: key, day, count: found ? found.count : 0 };
    });

    // Offer-to-Join ratio — Hired + Joined (aligned with export definition)
    const joinedCount = pipeline.Joined || 0;
    const hiredCount = pipeline.Hired || 0;
    const rejectedCount = pipeline.Rejected || 0;
    const droppedCount = pipeline.Dropped || 0;
    const totalOfferPlusJoined = hiredCount + joinedCount;
    const conversionRate =
      totalCandidates > 0 ? Math.round((totalOfferPlusJoined / totalCandidates) * 100) : 0;
    const rejectionRate =
      totalCandidates > 0
        ? Math.round(((rejectedCount + droppedCount) / totalCandidates) * 100)
        : 0;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({
      ...scopeMeta,
      dateRange,
      periodLabel: getDateRangeLabel(dateRange, customFrom, customTo),
      customFrom: customFrom || undefined,
      customTo: customTo || undefined,
      // ATS list view that matches these cards
      atsView: scopeMeta.scope === 'organization' ? 'all' : 'mine',
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
      topPositions: topPositions.map((p) => ({ position: p._id, count: p.count })),
      topSources: topSources.map((s) => ({ source: s._id, count: s.count })),
      recentCandidates: recentRows.map((c) => ({
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
      locationBreakdown: locationBreakdown.map((l) => ({ location: l._id, count: l.count })),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: err.message });
  }
};