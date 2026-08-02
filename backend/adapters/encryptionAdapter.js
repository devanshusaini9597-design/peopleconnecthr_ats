/**
 * Encryption Adapter — BYOK envelope encryption via cloud KMS.
 * Supports: AWS KMS, Azure Key Vault, GCP Cloud KMS.
 */
const axios = require('axios');
const crypto = require('crypto');
const { signAwsRequest } = require('../utils/awsSigV4');

class AwsKmsAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { accessKeyId, secretAccessKey, region, keyId } = this.config;
    if (!accessKeyId || !secretAccessKey || !region || !keyId) {
      throw new Error('AWS KMS is not configured: missing accessKeyId, secretAccessKey, region, or keyId');
    }
  }

  async _kmsRequest(target, payload) {
    const { accessKeyId, secretAccessKey, region, sessionToken } = this.config;
    const body = JSON.stringify(payload);
    const url = `https://kms.${region}.amazonaws.com/`;
    const headers = signAwsRequest({
      method: 'POST',
      url,
      body,
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `TrentService.${target}`
      },
      accessKeyId,
      secretAccessKey,
      region,
      service: 'kms',
      sessionToken
    });
    const response = await axios.post(url, body, { headers, timeout: 20000 });
    return response.data;
  }

  async encrypt(plaintext) {
    if (plaintext == null) throw new Error('encrypt requires plaintext');
    const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
    const result = await this._kmsRequest('Encrypt', {
      KeyId: this.config.keyId,
      Plaintext: data.toString('base64')
    });
    return { ciphertext: result.CiphertextBlob };
  }

  async decrypt(ciphertext) {
    if (!ciphertext) throw new Error('decrypt requires ciphertext');
    const result = await this._kmsRequest('Decrypt', { CiphertextBlob: ciphertext });
    return Buffer.from(result.Plaintext, 'base64').toString('utf8');
  }

  async testConnection() {
    await this._kmsRequest('DescribeKey', { KeyId: this.config.keyId });
    return true;
  }
}

class AzureKeyVaultAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { vaultUrl, clientId, clientSecret, tenantId, keyName } = this.config;
    if (!vaultUrl || !clientId || !clientSecret || !tenantId || !keyName) {
      throw new Error('Azure Key Vault is not configured: missing vaultUrl, clientId, clientSecret, tenantId, or keyName');
    }
    this.vaultUrl = vaultUrl.replace(/\/$/, '');
    this.keyName = keyName;
  }

  async _getToken() {
    const { clientId, clientSecret, tenantId } = this.config;
    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://vault.azure.net/.default'
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );
    return response.data.access_token;
  }

  async encrypt(plaintext) {
    const token = await this._getToken();
    const value = Buffer.isBuffer(plaintext) ? plaintext.toString('base64') : Buffer.from(String(plaintext)).toString('base64');
    const response = await axios.post(
      `${this.vaultUrl}/keys/${this.keyName}/encrypt?api-version=7.4`,
      { alg: 'RSA-OAEP', value },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return { ciphertext: response.data.value };
  }

  async decrypt(ciphertext) {
    const token = await this._getToken();
    const response = await axios.post(
      `${this.vaultUrl}/keys/${this.keyName}/decrypt?api-version=7.4`,
      { alg: 'RSA-OAEP', value: ciphertext },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return Buffer.from(response.data.value, 'base64').toString('utf8');
  }

  async testConnection() {
    const token = await this._getToken();
    await axios.get(`${this.vaultUrl}/keys/${this.keyName}?api-version=7.4`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

class GcpKmsAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { projectId, location, keyRing, cryptoKey, clientEmail, privateKey } = this.config;
    if (!projectId || !location || !keyRing || !cryptoKey || !clientEmail || !privateKey) {
      throw new Error('GCP KMS is not configured: missing projectId, location, keyRing, cryptoKey, clientEmail, or privateKey');
    }
    this.keyPath = `projects/${projectId}/locations/${location}/keyRings/${keyRing}/cryptoKeys/${cryptoKey}`;
  }

  async _getAccessToken() {
    const { clientEmail, privateKey } = this.config;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/cloudkms',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');
    const signInput = `${header}.${claim}`;
    const sign = crypto.createSign('RSA-SHA256').update(signInput).sign(privateKey.replace(/\\n/g, '\n'), 'base64url');
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signInput}.${sign}`
    }, { timeout: 15000 });
    return response.data.access_token;
  }

  async encrypt(plaintext) {
    const token = await this._getAccessToken();
    const data = Buffer.isBuffer(plaintext) ? plaintext.toString('base64') : Buffer.from(String(plaintext)).toString('base64');
    const response = await axios.post(
      `https://cloudkms.googleapis.com/v1/${this.keyPath}:encrypt`,
      { plaintext: data },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return { ciphertext: response.data.ciphertext };
  }

  async decrypt(ciphertext) {
    const token = await this._getAccessToken();
    const response = await axios.post(
      `https://cloudkms.googleapis.com/v1/${this.keyPath}:decrypt`,
      { ciphertext },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return Buffer.from(response.data.plaintext, 'base64').toString('utf8');
  }

  async testConnection() {
    const token = await this._getAccessToken();
    await axios.get(`https://cloudkms.googleapis.com/v1/${this.keyPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

const createEncryptionAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid encryption configuration');
  switch (config.provider.toLowerCase()) {
    case 'aws_kms':
      return new AwsKmsAdapter(config);
    case 'azure_keyvault':
      return new AzureKeyVaultAdapter(config);
    case 'gcp_kms':
      return new GcpKmsAdapter(config);
    default:
      throw new Error(`Unsupported encryption provider: ${config.provider}`);
  }
};

module.exports = { createEncryptionAdapter, AwsKmsAdapter, AzureKeyVaultAdapter, GcpKmsAdapter };
