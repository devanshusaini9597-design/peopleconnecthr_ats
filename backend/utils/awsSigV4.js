/**
 * Minimal AWS Signature Version 4 signing for axios REST calls.
 * Used by adapters that need SNS, KMS, Bedrock, etc. without pulling in full SDKs.
 */
const crypto = require('crypto');

const hmac = (key, data, encoding) => {
  const k = Buffer.isBuffer(key) ? key : Buffer.from(key, 'utf8');
  return crypto.createHmac('sha256', k).update(data, 'utf8').digest(encoding);
};

const sha256Hex = (data) => crypto.createHash('sha256').update(data || '', 'utf8').digest('hex');

const getSignatureKey = (secretKey, dateStamp, region, service) => {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
};

/**
 * Signs an HTTP request and returns headers to merge into axios config.
 * @param {Object} opts
 * @param {string} opts.method HTTP method
 * @param {string} opts.url Full URL including query string
 * @param {Object} [opts.headers] Extra headers (Host added automatically)
 * @param {string} [opts.body] Request body string
 * @param {string} opts.accessKeyId
 * @param {string} opts.secretAccessKey
 * @param {string} opts.region
 * @param {string} opts.service e.g. 'sns', 'kms', 'bedrock-runtime'
 * @param {string} [opts.sessionToken] Optional STS session token
 */
const signAwsRequest = ({
  method,
  url,
  headers = {},
  body = '',
  accessKeyId,
  secretAccessKey,
  region,
  service,
  sessionToken
}) => {
  if (!accessKeyId || !secretAccessKey || !region || !service) {
    throw new Error('AWS SigV4 signing requires accessKeyId, secretAccessKey, region, and service');
  }

  const parsed = new URL(url);
  const host = parsed.host;
  const pathname = parsed.pathname || '/';
  const search = parsed.search ? parsed.search.slice(1) : '';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(body);
  const signedHeadersList = ['host', 'x-amz-date'];
  const reqHeaders = {
    host,
    'x-amz-date': amzDate,
    ...headers
  };
  if (sessionToken) {
    reqHeaders['x-amz-security-token'] = sessionToken;
    signedHeadersList.push('x-amz-security-token');
  }
  if (body && !reqHeaders['content-type']) {
    reqHeaders['content-type'] = 'application/x-amz-json-1.1';
  }
  if (body) signedHeadersList.push('content-type');
  signedHeadersList.sort();

  const canonicalHeaders = signedHeadersList
    .map((h) => `${h}:${String(reqHeaders[h]).trim()}\n`)
    .join('');
  const signedHeaders = signedHeadersList.join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    pathname,
    search,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign, 'hex');

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');

  return {
    ...reqHeaders,
    Authorization: authorization,
    'x-amz-content-sha256': payloadHash
  };
};

module.exports = { signAwsRequest, sha256Hex };
