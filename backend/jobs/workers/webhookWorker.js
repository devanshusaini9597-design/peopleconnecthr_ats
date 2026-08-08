/**
 * Webhook dispatch worker.
 * Start: npm run worker:webhook
 *
 * Jobs contain { endpointId, eventType, data } and reuse webhookDispatcher
 * delivery (HMAC signing + delivery log + consecutive-failure disable).
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
const mongoose = require('mongoose');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;

(async () => {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  await connection.ping();
  if (mongoUrl) await mongoose.connect(mongoUrl);

  // Ensure models are registered
  require('../../models/WebhookEndpoint');
  require('../../models/WebhookDelivery');

  const { deliverByEndpointId } = require('../../services/webhookDispatcher');

  const worker = new Worker(
    'webhook-dispatch',
    async (job) => {
      const { endpointId, eventType, data } = job.data;
      logger.info({ endpointId, eventType, jobId: job.id }, 'Dispatching webhook');
      const result = await deliverByEndpointId({ endpointId, eventType, data });
      if (result?.skipped) return result;
      if (result && result.success === false) {
        throw new Error(result.errorMessage || `Webhook delivery failed (${result.responseStatus})`);
      }
      return { success: true, status: result?.responseStatus };
    },
    { connection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Webhook job failed');
  });

  logger.info('Webhook dispatch worker started');
})().catch((err) => {
  logger.error({ err }, 'Webhook worker failed to start');
  process.exit(1);
});
