/**
 * Meta WhatsApp Cloud API — Tech Provider onboarding + inbound webhooks.
 * Skillnix stores each org's WABA / phone and talks to graph.facebook.com.
 */
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');
const IntegrationConfig = require('../models/IntegrationConfig');
const Candidate = require('../models/Candidate');
const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const { graphBase, normalizeWaPhone } = require('../adapters/whatsappAdapter');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function getPlatformConfig() {
  const appId = (process.env.META_APP_ID || '').trim();
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  const configId = (process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '').trim();
  const verifyToken = (process.env.META_WHATSAPP_VERIFY_TOKEN || '').trim();
  const graphVersion = (process.env.META_GRAPH_VERSION || 'v21.0').trim();
  const company = getCompanyCloudCredentials();
  return {
    appId,
    appSecret,
    configId,
    verifyToken,
    graphVersion,
    companyReady: company.ready,
    saasReady: Boolean(appId && appSecret && configId),
    ready: Boolean(appId && appSecret && configId),
  };
}

/** Skillnix's own Meta Cloud API number (company-only mode, before multi-tenant SaaS). */
function getCompanyCloudCredentials() {
  const accessToken = (process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const wabaId = (process.env.META_WHATSAPP_WABA_ID || '').trim();
  const organizationId = (process.env.META_WHATSAPP_ORGANIZATION_ID || '').trim();
  return {
    accessToken,
    phoneNumberId,
    wabaId,
    organizationId,
    ready: Boolean(accessToken && phoneNumberId),
  };
}

function isCompanyCloudOrg(organizationId) {
  const owner = (process.env.META_WHATSAPP_ORGANIZATION_ID || '').trim();
  if (!owner || !organizationId) return false;
  return String(organizationId) === owner;
}

function verifyWebhookChallenge({ mode, token, challenge }) {
  const expected = (process.env.META_WHATSAPP_VERIFY_TOKEN || '').trim();
  if (mode === 'subscribe' && expected && token === expected) {
    return { ok: true, challenge: String(challenge || '') };
  }
  return { ok: false };
}

/** Express extended query parser turns hub.mode into query.hub.mode */
function parseHubQuery(query = {}) {
  const hub = query.hub && typeof query.hub === 'object' ? query.hub : {};
  return {
    mode: query['hub.mode'] || hub.mode,
    token: query['hub.verify_token'] || hub.verify_token,
    challenge: query['hub.challenge'] || hub.challenge,
  };
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  const secret = appSecret || (process.env.META_APP_SECRET || '').trim();
  if (!secret) return false;
  if (!signatureHeader || !rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const left = Buffer.from(String(signatureHeader));
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function extractMessageBody(msg) {
  if (!msg) return '';
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg.image) return msg.image.caption || '[Image]';
  if (msg.document) return msg.document.caption || msg.document.filename || '[Document]';
  if (msg.audio) return '[Audio]';
  if (msg.video) return msg.video.caption || '[Video]';
  if (msg.sticker) return '[Sticker]';
  if (msg.location) return '[Location]';
  if (msg.contacts) return '[Contact]';
  return `[${msg.type || 'message'}]`;
}

async function graphGet(path, accessToken, params = {}) {
  const { data } = await axios.get(`${graphBase()}/${String(path).replace(/^\//, '')}`, {
    params,
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 20000,
  });
  return data;
}

async function graphPost(path, accessToken, body = {}) {
  const { data } = await axios.post(
    `${graphBase()}/${String(path).replace(/^\//, '')}`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );
  return data;
}

async function exchangeCodeForToken(code) {
  const { appId, appSecret } = getPlatformConfig();
  if (!appId || !appSecret) {
    throw httpError('Meta WhatsApp is not configured on this Skillnix instance.', 503);
  }
  try {
    const { data } = await axios.get(`${graphBase()}/oauth/access_token`, {
      params: {
        client_id: appId,
        client_secret: appSecret,
        code,
      },
      timeout: 20000,
    });
    if (!data?.access_token) throw new Error('Meta did not return an access token');
    return data.access_token;
  } catch (err) {
    const metaMsg = err.response?.data?.error?.message || err.message;
    throw httpError(`Could not complete WhatsApp signup: ${metaMsg}`, err.statusCode || 400);
  }
}

async function exchangeLongLivedToken(shortToken) {
  const { appId, appSecret } = getPlatformConfig();
  try {
    const { data } = await axios.get(`${graphBase()}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      },
      timeout: 20000,
    });
    return data?.access_token || shortToken;
  } catch (err) {
    logger.warn({ err: err.message }, '[whatsapp] Long-lived token exchange skipped');
    return shortToken;
  }
}

async function subscribeAppToWaba(wabaId, accessToken) {
  try {
    await graphPost(`${wabaId}/subscribed_apps`, accessToken, {});
  } catch (err) {
    const metaMsg = err.response?.data?.error?.message || err.message;
    throw httpError(`Could not subscribe WhatsApp webhooks: ${metaMsg}`, 400);
  }
}

async function loadPhoneProfile(phoneNumberId, accessToken) {
  try {
    return await graphGet(phoneNumberId, accessToken, {
      fields: 'display_phone_number,verified_name,quality_rating',
    });
  } catch (err) {
    logger.warn({ err: err.message, phoneNumberId }, '[whatsapp] Could not load phone profile');
    return {};
  }
}

async function completeOnboarding({ organizationId, userId, code, wabaId, phoneNumberId, businessId }) {
  if (!code) throw httpError('Embedded Signup code is required');
  if (!wabaId || !phoneNumberId) {
    throw httpError('WhatsApp account and phone number IDs are required from Embedded Signup');
  }

  let accessToken = await exchangeCodeForToken(code);
  accessToken = await exchangeLongLivedToken(accessToken);
  await subscribeAppToWaba(wabaId, accessToken);
  const profile = await loadPhoneProfile(phoneNumberId, accessToken);

  let config = await IntegrationConfig.findOne({ organizationId, provider: 'meta' });
  const isNew = !config;
  if (!config) {
    config = new IntegrationConfig({
      organizationId,
      provider: 'meta',
      category: 'whatsapp',
    });
  }

  config.category = 'whatsapp';
  config.displayName = profile.verified_name
    ? `WhatsApp (${profile.verified_name})`
    : 'WhatsApp Cloud API';
  config.credentials = {
    accessToken,
    wabaId: String(wabaId),
    phoneNumberId: String(phoneNumberId),
    businessId: businessId ? String(businessId) : '',
  };
  config.metadata = {
    ...(config.metadata || {}),
    wabaId: String(wabaId),
    phoneNumberId: String(phoneNumberId),
    businessId: businessId ? String(businessId) : '',
    displayPhoneNumber: profile.display_phone_number || '',
    verifiedName: profile.verified_name || '',
    qualityRating: profile.quality_rating || '',
  };
  config.isActive = true;
  config.isValidated = true;
  config.lastValidatedAt = new Date();
  config.validationError = '';
  config.configuredBy = config.configuredBy || userId;
  config.lastModifiedBy = userId;
  config.auditLog.push({
    action: isNew ? 'created' : 'updated',
    performedBy: userId,
    details: 'Connected via Meta Embedded Signup',
  });
  await config.save();

  return {
    wabaId: String(wabaId),
    phoneNumberId: String(phoneNumberId),
    displayPhoneNumber: profile.display_phone_number || '',
    verifiedName: profile.verified_name || '',
  };
}

async function findConfigByMetaIds({ phoneNumberId, wabaId }) {
  const or = [];
  if (phoneNumberId) or.push({ 'metadata.phoneNumberId': String(phoneNumberId) });
  if (wabaId) or.push({ 'metadata.wabaId': String(wabaId) });
  if (or.length) {
    const config = await IntegrationConfig.findOne({
      category: 'whatsapp',
      provider: 'meta',
      isActive: true,
      $or: or,
    });
    if (config) return config;
  }

  const company = getCompanyCloudCredentials();
  if (
    company.ready
    && company.organizationId
    && (
      (phoneNumberId && String(phoneNumberId) === company.phoneNumberId)
      || (wabaId && company.wabaId && String(wabaId) === company.wabaId)
    )
  ) {
    return {
      organizationId: company.organizationId,
      metadata: {
        phoneNumberId: company.phoneNumberId,
        wabaId: company.wabaId,
      },
    };
  }
  return null;
}

async function findCandidateByWaId(organizationId, waId) {
  const digits = normalizeWaPhone(waId);
  if (!digits) return null;
  const last10 = digits.slice(-10);
  if (last10.length < 8) return null;
  const candidates = await Candidate.find({
    organizationId,
    $or: [
      { contact: { $regex: last10 } },
      { phone: { $regex: last10 } },
    ],
  })
    .select('name email contact phone messagingConsent')
    .limit(25)
    .lean();

  return candidates.find((c) => {
    const a = normalizeWaPhone(c.contact);
    const b = normalizeWaPhone(c.phone);
    return a === digits || b === digits || a.endsWith(last10) || b.endsWith(last10);
  }) || null;
}

async function recordInboundMessage({ organizationId, waId, contactName, body, externalId, toAddress }) {
  if (externalId) {
    const existing = await Message.findOne({ organizationId, externalId }).select('_id');
    if (existing) return { duplicate: true };
  }

  const candidate = await findCandidateByWaId(organizationId, waId);
  const phone = normalizeWaPhone(waId);

  let thread = await MessageThread.findOne({
    organizationId,
    channel: 'whatsapp',
    archived: false,
    $or: [
      ...(candidate?._id ? [{ candidateId: candidate._id }] : []),
      { 'participants.candidatePhone': { $regex: phone.slice(-10) } },
    ],
  }).sort({ lastMessageAt: -1 });

  if (!thread) {
    thread = await MessageThread.create({
      organizationId,
      candidateId: candidate?._id || null,
      subject: `WhatsApp with ${candidate?.name || contactName || phone}`,
      channel: 'whatsapp',
      participants: {
        candidateName: candidate?.name || contactName || '',
        candidateEmail: candidate?.email || '',
        candidatePhone: candidate?.contact || candidate?.phone || phone,
      },
      unreadCount: 1,
      lastMessageAt: new Date(),
      lastMessagePreview: String(body || '').slice(0, 160),
      lastDirection: 'inbound',
    });
  } else {
    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = String(body || '').slice(0, 160);
    thread.lastDirection = 'inbound';
    thread.unreadCount = (thread.unreadCount || 0) + 1;
    if (candidate?._id && !thread.candidateId) thread.candidateId = candidate._id;
    await thread.save();
  }

  await Message.create({
    organizationId,
    threadId: thread._id,
    candidateId: candidate?._id || null,
    channel: 'whatsapp',
    direction: 'inbound',
    fromName: candidate?.name || contactName || phone,
    fromAddress: phone,
    toAddress: toAddress || '',
    body: body || '',
    status: 'received',
    isRead: false,
    externalId: externalId || '',
    sentAt: new Date(),
  });

  return { duplicate: false, threadId: thread._id };
}

function mapMetaStatus(status) {
  if (status === 'delivered' || status === 'read') return status;
  if (status === 'sent') return 'sent';
  if (status === 'failed') return 'failed';
  return null;
}

async function applyStatusUpdate({ organizationId, wamid, status, errorMessage }) {
  if (!wamid) return;
  const mapped = mapMetaStatus(status);
  if (!mapped) return;
  const update = { status: mapped };
  if (mapped === 'failed' && errorMessage) update.errorMessage = errorMessage;
  await Message.updateOne(
    { organizationId, externalId: wamid },
    { $set: update }
  );
}

async function handleWebhookPayload(payload) {
  if (!payload || payload.object !== 'whatsapp_business_account') {
    return { handled: false };
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let inbound = 0;
  let statuses = 0;

  for (const entry of entries) {
    const wabaId = entry.id;
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id || '';
      const displayPhone = value.metadata?.display_phone_number || '';
      const config = await findConfigByMetaIds({ phoneNumberId, wabaId });
      if (!config) {
        logger.warn({ wabaId, phoneNumberId, field: change.field }, '[whatsapp] Webhook for unknown WABA');
        continue;
      }

      if (change.field === 'messages') {
        const contacts = value.contacts || [];
        for (const msg of value.messages || []) {
          if (msg.type === 'system') continue;
          const contact = contacts.find((c) => c.wa_id === msg.from) || contacts[0] || {};
          await recordInboundMessage({
            organizationId: config.organizationId,
            waId: msg.from,
            contactName: contact.profile?.name || '',
            body: extractMessageBody(msg),
            externalId: msg.id,
            toAddress: displayPhone,
          });
          inbound += 1;
        }
        for (const st of value.statuses || []) {
          const errMsg = st.errors?.[0]?.title || st.errors?.[0]?.message || '';
          await applyStatusUpdate({
            organizationId: config.organizationId,
            wamid: st.id,
            status: st.status,
            errorMessage: errMsg,
          });
          statuses += 1;
        }
      }
    }
  }

  return { handled: true, inbound, statuses };
}

async function getOrgConnection(organizationId) {
  const config = await IntegrationConfig.findOne({
    organizationId,
    category: 'whatsapp',
    provider: 'meta',
    isActive: true,
  });
  if (config) {
    const meta = config.metadata || {};
    return {
      configured: true,
      provider: 'meta',
      source: 'org',
      displayPhoneNumber: meta.displayPhoneNumber || '',
      verifiedName: meta.verifiedName || '',
      wabaId: meta.wabaId || '',
      phoneNumberId: meta.phoneNumberId || '',
      qualityRating: meta.qualityRating || '',
      isValidated: !!config.isValidated,
    };
  }

  const company = getCompanyCloudCredentials();
  if (company.ready && isCompanyCloudOrg(organizationId)) {
    return {
      configured: true,
      provider: 'meta',
      source: 'company',
      displayPhoneNumber: '',
      verifiedName: '',
      wabaId: company.wabaId,
      phoneNumberId: company.phoneNumberId,
      qualityRating: '',
      isValidated: true,
    };
  }
  return null;
}

module.exports = {
  getPlatformConfig,
  verifyWebhookChallenge,
  parseHubQuery,
  verifyMetaSignature,
  normalizeWaPhone,
  extractMessageBody,
  completeOnboarding,
  handleWebhookPayload,
  getOrgConnection,
  findCandidateByWaId,
  getCompanyCloudCredentials,
  isCompanyCloudOrg,
};
