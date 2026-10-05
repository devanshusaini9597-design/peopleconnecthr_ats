/**
 * Backfill old EmailSendLog + Message bodies into S3 mail-archive/.
 * Skips docs that already have archiveKey. Soft-fails per doc.
 *
 * Usage:
 *   node scripts/backfill-mail-archive.js
 *   node scripts/backfill-mail-archive.js --dry-run
 *   node scripts/backfill-mail-archive.js --limit 200
 *   node scripts/backfill-mail-archive.js --concurrency 8
 *   railway run node scripts/backfill-mail-archive.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const EmailSendLog = require('../models/EmailSendLog');
const Message = require('../models/Message');
const { storeOutbound, storeInbound, isConfigured } = require('../services/emailArchiveService');

function argValue(flag, fallback = null) {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function hasBody(html, text) {
  return Boolean(String(html || '').trim() || String(text || '').trim());
}

async function withRetry(fn, attempts = 3) {
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const result = await fn();
      if (result?.archiveKey) return result;
      lastErr = new Error('store returned null');
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  if (lastErr) throw lastErr;
  return null;
}

async function mapPool(items, concurrency, worker) {
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      await worker(items[i]);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => run()));
}

async function backfillOutbound({ dryRun, limit, pageSize, concurrency }) {
  const filter = {
    $and: [
      { $or: [{ archiveKey: { $exists: false } }, { archiveKey: null }, { archiveKey: '' }] },
      {
        $or: [
          { htmlBody: { $exists: true, $nin: [null, ''] } },
          { textBody: { $exists: true, $nin: [null, ''] } },
        ],
      },
    ],
  };

  const total = await EmailSendLog.countDocuments(filter);
  console.log(`[outbound] candidates=${total} dryRun=${dryRun} concurrency=${concurrency}`);

  let scanned = 0;
  let archived = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    if (limit && scanned >= limit) break;
    const take = limit ? Math.min(pageSize, limit - scanned) : pageSize;
    const docs = await EmailSendLog.find(filter)
      .sort({ sentAt: 1 })
      .limit(take)
      .select('_id organizationId subject htmlBody textBody fromEmail replyToEmail recipients provider channel emailType campaignKey messageId sentAt createdAt')
      .lean();
    if (!docs.length) break;

    await mapPool(docs, concurrency, async (doc) => {
      scanned += 1;
      if (!hasBody(doc.htmlBody, doc.textBody)) {
        skipped += 1;
        return;
      }
      if (dryRun) {
        archived += 1;
        return;
      }
      try {
        const result = await withRetry(() => storeOutbound({
          sendLogId: doc._id,
          organizationId: doc.organizationId,
          subject: doc.subject,
          html: doc.htmlBody,
          text: doc.textBody,
          from: doc.fromEmail,
          replyTo: doc.replyToEmail,
          recipients: doc.recipients,
          provider: doc.provider,
          channel: doc.channel,
          emailType: doc.emailType,
          campaignKey: doc.campaignKey,
          messageId: doc.messageId,
          sentAt: doc.sentAt || doc.createdAt,
        }));
        if (!result?.archiveKey) {
          failed += 1;
          return;
        }
        await EmailSendLog.updateOne(
          { _id: doc._id },
          { $set: { archiveKey: result.archiveKey, archiveMetaKey: result.archiveMetaKey || '' } }
        );
        archived += 1;
      } catch (err) {
        failed += 1;
        console.warn(`[outbound] fail ${doc._id}: ${err.message}`);
      }
    });

    console.log(`[outbound] progress scanned=${scanned} archived=${archived} failed=${failed} skipped=${skipped}`);
    if (docs.length < take) break;
  }

  return { total, scanned, archived, skipped, failed };
}

async function backfillInbound({ dryRun, limit, pageSize, concurrency }) {
  const filter = {
    channel: 'email',
    $and: [
      { $or: [{ archiveKey: { $exists: false } }, { archiveKey: null }, { archiveKey: '' }] },
      {
        $or: [
          { bodyHtml: { $exists: true, $nin: [null, ''] } },
          { body: { $exists: true, $nin: [null, ''] } },
        ],
      },
    ],
  };

  const total = await Message.countDocuments(filter);
  console.log(`[inbound] candidates=${total} dryRun=${dryRun} concurrency=${concurrency}`);

  let scanned = 0;
  let archived = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    if (limit && scanned >= limit) break;
    const take = limit ? Math.min(pageSize, limit - scanned) : pageSize;
    const docs = await Message.find(filter)
      .sort({ sentAt: 1 })
      .limit(take)
      .select('_id organizationId threadId subject bodyHtml body fromAddress toAddress externalId direction sentAt createdAt')
      .lean();
    if (!docs.length) break;

    await mapPool(docs, concurrency, async (doc) => {
      scanned += 1;
      if (!hasBody(doc.bodyHtml, doc.body)) {
        skipped += 1;
        return;
      }
      if (dryRun) {
        archived += 1;
        return;
      }
      try {
        const store = doc.direction === 'outbound' ? storeOutbound : storeInbound;
        const result = await withRetry(() => store({
          id: doc._id,
          messageId: doc._id,
          sendLogId: doc._id,
          organizationId: doc.organizationId,
          threadId: doc.threadId,
          subject: doc.subject,
          html: doc.bodyHtml,
          text: doc.body,
          from: doc.fromAddress,
          to: doc.toAddress,
          externalId: doc.externalId,
          sentAt: doc.sentAt || doc.createdAt,
          receivedAt: doc.sentAt || doc.createdAt,
        }));
        if (!result?.archiveKey) {
          failed += 1;
          return;
        }
        await Message.updateOne(
          { _id: doc._id },
          { $set: { archiveKey: result.archiveKey, archiveMetaKey: result.archiveMetaKey || '' } }
        );
        archived += 1;
      } catch (err) {
        failed += 1;
        console.warn(`[inbound] fail ${doc._id}: ${err.message}`);
      }
    });

    console.log(`[inbound] progress scanned=${scanned} archived=${archived} failed=${failed} skipped=${skipped}`);
    if (docs.length < take) break;
  }

  return { total, scanned, archived, skipped, failed };
}

async function main() {
  const dryRun = hasFlag('--dry-run');
  const limit = Number(argValue('--limit', '0')) || 0;
  const pageSize = Number(argValue('--batch', '80')) || 80;
  const concurrency = Number(argValue('--concurrency', '8')) || 8;
  const only = String(argValue('--only', 'all') || 'all').toLowerCase();

  // Prefer shared asset bucket; a stale dedicated email bucket name breaks writes.
  if (process.env.S3_EMAIL_BUCKET && process.env.S3_BUCKET_NAME
      && process.env.S3_EMAIL_BUCKET !== process.env.S3_BUCKET_NAME) {
    console.warn(`[mail-archive] clearing S3_EMAIL_BUCKET=${process.env.S3_EMAIL_BUCKET} → use ${process.env.S3_BUCKET_NAME}`);
    delete process.env.S3_EMAIL_BUCKET;
  }

  const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUrl) {
    console.error('MONGODB_URL missing');
    process.exit(1);
  }
  if (!isConfigured()) {
    console.error('S3 mail-archive not configured (need AWS_* + S3_BUCKET_NAME or S3_EMAIL_BUCKET)');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log(JSON.stringify({ ok: true, dryRun, limit: limit || 'all', only, concurrency, pageSize }, null, 0));

  const summary = {};
  if (only === 'all' || only === 'outbound' || only === 'sent') {
    summary.outbound = await backfillOutbound({ dryRun, limit, pageSize, concurrency });
  }
  if (only === 'all' || only === 'inbound' || only === 'inbox') {
    summary.inbound = await backfillInbound({ dryRun, limit, pageSize, concurrency });
  }

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
