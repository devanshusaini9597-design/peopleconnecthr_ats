/**
 * BullMQ job queues. Soft-fail when Redis is unavailable so the API still boots
 * without connection-error spam. Resume parse falls back to inline processing.
 */
const logger = require('../utils/logger');

let Queue;
let QueueEvents;
let IORedis;
try {
  ({ Queue, QueueEvents } = require('bullmq'));
  IORedis = require('ioredis');
} catch (err) {
  logger.warn({ err: err.message }, 'bullmq/ioredis not installed — queues disabled');
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

let connection = null;
let resumeParseQueue = null;
let resumeParseEvents = null;
let emailQueue = null;
let webhookQueue = null;
let reportQueue = null;
let excelImportQueue = null;
let queuesEnabled = false;

async function tryInitQueues() {
  if (!Queue || !IORedis || !REDIS_ENABLED) return;

  const probe = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 1500,
    retryStrategy: () => null,
  });

  try {
    await probe.connect();
    await probe.ping();
  } catch (err) {
    try {
      probe.disconnect();
    } catch (e) { /* ignore */ }
    logger.warn('Redis unavailable — resume parse will run inline (set REDIS_URL / start Redis to enable queues)');
    return;
  }

  // Reuse probe as main connection
  connection = probe;
  connection.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis connection error');
  });

  const shared = { connection };
  resumeParseQueue = new Queue('resume-parse', shared);
  resumeParseEvents = new QueueEvents('resume-parse', { connection: connection.duplicate() });
  emailQueue = new Queue('email-send', shared);
  webhookQueue = new Queue('webhook-dispatch', shared);
  reportQueue = new Queue('report-generation', shared);
  excelImportQueue = new Queue('excel-import', shared);
  queuesEnabled = true;
  logger.info('BullMQ queues initialized');
}

// Fire-and-forget init; product works before it completes
const ready = tryInitQueues().catch(() => {});

/**
 * Enqueue a job if Redis is up; otherwise run the provided fallback immediately.
 */
async function enqueueOrRun(queue, name, data, opts, fallback) {
  await ready;
  if (queuesEnabled && queue) {
    try {
      return await queue.add(name, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
        ...opts,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Queue add failed — using fallback');
    }
  }
  if (typeof fallback === 'function') {
    return fallback(data);
  }
  throw new Error('Background queues unavailable and no fallback provided');
}

/**
 * Parse a resume off the Express event loop when Redis+worker are available.
 * Falls back to inline parseResume so the product never breaks without Redis.
 */
async function parseResumeViaQueueOrInline({ buffer, mimetype, filename, parseResume }) {
  await ready;
  if (queuesEnabled && resumeParseQueue && resumeParseEvents) {
    try {
      const job = await resumeParseQueue.add(
        'parse-buffer',
        {
          bufferBase64: Buffer.from(buffer).toString('base64'),
          mimetype,
          filename,
        },
        {
          attempts: 2,
          backoff: { type: 'fixed', delay: 2000 },
          removeOnComplete: 50,
          removeOnFail: 20,
        }
      );
      const result = await job.waitUntilFinished(resumeParseEvents, 180000);
      if (result?.parsed) return result.parsed;
    } catch (err) {
      logger.warn({ err: err.message }, 'Queued resume parse failed/timed out — falling back to inline');
    }
  }
  return parseResume(buffer, mimetype, filename);
}

/**
 * Enqueue email if Redis is up; otherwise send inline.
 * Prefer this for fire-and-forget / retryable sends from routes.
 */
async function enqueueEmail(data) {
  const { sendEmail } = require('../services/emailService');
  return enqueueOrRun(
    emailQueue,
    'send',
    data,
    {},
    async (payload) => {
      await sendEmail(
        payload.to,
        payload.subject,
        payload.html,
        payload.text,
        payload.meta || payload.options || {}
      );
      return { success: true, inline: true };
    }
  );
}

/**
 * Enqueue webhook delivery if Redis is up; otherwise run deliverFn inline.
 * job data: { endpointId, eventType, data }
 */
async function enqueueWebhook(jobData, deliverFn) {
  return enqueueOrRun(
    webhookQueue,
    'dispatch',
    jobData,
    { attempts: 5, backoff: { type: 'exponential', delay: 3000 } },
    async (payload) => {
      if (typeof deliverFn === 'function') {
        await deliverFn(payload);
        return { success: true, inline: true };
      }
      throw new Error('Webhook queues unavailable and no deliverFn provided');
    }
  );
}

module.exports = {
  connection,
  resumeParseQueue,
  resumeParseEvents,
  emailQueue,
  webhookQueue,
  reportQueue,
  excelImportQueue,
  get queuesEnabled() {
    return queuesEnabled;
  },
  ready,
  enqueueOrRun,
  parseResumeViaQueueOrInline,
  enqueueEmail,
  enqueueWebhook,
};
