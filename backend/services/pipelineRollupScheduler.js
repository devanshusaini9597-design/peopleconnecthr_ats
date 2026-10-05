/**
 * Hourly precompute of org-wide pipeline rollups (snapshot, activity, cohort, velocity).
 * The dashboard reads the rollup; this job keeps it from going stale.
 */
const logger = require('../utils/logger');
const { DEFAULT_TZ } = require('../utils/analyticsTime');

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
let timer = null;

function intervalMs() {
  const raw = Number(process.env.PIPELINE_ROLLUP_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 5 * 60 * 1000 ? raw : DEFAULT_INTERVAL_MS;
}

async function refreshOrgPipelineRollups(now = new Date()) {
  const Organization = require('../models/Organization');
  const { getDashboardPipelineMetrics } = require('./pipelineMetricsService');
  const { monthRanges: rangesFor } = require('../utils/analyticsTime');
  const orgs = await Organization.find({}).select('_id atsSettings.pipelineStages').lean();
  const { startOfMonth, startOfNextMonth, timeZone } = rangesFor(now, DEFAULT_TZ);
  let refreshed = 0;

  for (const org of orgs) {
    const stages = Array.isArray(org.atsSettings?.pipelineStages) && org.atsSettings.pipelineStages.length
      ? org.atsSettings.pipelineStages
      : ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    await getDashboardPipelineMetrics({
      userFilter: { organizationId: { $in: [org._id, String(org._id)] } },
      dateRange: 'month',
      dateFilter: { $gte: startOfMonth, $lt: startOfNextMonth },
      now,
      timeZone: timeZone || DEFAULT_TZ,
      preferredStages: stages,
      force: true,
    });
    refreshed += 1;
  }
  return { refreshed };
}

function startPipelineRollupScheduler() {
  if (timer) return;
  const ms = intervalMs();
  logger.info({ intervalMinutes: Math.round(ms / 60000) }, '[pipeline-rollup] scheduler started');
  const tick = () => {
    refreshOrgPipelineRollups().catch((err) => {
      logger.error({ err: err.message }, '[pipeline-rollup] scheduled run failed');
    });
  };
  setTimeout(tick, 30 * 1000);
  timer = setInterval(tick, ms);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { startPipelineRollupScheduler, refreshOrgPipelineRollups };
