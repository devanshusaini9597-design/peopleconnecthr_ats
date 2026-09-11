/**
 * WhatsApp Cloud API adapter — Skillnix talks to Meta Graph API directly.
 * No Twilio / Wati / Gupshup on this path.
 */
const axios = require('axios');

function graphBase() {
  const version = (process.env.META_GRAPH_VERSION || 'v21.0').replace(/^\//, '');
  return `https://graph.facebook.com/${version}`;
}

function normalizeWaPhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^0+/, '');
}

class MetaCloudWhatsAppAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  _assertConfig() {
    const { accessToken, phoneNumberId } = this.config;
    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp is not connected. Save your Meta access token and Phone Number ID in Integrations.');
    }
  }

  async sendWhatsApp({ to, message, templateName, languageCode, components }) {
    this._assertConfig();
    const toDigits = normalizeWaPhone(to);
    if (!toDigits) throw new Error('A valid recipient phone number is required');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toDigits,
    };

    if (templateName) {
      payload.type = 'template';
      payload.template = {
        name: templateName,
        language: { code: languageCode || 'en_US' },
      };
      if (Array.isArray(components) && components.length) {
        payload.template.components = components;
      }
    } else {
      if (!message || !String(message).trim()) {
        throw new Error('Message text is required');
      }
      payload.type = 'text';
      payload.text = { preview_url: false, body: String(message).trim() };
    }

    try {
      const response = await axios.post(
        `${graphBase()}/${this.config.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );
      const id = response.data?.messages?.[0]?.id || '';
      return { id, status: 'sent', provider: 'meta' };
    } catch (err) {
      const metaMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.error?.error_user_msg ||
        err.message;
      throw new Error(`WhatsApp send failed: ${metaMsg}`);
    }
  }

  async testConnection() {
    this._assertConfig();
    const response = await axios.get(
      `${graphBase()}/${this.config.phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
        timeout: 15000,
      }
    );
    return {
      displayPhoneNumber: response.data?.display_phone_number || '',
      verifiedName: response.data?.verified_name || '',
      qualityRating: response.data?.quality_rating || '',
    };
  }
}

function createWhatsAppAdapter(config) {
  if (!config || !config.provider) throw new Error('Invalid WhatsApp configuration');
  const provider = String(config.provider).toLowerCase();
  if (provider === 'meta' || provider === 'meta_cloud' || provider === 'whatsapp_cloud') {
    return new MetaCloudWhatsAppAdapter(config);
  }
  throw new Error('WhatsApp on this platform uses Meta Cloud API only. Reconnect WhatsApp in Integrations.');
}

module.exports = {
  createWhatsAppAdapter,
  MetaCloudWhatsAppAdapter,
  normalizeWaPhone,
  graphBase,
};
