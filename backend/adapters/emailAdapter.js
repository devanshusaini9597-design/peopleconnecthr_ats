/**
 * Email Adapter — unified interface for sending emails regardless of provider.
 * 
 * Supports: SMTP (nodemailer), Zoho Zeptomail, SendGrid
 */

const nodemailer = require('nodemailer');

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
    this.config = config.credentials;
    // Assuming ZeptoMail uses a REST API via fetch or a specific SDK
    // Here we'd initialize the SendMailClient if using zeptomail sdk
  }

  async send({ to, subject, html, text, from, replyTo }) {
    // Stub for Zeptomail
    console.log('Sending email via ZeptoMail:', { to, subject });
    // In actual implementation, construct payload and send via API
    return true;
  }

  async testConnection() {
    // Stub
    return true;
  }
}

class SendGridAdapter {
  constructor(config) {
    this.config = config.credentials;
  }

  async send({ to, subject, html, text, from, replyTo }) {
    // Stub for SendGrid
    console.log('Sending email via SendGrid:', { to, subject });
    return true;
  }

  async testConnection() {
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
