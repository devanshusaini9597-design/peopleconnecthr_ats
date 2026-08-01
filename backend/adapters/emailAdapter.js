/**
 * Email Adapter — unified interface for sending emails regardless of provider.
 * 
 * Supports: SMTP (nodemailer), Zoho Zeptomail, SendGrid
 */

const nodemailer = require('nodemailer');
const axios = require('axios');

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

/**
 * Factory to create email adapter based on provider config
 * @param {Object} config The IntegrationConfig document
 * @returns {SMTPAdapter|ZeptoMailAdapter|SendGridAdapter}
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
    default:
      throw new Error(`Unsupported email provider: ${config.provider}`);
  }
};

module.exports = {
  createEmailAdapter,
  SMTPAdapter,
  ZeptoMailAdapter,
  SendGridAdapter
};
