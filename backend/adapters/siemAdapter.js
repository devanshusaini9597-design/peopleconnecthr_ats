/**
 * SIEM Adapter — ship security/audit events to observability platforms.
 * Supports: Splunk HEC, Datadog Logs API.
 */
const axios = require('axios');

class SplunkAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.hecUrl = (this.config.hecUrl || '').replace(/\/$/, '');
  }

  async shipEvents(events) {
    const { hecToken, index, sourcetype } = this.config;
    if (!hecToken || !this.hecUrl) {
      throw new Error('Splunk is not configured: missing hecToken or hecUrl');
    }
    const list = Array.isArray(events) ? events : [events];
    const payload = list.map((event) => ({
      event,
      index: index || 'main',
      sourcetype: sourcetype || 'ats:audit',
      time: event.timestamp ? new Date(event.timestamp).getTime() / 1000 : undefined
    }));

    const response = await axios.post(`${this.hecUrl}/services/collector/event`, payload, {
      headers: {
        Authorization: `Splunk ${hecToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    return { accepted: response.data.text === 'Success', count: list.length };
  }

  async testConnection() {
    const { hecToken } = this.config;
    if (!hecToken || !this.hecUrl) throw new Error('Missing Splunk hecToken or hecUrl');
    await axios.post(`${this.hecUrl}/services/collector/event`, { event: { message: 'ATS connection test' } }, {
      headers: { Authorization: `Splunk ${hecToken}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });
    return true;
  }
}

class DatadogAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.baseUrl = (this.config.site || 'https://http-intake.logs.datadoghq.com').replace(/\/$/, '');
  }

  async shipEvents(events) {
    const { apiKey, service, source } = this.config;
    if (!apiKey) throw new Error('Datadog is not configured: missing apiKey');
    const list = Array.isArray(events) ? events : [events];
    const payload = list.map((event) => ({
      ddsource: source || 'ats',
      ddtags: `env:${this.config.env || 'production'}`,
      hostname: this.config.hostname || 'ats-backend',
      service: service || 'ats',
      message: typeof event === 'string' ? event : JSON.stringify(event),
      ...event
    }));

    const response = await axios.post(`${this.baseUrl}/api/v2/logs`, payload, {
      headers: {
        'DD-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    return { accepted: true, count: list.length, status: response.status };
  }

  async testConnection() {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('Missing Datadog apiKey');
    await axios.get('https://api.datadoghq.com/api/v1/validate', {
      headers: { 'DD-API-KEY': apiKey },
      timeout: 15000
    });
    return true;
  }
}

const createSiemAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid SIEM configuration');
  switch (config.provider.toLowerCase()) {
    case 'splunk':
      return new SplunkAdapter(config);
    case 'datadog':
      return new DatadogAdapter(config);
    default:
      throw new Error(`Unsupported SIEM provider: ${config.provider}`);
  }
};

module.exports = { createSiemAdapter, SplunkAdapter, DatadogAdapter };
