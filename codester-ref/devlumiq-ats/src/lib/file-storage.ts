/**
 * File Storage Utility — S3 / Cloudflare R2 / Local Fallback
 *
 * Supports three modes, selected automatically from environment variables:
 *   1. AWS S3          — set FILE_STORAGE_PROVIDER=s3
 *   2. Cloudflare R2   — set FILE_STORAGE_PROVIDER=r2
 *   3. Local (default) — files stored in /storage/uploads/ (NOT public/)
 *                        and served via authenticated /api/files/*
 *
 * Usage:
 *   const url = await uploadFile(buffer, 'resumes/candidate-123.pdf', 'application/pdf');
 *   await deleteFile('resumes/candidate-123.pdf');
 */

import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StorageProvider = 's3' | 'r2' | 'local';

export interface UploadResult {
  url: string;
  key: string;
  provider: StorageProvider;
}

export function getLocalUploadRoot(): string {
  return path.join(process.cwd(), 'storage', 'uploads');
}

// ─── Config ───────────────────────────────────────────────────────────────────

function getProvider(): StorageProvider {
  const p = (process.env.FILE_STORAGE_PROVIDER || 'local').toLowerCase();
  if (p === 's3' || p === 'r2') return p;
  if (process.env.NODE_ENV === 'production' && !process.env.FILE_STORAGE_PROVIDER) {
    console.warn(
      '[file-storage] FILE_STORAGE_PROVIDER unset in production — using private local storage (ephemeral on serverless). Prefer s3 or r2.',
    );
  }
  return 'local';
}

function getS3Config() {
  return {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  };
}

function getR2Config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || '',
    bucket: process.env.R2_BUCKET || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  };
}

// ─── S3-compatible upload (works for both AWS S3 and Cloudflare R2) ──────────

async function uploadToS3Compatible(
  buffer: Buffer,
  key: string,
  contentType: string,
  endpoint: string,
  region: string,
  bucket: string,
  accessKeyId: string,
  secretAccessKey: string,
): Promise<string> {
  // Use the built-in fetch with AWS Signature V4
  // For production, install @aws-sdk/client-s3 for full SDK support
  const { createHmac, createHash } = await import('crypto');

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const host = new URL(endpoint).host;
  const url = `${endpoint}/${bucket}/${key}`;

  const payloadHash = createHash('sha256').update(buffer).digest('hex');

  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = ['aws4_request', 's3', region, dateStamp].reduce(
    (key, msg) => createHmac('sha256', key).update(msg).digest(),
    Buffer.from(`AWS4${secretAccessKey}`),
  );

  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 upload failed (${response.status}): ${text}`);
  }

  return url;
}

// ─── Local file storage (private directory — not under public/) ───────────────

async function uploadLocal(buffer: Buffer, key: string): Promise<string> {
  const fs = await import('fs');

  const uploadDir = getLocalUploadRoot();
  const filePath = path.join(uploadDir, key);
  const dir = path.dirname(filePath);

  // Path traversal guard
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(uploadDir) + path.sep) && resolved !== path.resolve(uploadDir)) {
    throw new Error('Invalid upload key');
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, buffer);
  // Served only via authenticated /api/files/* — never as a public static asset
  return `/api/files/${key.replace(/\\/g, '/')}`;
}

async function deleteLocal(key: string): Promise<void> {
  const fs = await import('fs');
  const filePath = path.join(getLocalUploadRoot(), key);
  const resolved = path.resolve(filePath);
  const root = path.resolve(getLocalUploadRoot());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string = 'application/octet-stream',
): Promise<UploadResult> {
  const provider = getProvider();

  if (provider === 's3') {
    const config = getS3Config();
    if (!config.bucket || !config.accessKeyId) {
      throw new Error('AWS S3 credentials not configured (AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
    }
    const endpoint = `https://s3.${config.region}.amazonaws.com`;
    const url = await uploadToS3Compatible(
      buffer, key, contentType,
      endpoint, config.region, config.bucket,
      config.accessKeyId, config.secretAccessKey,
    );
    return { url, key, provider };
  }

  if (provider === 'r2') {
    const config = getR2Config();
    if (!config.bucket || !config.accessKeyId) {
      throw new Error('Cloudflare R2 credentials not configured (R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
    }
    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    await uploadToS3Compatible(
      buffer, key, contentType,
      endpoint, 'auto', config.bucket,
      config.accessKeyId, config.secretAccessKey,
    );
    const url = config.publicUrl ? `${config.publicUrl}/${key}` : `${endpoint}/${config.bucket}/${key}`;
    return { url, key, provider };
  }

  // Local fallback (private)
  const url = await uploadLocal(buffer, key);
  return { url, key, provider: 'local' };
}

export async function deleteFile(key: string): Promise<void> {
  const provider = getProvider();

  if (provider === 'local') {
    return deleteLocal(key);
  }

  // For S3/R2, a DELETE request would be needed — omitted for brevity.
  // Install @aws-sdk/client-s3 for full delete support.
  console.warn(`[file-storage] Delete not implemented for provider "${provider}". Key: ${key}`);
}

export function getStorageInfo(): { provider: StorageProvider; configured: boolean } {
  const provider = getProvider();
  if (provider === 's3') return { provider, configured: !!process.env.AWS_S3_BUCKET };
  if (provider === 'r2') return { provider, configured: !!process.env.R2_BUCKET };
  return { provider, configured: true };
}
