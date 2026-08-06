/**
 * Email send worker — processes email-send BullMQ jobs.
 * Start: npm run worker:email
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const logger = require('../../utils/logger');
let Worker;
try {
  ({ Worker } = require('bullmq'));
} catch (err) {
  console.error('bullmq not installed');
  process.exit(1);
}

const IORedis = require('ioredis');
const { sendEmail } = require('../../services/emailService');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

(async () => {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  await connection.ping();

  const worker = new Worker(
    'email-send',
    async (job) => {
      const { to, subject, html, text, meta } = job.data;
      logger.info({ to, subject, jobId: job.id }, 'Sending queued email');
      await sendEmail(to, subject, html, text, meta || {});
      return { success: true };
    },
    { connection, concurrency: 3 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Email job failed');
  });

  logger.info('Email send worker started');
})().catch((err) => {
  logger.error({ err }, 'Email worker failed to start');
  process.exit(1);
});
