/**

 * Background Check Adapter — unified interface for ordering background checks.

 * Supports: Checkr, Sterling, HireRight, GoodHire, SpringVerify, AuthBridge, IDfy.

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



  async orderCheck({ firstName, lastName, email, phone }) {

    if (!firstName || !lastName || !email) throw new Error('orderCheck requires firstName, lastName, and email');

    if (!this.config.packageSlug) throw new Error('Checkr is not configured: missing packageSlug');



    const headers = { ...this._authHeader(), 'Content-Type': 'application/json' };

    const candidateRes = await axios.post(`${this.baseUrl}/candidates`, {

      first_name: firstName, last_name: lastName, email, phone

    }, { headers, timeout: 20000 });



    const invitationRes = await axios.post(`${this.baseUrl}/invitations`, {

      candidate_id: candidateRes.data.id,

      package: this.config.packageSlug

    }, { headers, timeout: 20000 });



    return {

      candidateId: candidateRes.data.id,

      invitationId: invitationRes.data.id,

      status: invitationRes.data.status || 'pending',

      invitationUrl: invitationRes.data.invitation_url

    };

  }



  async getReportStatus(reportId) {

    const response = await axios.get(`${this.baseUrl}/reports/${reportId}`, {

      headers: this._authHeader(),

      timeout: 15000

    });

    return { status: response.data.status, result: response.data.result, adjudication: response.data.adjudication };

  }



  async testConnection() {

    await axios.get(`${this.baseUrl}/packages`, { headers: this._authHeader(), timeout: 15000 });

    return true;

  }

}



class SterlingAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.sterlingcheck.app/v2').replace(/\/$/, '');

  }



  async orderCheck({ firstName, lastName, email, phone }) {

    const { apiKey, packageId } = this.config;

    if (!apiKey || !packageId) throw new Error('Sterling is not configured: missing apiKey or packageId');

    const response = await axios.post(`${this.baseUrl}/screenings`, {

      packageId,

      candidate: { firstName, lastName, email, phone }

    }, {

      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { candidateId: response.data.candidateId, reportId: response.data.id, status: response.data.status };

  }



  async getReportStatus(reportId) {

    const { apiKey } = this.config;

    const response = await axios.get(`${this.baseUrl}/screenings/${reportId}`, {

      headers: { Authorization: `Bearer ${apiKey}` },

      timeout: 15000

    });

    return { status: response.data.status, result: response.data.result };

  }



  async testConnection() {

    const { apiKey } = this.config;

    if (!apiKey) throw new Error('Missing Sterling apiKey');

    await axios.get(`${this.baseUrl}/packages`, {

      headers: { Authorization: `Bearer ${apiKey}` },

      timeout: 15000

    });

    return true;

  }

}



class HireRightAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.hireright.com/v1').replace(/\/$/, '');

  }



  async orderCheck({ firstName, lastName, email, phone }) {

    const { clientId, clientSecret, packageCode } = this.config;

    if (!clientId || !clientSecret || !packageCode) {

      throw new Error('HireRight is not configured: missing clientId, clientSecret, or packageCode');

    }

    const tokenRes = await axios.post(`${this.baseUrl}/oauth/token`, {

      grant_type: 'client_credentials',

      client_id: clientId,

      client_secret: clientSecret

    }, { timeout: 20000 });

    const token = tokenRes.data.access_token;



    const response = await axios.post(`${this.baseUrl}/orders`, {

      packageCode,

      subject: { firstName, lastName, email, phone }

    }, {

      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { reportId: response.data.orderId, status: response.data.status };

  }



  async getReportStatus(reportId) {

    const token = await this._getToken();

    const response = await axios.get(`${this.baseUrl}/orders/${reportId}`, {

      headers: { Authorization: `Bearer ${token}` },

      timeout: 15000

    });

    return { status: response.data.status, result: response.data.result };

  }



  async _getToken() {

    const { clientId, clientSecret } = this.config;

    const tokenRes = await axios.post(`${this.baseUrl}/oauth/token`, {

      grant_type: 'client_credentials',

      client_id: clientId,

      client_secret: clientSecret

    }, { timeout: 20000 });

    return tokenRes.data.access_token;

  }



  async testConnection() {

    await this._getToken();

    return true;

  }

}



class GoodHireAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = 'https://api.goodhire.com/v1';

  }



  async orderCheck({ firstName, lastName, email, phone }) {

    const { apiKey, packageId } = this.config;

    if (!apiKey || !packageId) throw new Error('GoodHire is not configured: missing apiKey or packageId');

    const response = await axios.post(`${this.baseUrl}/reports`, {

      package_id: packageId,

      candidate: { first_name: firstName, last_name: lastName, email, phone }

    }, {

      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { reportId: response.data.id, status: response.data.status };

  }



  async getReportStatus(reportId) {

    const response = await axios.get(`${this.baseUrl}/reports/${reportId}`, {

      headers: { Authorization: `Token ${this.config.apiKey}` },

      timeout: 15000

    });

    return { status: response.data.status, result: response.data.result };

  }



  async testConnection() {

    if (!this.config.apiKey) throw new Error('Missing GoodHire apiKey');

    await axios.get(`${this.baseUrl}/packages`, {

      headers: { Authorization: `Token ${this.config.apiKey}` },

      timeout: 15000

    });

    return true;

  }

}



class SpringVerifyAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.springverify.com/v1').replace(/\/$/, '');

  }



  async orderCheck({ firstName, lastName, email, phone }) {

    const { apiKey, packageId } = this.config;

    if (!apiKey || !packageId) throw new Error('SpringVerify is not configured: missing apiKey or packageId');

    const response = await axios.post(`${this.baseUrl}/candidates`, {

      package_id: packageId,

      name: `${firstName} ${lastName}`,

      email,

      phone

    }, {

      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { candidateId: response.data.id, status: response.data.status };

  }



  async getReportStatus(reportId) {

    const response = await axios.get(`${this.baseUrl}/candidates/${reportId}`, {

      headers: { Authorization: `Bearer ${this.config.apiKey}` },

      timeout: 15000

    });

    return { status: response.data.status, result: response.data.overall_result };

  }



  async testConnection() {

    if (!this.config.apiKey) throw new Error('Missing SpringVerify apiKey');

    await axios.get(`${this.baseUrl}/packages`, {

      headers: { Authorization: `Bearer ${this.config.apiKey}` },

      timeout: 15000

    });

    return true;

  }

}



class AuthBridgeAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.authbridge.com/v2').replace(/\/$/, '');

  }



  async orderCheck({ firstName, lastName, email, phone }) {

    const { apiKey, clientCode, packageCode } = this.config;

    if (!apiKey || !clientCode || !packageCode) {

      throw new Error('AuthBridge is not configured: missing apiKey, clientCode, or packageCode');

    }

    const response = await axios.post(`${this.baseUrl}/cases`, {

      client_code: clientCode,

      package_code: packageCode,

      candidate: { first_name: firstName, last_name: lastName, email, mobile: phone }

    }, {

      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { reportId: response.data.case_id, status: response.data.status };

  }



  async getReportStatus(reportId) {

    const response = await axios.get(`${this.baseUrl}/cases/${reportId}`, {

      headers: { 'X-API-Key': this.config.apiKey },

      timeout: 15000

    });

    return { status: response.data.status, result: response.data.result };

  }



  async testConnection() {

    if (!this.config.apiKey) throw new Error('Missing AuthBridge apiKey');

    await axios.get(`${this.baseUrl}/health`, {

      headers: { 'X-API-Key': this.config.apiKey },

      timeout: 15000

    });

    return true;

  }

}



class IdfyAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.idfy.com/v3').replace(/\/$/, '');

  }



  async orderCheck({ firstName, lastName, email, phone }) {

    const { apiKey, accountId, taskId } = this.config;

    if (!apiKey || !accountId || !taskId) {

      throw new Error('IDfy is not configured: missing apiKey, accountId, or taskId');

    }

    const response = await axios.post(`${this.baseUrl}/tasks/async/verify_with_source/ind_bgc`, {

      task_id: taskId,

      group_id: `ats-${Date.now()}`,

      data: {

        name: `${firstName} ${lastName}`,

        email,

        phone,

        account_id: accountId

      }

    }, {

      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { reportId: response.data.request_id, status: response.data.status || 'in_progress' };

  }



  async getReportStatus(reportId) {

    const response = await axios.get(`${this.baseUrl}/tasks/${reportId}`, {

      headers: { 'api-key': this.config.apiKey },

      timeout: 15000

    });

    return { status: response.data.status, result: response.data.result };

  }



  async testConnection() {

    if (!this.config.apiKey) throw new Error('Missing IDfy apiKey');

    await axios.get(`${this.baseUrl}/accounts/${this.config.accountId}`, {

      headers: { 'api-key': this.config.apiKey },

      timeout: 15000

    });

    return true;

  }

}



const createBackgroundCheckAdapter = (config) => {

  if (!config || !config.provider) throw new Error('Invalid background check configuration');

  switch (config.provider.toLowerCase()) {

    case 'checkr':

      return new CheckrAdapter(config);

    case 'sterling':

      return new SterlingAdapter(config);

    case 'hireright':

      return new HireRightAdapter(config);

    case 'goodhire':

      return new GoodHireAdapter(config);

    case 'springverify':

      return new SpringVerifyAdapter(config);

    case 'authbridge':

      return new AuthBridgeAdapter(config);

    case 'idfy':

      return new IdfyAdapter(config);

    default:

      throw new Error(`Unsupported background check provider: ${config.provider}`);

  }

};



module.exports = {

  createBackgroundCheckAdapter,

  CheckrAdapter,

  SterlingAdapter,

  HireRightAdapter,

  GoodHireAdapter,

  SpringVerifyAdapter,

  AuthBridgeAdapter,

  IdfyAdapter

};

