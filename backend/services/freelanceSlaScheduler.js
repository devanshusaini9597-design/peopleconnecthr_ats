/**
 * Hourly SLA escalation for freelance desk handoffs.
 */
const logger = require('../utils/logger');

const INTERVAL_MS = 60 * 60 * 1000;
let timer = null;

function startFreelanceSlaScheduler() {
  if (timer) return;
  const tick = () => {
    const { escalateSlaBreaches } = require('./freelancerOps');
    escalateSlaBreaches()
      .then((r) => {
        if (r?.escalated) logger.info({ escalated: r.escalated }, '[freelance-sla] escalations sent');
      })
      .catch((err) => logger.error('[freelance-sla] tick failed:', err.message));
  };
  setTimeout(tick, 2 * 60 * 1000);
  timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  logger.info('[freelance-sla] scheduler started');
}

module.exports = { startFreelanceSlaScheduler };
