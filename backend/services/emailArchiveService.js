/**
 * Enterprise mail archive — durable HTML + metadata on S3 (Gmail-like long-term store).
 * Soft-fails so archive outages never block send/IMAP ingest.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
  isEmailArchiveConfigured,
  kindConfig,
  putObject,
  getAssetBuffer,
  resolveBucketForKey,
} = require('./s3Service');

const MONGO_HTML_CLIP = 48 * 1024;
const MONGO_TEXT_CLIP = 8 * 1024;

function safeId(value, fallback = '') {
  const raw = String(value || '').trim();
  if (raw && /^[a-f0-9]{24}$/i.test(raw)) return raw;
  if (raw) return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return fallback || crypto.randomBytes(8).toString('hex');
}

function yyyyMm(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return { y, m, d };
}

function archivePrefix() {
  return kindConfig('email').prefix || 'mail-archive';
}

function buildKeys({ organizationId, folder, id, at }) {
  const org = safeId(organizationId, 'unknown');
  const { y, m } = yyyyMm(at);
  const fileId = safeId(id, crypto.randomBytes(10).toString('hex'));
  const base = `${archivePrefix()}/${org}/${folder}/${y}/${m}/${fileId}`;
  return {
    htmlKey: `${base}.html`,
    metaKey: `${base}.meta.json`,
    textKey: `${base}.txt`,
  };
}

function clip(value, max) {
  const s = String(value || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n<!-- truncated -->`;
}

async function writePair({ htmlKey, metaKey, textKey, html, text, meta }) {
  if (!isEmailArchiveConfigured()) return null;
  const bucket = resolveBucketForKey(htmlKey) || kindConfig('email').bucket;
  const htmlBody = String(html || text || '');
  const textBody = String(text || '');
  const metaJson = JSON.stringify(
    {
      ...meta,
      archivedAt: new Date().toISOString(),
      htmlKey,
      metaKey,
      textKey: textBody ? textKey : '',
      bytes: Buffer.byteLength(htmlBody, 'utf8'),
    },
    null,
    0
  );

  try {
    const okHtml = await putObject({
      key: htmlKey,
      body: htmlBody,
      contentType: 'text/html; charset=utf-8',
      bucket,
      cacheControl: 'private, no-store',
    });
    const okMeta = await putObject({
      key: metaKey,
      body: metaJson,
      contentType: 'application/json; charset=utf-8',
      bucket,
      cacheControl: 'private, no-store',
    });
    if (textBody) {
      await putObject({
        key: textKey,
        body: textBody,
        contentType: 'text/plain; charset=utf-8',
        bucket,
        cacheControl: 'private, no-store',
      });
    }
    if (!okHtml || !okMeta) return null;
    return { archiveKey: htmlKey, archiveMetaKey: metaKey, bucket };
  } catch (err) {
    logger.warn({ err: err.message, htmlKey }, '[mail-archive] write failed');
    return null;
  }
}

/**
 * @returns {Promise<{ archiveKey: string, archiveMetaKey: string, bucket: string }|null>}
 */
async function storeOutbound(payload = {}) {
  try {
    if (!isEmailArchiveConfigured()) return null;
    const sendLogId = payload.sendLogId || payload.id || '';
    const keys = buildKeys({
      organizationId: payload.organizationId,
      folder: 'sent',
      id: sendLogId || crypto.randomBytes(10).toString('hex'),
      at: payload.sentAt || new Date(),
    });
    const toList = Array.isArray(payload.to)
      ? payload.to
      : Array.isArray(payload.recipients)
        ? payload.recipients.map((r) => (typeof r === 'string' ? r : r?.email)).filter(Boolean)
        : [];
    return writePair({
      ...keys,
      html: payload.html || payload.htmlBody || '',
      text: payload.text || payload.textBody || '',
      meta: {
        direction: 'outbound',
        organizationId: String(payload.organizationId || ''),
        sendLogId: String(sendLogId || ''),
        subject: String(payload.subject || ''),
        from: String(payload.from || payload.fromEmail || ''),
        replyTo: String(payload.replyTo || payload.replyToEmail || ''),
        to: toList,
        provider: String(payload.provider || ''),
        channel: String(payload.channel || ''),
        messageId: String(payload.messageId || ''),
        emailType: String(payload.emailType || ''),
        campaignKey: String(payload.campaignKey || ''),
      },
    });
  } catch (err) {
    logger.warn({ err: err.message }, '[mail-archive] storeOutbound soft-fail');
    return null;
  }
}

/**
 * @returns {Promise<{ archiveKey: string, archiveMetaKey: string, bucket: string }|null>}
 */
async function storeInbound(payload = {}) {
  try {
    if (!isEmailArchiveConfigured()) return null;
    const messageId = payload.messageId || payload.id || '';
    const keys = buildKeys({
      organizationId: payload.organizationId,
      folder: 'inbox',
      id: messageId || crypto.randomBytes(10).toString('hex'),
      at: payload.sentAt || payload.receivedAt || new Date(),
    });
    return writePair({
      ...keys,
      html: payload.html || payload.bodyHtml || '',
      text: payload.text || payload.body || '',
      meta: {
        direction: 'inbound',
        organizationId: String(payload.organizationId || ''),
        messageId: String(messageId || ''),
        threadId: String(payload.threadId || ''),
        subject: String(payload.subject || ''),
        from: String(payload.from || payload.fromAddress || ''),
        to: String(payload.to || payload.toAddress || ''),
        externalId: String(payload.externalId || ''),
      },
    });
  } catch (err) {
    logger.warn({ err: err.message }, '[mail-archive] storeInbound soft-fail');
    return null;
  }
}

async function getArchivedHtml(archiveKey) {
  const key = String(archiveKey || '').trim();
  if (!key) return null;
  try {
    const asset = await getAssetBuffer(key);
    if (!asset?.buffer) return null;
    return asset.buffer.toString('utf8');
  } catch (err) {
    logger.warn({ err: err.message, key }, '[mail-archive] read failed');
    return null;
  }
}

async function getArchivedMeta(archiveMetaKey) {
  const key = String(archiveMetaKey || '').trim();
  if (!key) return null;
  try {
    const asset = await getAssetBuffer(key);
    if (!asset?.buffer) return null;
    return JSON.parse(asset.buffer.toString('utf8'));
  } catch (err) {
    logger.warn({ err: err.message, key }, '[mail-archive] meta read failed');
    return null;
  }
}

/**
 * Prefer S3 full body; fall back to Mongo clip.
 */
async function resolveHtmlBody({ archiveKey, htmlBody }) {
  if (archiveKey) {
    const fromS3 = await getArchivedHtml(archiveKey);
    if (fromS3) return fromS3;
  }
  return String(htmlBody || '');
}

module.exports = {
  storeOutbound,
  storeInbound,
  getArchivedHtml,
  getArchivedMeta,
  resolveHtmlBody,
  buildKeys,
  clipHtmlForMongo: (html) => clip(html, MONGO_HTML_CLIP),
  clipTextForMongo: (text) => clip(text, MONGO_TEXT_CLIP),
  MONGO_HTML_CLIP,
  MONGO_TEXT_CLIP,
  isConfigured: isEmailArchiveConfigured,
};
