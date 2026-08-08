/**

 * Job Board Adapter — unified interface for publishing jobs to external boards.

 * Supports: feed boards, webhook relay, LinkedIn, ZipRecruiter, Naukri, Monster.

 */

const axios = require('axios');



class FeedBoardAdapter {

  constructor(config) {

    this.config = config.credentials || {};

  }



  async postJob(job) {

    return { posted: true, mode: 'feed', message: 'Job included in public feed (pull-based).', jobId: job._id };

  }



  async removeJob() {

    return { removed: true, mode: 'feed', message: 'Unpublish the job on your careers page to remove from feed.' };

  }



  async testConnection() {

    if (!this.config.feedUrl) throw new Error('feedUrl is not configured for this feed-based job board integration.');

    return true;

  }

}



class WebhookBoardAdapter {

  constructor(config) {

    this.config = config.credentials || {};

  }



  async postJob(job) {

    if (!this.config.webhookUrl) throw new Error('webhookUrl is not configured');

    const response = await axios.post(this.config.webhookUrl, {

      action: 'post',

      job: {

        id: job._id, title: job.title, department: job.department, location: job.location,

        employmentType: job.employmentType, description: job.description, skills: job.skills

      }

    }, { headers: { 'Content-Type': 'application/json', ...(this.config.headers || {}) }, timeout: 20000 });

    return response.data;

  }



  async removeJob(jobId) {

    if (!this.config.webhookUrl) throw new Error('webhookUrl is not configured');

    const response = await axios.post(this.config.webhookUrl, { action: 'remove', jobId }, {

      headers: { 'Content-Type': 'application/json', ...(this.config.headers || {}) },

      timeout: 20000

    });

    return response.data;

  }



  async testConnection() {

    if (!this.config.webhookUrl) throw new Error('Missing webhookUrl');

    const response = await axios.post(this.config.webhookUrl, { action: 'ping' }, {

      headers: { 'Content-Type': 'application/json', ...(this.config.headers || {}) },

      timeout: 15000,

      validateStatus: () => true

    });

    if (response.status >= 400) throw new Error(`Relay endpoint responded with HTTP ${response.status}`);

    return true;

  }

}



class LinkedInAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = 'https://api.linkedin.com/v2';

  }



  _headers() {

    const { accessToken } = this.config;

    if (!accessToken) throw new Error('LinkedIn is not configured: missing accessToken');

    return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  }



  async postJob(job) {

    const { organizationUrn } = this.config;

    if (!organizationUrn) throw new Error('LinkedIn is not configured: missing organizationUrn');



    const payload = {

      companyApplyUrl: job.applyUrl,

      description: job.description,

      employmentStatus: job.employmentType || 'FULL_TIME',

      externalJobPostingId: String(job._id),

      listedAt: Date.now(),

      location: job.location,

      title: job.title,

      workplaceTypes: ['HYBRID']

    };



    const response = await axios.post(`${this.baseUrl}/simpleJobPostings`, {

      elements: [{ ...payload, company: organizationUrn }]

    }, { headers: this._headers(), timeout: 30000 });

    return { posted: true, jobId: job._id, linkedInId: response.data?.elements?.[0]?.id };

  }



  async removeJob(jobId) {

    const response = await axios.post(`${this.baseUrl}/simpleJobPostings`, {

      elements: [{ externalJobPostingId: String(jobId), listingStatus: 'CLOSED' }]

    }, { headers: this._headers(), timeout: 20000 });

    return { removed: true, data: response.data };

  }



  async testConnection() {

    await axios.get(`${this.baseUrl}/me`, { headers: this._headers(), timeout: 15000 });

    return true;

  }

}



class ZipRecruiterAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = 'https://api.ziprecruiter.com/jobs/v1';

  }



  async postJob(job) {

    const { apiKey, employerId } = this.config;

    if (!apiKey || !employerId) throw new Error('ZipRecruiter is not configured: missing apiKey or employerId');



    const response = await axios.post(`${this.baseUrl}/post`, {

      employer_id: employerId,

      title: job.title,

      description: job.description,

      city: job.location,

      job_type: job.employmentType,

      external_id: String(job._id)

    }, {

      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { posted: true, jobId: job._id, zipRecruiterId: response.data.job_id };

  }



  async removeJob(jobId) {

    const { apiKey } = this.config;

    await axios.delete(`${this.baseUrl}/${jobId}`, {

      headers: { Authorization: `Bearer ${apiKey}` },

      timeout: 20000

    });

    return { removed: true };

  }



  async testConnection() {

    const { apiKey, employerId } = this.config;

    if (!apiKey || !employerId) throw new Error('Missing ZipRecruiter apiKey or employerId');

    await axios.get(`${this.baseUrl}/employers/${employerId}`, {

      headers: { Authorization: `Bearer ${apiKey}` },

      timeout: 15000

    });

    return true;

  }

}



class NaukriAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.naukri.com/jobposting/v1').replace(/\/$/, '');

  }



  async postJob(job) {

    const { apiKey, recruiterId } = this.config;

    if (!apiKey || !recruiterId) throw new Error('Naukri is not configured: missing apiKey or recruiterId');



    const response = await axios.post(`${this.baseUrl}/jobs`, {

      recruiterId,

      title: job.title,

      description: job.description,

      location: job.location,

      keySkills: (job.skills || []).join(', '),

      externalJobId: String(job._id)

    }, {

      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { posted: true, jobId: job._id, naukriId: response.data.jobId };

  }



  async removeJob(jobId) {

    await axios.delete(`${this.baseUrl}/jobs/${jobId}`, {

      headers: { 'X-API-Key': this.config.apiKey },

      timeout: 20000

    });

    return { removed: true };

  }



  async testConnection() {

    if (!this.config.apiKey) throw new Error('Missing Naukri apiKey');

    await axios.get(`${this.baseUrl}/health`, {

      headers: { 'X-API-Key': this.config.apiKey },

      timeout: 15000

    });

    return true;

  }

}



class MonsterAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.monster.com/v1').replace(/\/$/, '');

  }



  async postJob(job) {

    const { clientId, clientSecret, boardId } = this.config;

    if (!clientId || !clientSecret || !boardId) {

      throw new Error('Monster is not configured: missing clientId, clientSecret, or boardId');

    }

    const tokenRes = await axios.post(`${this.baseUrl}/oauth/token`, {

      grant_type: 'client_credentials',

      client_id: clientId,

      client_secret: clientSecret

    }, { timeout: 20000 });

    const token = tokenRes.data.access_token;



    const response = await axios.post(`${this.baseUrl}/boards/${boardId}/jobs`, {

      title: job.title,

      description: job.description,

      location: job.location,

      referenceId: String(job._id)

    }, {

      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { posted: true, jobId: job._id, monsterId: response.data.id };

  }



  async removeJob(jobId) {

    const token = await this._getToken();

    await axios.delete(`${this.baseUrl}/jobs/${jobId}`, {

      headers: { Authorization: `Bearer ${token}` },

      timeout: 20000

    });

    return { removed: true };

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



const createJobBoardAdapter = (config) => {

  if (!config || !config.provider) throw new Error('Invalid job board configuration');

  switch (config.provider.toLowerCase()) {

    case 'indeed_feed':

    case 'google_jobs_feed':

      return new FeedBoardAdapter(config);

    case 'webhook':

      return new WebhookBoardAdapter(config);

    case 'linkedin':

      return new LinkedInAdapter(config);

    case 'ziprecruiter':

      return new ZipRecruiterAdapter(config);

    case 'naukri':

      return new NaukriAdapter(config);

    case 'monster':

      return new MonsterAdapter(config);

    default:

      throw new Error(`Unsupported job board provider: ${config.provider}`);

  }

};



module.exports = {

  createJobBoardAdapter,

  FeedBoardAdapter,

  WebhookBoardAdapter,

  LinkedInAdapter,

  ZipRecruiterAdapter,

  NaukriAdapter,

  MonsterAdapter

};

