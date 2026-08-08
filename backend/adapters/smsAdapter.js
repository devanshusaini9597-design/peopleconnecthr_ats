/**
 * SMS / WhatsApp Adapter — unified interface for messaging regardless of provider.
 * Supports: Twilio, MessageBird, Vonage, AWS SNS, Gupshup.
 */
const axios = require('axios');
const { signAwsRequest } = require('../utils/awsSigV4');

class TwilioAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async send({ to, message }) {
    const { accountSid, authToken, fromNumber } = this.config;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio is not configured: missing accountSid, authToken, or fromNumber');
    }
    if (!to || !message) throw new Error('SMS send requires both "to" and "message"');

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
      throw new Error(`Twilio send failed: ${err.response?.data?.message || err.message}`);
    }
  }

  async testConnection() {
    const { accountSid, authToken } = this.config;
    if (!accountSid || !authToken) throw new Error('Missing Twilio accountSid or authToken');
    await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      auth: { username: accountSid, password: authToken },
      timeout: 15000
    });
    return true;
  }

  async sendWhatsApp({ to, message }) {
    const { accountSid, authToken, fromNumber } = this.config;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio is not configured: missing accountSid, authToken, or fromNumber');
    }
    const withPrefix = (num) => (num.startsWith('whatsapp:') ? num : `whatsapp:${num}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: withPrefix(to),
      From: withPrefix(fromNumber),
      Body: message
    });
    try {
      const response = await axios.post(url, body.toString(), {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000
      });
      return { sid: response.data.sid, status: response.data.status };
    } catch (err) {
      throw new Error(`Twilio WhatsApp send failed: ${err.response?.data?.message || err.message}`);
    }
  }
}

class MessageBirdAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async send({ to, message }) {
    const { apiKey, originator } = this.config;
    if (!apiKey || !originator) throw new Error('MessageBird is not configured: missing apiKey or originator');
    const response = await axios.post('https://rest.messagebird.com/messages', {
      originator,
      recipients: [to],
      body: message
    }, {
      headers: { Authorization: `AccessKey ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 20000
    });
    return { id: response.data.id, status: response.data.recipients?.items?.[0]?.status };
  }

  async testConnection() {
    if (!this.config.apiKey) throw new Error('Missing MessageBird apiKey');
    await axios.get('https://rest.messagebird.com/balance', {
      headers: { Authorization: `AccessKey ${this.config.apiKey}` },
      timeout: 15000
    });
    return true;
  }
}

class VonageAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async send({ to, message }) {
    const { apiKey, apiSecret, fromNumber } = this.config;
    if (!apiKey || !apiSecret || !fromNumber) {
      throw new Error('Vonage is not configured: missing apiKey, apiSecret, or fromNumber');
    }
    const response = await axios.post('https://rest.nexmo.com/sms/json', {
      api_key: apiKey,
      api_secret: apiSecret,
      to: to.replace(/^\+/, ''),
      from: fromNumber,
      text: message
    }, { timeout: 20000 });
    const msg = response.data.messages?.[0];
    if (msg?.status !== '0') throw new Error(`Vonage send failed: ${msg?.['error-text'] || 'unknown error'}`);
    return { id: msg['message-id'], status: 'sent' };
  }

  async testConnection() {
    const { apiKey, apiSecret } = this.config;
    if (!apiKey || !apiSecret) throw new Error('Missing Vonage apiKey or apiSecret');
    await axios.get('https://rest.nexmo.com/account/get-balance', {
      params: { api_key: apiKey, api_secret: apiSecret },
      timeout: 15000
    });
    return true;
  }
}

class AwsSnsAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { accessKeyId, secretAccessKey, region } = this.config;
    if (!accessKeyId || !secretAccessKey || !region) {
      throw new Error('AWS SNS is not configured: missing accessKeyId, secretAccessKey, or region');
    }
  }

  async _snsRequest(action, params) {
    const { accessKeyId, secretAccessKey, region, sessionToken } = this.config;
    const body = new URLSearchParams({ Action: action, Version: '2010-03-31', ...params }).toString();
    const url = `https://sns.${region}.amazonaws.com/`;
    const headers = signAwsRequest({
      method: 'POST',
      url,
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      accessKeyId,
      secretAccessKey,
      region,
      service: 'sns',
      sessionToken
    });
    const response = await axios.post(url, body, { headers, timeout: 20000 });
    return response.data;
  }

  async send({ to, message }) {
    const { fromNumber } = this.config;
    if (!fromNumber) throw new Error('AWS SNS is not configured: missing fromNumber (origination number or sender ID)');
    const data = await this._snsRequest('Publish', {
      PhoneNumber: to,
      Message: message,
      'MessageAttributes.entry.1.Name': 'AWS.SNS.SMS.SenderID',
      'MessageAttributes.entry.1.Value.DataType': 'String',
      'MessageAttributes.entry.1.Value.StringValue': fromNumber
    });
    return { messageId: data?.PublishResponse?.PublishResult?.MessageId };
  }

  async testConnection() {
    await this._snsRequest('ListTopics', {});
    return true;
  }
}

class GupshupAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async send({ to, message }) {
    const { apiKey, appName, sourceNumber } = this.config;
    if (!apiKey || !appName || !sourceNumber) {
      throw new Error('Gupshup is not configured: missing apiKey, appName, or sourceNumber');
    }
    const response = await axios.post('https://enterprise.smsgupshup.com/GatewayAPI/rest', null, {
      params: {
        method: 'SendMessage',
        send_to: to,
        msg: message,
        msg_type: 'TEXT',
        userid: appName,
        auth_scheme: 'plain',
        password: apiKey,
        v: '1.1',
        format: 'json',
        mask: sourceNumber
      },
      timeout: 20000
    });
    if (response.data?.response?.status !== 'success') {
      throw new Error(`Gupshup send failed: ${response.data?.response?.details || 'unknown error'}`);
    }
    return { id: response.data.response.id, status: 'sent' };
  }

  async sendWhatsApp({ to, message }) {
    const { apiKey, appName, sourceNumber } = this.config;
    if (!apiKey || !appName || !sourceNumber) {
      throw new Error('Gupshup WhatsApp is not configured: missing apiKey, appName, or sourceNumber');
    }
    const response = await axios.post('https://api.gupshup.io/wa/api/v1/msg', new URLSearchParams({
      channel: 'whatsapp',
      source: sourceNumber,
      destination: to.replace(/^\+/, ''),
      message: JSON.stringify({ type: 'text', text: message }),
      'src.name': appName
    }).toString(), {
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 20000
    });
    return { id: response.data.messageId, status: response.data.status };
  }

  async testConnection() {
    if (!this.config.apiKey || !this.config.appName) {
      throw new Error('Missing Gupshup apiKey or appName');
    }
    return true;
  }
}

const createSmsAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid SMS configuration');
  switch (config.provider.toLowerCase()) {
    case 'twilio':
    case 'twilio_whatsapp':
      return new TwilioAdapter(config);
    case 'messagebird':
      return new MessageBirdAdapter(config);
    case 'vonage':
      return new VonageAdapter(config);
    case 'aws_sns':
      return new AwsSnsAdapter(config);
    case 'gupshup':
      return new GupshupAdapter(config);
    default:
      throw new Error(`Unsupported SMS provider: ${config.provider}`);
  }
};

module.exports = {
  createSmsAdapter,
  TwilioAdapter,
  MessageBirdAdapter,
  VonageAdapter,
  AwsSnsAdapter,
  GupshupAdapter,
  send: async () => {
    throw new Error('SMS integration not configured — use createSmsAdapter(config) via getAdapter(orgId, "sms")');
  }
};
