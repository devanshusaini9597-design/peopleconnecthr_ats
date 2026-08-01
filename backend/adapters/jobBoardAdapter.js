/**
 * Job Board Adapter — unified interface for publishing jobs to external
 * boards regardless of provider.
 *
 * IMPORTANT — why this is deliberately more modest than email/SMS/calendar:
 * LinkedIn, Naukri, and Indeed's *push* posting APIs require a signed
 * partner/publisher agreement per board (not a self-serve API key a
 * customer can paste in), so this adapter does not fabricate calls against
 * those private partner APIs. It supports two providers that genuinely work
 * without a partner agreement:
 *
 *   - 'indeed_feed' / 'google_jobs_feed': these boards support *pulling*
 *     jobs from a public XML feed URL the org submits once in the board's
 *     publisher console. No push call needed — see GET
 *     /api/careers/:orgSlug/jobs.xml (careersRoutes.js), which this adapter
 *     just returns the URL for.
 *   - 'webhook': posts the job payload to a customer-provided relay URL
 *     (e.g. their own middleware, or a partner who *has* LinkedIn/Naukri
 *     partner access and exposes a plain HTTP endpoint for it). This is
 *     also what a Zapier/Make "job board" zap would consume.
 *
 * If/when a real LinkedIn or Naukri partner agreement is signed, add a case
 * here — the contract (postJob/removeJob/testConnection) stays the same.
 */
const axios = require('axios');

class FeedBoardAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  /** Feed boards are pull-based — "posting" just means the job already appears in the public feed. */
  async postJob(job) {
    return { posted: true, mode: 'feed', message: 'This job is already included in your public job feed (pull-based, no push needed).', jobId: job._id };
  }

  async removeJob() {
    return { removed: true, mode: 'feed', message: 'Unpublish the job on your careers page — it will drop out of the feed on the board\'s next crawl.' };
  }

  async testConnection() {
    if (!this.config.feedUrl) {
      throw new Error('feedUrl is not configured for this feed-based job board integration.');
    }
    return true;
  }
}

class WebhookBoardAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async postJob(job) {
    if (!this.config.webhookUrl) {
      throw new Error('webhookUrl is not configured for this job board integration.');
    }
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
    if (!this.config.webhookUrl) {
      throw new Error('webhookUrl is not configured for this job board integration.');
    }
    const response = await axios.post(this.config.webhookUrl, { action: 'remove', jobId }, {
      headers: { 'Content-Type': 'application/json', ...(this.config.headers || {}) },
      timeout: 20000
    });
    return response.data;
  }

  async testConnection() {
    if (!this.config.webhookUrl) {
      throw new Error('Missing webhookUrl');
    }
    const response = await axios.post(this.config.webhookUrl, { action: 'ping' }, {
      headers: { 'Content-Type': 'application/json', ...(this.config.headers || {}) },
      timeout: 15000,
      validateStatus: () => true
    });
    if (response.status >= 400) throw new Error(`Relay endpoint responded with HTTP ${response.status}`);
    return true;
  }
}

const createJobBoardAdapter = (config) => {
  if (!config || !config.provider) {
    throw new Error('Invalid job board configuration');
  }
  switch (config.provider.toLowerCase()) {
    case 'indeed_feed':
    case 'google_jobs_feed':
      return new FeedBoardAdapter(config);
    case 'webhook':
      return new WebhookBoardAdapter(config);
    default:
      throw new Error(`Job board provider '${config.provider}' is not supported for direct posting. LinkedIn/Naukri push posting requires a signed publisher agreement with that board — use 'webhook' to relay through a partner who has one, or 'indeed_feed' for pull-based boards.`);
  }
};

module.exports = { createJobBoardAdapter, FeedBoardAdapter, WebhookBoardAdapter };
