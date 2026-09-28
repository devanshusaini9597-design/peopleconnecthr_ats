/**
 * Poll shared IMAP mailboxes into ATS Inbox.
 */
const logger = require('../utils/logger');
const { pollAllMailboxes } = require('./inboxImapService');

const DEFAULT_INTERVAL_MS = 90 * 1000;
let timer = null;

function intervalMs() {
  const raw = Number(process.env.INBOX_IMAP_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 30 * 1000 ? raw : DEFAULT_INTERVAL_MS;
}

function startInboxImapScheduler() {
  if (timer) return;
  const ms = intervalMs();
  logger.info({ intervalSeconds: Math.round(ms / 1000) }, '[inbox-imap] scheduler started');
  const tick = () => {
    pollAllMailboxes()
      .then((summary) => {
        if (summary.polled) {
          logger.info(summary, '[inbox-imap] poll finished');
        }
      })
      .catch((err) => {
        logger.error({ err: err.message }, '[inbox-imap] scheduled run failed');
      });
  };
  setTimeout(tick, 20 * 1000);
  timer = setInterval(tick, ms);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { startInboxImapScheduler };
