/**
 * CRM Adapter — sync candidates with external CRM systems.
 * Supports: Salesforce, HubSpot.
 */
const axios = require('axios');

class SalesforceAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this._accessToken = null;
    this._instanceUrl = null;
    this._tokenExpiresAt = 0;
  }

  async _authenticate() {
    const { clientId, clientSecret, refreshToken, instanceUrl } = this.config;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Salesforce is not configured: missing clientId, clientSecret, or refreshToken');
    }
    if (this._accessToken && Date.now() < this._tokenExpiresAt - 30000) {
      return { token: this._accessToken, instanceUrl: this._instanceUrl || instanceUrl };
    }

    const response = await axios.post('https://login.salesforce.com/services/oauth2/token', new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });
    this._accessToken = response.data.access_token;
    this._instanceUrl = response.data.instance_url || instanceUrl;
    this._tokenExpiresAt = Date.now() + 3600 * 1000;
    return { token: this._accessToken, instanceUrl: this._instanceUrl };
  }

  async upsertCandidate({ email, firstName, lastName, phone, source, customFields = {} }) {
    if (!email) throw new Error('upsertCandidate requires email');
    const { token, instanceUrl } = await this._authenticate();
    const externalIdField = this.config.externalIdField || 'Email';

    const payload = {
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      Phone: phone,
      LeadSource: source || 'ATS',
      ...customFields
    };

    const response = await axios.patch(
      `${instanceUrl}/services/data/v59.0/sobjects/Lead/${externalIdField}/${encodeURIComponent(email)}`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 20000
      }
    );
    return { id: response.data.id, created: response.status === 201 };
  }

  async sync({ since } = {}) {
    const { token, instanceUrl } = await this._authenticate();
    const query = since
      ? `SELECT Id, Email, FirstName, LastName, Phone, LastModifiedDate FROM Lead WHERE LastModifiedDate > ${since}`
      : 'SELECT Id, Email, FirstName, LastName, Phone, LastModifiedDate FROM Lead ORDER BY LastModifiedDate DESC LIMIT 200';
    const response = await axios.get(`${instanceUrl}/services/data/v59.0/query`, {
      params: { q: query },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    });
    return response.data.records || [];
  }

  async testConnection() {
    const { token, instanceUrl } = await this._authenticate();
    await axios.get(`${instanceUrl}/services/data/v59.0/limits`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return true;
  }
}

class HubSpotAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.baseUrl = 'https://api.hubapi.com';
  }

  _headers() {
    const { accessToken } = this.config;
    if (!accessToken) throw new Error('HubSpot is not configured: missing accessToken');
    return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  }

  async upsertCandidate({ email, firstName, lastName, phone, source, customFields = {} }) {
    if (!email) throw new Error('upsertCandidate requires email');
    const properties = {
      email,
      firstname: firstName,
      lastname: lastName,
      phone,
      hs_lead_status: 'NEW',
      lead_source: source || 'ATS',
      ...customFields
    };

    const response = await axios.post(`${this.baseUrl}/crm/v3/objects/contacts/batch/upsert`, {
      inputs: [{ idProperty: 'email', id: email, properties }]
    }, { headers: this._headers(), timeout: 20000 });
    return { id: response.data.results?.[0]?.id, created: response.data.results?.[0]?.new };
  }

  async sync({ since } = {}) {
    const params = { limit: 100, properties: 'email,firstname,lastname,phone,lastmodifieddate' };
    if (since) params.updatedAfter = since;
    const response = await axios.get(`${this.baseUrl}/crm/v3/objects/contacts`, {
      params,
      headers: this._headers(),
      timeout: 30000
    });
    return response.data.results || [];
  }

  async testConnection() {
    await axios.get(`${this.baseUrl}/crm/v3/objects/contacts`, {
      params: { limit: 1 },
      headers: this._headers(),
      timeout: 15000
    });
    return true;
  }
}

const createCrmAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid CRM configuration');
  switch (config.provider.toLowerCase()) {
    case 'salesforce':
      return new SalesforceAdapter(config);
    case 'hubspot':
      return new HubSpotAdapter(config);
    default:
      throw new Error(`Unsupported CRM provider: ${config.provider}`);
  }
};

module.exports = { createCrmAdapter, SalesforceAdapter, HubSpotAdapter };
