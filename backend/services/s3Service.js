/**
 * Platform S3 storage.
 * Default: one bucket with separate prefixes (resumes/, logos/, profiles/).
 * Optional dedicated buckets: S3_RESUME_BUCKET, S3_LOGO_BUCKET, S3_PROFILE_BUCKET.
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
  logo: { bucketEnv: 'S3_LOGO_BUCKET', prefixEnv: 'S3_LOGO_PREFIX', prefixDefault: 'logos' },
  profile: { bucketEnv: 'S3_PROFILE_BUCKET', prefixEnv: 'S3_PROFILE_PREFIX', prefixDefault: 'profiles' },
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

function getClient() {
  if (!isS3Configured()) return null;
  return new S3Client({
    region: env('AWS_REGION') || env('S3_REGION'),
    credentials: {
      accessKeyId: env('AWS_ACCESS_KEY_ID') || env('S3_ACCESS_KEY_ID'),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY') || env('S3_SECRET_ACCESS_KEY'),
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
  if (k.startsWith(`${kindConfig('logo').prefix}/`) || k.startsWith('logos/') || k.startsWith('org-logo-')) return 'logo';
  if (k.startsWith(`${kindConfig('profile').prefix}/`) || k.startsWith('profiles/') || k.startsWith('profile-')) return 'profile';
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
  const ext = path.extname(filename || originalName || '') || (kind === 'resume' ? '.pdf' : '.png');
  const safeName = String(filename || `${kind}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
    .replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${cfg.prefix}/${safeName}`;
  try {
    await client.send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || getContentType(ext),
      CacheControl: 'public, max-age=31536000, immutable',
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

function isS3Resume(resumeValue) {
  if (!resumeValue || typeof resumeValue !== 'string') return false;
  const s = storedToKey(resumeValue);
  const prefix = kindConfig('resume').prefix;
  return s.startsWith(`${prefix}/`) || s.startsWith('resumes/');
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
      return {
        buffer: Buffer.from(bytes),
        contentType: response.ContentType || getContentType(path.extname(key), 'image/png'),
        key,
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
  res.setHeader('Cache-Control', 'public, max-age=86400');
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

async function listKeys(prefix, { maxKeys = 0 } = {}) {
  const client = getClient();
  const bucket = defaultBucket();
  if (!client || !bucket) return [];
  const keys = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
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

async function putObject({ key, body, contentType, bucket }) {
  const client = getClient();
  const target = bucket || defaultBucket();
  if (!client || !target) return false;
  await client.send(new PutObjectCommand({
    Bucket: target,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
  }));
  return true;
}

module.exports = {
  isS3Configured,
  uploadAsset,
  uploadResumeFromFile,
  isS3Resume,
  isS3Asset,
  getResumeStream,
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
  get S3_BUCKET() { return defaultBucket(); },
  get S3_RESUME_PREFIX() { return kindConfig('resume').prefix; },
};
