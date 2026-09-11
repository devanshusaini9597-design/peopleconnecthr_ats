/**
 * Enterprise marketing lists — purpose-based Zoho lists + ATS consent.
 * Auto-creates missing purpose lists via Zoho API and persists keys in MarketingListRegistry.
 */
const logger = require('../utils/logger');
const mongoose = require('mongoose');

const LIST_PURPOSES = ['subscribe', 'job_alerts', 'nurture', 'general'];

const PURPOSE_SETTING_FIELD = {
  subscribe: 'listKeySubscribe',
  job_alerts: 'listKeyJobAlerts',
  nurture: 'listKeyNurture',
  general: 'listKey',
};

const PURPOSE_LABEL = {
  subscribe: 'ATS Subscribe',
  job_alerts: 'ATS Job Alerts',
  nurture: 'ATS Nurture',
  general: 'ATS General',
};

const ensureLocks = new Map();

function scopeKeyFor(organizationId) {
  return organizationId ? String(organizationId) : 'platform';
}

async function getOrgMarketingCredentials(organizationId) {
  if (!organizationId) return null;
  try {
    const IntegrationConfig = mongoose.model('IntegrationConfig');
    const config = await IntegrationConfig.findOne({
      organizationId,
      category: 'marketing',
      provider: 'zoho_campaigns',
      isActive: true,
    });
    if (!config) return null;
    return config.getDecryptedCredentials() || null;
  } catch (err) {
    logger.warn({ err: err.message }, '[MarketingList] org credentials lookup failed');
    return null;
  }
}

async function loadRegistryKeys(organizationId) {
  try {
    const MarketingListRegistry = require('../models/MarketingListRegistry');
    const rows = await MarketingListRegistry.find({ scopeKey: scopeKeyFor(organizationId) }).lean();
    const out = {};
    for (const row of rows) {
      if (row.purpose && row.listKey) out[row.purpose] = row.listKey;
    }
    return out;
  } catch (err) {
    logger.warn({ err: err.message }, '[MarketingList] registry load failed');
    return {};
  }
}

async function resolveCampaignsSettings(organizationId) {
  const orgCreds = await getOrgMarketingCredentials(organizationId);
  const registry = await loadRegistryKeys(organizationId);
  const pick = (orgKey, purpose, ...envKeys) => {
    const fromOrg = orgCreds && String(orgCreds[orgKey] || '').trim();
    if (fromOrg) return fromOrg;
    if (purpose && registry[purpose]) return String(registry[purpose]).trim();
    for (const k of envKeys) {
      const v = String(process.env[k] || '').trim();
      if (v) return v;
    }
    return '';
  };

  const listKey = pick('listKey', 'general', 'ZOHO_CAMPAIGNS_LIST_KEY');
  return {
    clientId: pick('clientId', null, 'ZOHO_CAMPAIGNS_CLIENT_ID'),
    clientSecret: pick('clientSecret', null, 'ZOHO_CAMPAIGNS_CLIENT_SECRET'),
    refreshToken: pick('refreshToken', null, 'ZOHO_CAMPAIGNS_REFRESH_TOKEN'),
    apiKey: pick('apiKey', null, 'ZOHO_CAMPAIGNS_API_KEY'),
    listKey,
    listKeySubscribe: pick('listKeySubscribe', 'subscribe', 'ZOHO_CAMPAIGNS_LIST_KEY_SUBSCRIBE'),
    listKeyJobAlerts: pick('listKeyJobAlerts', 'job_alerts', 'ZOHO_CAMPAIGNS_LIST_KEY_JOB_ALERTS'),
    listKeyNurture: pick('listKeyNurture', 'nurture', 'ZOHO_CAMPAIGNS_LIST_KEY_NURTURE'),
    topicId: pick('topicId', null, 'ZOHO_CAMPAIGNS_TOPIC_ID'),
    fromEmail: pick('fromEmail', null, 'ZOHO_CAMPAIGNS_FROM_EMAIL', 'ZOHO_ZEPTOMAIL_FROM_EMAIL', 'ZEPTOMAIL_FROM_EMAIL'),
    // Hosted Zoho signup form — required for contacts on Do-Not-Mail to re-opt-in
    signupFormUrl: pick(
      'signupFormUrl',
      null,
      'ZOHO_CAMPAIGNS_SIGNUP_FORM_URL'
    ),
    accountsUrl: pick('accountsUrl', null, 'ZOHO_CAMPAIGNS_ACCOUNTS_URL') || 'https://accounts.zoho.in/oauth/v2/token',
    baseUrl: pick('baseUrl', null, 'ZOHO_CAMPAIGNS_BASE_URL') || 'https://campaigns.zoho.in/api/v1.1',
    source: orgCreds ? 'organization' : 'platform',
    organizationId: organizationId || null,
  };
}

function isSettingsConfigured(settings) {
  if (!settings) return false;
  const oauth = !!(settings.clientId && settings.clientSecret && settings.refreshToken);
  const zapikey = !!settings.apiKey;
  return oauth || zapikey;
}

function resolveListKeyForPurpose(settings, purpose = 'general') {
  const p = LIST_PURPOSES.includes(purpose) ? purpose : 'general';
  const map = {
    subscribe: settings.listKeySubscribe,
    job_alerts: settings.listKeyJobAlerts,
    nurture: settings.listKeyNurture,
    general: settings.listKey,
  };
  return (map[p] || settings.listKey || settings.listKeySubscribe || settings.listKeyJobAlerts || settings.listKeyNurture || '').trim();
}

async function persistPurposeListKey(organizationId, purpose, listKey, listName) {
  const MarketingListRegistry = require('../models/MarketingListRegistry');
  await MarketingListRegistry.findOneAndUpdate(
    { scopeKey: scopeKeyFor(organizationId), purpose },
    { $set: { listKey, listName: listName || PURPOSE_LABEL[purpose] || purpose } },
    { upsert: true, new: true }
  );

  // Mirror onto active org IntegrationConfig credentials when present
  if (!organizationId) return;
  try {
    const IntegrationConfig = mongoose.model('IntegrationConfig');
    const config = await IntegrationConfig.findOne({
      organizationId,
      category: 'marketing',
      provider: 'zoho_campaigns',
    });
    if (!config) return;
    const creds = config.getDecryptedCredentials() || {};
    const field = PURPOSE_SETTING_FIELD[purpose];
    if (field) creds[field] = listKey;
    config.credentials = creds;
    await config.save();
  } catch (err) {
    logger.warn({ err: err.message }, '[MarketingList] IntegrationConfig mirror failed');
  }
}

/**
 * Create Zoho private list for purpose if missing; persist key; return listKey.
 */
async function ensurePurposeListKey(organizationId, purpose, settings) {
  const p = LIST_PURPOSES.includes(purpose) ? purpose : 'general';
  let settingsResolved = settings || (await resolveCampaignsSettings(organizationId));
  let existing = resolveListKeyForPurpose(settingsResolved, p);
  if (existing) return existing;

  if (!isSettingsConfigured(settingsResolved)) {
    const err = new Error('Zoho Campaigns OAuth/API is not configured — cannot auto-create lists');
    err.code = 'CAMPAIGNS_NOT_CONFIGURED';
    throw err;
  }

  const lockKey = `${scopeKeyFor(organizationId)}:${p}`;
  if (ensureLocks.has(lockKey)) return ensureLocks.get(lockKey);

  const work = (async () => {
    // Re-check after lock
    settingsResolved = await resolveCampaignsSettings(organizationId);
    existing = resolveListKeyForPurpose(settingsResolved, p);
    if (existing) return existing;

    const seedEmail =
      settingsResolved.fromEmail ||
      process.env.ZOHO_CAMPAIGNS_FROM_EMAIL ||
      process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL ||
      'noreply@skillnixrecruitment.com';
    const listName = `${PURPOSE_LABEL[p] || 'ATS'} ${new Date().toISOString().slice(0, 10)}`;

    const { campaignsRequest } = require('./campaignService');
    const createRes = await campaignsRequest(
      'POST',
      'addlistandcontacts',
      new URLSearchParams({
        resfmt: 'JSON',
        listname: listName,
        signupform: 'public',
        mode: 'newlist',
        listdescription: `Auto-created ATS ${p} marketing list (signup form enabled for re-opt-in)`,
        emailids: String(seedEmail).trim().toLowerCase(),
      }).toString(),
      settingsResolved
    );

    const code = String(createRes?.code ?? '');
    let listKey = String(createRes?.listkey || createRes?.listKey || '').trim();
    if (!listKey && code !== '0' && code !== '200') {
      // Duplicate name — try find by name prefix via getmailinglists
      const lists = await campaignsRequest(
        'GET',
        'getmailinglists',
        { resfmt: 'JSON', sort: 'desc', fromindex: 1, range: 50 },
        settingsResolved
      );
      const arr = lists?.list_of_details || lists?.lists || [];
      const prefix = (PURPOSE_LABEL[p] || 'ATS').toLowerCase();
      for (const item of arr) {
        const n = String(item.listname || item.name || '').toLowerCase();
        const k = String(item.listkey || item.listKey || '').trim();
        if (k && n.includes(prefix)) {
          listKey = k;
          break;
        }
      }
    }

    if (!listKey) {
      const err = new Error(`Failed to auto-create Zoho list for purpose "${p}": ${JSON.stringify(createRes)}`);
      err.code = 'CAMPAIGNS_API';
      throw err;
    }

    await persistPurposeListKey(organizationId, p, listKey, listName);
    logger.info({ purpose: p, listName, listKeyPrefix: listKey.slice(0, 10) }, '[MarketingList] auto-created Zoho list');

    // Update in-memory settings object for callers
    const field = PURPOSE_SETTING_FIELD[p];
    if (field && settings) settings[field] = listKey;
    return listKey;
  })();

  ensureLocks.set(lockKey, work);
  try {
    return await work;
  } finally {
    ensureLocks.delete(lockKey);
  }
}

function allConfiguredListKeys(settings) {
  return [
    ...new Set(
      [
        settings.listKey,
        settings.listKeySubscribe,
        settings.listKeyJobAlerts,
        settings.listKeyNurture,
      ]
        .map((k) => String(k || '').trim())
        .filter(Boolean)
    ),
  ];
}

function inferListPurpose({ templateName = '', category = '', subject = '', explicit } = {}) {
  if (explicit && LIST_PURPOSES.includes(explicit)) return explicit;
  const blob = `${templateName} ${category} ${subject}`.toLowerCase();
  if (/subscribe|re-engagement|stay in touch/.test(blob)) return 'subscribe';
  if (/talent\s*pool|nurture|spotlight/.test(blob)) return 'nurture';
  if (/job|opening|hiring|position|role|vacanc|recruit|drive|alert/.test(blob)) return 'job_alerts';
  return 'general';
}

async function recordMarketingConsent({
  organizationId,
  email,
  optedIn,
  source = 'api',
  listKey = '',
  topicId = '',
  purpose = 'general',
  zohoEnrolled,
}) {
  if (!organizationId || !email) return null;
  const Candidate = mongoose.model('Candidate');
  const emailNorm = String(email).trim().toLowerCase();
  const now = new Date();
  const purposeKey = LIST_PURPOSES.includes(purpose) ? purpose : 'general';
  const update = {
    'marketingConsent.optedIn': !!optedIn,
    'marketingConsent.source': source,
    'marketingConsent.updatedAt': now,
    [`marketingConsent.lists.${purposeKey}`]: !!optedIn,
  };
  if (listKey) update['marketingConsent.listKey'] = listKey;
  if (topicId) update['marketingConsent.topicId'] = topicId;
  if (zohoEnrolled !== undefined) {
    update['marketingConsent.zohoEnrolled'] = !!zohoEnrolled;
  }
  if (optedIn) {
    update['marketingConsent.optedInAt'] = now;
    update['marketingConsent.optedOutAt'] = null;
  } else {
    update['marketingConsent.optedOutAt'] = now;
    update['marketingConsent.zohoEnrolled'] = false;
  }

  return Candidate.findOneAndUpdate(
    { organizationId, email: emailNorm },
    { $set: update },
    { new: true }
  ).select('email marketingConsent name');
}

async function enrollInMarketingList({
  organizationId,
  email,
  firstName = '',
  lastName = '',
  source = 'api',
  purpose = 'general',
  skipIfOptedOut = false,
  recordConsent = true,
} = {}) {
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes('@')) {
    const err = new Error('Valid email required for marketing enrollment');
    err.code = 'MARKETING_EMAIL';
    throw err;
  }

  if (organizationId && skipIfOptedOut) {
    const Candidate = mongoose.model('Candidate');
    const existing = await Candidate.findOne({ organizationId, email: emailNorm })
      .select('marketingConsent')
      .lean();
    if (existing?.marketingConsent?.optedIn === false && existing?.marketingConsent?.optedOutAt) {
      logger.info({ email: emailNorm }, '[MarketingList] skip enroll — previously opted out');
      return { skipped: true, reason: 'opted_out' };
    }
  }

  const settings = await resolveCampaignsSettings(organizationId);
  if (!isSettingsConfigured(settings)) {
    const err = new Error('Marketing list is not configured');
    err.code = 'CAMPAIGNS_NOT_CONFIGURED';
    throw err;
  }

  const listPurpose = LIST_PURPOSES.includes(purpose) ? purpose : 'general';
  const mustRecordConsent =
    recordConsent ||
    source === 'subscribe' ||
    source === 'subscribe_confirm';

  let listKey = '';
  try {
    listKey = await ensurePurposeListKey(organizationId, listPurpose, settings);
  } catch (err) {
    if (!mustRecordConsent) throw err;
    logger.warn(
      { purpose: listPurpose, err: err.message },
      '[MarketingList] list ensure failed — subscribe soft path'
    );
  }

  const { addContact } = require('./campaignService');
  let zohoEnrolled = false;
  let zohoPending = false;
  let zohoError = '';
  if (listKey) {
    try {
      const res = await addContact(listKey, emailNorm, firstName, lastName, settings.topicId, settings);
      zohoEnrolled = true;
      zohoPending = Boolean(res?.pendingConfirm);
    } catch (err) {
      zohoError = err.message || 'Zoho listsubscribe failed';
      // Retry without topic_id — some orgs reject unknown/mismatched topics
      try {
        const res2 = await addContact(listKey, emailNorm, firstName, lastName, '', {
          ...settings,
          topicId: '',
        });
        zohoEnrolled = true;
        zohoPending = Boolean(res2?.pendingConfirm);
        zohoError = '';
      } catch (err2) {
        zohoError = err2.message || zohoError;
        // Soft-ok: already on list / pending confirmation
        if (/already|exist|subscribed|duplicate|confirmation|pending/i.test(zohoError)) {
          zohoEnrolled = true;
          zohoPending = /confirmation|pending/i.test(zohoError);
          zohoError = '';
        } else {
          if (err2.zohoBlocked === 'donotmail' || /do-?not-?mail|2006/i.test(zohoError)) {
            zohoError = zohoError.includes('2006')
              ? zohoError
              : `Zoho listsubscribe failed (2006): Contact belongs to Do-not-mail registry.`;
          }
          logger.warn(
            { email: emailNorm, err: zohoError },
            '[MarketingList] Zoho enroll failed — will still record ATS consent when requested'
          );
        }
      }
    }
  }

  let candidate = null;
  // For explicit subscribe actions, always record ATS consent even if Zoho is flaky —
  // otherwise Campaign stays blocked and the user sees a dead-end error page.
  if (mustRecordConsent) {
    try {
      candidate = await recordMarketingConsent({
        organizationId,
        email: emailNorm,
        optedIn: true,
        source,
        listKey,
        topicId: settings.topicId,
        purpose: listPurpose,
        zohoEnrolled,
      });
    } catch (err) {
      logger.warn({ err: err.message }, '[MarketingList] consent record failed');
    }
  }

  if (!zohoEnrolled && !mustRecordConsent) {
    const err = new Error(zohoError || 'Marketing list enrollment failed');
    err.code = 'CAMPAIGNS_API';
    throw err;
  }

  // Explicit subscribe: never dead-end the user on Zoho flakiness.
  // Consent on the candidate (when found) is enough; otherwise still return success
  // so the thank-you page is not error=failed — ops can reconcile Zoho from logs.
  if (!zohoEnrolled && mustRecordConsent) {
    logger.warn(
      {
        email: emailNorm,
        organizationId: organizationId || null,
        hasCandidate: !!candidate,
        err: zohoError || 'no list key',
      },
      '[MarketingList] subscribe soft-ok without Zoho enroll'
    );
  }

  logger.info(
    {
      email: emailNorm,
      purpose: listPurpose,
      listKeyPrefix: listKey ? listKey.slice(0, 8) : '',
      config: settings.source,
      recordConsent: !!mustRecordConsent,
      zohoEnrolled,
      zohoPending,
    },
    '[MarketingList] enrolled'
  );

  return {
    enrolled: true,
    purpose: listPurpose,
    listKey,
    topicId: settings.topicId,
    configSource: settings.source,
    candidateId: candidate?._id || null,
    recordConsent: !!mustRecordConsent,
    zohoEnrolled,
    zohoPending,
    zohoBlocked: !zohoEnrolled && /do-?not-?mail|2006/i.test(zohoError) ? 'donotmail' : null,
    zohoError: zohoEnrolled ? '' : zohoError,
    signupFormUrl: String(settings.signupFormUrl || '').trim() || '',
  };
}

async function unenrollFromMarketingList({
  organizationId,
  email,
  source = 'unsubscribe',
  purpose = null,
} = {}) {
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes('@')) {
    const err = new Error('Valid email required');
    err.code = 'MARKETING_EMAIL';
    throw err;
  }

  const settings = await resolveCampaignsSettings(organizationId);
  const keys = purpose
    ? [resolveListKeyForPurpose(settings, purpose)].filter(Boolean)
    : allConfiguredListKeys(settings);

  if (!keys.length) {
    const err = new Error('Marketing list is not configured');
    err.code = 'CAMPAIGNS_NOT_CONFIGURED';
    throw err;
  }

  const { removeContact } = require('./campaignService');
  for (const listKey of keys) {
    try {
      await removeContact(listKey, emailNorm, settings);
    } catch (err) {
      logger.warn({ listKey: listKey.slice(0, 8), err: err.message }, '[MarketingList] unenroll list failed');
    }
  }

  try {
    await recordMarketingConsent({
      organizationId,
      email: emailNorm,
      optedIn: false,
      source,
      listKey: keys[0] || '',
      topicId: settings.topicId,
      purpose: purpose || 'general',
    });
    if (!purpose) {
      const Candidate = mongoose.model('Candidate');
      await Candidate.updateOne(
        { organizationId, email: emailNorm },
        {
          $set: {
            'marketingConsent.lists.subscribe': false,
            'marketingConsent.lists.job_alerts': false,
            'marketingConsent.lists.nurture': false,
            'marketingConsent.lists.general': false,
          },
        }
      );
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[MarketingList] opt-out consent record failed');
  }

  return { unenrolled: true, listKeys: keys, configSource: settings.source };
}

async function enrollCandidatesAfterTalentPool(organizationId, candidateIds = []) {
  if (!organizationId || !candidateIds.length) return { attempted: 0, enrolled: 0 };
  const settings = await resolveCampaignsSettings(organizationId);
  if (!isSettingsConfigured(settings)) return { attempted: 0, enrolled: 0, skipped: 'not_configured' };

  const Candidate = mongoose.model('Candidate');
  const rows = await Candidate.find({
    _id: { $in: candidateIds },
    organizationId,
  })
    .select('email name marketingConsent')
    .lean();

  let enrolled = 0;
  for (const c of rows) {
    if (!c.email) continue;
    if (c.marketingConsent?.optedIn === false && c.marketingConsent?.optedOutAt) continue;
    try {
      const parts = String(c.name || '').trim().split(/\s+/);
      await enrollInMarketingList({
        organizationId,
        email: c.email,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        source: 'talent_pool',
        purpose: 'nurture',
        skipIfOptedOut: true,
      });
      enrolled += 1;
    } catch (err) {
      logger.warn({ email: c.email, err: err.message }, '[MarketingList] talent pool enroll failed');
    }
  }
  return { attempted: rows.length, enrolled };
}

module.exports = {
  LIST_PURPOSES,
  resolveCampaignsSettings,
  isSettingsConfigured,
  resolveListKeyForPurpose,
  ensurePurposeListKey,
  inferListPurpose,
  recordMarketingConsent,
  enrollInMarketingList,
  unenrollFromMarketingList,
  enrollCandidatesAfterTalentPool,
  getOrgMarketingCredentials,
};
