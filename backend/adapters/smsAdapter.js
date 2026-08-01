/**
 * SMS Adapter — unified interface for sending SMS regardless of provider.
 * Supports: Twilio.
 *
 * IntegrationConfig.credentials shape for provider 'twilio':
 *   { accountSid, authToken, fromNumber }
 */
const axios = require('axios');

class TwilioAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async send({ to, message }) {
    const { accountSid, authToken, fromNumber } = this.config;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio is not configured: missing accountSid, authToken, or fromNumber');
    }
    if (!to || !message) {
      throw new Error('SMS send requires both "to" and "message"');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({ To: to, From: fromNumber, Body: message });

    try {
      const response = await axios.post(url, body.toString(), {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000
      });
      return { sid: response.data.sid, status: response.data.status };
    } catch (err) {
      const twilioMsg = err.response?.data?.message || err.message;
      throw new Error(`Twilio send failed: ${twilioMsg}`);
    }
  }

  async testConnection() {
    const { accountSid, authToken } = this.config;
    if (!accountSid || !authToken) {
      throw new Error('Missing Twilio accountSid or authToken');
    }
    // Validate credentials without sending an SMS by fetching the account resource.
    await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      auth: { username: accountSid, password: authToken },
      timeout: 15000
    });
    return true;
  }
}

/**
 * Factory to create an SMS adapter based on provider config.
 * @param {Object} config The resolved IntegrationConfig ({ provider, credentials })
 */
const createSmsAdapter = (config) => {
  if (!config || !config.provider) {
    throw new Error('Invalid SMS configuration');
  }
  switch (config.provider.toLowerCase()) {
    case 'twilio':
      return new TwilioAdapter(config);
    default:
      throw new Error(`Unsupported SMS provider: ${config.provider}`);
  }
};

module.exports = {
  createSmsAdapter,
  TwilioAdapter,
  // Legacy stub shape kept so any existing `smsAdapter.send(...)` callers that
  // bypass the factory still fail loudly instead of silently no-oping.
  send: async () => {
    throw new Error('SMS integration not configured — use createSmsAdapter(config) via getAdapter(orgId, "sms")');
  }
};
