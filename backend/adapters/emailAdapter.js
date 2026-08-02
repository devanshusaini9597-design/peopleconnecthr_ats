/**
 * Email Adapter — unified interface for sending emails regardless of provider.
 *
 * Supports: SMTP (nodemailer), Zoho Zeptomail, SendGrid, AWS SES, Mailgun, Postmark
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const { SESClient, SendEmailCommand, GetAccountSendingEnabledCommand } = require('@aws-sdk/client-ses');

const zohoAuthHeader = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') return '';
  const k = apiKey.trim();
  return k.toLowerCase().startsWith('zoho-enczapikey') ? k : `Zoho-enczapikey ${k}`;
};

class SMTPAdapter {
  constructor(config) {
    this.config = config.credentials;
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure || false,
      auth: {
        user: this.config.username,
        pass: this.config.password
      }
    });
  }

  async send({ to, subject, html, text, from, replyTo }) {
    return this.transporter.sendMail({
      from: from || this.config.fromEmail,
      to,
      subject,
      text,
      html,
      replyTo
    });
  }

  async testConnection() {
    return this.transporter.verify();
  }
}

class ZeptoMailAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.apiUrl = (this.config.apiUrl || 'https://api.zeptomail.com/').replace(/\/?$/, '/');
  }

  async send({ to, subject, html, text, from, replyTo }) {
    const fromEmail = from || this.config.fromEmail;
    if (!this.config.apiKey || !fromEmail) {
      throw new Error('ZeptoMail is not configured: missing apiKey or fromEmail');
    }

    const toList = (Array.isArray(to) ? to : [to]).map((address) => ({
      email_address: { address }
    }));

    const payload = {
      from: { address: fromEmail, name: this.config.fromName || undefined },
      to: toList,
      subject,
      htmlbody: html,
      textbody: text
    };
    if (replyTo) payload.reply_to = [{ address: replyTo }];

    const response = await axios.post(`${this.apiUrl}v1.1/email`, payload, {
      headers: {
        Authorization: zohoAuthHeader(this.config.apiKey),
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    return response.data;
  }

  async testConnection() {
    if (!this.config.apiKey || !this.config.fromEmail) {
      throw new Error('Missing ZeptoMail apiKey or fromEmail');
    }
    // ZeptoMail has no lightweight "ping" endpoint — verify by sending a real
    // test email to the configured from-address, which also confirms deliverability.
    await this.send({
      to: this.config.fromEmail,
      subject: 'ZeptoMail connection test',
      html: '<p>This is a test email confirming your ZeptoMail integration is working.</p>',
      text: 'This is a test email confirming your ZeptoMail integration is working.'
    });
    return true;
  }
}

class SendGridAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async send({ to, subject, html, text, from, replyTo }) {
    const fromEmail = from || this.config.fromEmail;
    if (!this.config.apiKey || !fromEmail) {
      throw new Error('SendGrid is not configured: missing apiKey or fromEmail');
    }

    const toList = Array.isArray(to) ? to : [to];
    const payload = {
      personalizations: [{ to: toList.map((address) => ({ email: address })) }],
      from: { email: fromEmail, name: this.config.fromName || undefined },
      subject,
      content: [
        text ? { type: 'text/plain', value: text } : null,
        html ? { type: 'text/html', value: html } : null
      ].filter(Boolean)
    };
    if (replyTo) payload.reply_to = { email: replyTo };

    const response = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    return response.data;
  }

  async testConnection() {
    if (!this.config.apiKey) {
      throw new Error('Missing SendGrid apiKey');
    }
    // Validate the API key against SendGrid without sending an email.
    await axios.get('https://api.sendgrid.com/v3/scopes', {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      timeout: 15000
    });
    return true;
  }
}

class SesAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    const { accessKeyId, secretAccessKey, region } = this.config;
    if (!accessKeyId || !secretAccessKey || !region) {
      throw new Error('AWS SES is not configured: missing accessKeyId, secretAccessKey, or region');
    }
    this.client = new SESClient({
      region,
      credentials: { accessKeyId, secretAccessKey, sessionToken: this.config.sessionToken }
    });
  }

  async send({ to, subject, html, text, from, replyTo }) {
    const fromEmail = from || this.config.fromEmail;
    if (!fromEmail) throw new Error('AWS SES is not configured: missing fromEmail');

    const toList = Array.isArray(to) ? to : [to];
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: toList },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
          ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {})
        }
      },
      ReplyToAddresses: replyTo ? [replyTo] : undefined
    });
    const response = await this.client.send(command);
    return { messageId: response.MessageId };
  }

  async testConnection() {
    await this.client.send(new GetAccountSendingEnabledCommand({}));
    return true;
  }
}

class MailgunAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.domain = this.config.domain;
    this.baseUrl = (this.config.apiUrl || `https://api.mailgun.net/v3/${this.domain}`).replace(/\/$/, '');
  }

  async send({ to, subject, html, text, from, replyTo }) {
    const { apiKey } = this.config;
    const fromEmail = from || this.config.fromEmail;
    if (!apiKey || !fromEmail || !this.domain) {
      throw new Error('Mailgun is not configured: missing apiKey, fromEmail, or domain');
    }

    const toList = Array.isArray(to) ? to.join(',') : to;
    const body = new URLSearchParams({
      from: fromEmail,
      to: toList,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(replyTo ? { 'h:Reply-To': replyTo } : {})
    });

    const response = await axios.post(`${this.baseUrl}/messages`, body.toString(), {
      auth: { username: 'api', password: apiKey },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });
    return response.data;
  }

  async testConnection() {
    const { apiKey } = this.config;
    if (!apiKey || !this.domain) throw new Error('Missing Mailgun apiKey or domain');
    await axios.get(`https://api.mailgun.net/v3/domains/${this.domain}`, {
      auth: { username: 'api', password: apiKey },
      timeout: 15000
    });
    return true;
  }
}

class PostmarkAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  async send({ to, subject, html, text, from, replyTo }) {
    const { serverToken } = this.config;
    const fromEmail = from || this.config.fromEmail;
    if (!serverToken || !fromEmail) {
      throw new Error('Postmark is not configured: missing serverToken or fromEmail');
    }

    const toList = Array.isArray(to) ? to : [to];
    const payload = {
      From: fromEmail,
      To: toList.join(','),
      Subject: subject,
      ...(html ? { HtmlBody: html } : {}),
      ...(text ? { TextBody: text } : {}),
      ...(replyTo ? { ReplyTo: replyTo } : {})
    };

    const response = await axios.post('https://api.postmarkapp.com/email', payload, {
      headers: {
        'X-Postmark-Server-Token': serverToken,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: 30000
    });
    return response.data;
  }

  async testConnection() {
    const { serverToken } = this.config;
    if (!serverToken) throw new Error('Missing Postmark serverToken');
    await axios.get('https://api.postmarkapp.com/server', {
      headers: { 'X-Postmark-Server-Token': serverToken, Accept: 'application/json' },
      timeout: 15000
    });
    return true;
  }
}

/**
 * Factory to create email adapter based on provider config
 * @param {Object} config The IntegrationConfig document
 */
const createEmailAdapter = (config) => {
  if (!config || !config.provider) {
    throw new Error('Invalid email configuration');
  }

  switch (config.provider.toLowerCase()) {
    case 'smtp':
      return new SMTPAdapter(config);
    case 'zeptomail':
      return new ZeptoMailAdapter(config);
    case 'sendgrid':
      return new SendGridAdapter(config);
    case 'ses':
      return new SesAdapter(config);
    case 'mailgun':
      return new MailgunAdapter(config);
    case 'postmark':
      return new PostmarkAdapter(config);
    default:
      throw new Error(`Unsupported email provider: ${config.provider}`);
  }
};

module.exports = {
  createEmailAdapter,
  SMTPAdapter,
  ZeptoMailAdapter,
  SendGridAdapter,
  SesAdapter,
  MailgunAdapter,
  PostmarkAdapter
};
