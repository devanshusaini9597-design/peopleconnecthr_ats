/**

 * E-Sign Adapter — unified interface for sending documents out for signature.

 * Supports: DocuSign, Dropbox Sign (HelloSign), Adobe Sign, PandaDoc.

 */

const axios = require('axios');

const FormData = require('form-data');



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



class DropboxSignAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = 'https://api.hellosign.com/v3';

  }



  async sendForSignature({ documentBase64, documentName, signerEmail, signerName, emailSubject }) {

    const { apiKey, clientId } = this.config;

    if (!apiKey || !clientId) throw new Error('Dropbox Sign is not configured: missing apiKey or clientId');

    if (!documentBase64 || !signerEmail || !signerName) {

      throw new Error('sendForSignature requires documentBase64, signerEmail, and signerName');

    }



    const form = new FormData();

    form.append('client_id', clientId);

    form.append('title', documentName || 'Offer Letter');

    form.append('subject', emailSubject || `Please sign: ${documentName || 'Offer Letter'}`);

    form.append('signers[0][email_address]', signerEmail);

    form.append('signers[0][name]', signerName);

    form.append('file[0]', Buffer.from(documentBase64, 'base64'), {

      filename: `${documentName || 'document'}.pdf`,

      contentType: 'application/pdf'

    });



    const response = await axios.post(`${this.baseUrl}/signature_request/send`, form, {

      auth: { username: apiKey, password: '' },

      headers: form.getHeaders(),

      timeout: 30000

    });

    const req = response.data.signature_request;

    return { envelopeId: req.signature_request_id, status: req.is_complete ? 'completed' : 'sent' };

  }



  async getEnvelopeStatus(envelopeId) {

    const { apiKey } = this.config;

    if (!apiKey) throw new Error('Dropbox Sign is not configured: missing apiKey');

    const response = await axios.get(`${this.baseUrl}/signature_request/${envelopeId}`, {

      auth: { username: apiKey, password: '' },

      timeout: 15000

    });

    const req = response.data.signature_request;

    return { status: req.is_complete ? 'completed' : req.is_declined ? 'declined' : 'sent' };

  }



  async testConnection() {

    const { apiKey } = this.config;

    if (!apiKey) throw new Error('Missing Dropbox Sign apiKey');

    await axios.get(`${this.baseUrl}/account`, {

      auth: { username: apiKey, password: '' },

      timeout: 15000

    });

    return true;

  }

}



class AdobeSignAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = (this.config.baseUrl || 'https://api.na1.adobesign.com/api/rest/v6').replace(/\/$/, '');

  }



  _headers() {

    const { accessToken } = this.config;

    if (!accessToken) throw new Error('Adobe Sign is not configured: missing accessToken');

    return { Authorization: `Bearer ${accessToken}` };

  }



  async sendForSignature({ documentBase64, documentName, signerEmail, signerName, emailSubject }) {

    if (!documentBase64 || !signerEmail || !signerName) {

      throw new Error('sendForSignature requires documentBase64, signerEmail, and signerName');

    }



    const form = new FormData();

    form.append('File', Buffer.from(documentBase64, 'base64'), {

      filename: `${documentName || 'document'}.pdf`,

      contentType: 'application/pdf'

    });



    const transientDoc = await axios.post(`${this.baseUrl}/transientDocuments`, form, {

      headers: { ...this._headers(), ...form.getHeaders() },

      timeout: 30000

    });



    const payload = {

      fileInfos: [{ transientDocumentId: transientDoc.data.transientDocumentId }],

      name: documentName || 'Offer Letter',

      participantSetsInfo: [{

        memberInfos: [{ email: signerEmail, name: signerName }],

        order: 1,

        role: 'SIGNER'

      }],

      signatureType: 'ESIGN',

      state: 'IN_PROCESS',

      message: emailSubject || `Please sign: ${documentName || 'Offer Letter'}`

    };



    const response = await axios.post(`${this.baseUrl}/agreements`, payload, {

      headers: { ...this._headers(), 'Content-Type': 'application/json' },

      timeout: 30000

    });

    return { envelopeId: response.data.id, status: response.data.status };

  }



  async getEnvelopeStatus(envelopeId) {

    const response = await axios.get(`${this.baseUrl}/agreements/${envelopeId}`, {

      headers: this._headers(),

      timeout: 15000

    });

    return { status: response.data.status };

  }



  async testConnection() {

    await axios.get(`${this.baseUrl}/users/me`, { headers: this._headers(), timeout: 15000 });

    return true;

  }

}



class PandaDocAdapter {

  constructor(config) {

    this.config = config.credentials || {};

    this.baseUrl = 'https://api.pandadoc.com/public/v1';

  }



  _headers() {

    const { apiKey } = this.config;

    if (!apiKey) throw new Error('PandaDoc is not configured: missing apiKey');

    return { Authorization: `API-Key ${apiKey}`, 'Content-Type': 'application/json' };

  }



  async sendForSignature({ documentBase64, documentName, signerEmail, signerName, emailSubject }) {

    if (!documentBase64 || !signerEmail || !signerName) {

      throw new Error('sendForSignature requires documentBase64, signerEmail, and signerName');

    }



    const createRes = await axios.post(`${this.baseUrl}/documents`, {

      name: documentName || 'Offer Letter',

      recipients: [{

        email: signerEmail,

        first_name: signerName.split(' ')[0],

        last_name: signerName.split(' ').slice(1).join(' ') || signerName

      }],

      metadata: { subject: emailSubject || `Please sign: ${documentName || 'Offer Letter'}` }

    }, { headers: this._headers(), timeout: 30000 });



    const docId = createRes.data.id;

    await axios.post(`${this.baseUrl}/documents/${docId}/upload`, {

      file: documentBase64,

      name: `${documentName || 'document'}.pdf`

    }, { headers: this._headers(), timeout: 30000 });



    const sendRes = await axios.post(`${this.baseUrl}/documents/${docId}/send`, {

      message: emailSubject || 'Please review and sign this document.'

    }, { headers: this._headers(), timeout: 30000 });



    return { envelopeId: docId, status: sendRes.data.status || 'document.sent' };

  }



  async getEnvelopeStatus(envelopeId) {

    const response = await axios.get(`${this.baseUrl}/documents/${envelopeId}`, {

      headers: this._headers(),

      timeout: 15000

    });

    return { status: response.data.status };

  }



  async testConnection() {

    await axios.get(`${this.baseUrl}/members`, { headers: this._headers(), timeout: 15000 });

    return true;

  }

}



const createEsignAdapter = (config) => {

  if (!config || !config.provider) throw new Error('Invalid e-sign configuration');

  switch (config.provider.toLowerCase()) {

    case 'docusign':

      return new DocuSignAdapter(config);

    case 'hellosign':

    case 'dropbox_sign':

      return new DropboxSignAdapter(config);

    case 'adobe_sign':

      return new AdobeSignAdapter(config);

    case 'pandadoc':

      return new PandaDocAdapter(config);

    default:

      throw new Error(`Unsupported e-sign provider: ${config.provider}`);

  }

};



module.exports = { createEsignAdapter, DocuSignAdapter, DropboxSignAdapter, AdobeSignAdapter, PandaDocAdapter };

