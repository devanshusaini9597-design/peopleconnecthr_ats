/**
 * Daily backup hook. Off unless BACKUP_ENABLED=1.
 * Run a restore test after each backup unless BACKUP_SKIP_RESTORE_TEST=1.
 */
const logger = require('../utils/logger');

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
let timer = null;

function intervalMs() {
  const raw = Number(process.env.BACKUP_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 60 * 60 * 1000 ? raw : DEFAULT_INTERVAL_MS;
}

async function runScheduledBackup() {
  const { runBackup, runRestoreTest } = require('./backupService');
  const result = await runBackup();
  if (process.env.BACKUP_SKIP_RESTORE_TEST === '1') return result;
  const dumpDir = require('path').join(result.localDir, 'mongo');
  const restore = await runRestoreTest({ dumpDir });
  return { backup: result, restore };
}

function startBackupScheduler() {
  if (process.env.BACKUP_ENABLED !== '1') {
    logger.info('[backup] scheduler idle (set BACKUP_ENABLED=1 to run daily dumps)');
    return;
  }
  if (timer) return;
  const ms = intervalMs();
  logger.info({ intervalHours: Math.round(ms / 3600000) }, '[backup] scheduler started');
  const tick = () => {
    runScheduledBackup().catch((err) => logger.error('[backup] scheduled run failed:', err.message));
  };
  setTimeout(tick, 5 * 60 * 1000);
  timer = setInterval(tick, ms);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { startBackupScheduler, runScheduledBackup };
