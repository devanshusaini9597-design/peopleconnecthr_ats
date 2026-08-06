/**
 * Resume parse worker — runs OCR/PDF parsing off the Express event loop.
 * Start: npm run worker:resume
 * Requires REDIS_URL.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const logger = require('../../utils/logger');

let Worker;
try {
  ({ Worker } = require('bullmq'));
} catch (err) {
  console.error('bullmq not installed. Run: npm install bullmq ioredis');
  process.exit(1);
}

const { connection } = require('../queue');
const mongoose = require('mongoose');
const { parseResume } = require('../../services/resumeParser');

const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;

(async () => {
  if (!connection) {
    logger.error('Redis connection not available — cannot start resume parse worker');
    process.exit(1);
  }

  await connection.connect().catch(() => {});
  if (mongoUrl) {
    await mongoose.connect(mongoUrl).catch((err) => {
      logger.warn({ err: err.message }, 'Mongo optional for buffer-only jobs');
    });
  }

  let Candidate;
  try {
    Candidate = require('../../models/Candidate');
  } catch (e) {
    Candidate = null;
  }

  const worker = new Worker(
    'resume-parse',
    async (job) => {
      if (job.name === 'parse-buffer' || job.data?.bufferBase64) {
        const { bufferBase64, mimetype, filename } = job.data;
        const buffer = Buffer.from(bufferBase64, 'base64');
        logger.info({ filename, jobId: job.id }, 'Parsing resume buffer');
        const parsed = await parseResume(buffer, mimetype, filename || '');
        return { success: true, parsed };
      }

      const { candidateId, filePath, organizationId, mimetype, filename } = job.data;
      logger.info({ candidateId, organizationId, jobId: job.id }, 'Parsing resume file');

      const fs = require('fs');
      const buffer = fs.readFileSync(filePath);
      const parsed = await parseResume(buffer, mimetype || 'application/pdf', filename || path.basename(filePath));

      if (Candidate && candidateId) {
        await Candidate.findByIdAndUpdate(candidateId, {
          $set: {
            resumeParsed: parsed,
            parseStatus: 'completed',
            name: parsed.name || undefined,
            email: parsed.email || undefined,
            contact: parsed.contact || undefined,
          },
        });
      }

      try {
        fs.unlink(filePath, () => {});
      } catch (e) { /* ignore */ }

      return { success: true, candidateId, parsed };
    },
    {
      connection,
      concurrency: 2,
      limiter: { max: 10, duration: 60000 },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Resume parse job failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Resume parse job completed');
  });

  logger.info('Resume parse worker started');
})().catch((err) => {
  logger.error({ err }, 'Resume parse worker failed to start');
  process.exit(1);
});
