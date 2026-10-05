/**
 * Platform S3 storage.
 * Default: one bucket with separate prefixes (resumes/, logos/, profiles/, mail-archive/).
 * Optional dedicated buckets: S3_RESUME_BUCKET, S3_LOGO_BUCKET, S3_PROFILE_BUCKET, S3_EMAIL_BUCKET.
 */
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const KINDS = {
  resume: { bucketEnv: 'S3_RESUME_BUCKET', prefixEnv: 'S3_RESUME_PREFIX', prefixDefault: 'resumes' },
  /** Partner / freelance-application CVs — kept separate from candidate resumes. */
  partnerResume: {
    bucketEnv: 'S3_RESUME_BUCKET',
    prefixEnv: 'S3_PARTNER_RESUME_PREFIX',
    prefixDefault: 'partner-resumes',
  },
  logo: { bucketEnv: 'S3_LOGO_BUCKET', prefixEnv: 'S3_LOGO_PREFIX', prefixDefault: 'logos' },
  profile: { bucketEnv: 'S3_PROFILE_BUCKET', prefixEnv: 'S3_PROFILE_PREFIX', prefixDefault: 'profiles' },
  email: { bucketEnv: 'S3_EMAIL_BUCKET', prefixEnv: 'S3_EMAIL_PREFIX', prefixDefault: 'mail-archive' },
};

function env(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

function defaultBucket() {
  return env('S3_BUCKET_NAME');
}

function kindConfig(kind) {
  const spec = KINDS[kind] || KINDS.resume;
  const prefix = (env(spec.prefixEnv, spec.prefixDefault).replace(/^\/+|\/+$/g, '')) || spec.prefixDefault;
  return {
    kind,
    bucket: env(spec.bucketEnv) || defaultBucket(),
    prefix,
  };
}

function isS3Configured() {
  const accessKey = env('AWS_ACCESS_KEY_ID') || env('S3_ACCESS_KEY_ID');
  const secretKey = env('AWS_SECRET_ACCESS_KEY') || env('S3_SECRET_ACCESS_KEY');
  const region = env('AWS_REGION') || env('S3_REGION');
  return !!(accessKey && secretKey && region && defaultBucket());
}

/** Mail archive can use a dedicated bucket even when the default asset bucket is unset. */
function isEmailArchiveConfigured() {
  const accessKey = env('AWS_ACCESS_KEY_ID') || env('S3_ACCESS_KEY_ID');
  const secretKey = env('AWS_SECRET_ACCESS_KEY') || env('S3_SECRET_ACCESS_KEY');
  const region = env('AWS_REGION') || env('S3_REGION');
  const bucket = kindConfig('email').bucket;
  return !!(accessKey && secretKey && region && bucket);
}

function getClient() {
  const accessKey = env('AWS_ACCESS_KEY_ID') || env('S3_ACCESS_KEY_ID');
  const secretKey = env('AWS_SECRET_ACCESS_KEY') || env('S3_SECRET_ACCESS_KEY');
  const region = env('AWS_REGION') || env('S3_REGION');
  if (!accessKey || !secretKey || !region) return null;
  if (!defaultBucket() && !kindConfig('email').bucket) return null;
  return new S3Client({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });
}

function getContentType(ext, fallback) {
  const mime = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.eml': 'message/rfc822',
  };
  return mime[String(ext || '').toLowerCase()] || fallback || 'application/octet-stream';
}

function storedToKey(value) {
  let key = String(value || '').trim();
  if (!key) return '';
  key = key.replace(/^https?:\/\/[^/]+/i, '');
  key = key.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  return key.replace(/\\/g, '/');
}

function kindFromKey(key) {
  const k = storedToKey(key);
  if (!k) return null;
  if (k.startsWith(`${kindConfig('email').prefix}/`) || k.startsWith('mail-archive/')) return 'email';
  if (k.startsWith(`${kindConfig('logo').prefix}/`) || k.startsWith('logos/') || k.startsWith('org-logo-')) return 'logo';
  if (k.startsWith(`${kindConfig('profile').prefix}/`) || k.startsWith('profiles/') || k.startsWith('profile-')) return 'profile';
  if (
    k.startsWith(`${kindConfig('partnerResume').prefix}/`)
    || k.startsWith('partner-resumes/')
  ) {
    return 'partnerResume';
  }
  // Legacy local uploads used filenames like partner-<timestamp>-<rand>.pdf
  if (/^partner-\d+/.test(path.posix.basename(k)) && !k.startsWith('resumes/')) {
    return 'partnerResume';
  }
  if (k.startsWith(`${kindConfig('resume').prefix}/`) || k.startsWith('resumes/')) return 'resume';
  return null;
}

function publicPathForKey(key) {
  const k = storedToKey(key);
  return k ? `/uploads/${k}` : '';
}

function candidateKeys(rel) {
  const key = storedToKey(rel);
  if (!key || key.includes('..')) return [];
  const keys = [key];
  const base = path.posix.basename(key);
  if (base.startsWith('org-logo-') && !key.startsWith('logos/')) keys.push(`logos/${base}`);
  if (base.startsWith('profile-') && !key.startsWith('profiles/')) keys.push(`profiles/${base}`);
  if (/^partner-\d+/.test(base) && !key.startsWith('partner-resumes/') && !key.startsWith(`${kindConfig('partnerResume').prefix}/`)) {
    keys.push(`${kindConfig('partnerResume').prefix}/${base}`);
  }
  return [...new Set(keys)];
}

function resolveBucketForKey(key) {
  const kind = kindFromKey(key);
  if (!kind) return defaultBucket();
  return kindConfig(kind).bucket;
}

async function uploadAsset({ kind, body, filename, originalName, contentType }) {
  const client = getClient();
  const cfg = kindConfig(kind);
  if (!client || !cfg.bucket) {
    logger.info(`[S3] ${kind} upload skipped — S3 not configured`);
    return null;
  }
  const ext = path.extname(filename || originalName || '')
    || ((kind === 'resume' || kind === 'partnerResume') ? '.pdf' : '.png');
  const safeName = String(filename || `${kind}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
    .replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${cfg.prefix}/${safeName}`;
  try {
    const isPrivate = kind === 'email' || kind === 'partnerResume' || kind === 'resume';
    await client.send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || getContentType(ext),
      ...(isPrivate
        ? { CacheControl: 'private, no-store' }
        : { CacheControl: 'public, max-age=31536000, immutable' }),
    }));
    logger.info(`[S3] ${kind} saved — bucket: ${cfg.bucket}, key: ${key}`);
    return { key, bucket: cfg.bucket, publicPath: publicPathForKey(key) };
  } catch (err) {
    logger.error(`[S3] uploadAsset (${kind}) error:`, err.message);
    return null;
  }
}

async function uploadResumeFromFile(localFilePath, originalName) {
  if (!fs.existsSync(localFilePath)) {
    logger.error('[S3] Local file not found:', localFilePath);
    return null;
  }
  const body = fs.readFileSync(localFilePath);
  const ext = path.extname(originalName) || path.extname(localFilePath) || '.pdf';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  return uploadAsset({
    kind: 'resume',
    body,
    filename,
    originalName,
    contentType: getContentType(ext),
  });
}

async function uploadPartnerResumeFromFile(localFilePath, originalName) {
  if (!fs.existsSync(localFilePath)) {
    logger.error('[S3] Partner resume local file not found:', localFilePath);
    return null;
  }
  const body = fs.readFileSync(localFilePath);
  const ext = path.extname(originalName) || path.extname(localFilePath) || '.pdf';
  const filename = `partner-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  return uploadAsset({
    kind: 'partnerResume',
    body,
    filename,
    originalName,
    contentType: getContentType(ext),
  });
}

function isS3Resume(resumeValue) {
  if (!resumeValue || typeof resumeValue !== 'string') return false;
  const s = storedToKey(resumeValue);
  const prefix = kindConfig('resume').prefix;
  return s.startsWith(`${prefix}/`) || s.startsWith('resumes/');
}

function isS3PartnerResume(resumeValue) {
  if (!resumeValue || typeof resumeValue !== 'string') return false;
  return kindFromKey(resumeValue) === 'partnerResume';
}

async function getPartnerResumeStream(s3Key) {
  const client = getClient();
  if (!client) return null;
  const tried = candidateKeys(s3Key);
  for (const key of tried) {
    if (kindFromKey(key) !== 'partnerResume' && !key.startsWith('partner-resumes/')) continue;
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: resolveBucketForKey(key) || defaultBucket(),
        Key: key,
      }));
      return {
        stream: response.Body,
        contentType: response.ContentType || getContentType(path.extname(key)),
        key,
      };
    } catch {
      /* try next */
    }
  }
  logger.error('[S3] getPartnerResumeStream failed for:', storedToKey(s3Key));
  return null;
}

function isS3Asset(value) {
  return Boolean(kindFromKey(value));
}

async function getResumeStream(s3Key) {
  const client = getClient();
  if (!client) return null;
  const key = storedToKey(s3Key);
  if (!isS3Resume(key)) return null;
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: resolveBucketForKey(key),
      Key: key,
    }));
    return {
      stream: response.Body,
      contentType: response.ContentType || getContentType(path.extname(key)),
    };
  } catch (err) {
    logger.error('[S3] getResumeStream error:', err.message);
    return null;
  }
}

async function getAssetBuffer(storedValue) {
  const client = getClient();
  if (!client) return null;
  const tried = candidateKeys(storedValue);
  for (const key of tried) {
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: resolveBucketForKey(key),
        Key: key,
      }));
      const bytes = await response.Body.transformToByteArray();
      const ext = path.extname(key);
      const fallbackType = kindFromKey(key) === 'email'
        ? (ext === '.json' ? 'application/json' : 'text/html; charset=utf-8')
        : 'image/png';
      return {
        buffer: Buffer.from(bytes),
        contentType: response.ContentType || getContentType(ext, fallbackType),
        key,
        bucket: resolveBucketForKey(key),
      };
    } catch {
      /* try next key */
    }
  }
  return null;
}

async function sendAssetToResponse(rel, res) {
  const asset = await getAssetBuffer(rel);
  if (!asset) return false;
  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', kindFromKey(rel) === 'email' ? 'private, no-store' : 'public, max-age=86400');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(asset.buffer);
  return true;
}

async function deleteStoredAsset(storedValue) {
  const client = getClient();
  if (!client || !storedValue) return false;
  const tried = candidateKeys(storedValue).filter((key) => kindFromKey(key));
  let deleted = false;
  for (const key of tried) {
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: resolveBucketForKey(key),
        Key: key,
      }));
      deleted = true;
    } catch (err) {
      logger.info('[S3] delete skipped:', key, err.message);
    }
  }
  return deleted;
}

async function listKeys(prefix, { maxKeys = 0, bucket } = {}) {
  const client = getClient();
  const target = bucket || defaultBucket();
  if (!client || !target) return [];
  const keys = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: target,
      Prefix: prefix || '',
      ContinuationToken: token,
    }));
    for (const obj of page.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
      if (maxKeys && keys.length >= maxKeys) return keys.slice(0, maxKeys);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function copyKey({ sourceKey, destKey, destBucket }) {
  const client = getClient();
  const sourceBucket = resolveBucketForKey(sourceKey);
  const targetBucket = destBucket || defaultBucket();
  if (!client || !sourceBucket || !targetBucket) return false;
  await client.send(new CopyObjectCommand({
    Bucket: targetBucket,
    Key: destKey,
    CopySource: `${sourceBucket}/${String(sourceKey).split('/').map(encodeURIComponent).join('/')}`,
  }));
  return true;
}

async function headKey(key, bucket) {
  const client = getClient();
  const target = bucket || resolveBucketForKey(key) || defaultBucket();
  if (!client || !target) return null;
  const res = await client.send(new HeadObjectCommand({ Bucket: target, Key: key }));
  return { contentLength: res.ContentLength, contentType: res.ContentType };
}

async function putObject({ key, body, contentType, bucket, cacheControl }) {
  const client = getClient();
  const target = bucket || resolveBucketForKey(key) || defaultBucket();
  if (!client || !target) return false;
  const privateMail = kindFromKey(key) === 'email';
  await client.send(new PutObjectCommand({
    Bucket: target,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: cacheControl || (privateMail ? 'private, no-store' : undefined),
  }));
  return true;
}

module.exports = {
  isS3Configured,
  isEmailArchiveConfigured,
  uploadAsset,
  uploadResumeFromFile,
  uploadPartnerResumeFromFile,
  isS3Resume,
  isS3PartnerResume,
  isS3Asset,
  getResumeStream,
  getPartnerResumeStream,
  getAssetBuffer,
  sendAssetToResponse,
  deleteStoredAsset,
  storedToKey,
  kindFromKey,
  publicPathForKey,
  listKeys,
  copyKey,
  headKey,
  putObject,
  kindConfig,
  resolveBucketForKey,
  get S3_BUCKET() { return defaultBucket(); },
  get S3_RESUME_PREFIX() { return kindConfig('resume').prefix; },
  get S3_PARTNER_RESUME_PREFIX() { return kindConfig('partnerResume').prefix; },
  get S3_EMAIL_BUCKET() { return kindConfig('email').bucket; },
  get S3_EMAIL_PREFIX() { return kindConfig('email').prefix; },
};
