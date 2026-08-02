/**
 * Storage Adapter — upload, signed URLs, delete for tenant file storage.
 * Supports: AWS S3, Azure Blob, Google Cloud Storage.
 */
const axios = require('axios');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

class S3StorageAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { accessKeyId, secretAccessKey, region, bucket } = this.config;
    if (!accessKeyId || !secretAccessKey || !region || !bucket) {
      throw new Error('AWS S3 is not configured: missing accessKeyId, secretAccessKey, region, or bucket');
    }
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey, sessionToken: this.config.sessionToken }
    });
    this.bucket = bucket;
  }

  _key(path) {
    const prefix = this.config.prefix ? `${this.config.prefix.replace(/\/$/, '')}/` : '';
    return `${prefix}${path}`;
  }

  async upload({ path, body, contentType }) {
    const Key = this._key(path);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key,
      Body: body,
      ContentType: contentType || 'application/octet-stream'
    }));
    return { key: Key, bucket: this.bucket };
  }

  async getSignedUrl(path, { expiresIn = 3600 } = {}) {
    const Key = this._key(path);
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key }), { expiresIn });
    return url;
  }

  async getObject(path) {
    const Key = this._key(path);
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key }));
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    return {
      body: Buffer.concat(chunks),
      contentType: response.ContentType || 'application/octet-stream'
    };
  }

  async delete(path) {
    const Key = this._key(path);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key }));
    return true;
  }

  async testConnection() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    return true;
  }
}

class AzureBlobAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { connectionString, container } = this.config;
    if (!connectionString || !container) {
      throw new Error('Azure Blob is not configured: missing connectionString or container');
    }
    const match = connectionString.match(/AccountName=([^;]+);AccountKey=([^;]+)/);
    if (!match) throw new Error('Invalid Azure Blob connectionString format');
    this.accountName = match[1];
    this.accountKey = match[2];
    this.container = container;
    this.baseUrl = `https://${this.accountName}.blob.core.windows.net`;
  }

  _sign(method, path, headers = {}, contentLength = 0) {
    const date = new Date().toUTCString();
    const canonicalizedHeaders = `x-ms-date:${date}\nx-ms-version:2021-08-06\n`;
    const canonicalizedResource = `/${this.accountName}/${this.container}/${path}`;
    const stringToSign = [
      method, '', '', contentLength, '', '', '', '', '', '', '', canonicalizedHeaders, canonicalizedResource
    ].join('\n');
    const signature = crypto.createHmac('sha256', Buffer.from(this.accountKey, 'base64'))
      .update(stringToSign, 'utf8')
      .digest('base64');
    return {
      Authorization: `SharedKey ${this.accountName}:${signature}`,
      'x-ms-date': date,
      'x-ms-version': '2021-08-06',
      ...headers
    };
  }

  async upload({ path, body, contentType }) {
    const blobPath = path.replace(/^\//, '');
    const headers = this._sign('PUT', blobPath, {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType || 'application/octet-stream'
    }, Buffer.byteLength(body));
    await axios.put(`${this.baseUrl}/${this.container}/${blobPath}`, body, { headers, timeout: 60000 });
    return { key: blobPath, container: this.container };
  }

  async getSignedUrl(path, { expiresIn = 3600 } = {}) {
    const blobPath = path.replace(/^\//, '');
    const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();
    const resource = `/${this.accountName}/${this.container}/${blobPath}`;
    const stringToSign = `r\n\nb\n${expiry}\n${resource}\n\n\n\n\n\n\n`;
    const signature = encodeURIComponent(
      crypto.createHmac('sha256', Buffer.from(this.accountKey, 'base64')).update(stringToSign, 'utf8').digest('base64')
    );
    return `${this.baseUrl}/${this.container}/${blobPath}?sv=2021-08-06&sr=b&sig=${signature}&se=${encodeURIComponent(expiry)}&sp=r`;
  }

  async delete(path) {
    const blobPath = path.replace(/^\//, '');
    const headers = this._sign('DELETE', blobPath);
    await axios.delete(`${this.baseUrl}/${this.container}/${blobPath}`, { headers, timeout: 15000 });
    return true;
  }

  async testConnection() {
    const headers = this._sign('GET', '', { 'x-ms-version': '2021-08-06' });
    await axios.get(`${this.baseUrl}/${this.container}?restype=container&comp=list&maxresults=1`, {
      headers,
      timeout: 15000
    });
    return true;
  }
}

class GcsStorageAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { projectId, bucket, clientEmail, privateKey } = this.config;
    if (!projectId || !bucket || !clientEmail || !privateKey) {
      throw new Error('GCS is not configured: missing projectId, bucket, clientEmail, or privateKey');
    }
    this.bucket = bucket;
    this.baseUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o`;
  }

  async _getAccessToken() {
    const { clientEmail, privateKey } = this.config;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/devstorage.read_write',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');
    const signInput = `${header}.${claim}`;
    const sign = crypto.createSign('RSA-SHA256').update(signInput).sign(privateKey.replace(/\\n/g, '\n'), 'base64url');
    const jwt = `${signInput}.${sign}`;
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }, { timeout: 15000 });
    return response.data.access_token;
  }

  async upload({ path, body, contentType }) {
    const token = await this._getAccessToken();
    const name = path.replace(/^\//, '');
    const response = await axios.post(this.baseUrl, body, {
      params: { uploadType: 'media', name },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType || 'application/octet-stream'
      },
      timeout: 60000
    });
    return { key: response.data.name, bucket: this.bucket };
  }

  async getSignedUrl(path, { expiresIn = 3600 } = {}) {
    const token = await this._getAccessToken();
    const name = encodeURIComponent(path.replace(/^\//, ''));
    const response = await axios.post(
      `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${name}/generateSignedUrl`,
      { expiration: new Date(Date.now() + expiresIn * 1000).toISOString(), httpMethod: 'GET' },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );
    return response.data.signedUrl;
  }

  async delete(path) {
    const token = await this._getAccessToken();
    const name = encodeURIComponent(path.replace(/^\//, ''));
    await axios.delete(`https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${name}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }

  async testConnection() {
    const token = await this._getAccessToken();
    await axios.get(`https://storage.googleapis.com/storage/v1/b/${this.bucket}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

const createStorageAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid storage configuration');
  switch (config.provider.toLowerCase()) {
    case 's3':
      return new S3StorageAdapter(config);
    case 'azure_blob':
      return new AzureBlobAdapter(config);
    case 'gcs':
      return new GcsStorageAdapter(config);
    default:
      throw new Error(`Unsupported storage provider: ${config.provider}`);
  }
};

module.exports = { createStorageAdapter, S3StorageAdapter, AzureBlobAdapter, GcsStorageAdapter };
