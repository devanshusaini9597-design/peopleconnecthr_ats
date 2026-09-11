const crypto = require('crypto');
const {
  verifyWebhookChallenge,
  verifyMetaSignature,
  extractMessageBody,
  normalizeWaPhone,
  getCompanyCloudCredentials,
  isCompanyCloudOrg,
  parseHubQuery,
} = require('../services/whatsappCloudService');
const { createWhatsAppAdapter } = require('../adapters/whatsappAdapter');

describe('whatsappCloudService helpers', () => {
  describe('normalizeWaPhone', () => {
    it('strips plus, spaces, and leading zeros', () => {
      expect(normalizeWaPhone('+91 98765 43210')).toBe('919876543210');
      expect(normalizeWaPhone('09876543210')).toBe('9876543210');
    });
  });

  describe('extractMessageBody', () => {
    it('reads text, buttons, and media captions', () => {
      expect(extractMessageBody({ text: { body: 'Hello' } })).toBe('Hello');
      expect(extractMessageBody({ button: { text: 'Yes' } })).toBe('Yes');
      expect(extractMessageBody({ image: { caption: 'CV' } })).toBe('CV');
      expect(extractMessageBody({ image: {} })).toBe('[Image]');
      expect(extractMessageBody({ type: 'unknown' })).toBe('[unknown]');
    });
  });

  describe('verifyWebhookChallenge', () => {
    const prev = process.env.META_WHATSAPP_VERIFY_TOKEN;
    afterAll(() => {
      process.env.META_WHATSAPP_VERIFY_TOKEN = prev;
    });

    it('accepts a matching subscribe challenge', () => {
      process.env.META_WHATSAPP_VERIFY_TOKEN = 'skillnix-verify';
      const result = verifyWebhookChallenge({
        mode: 'subscribe',
        token: 'skillnix-verify',
        challenge: '12345',
      });
      expect(result).toEqual({ ok: true, challenge: '12345' });
    });

    it('rejects a wrong token', () => {
      process.env.META_WHATSAPP_VERIFY_TOKEN = 'skillnix-verify';
      expect(verifyWebhookChallenge({
        mode: 'subscribe',
        token: 'nope',
        challenge: '12345',
      }).ok).toBe(false);
    });
  });

  describe('parseHubQuery', () => {
    it('reads nested hub fields from Express extended query parser', () => {
      expect(parseHubQuery({
        hub: { mode: 'subscribe', verify_token: 'abc', challenge: '99' },
      })).toEqual({ mode: 'subscribe', token: 'abc', challenge: '99' });
    });
  });

  describe('verifyMetaSignature', () => {
    it('accepts a valid HMAC and rejects a bad one', () => {
      const body = '{"object":"whatsapp_business_account"}';
      const secret = 'app-secret';
      const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
      expect(verifyMetaSignature(body, sig, secret)).toBe(true);
      expect(verifyMetaSignature(body, 'sha256=deadbeef', secret)).toBe(false);
      expect(verifyMetaSignature(body, sig, 'other')).toBe(false);
    });
  });
});

describe('whatsappAdapter factory', () => {
  it('creates a Meta adapter and rejects third-party providers', () => {
    const adapter = createWhatsAppAdapter({
      provider: 'meta',
      credentials: { accessToken: 't', phoneNumberId: '1' },
    });
    expect(typeof adapter.sendWhatsApp).toBe('function');
    expect(() => createWhatsAppAdapter({ provider: 'twilio', credentials: {} }))
      .toThrow(/Meta Cloud API only/);
  });
});

describe('company-only Meta credentials', () => {
  const keys = [
    'META_WHATSAPP_ACCESS_TOKEN',
    'META_WHATSAPP_PHONE_NUMBER_ID',
    'META_WHATSAPP_WABA_ID',
    'META_WHATSAPP_ORGANIZATION_ID',
  ];
  const prev = {};
  beforeEach(() => {
    keys.forEach((k) => { prev[k] = process.env[k]; });
  });
  afterEach(() => {
    keys.forEach((k) => {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    });
  });

  it('is ready only when token and phone number id are set', () => {
    process.env.META_WHATSAPP_ACCESS_TOKEN = 'tok';
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = '123';
    process.env.META_WHATSAPP_ORGANIZATION_ID = 'org1';
    const company = getCompanyCloudCredentials();
    expect(company.ready).toBe(true);
    expect(isCompanyCloudOrg('org1')).toBe(true);
    expect(isCompanyCloudOrg('org2')).toBe(false);
  });
});
