/**
 * Background Check Adapter — unified interface for ordering background
 * checks regardless of provider.
 * Supports: Checkr (v1 REST API, HTTP Basic Auth with the API key as the
 * username and an empty password).
 *
 * IntegrationConfig.credentials shape for provider 'checkr':
 *   { apiKey, packageSlug } // packageSlug = the Checkr package to invite candidates into
 */
const axios = require('axios');

class CheckrAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.baseUrl = 'https://api.checkr.com/v1';
  }

  _authHeader() {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('Checkr is not configured: missing apiKey');
    return { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` };
  }

  /**
   * Creates a Checkr candidate record, then invites them into the
   * configured package — the two-step flow Checkr's API requires.
   * @returns {Promise<{candidateId: string, invitationId: string, reportStatus: string}>}
   */
  async orderCheck({ firstName, lastName, email, phone }) {
    if (!firstName || !lastName || !email) {
      throw new Error('orderCheck requires firstName, lastName, and email');
    }
    if (!this.config.packageSlug) {
      throw new Error('Checkr is not configured: missing packageSlug (the Checkr package to invite candidates into)');
    }

    const headers = { ...this._authHeader(), 'Content-Type': 'application/json' };

    const candidateRes = await axios.post(`${this.baseUrl}/candidates`, {
      first_name: firstName, last_name: lastName, email, phone
    }, { headers, timeout: 20000 });

    const candidateId = candidateRes.data.id;

    const invitationRes = await axios.post(`${this.baseUrl}/invitations`, {
      candidate_id: candidateId,
      package: this.config.packageSlug
    }, { headers, timeout: 20000 });

    return {
      candidateId,
      invitationId: invitationRes.data.id,
      status: invitationRes.data.status || 'pending',
      invitationUrl: invitationRes.data.invitation_url
    };
  }

  /** Polls the status of a previously-ordered report. */
  async getReportStatus(reportId) {
    if (!reportId) throw new Error('getReportStatus requires reportId');
    const response = await axios.get(`${this.baseUrl}/reports/${reportId}`, { headers: this._authHeader(), timeout: 15000 });
    return { status: response.data.status, result: response.data.result, adjudication: response.data.adjudication };
  }

  async testConnection() {
    // A cheap authenticated read (list packages) confirms the API key is valid.
    await axios.get(`${this.baseUrl}/packages`, { headers: this._authHeader(), timeout: 15000 });
    return true;
  }
}

const createBackgroundCheckAdapter = (config) => {
  if (!config || !config.provider) {
    throw new Error('Invalid background check configuration');
  }
  switch (config.provider.toLowerCase()) {
    case 'checkr':
      return new CheckrAdapter(config);
    default:
      throw new Error(`Unsupported background check provider: ${config.provider}`);
  }
};

module.exports = { createBackgroundCheckAdapter, CheckrAdapter };
