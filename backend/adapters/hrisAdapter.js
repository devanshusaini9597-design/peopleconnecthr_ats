/**
 * HRIS Adapter — push hire data to HR systems.
 * Supports: Workday, BambooHR, ADP.
 */
const axios = require('axios');

class WorkdayAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.baseUrl = (this.config.baseUrl || '').replace(/\/$/, '');
  }

  _auth() {
    const { username, password, tenant } = this.config;
    if (!username || !password || !tenant || !this.baseUrl) {
      throw new Error('Workday is not configured: missing username, password, tenant, or baseUrl');
    }
    return {
      auth: { username: `${username}@${tenant}`, password },
      headers: { 'Content-Type': 'application/json' }
    };
  }

  async pushHire({ employeeId, firstName, lastName, email, startDate, jobTitle, department }) {
    if (!firstName || !lastName || !email) {
      throw new Error('pushHire requires firstName, lastName, and email');
    }
    const response = await axios.post(`${this.baseUrl}/ccx/service/${this.config.tenant}/Recruiting/v40.0`, {
      Worker_Data: {
        Personal_Data: {
          Name_Data: { Legal_Name_Data: { Name_Detail_Data: { First_Name: firstName, Last_Name: lastName } } },
          Contact_Data: { Email_Address_Data: [{ Email_Address: email, Usage_Type: 'WORK' }] }
        },
        Employment_Data: {
          Worker_Job_Data: [{
            Position_Data: { Job_Title: jobTitle, Organization_Reference: department },
            Hire_Date: startDate
          }]
        },
        Worker_ID: employeeId
      }
    }, { ...this._auth(), timeout: 30000 });
    return { workerId: response.data?.Worker_Reference?.ID || employeeId, status: 'submitted' };
  }

  async testConnection() {
    await axios.get(`${this.baseUrl}/ccx/service/${this.config.tenant}/Human_Resources/v40.0`, {
      ...this._auth(),
      timeout: 15000
    });
    return true;
  }
}

class BambooHrAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.baseUrl = this.config.subdomain
      ? `https://api.bamboohr.com/api/gateway.php/${this.config.subdomain}/v1`
      : '';
  }

  _auth() {
    const { apiKey, subdomain } = this.config;
    if (!apiKey || !subdomain) throw new Error('BambooHR is not configured: missing apiKey or subdomain');
    return {
      auth: { username: apiKey, password: 'x' },
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
    };
  }

  async pushHire({ firstName, lastName, email, startDate, jobTitle, department }) {
    if (!firstName || !lastName || !email) {
      throw new Error('pushHire requires firstName, lastName, and email');
    }
    const response = await axios.post(`${this.baseUrl}/employees/`, {
      firstName,
      lastName,
      workEmail: email,
      hireDate: startDate,
      jobTitle,
      department
    }, { ...this._auth(), timeout: 30000 });
    return { employeeId: response.data.id, status: 'created' };
  }

  async testConnection() {
    await axios.get(`${this.baseUrl}/meta/users`, { ...this._auth(), timeout: 15000 });
    return true;
  }
}

class AdpAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.baseUrl = (this.config.baseUrl || 'https://api.adp.com').replace(/\/$/, '');
  }

  async _getToken() {
    const { clientId, clientSecret } = this.config;
    if (!clientId || !clientSecret) throw new Error('ADP is not configured: missing clientId or clientSecret');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(`${this.baseUrl}/auth/oauth/v2/token`, new URLSearchParams({
      grant_type: 'client_credentials'
    }).toString(), {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });
    return response.data.access_token;
  }

  async pushHire({ firstName, lastName, email, startDate, jobTitle, department }) {
    if (!firstName || !lastName || !email) {
      throw new Error('pushHire requires firstName, lastName, and email');
    }
    const token = await this._getToken();
    const response = await axios.post(`${this.baseUrl}/hr/v2/workers`, {
      person: {
        legalName: { givenName: firstName, familyName: lastName },
        communication: { emails: [{ emailUri: email, nameCode: { codeValue: 'WORK' } }] }
      },
      workerDates: { originalHireDate: startDate },
      businessCommunication: {},
      workAssignments: [{ jobTitle, organizationalUnits: [{ nameCode: { codeValue: department } }] }]
    }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    return { workerId: response.data.workerID?.idValue, status: 'submitted' };
  }

  async testConnection() {
    await this._getToken();
    return true;
  }
}

const createHrisAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid HRIS configuration');
  switch (config.provider.toLowerCase()) {
    case 'workday':
      return new WorkdayAdapter(config);
    case 'bamboohr':
      return new BambooHrAdapter(config);
    case 'adp':
      return new AdpAdapter(config);
    default:
      throw new Error(`Unsupported HRIS provider: ${config.provider}`);
  }
};

module.exports = { createHrisAdapter, WorkdayAdapter, BambooHrAdapter, AdpAdapter };
