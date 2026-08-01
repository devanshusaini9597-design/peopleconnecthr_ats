/**
 * E-Sign Adapter — unified interface for sending documents (offer letters)
 * out for signature, regardless of provider.
 * Supports: DocuSign eSignature REST API v2.1.
 *
 * IntegrationConfig.credentials shape for provider 'docusign':
 *   { accessToken, accountId, basePath }
 *   // accessToken: OAuth access token obtained via DocuSign's JWT grant
 *   //   flow (server-to-server) — DocuSign tokens expire after ~8h, so
 *   //   production use should refresh this out-of-band and re-save the
 *   //   IntegrationConfig; this adapter does not implement the JWT grant
 *   //   itself (that needs an RSA keypair registered with DocuSign, out of
 *   //   scope for a paste-a-credential BYOK flow).
 *   // accountId: DocuSign API Account ID (guid, from the DocuSign admin console)
 *   // basePath: e.g. https://demo.docusign.net/restapi (sandbox) or the
 *   //   production base URI DocuSign returns from /oauth/userinfo
 */
const axios = require('axios');

class DocuSignAdapter {
  constructor(config) {
    this.config = config.credentials || {};
  }

  _headers() {
    const { accessToken } = this.config;
    if (!accessToken) throw new Error('DocuSign is not configured: missing accessToken');
    return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  }

  _envelopesUrl() {
    const { basePath, accountId } = this.config;
    if (!basePath || !accountId) throw new Error('DocuSign is not configured: missing basePath or accountId');
    return `${basePath.replace(/\/$/, '')}/v2.1/accounts/${accountId}/envelopes`;
  }

  /**
   * Sends a document (e.g. an offer letter PDF, base64-encoded) to a single
   * signer for signature.
   * @param {Object} params
   * @param {string} params.documentBase64 base64-encoded PDF/doc content
   * @param {string} params.documentName
   * @param {string} params.signerEmail
   * @param {string} params.signerName
   * @param {string} [params.emailSubject]
   * @returns {Promise<{envelopeId: string, status: string}>}
   */
  async sendForSignature({ documentBase64, documentName, signerEmail, signerName, emailSubject }) {
    if (!documentBase64 || !signerEmail || !signerName) {
      throw new Error('sendForSignature requires documentBase64, signerEmail, and signerName');
    }

    const payload = {
      emailSubject: emailSubject || `Please sign: ${documentName || 'Offer Letter'}`,
      documents: [{
        documentBase64,
        name: documentName || 'Offer Letter',
        fileExtension: 'pdf',
        documentId: '1'
      }],
      recipients: {
        signers: [{
          email: signerEmail,
          name: signerName,
          recipientId: '1',
          routingOrder: '1',
          tabs: { signHereTabs: [{ anchorString: '/sign/', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }] }
        }]
      },
      status: 'sent'
    };

    const response = await axios.post(this._envelopesUrl(), payload, { headers: this._headers(), timeout: 30000 });
    return { envelopeId: response.data.envelopeId, status: response.data.status };
  }

  async getEnvelopeStatus(envelopeId) {
    if (!envelopeId) throw new Error('getEnvelopeStatus requires envelopeId');
    const response = await axios.get(`${this._envelopesUrl()}/${envelopeId}`, { headers: this._headers(), timeout: 15000 });
    return { status: response.data.status, completedDateTime: response.data.completedDateTime };
  }

  async testConnection() {
    const { basePath, accountId } = this.config;
    if (!basePath || !accountId) throw new Error('Missing basePath or accountId');
    await axios.get(`${basePath.replace(/\/$/, '')}/v2.1/accounts/${accountId}`, { headers: this._headers(), timeout: 15000 });
    return true;
  }
}

const createEsignAdapter = (config) => {
  if (!config || !config.provider) {
    throw new Error('Invalid e-sign configuration');
  }
  switch (config.provider.toLowerCase()) {
    case 'docusign':
      return new DocuSignAdapter(config);
    default:
      throw new Error(`Unsupported e-sign provider: ${config.provider}`);
  }
};

module.exports = { createEsignAdapter, DocuSignAdapter };
