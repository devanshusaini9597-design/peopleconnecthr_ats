/**
 * Enterprise email reporting — ledger + sync from Zoho Campaigns / ZeptoMail.
 */
const axios = require('axios');
const mongoose = require('mongoose');
const EmailSendLog = require('../models/EmailSendLog');
const logger = require('../utils/logger');

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pct = (part, whole) => {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
};

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function recipientList(to, names = {}) {
  const list = Array.isArray(to) ? to : [to];
  return list
    .map((e) => normalizeEmail(e))
    .filter((e) => e.includes('@'))
    .map((email) => ({
      email,
      name: names[email] || '',
      status: 'sent',
      sentAt: new Date(),
      openCount: 0,
      clickCount: 0,
      clickUrls: [],
    }));
}

function recomputeTotals(doc) {
  const recipients = doc.recipients || [];
  const totals = {
    sent: recipients.length,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    softBounced: 0,
    hardBounced: 0,
    unsubscribed: 0,
    spam: 0,
    failed: 0,
    replied: 0,
    unopened: 0,
  };

  for (const r of recipients) {
    const s = r.status;
    if (s === 'delivered' || s === 'opened' || s === 'clicked' || s === 'replied') totals.delivered += 1;
    if (s === 'opened' || s === 'clicked' || s === 'replied') totals.opened += 1;
    if (s === 'clicked') totals.clicked += 1;
    if (s === 'soft_bounced') {
      totals.softBounced += 1;
      totals.bounced += 1;
    }
    if (s === 'hard_bounced') {
      totals.hardBounced += 1;
      totals.bounced += 1;
    }
    if (s === 'failed') totals.failed += 1;
    if (s === 'unsubscribed') totals.unsubscribed += 1;
    if (s === 'spam') totals.spam += 1;
    if (s === 'replied') totals.replied += 1;
    if (s === 'sent' || s === 'unopened' || s === 'queued') totals.unopened += 1;
  }

  const base = totals.delivered || totals.sent || 0;
  doc.totals = totals;
  doc.rates = {
    deliveryRate: pct(totals.delivered, totals.sent),
    openRate: pct(totals.opened, base || totals.sent),
    clickRate: pct(totals.clicked, base || totals.sent),
    bounceRate: pct(totals.bounced, totals.sent),
    unsubscribeRate: pct(totals.unsubscribed, totals.sent),
  };

  if (totals.failed && !totals.delivered && !totals.opened) doc.status = 'failed';
  else if (totals.bounced && totals.delivered === 0) doc.status = 'bounced';
  else if (totals.opened || totals.clicked || totals.delivered) doc.status = 'completed';
  else doc.status = doc.status === 'failed' ? 'failed' : 'sent';

  return doc;
}

/**
 * Persist a send (never throws to callers — logging only).
 */
async function recordEmailSend(payload = {}) {
  try {
    const recipients = Array.isArray(payload.recipients)
      ? payload.recipients.map((r) => ({
          email: normalizeEmail(r.email || r),
          name: r.name || '',
          status: r.status || 'sent',
          sentAt: r.sentAt || new Date(),
          openCount: 0,
          clickCount: 0,
          clickUrls: [],
        }))
      : recipientList(payload.to, payload.recipientNames || {});

    if (!recipients.length && !payload.campaignKey) return null;

    const doc = new EmailSendLog({
      organizationId: payload.organizationId || null,
      sentByUserId: payload.userId || null,
      channel: payload.channel || 'transactional',
      provider: payload.provider || 'unknown',
      emailType: payload.emailType || '',
      subject: payload.subject || '',
      fromEmail: payload.fromEmail || '',
      replyToEmail: payload.replyToEmail || '',
      campaignName: payload.campaignName || '',
      campaignKey: payload.campaignKey || '',
      messageId: payload.messageId || '',
      requestId: payload.requestId || '',
      emailReference: payload.emailReference || '',
      clientReference: payload.clientReference || '',
      status: payload.status || 'accepted',
      recipients,
      providerRaw: payload.providerRaw || null,
      lastError: payload.lastError || '',
      sentAt: payload.sentAt || new Date(),
    });
    recomputeTotals(doc);
    await doc.save();
    return doc;
  } catch (err) {
    logger.warn({ err: err.message }, '[emailReports] recordEmailSend failed');
    return null;
  }
}

function applyCampaignReportMetrics(doc, reportBlock = {}, details = {}) {
  const flat = Array.isArray(reportBlock) ? reportBlock[0] : reportBlock;
  if (!flat || typeof flat !== 'object') return;

  const get = (k) => flat[k] ?? flat[`fl_${k}`];

  const emailsSent = num(get('emails_sent_count'));
  const delivered = num(get('delivered_count'));
  const opens = num(get('opens_count'));
  const uniqueClicks = num(get('unique_clicks_count'));
  const soft = num(get('softbounce_count'));
  const hard = num(get('hardbounce_count'));
  const bounces = num(get('bounces_count')) || soft + hard;
  const unsub = num(get('unsub_count'));
  const spam = num(get('spams_count'));
  const unopened = num(get('unopened'));
  const forwards = num(get('forwards_count'));
  const autoreply = num(get('autoreply_count'));

  doc.totals = {
    sent: emailsSent || doc.recipients.length,
    delivered,
    opened: opens,
    clicked: uniqueClicks,
    bounced: bounces,
    softBounced: soft,
    hardBounced: hard,
    unsubscribed: unsub,
    spam,
    failed: num(get('unsent_count')),
    replied: autoreply,
    unopened,
  };
  doc.rates = {
    deliveryRate: num(get('delivered_percent')) || pct(delivered, emailsSent),
    openRate: num(get('open_percent')) || pct(opens, delivered || emailsSent),
    clickRate: num(get('unique_clicked_percent')) || pct(uniqueClicks, delivered || emailsSent),
    bounceRate: num(get('bounce_percent')) || pct(bounces, emailsSent),
    unsubscribeRate: num(get('unsubscribe_percent')) || pct(unsub, emailsSent),
  };

  if (details.email_subject) doc.subject = details.email_subject;
  if (details.campaign_name) doc.campaignName = details.campaign_name;
  if (details.email_from) doc.fromEmail = details.email_from;
  if (details.reply_to) doc.replyToEmail = details.reply_to;
  if (details.sent_time) {
    const parsed = new Date(details.sent_time);
    if (!Number.isNaN(parsed.getTime())) doc.sentAt = parsed;
  }

  doc.providerRaw = {
    ...(doc.providerRaw && typeof doc.providerRaw === 'object' ? doc.providerRaw : {}),
    campaignReports: flat,
    campaignDetails: details,
    forwards,
    autoreply,
  };
  doc.status = 'completed';
}

async function fetchRecipientBucket(campaignKey, action, settings) {
  const { campaignsRequest } = require('./campaignService');
  const rows = [];
  let fromindex = 1;
  const range = 200;
  for (let page = 0; page < 25; page += 1) {
    const res = await campaignsRequest(
      'GET',
      'getcampaignrecipientsdata',
      {
        resfmt: 'JSON',
        campaignkey: String(campaignKey),
        action,
        fromindex,
        range,
      },
      settings
    );
    const list = res?.list_of_details || res?.contacts || [];
    if (!Array.isArray(list) || !list.length) break;
    rows.push(...list);
    if (list.length < range) break;
    fromindex += range;
  }
  return rows;
}

function upsertRecipient(map, email, patch) {
  const key = normalizeEmail(email);
  if (!key.includes('@')) return;
  const existing = map.get(key) || {
    email: key,
    name: '',
    status: 'sent',
    sentAt: null,
    openCount: 0,
    clickCount: 0,
    clickUrls: [],
  };
  const rank = {
    queued: 0,
    sent: 1,
    unopened: 1,
    delivered: 2,
    opened: 3,
    clicked: 4,
    replied: 5,
    soft_bounced: 6,
    hard_bounced: 7,
    failed: 8,
    unsubscribed: 9,
    spam: 10,
  };
  const nextStatus = patch.status || existing.status;
  if ((rank[nextStatus] ?? 0) >= (rank[existing.status] ?? 0)) {
    Object.assign(existing, patch, { email: key, status: nextStatus });
  } else {
    Object.assign(existing, { ...patch, status: existing.status, email: key });
  }
  if (patch.name) existing.name = patch.name;
  map.set(key, existing);
}

async function syncCampaignRecipients(doc, campaignKey, settings) {
  const map = new Map();
  (doc.recipients || []).forEach((r) => map.set(normalizeEmail(r.email), { ...r.toObject?.() || r }));

  const buckets = [
    ['sentcontacts', { status: 'sent' }],
    ['openedcontacts', { status: 'opened' }],
    ['clickedcontacts', { status: 'clicked' }],
    ['unopenedcontacts', { status: 'unopened' }],
    ['sentsoftbounce', { status: 'soft_bounced', bounceType: 'soft' }],
    ['senthardbounce', { status: 'hard_bounced', bounceType: 'hard' }],
    ['optoutcontacts', { status: 'unsubscribed' }],
    ['spamcontacts', { status: 'spam' }],
    ['unsentcontacts', { status: 'failed' }],
  ];

  for (const [action, patchBase] of buckets) {
    try {
      const rows = await fetchRecipientBucket(campaignKey, action, settings);
      for (const row of rows) {
        const email = row.contactemailaddress || row.contact_email || row.email;
        const sentMs = num(row.sent_time);
        upsertRecipient(map, email, {
          ...patchBase,
          name: [row.firstname, row.lastname].filter(Boolean).join(' ') || row.first_name || '',
          providerContactId: String(row.contactid || row.contact_id || ''),
          sentAt: sentMs ? new Date(sentMs) : row.sentdate ? new Date(row.sentdate) : undefined,
          openedAt: patchBase.status === 'opened' || patchBase.status === 'clicked' ? new Date() : undefined,
          clickedAt: patchBase.status === 'clicked' ? new Date() : undefined,
          bouncedAt:
            patchBase.status === 'soft_bounced' || patchBase.status === 'hard_bounced'
              ? new Date()
              : undefined,
          unsubscribedAt: patchBase.status === 'unsubscribed' ? new Date() : undefined,
          openCount:
            patchBase.status === 'opened' || patchBase.status === 'clicked'
              ? Math.max(1, num(row.open_count) || 1)
              : undefined,
          clickCount: patchBase.status === 'clicked' ? Math.max(1, num(row.click_count) || 1) : undefined,
        });
      }
    } catch (err) {
      logger.warn({ err: err.message, action, campaignKey }, '[emailReports] recipient bucket failed');
    }
  }

  doc.recipients = Array.from(map.values());
}

async function detectReplies(doc) {
  if (!doc.organizationId || !doc.recipients?.length) return;
  try {
    const Message = mongoose.model('Message');
    const emails = doc.recipients.map((r) => r.email);
    const since = new Date((doc.sentAt || doc.createdAt || Date.now()) - 60 * 1000);
    const inbound = await Message.find({
      organizationId: doc.organizationId,
      channel: 'email',
      direction: 'inbound',
      createdAt: { $gte: since },
      fromAddress: { $in: emails },
    })
      .select('fromAddress createdAt subject')
      .lean()
      .limit(200);

    if (!inbound.length) return;

    const byEmail = new Map();
    for (const m of inbound) {
      const from = normalizeEmail(m.fromAddress);
      if (!from) continue;
      const prev = byEmail.get(from);
      if (!prev || new Date(m.createdAt) < new Date(prev)) byEmail.set(from, m.createdAt);
    }

    let changed = false;
    doc.recipients = doc.recipients.map((r) => {
      const hit = byEmail.get(normalizeEmail(r.email));
      if (!hit) return r;
      changed = true;
      return {
        ...(r.toObject?.() || r),
        status: 'replied',
        repliedAt: new Date(hit),
      };
    });
    if (changed) recomputeTotals(doc);
  } catch (_) {
    /* Message model may be unavailable — ignore */
  }
}

async function syncZohoCampaign(doc, settings = null) {
  const { campaignsRequest, resolveCampaignsSettings } = (() => {
    const campaignService = require('./campaignService');
    let resolve = null;
    try {
      resolve = require('./marketingListService').resolveCampaignsSettings;
    } catch (_) {}
    return { ...campaignService, resolveCampaignsSettings: resolve };
  })();

  let cfg = settings;
  if (!cfg && doc.organizationId && typeof resolveCampaignsSettings === 'function') {
    try {
      cfg = await resolveCampaignsSettings(doc.organizationId);
    } catch (_) {}
  }

  const campaignKey = doc.campaignKey;
  if (!campaignKey) throw new Error('Missing campaignKey');

  const reportRes = await campaignsRequest(
    'GET',
    'campaignreports',
    { resfmt: 'JSON', campaignkey: String(campaignKey) },
    cfg
  );

  const reportBlock = reportRes?.['campaign-reports'] || reportRes?.campaign_reports || reportRes?.reports;
  const detailsArr = reportRes?.['campaign-details'] || reportRes?.campaign_details || [];
  const details = Array.isArray(detailsArr) ? detailsArr[0] : detailsArr || {};
  applyCampaignReportMetrics(doc, reportBlock, details);

  await syncCampaignRecipients(doc, campaignKey, cfg);
  // Prefer recipient-derived totals when we have them
  if (doc.recipients?.length) recomputeTotals(doc);
  await detectReplies(doc);

  doc.lastSyncedAt = new Date();
  doc.syncSource = 'zoho_campaigns';
  await doc.save();
  return doc;
}

function zeptoAuthAndBase() {
  const apiKey = (
    process.env.ZOHO_ZEPTOMAIL_API_KEY ||
    process.env.ZEPTOMAIL_API_KEY ||
    ''
  ).trim();
  const apiUrl = (
    process.env.ZOHO_ZEPTOMAIL_API_URL ||
    process.env.ZEPTOMAIL_API_URL ||
    'https://api.zeptomail.in/'
  ).replace(/\/?$/, '/');
  if (!apiKey) return null;
  const auth = apiKey.toLowerCase().startsWith('zoho-enczapikey')
    ? apiKey
    : `Zoho-enczapikey ${apiKey}`;
  return { auth, apiUrl };
}

function formatZeptoDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  // DD/MM/YYYY, hh:mm AM/PM
  const pad = (n) => String(n).padStart(2, '0');
  let h = date.getHours();
  const m = pad(date.getMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(h)}:${m} ${ampm}`;
}

async function fetchZeptoLogs(params = {}) {
  const cfg = zeptoAuthAndBase();
  if (!cfg) throw new Error('ZEPTOMAIL_NOT_CONFIGURED');

  const agentKey =
    process.env.ZEPTOMAIL_MAILAGENT_KEY ||
    process.env.ZOHO_ZEPTOMAIL_MAILAGENT_KEY ||
    process.env.ZEPTOMAIL_AGENT_ALIAS ||
    '';

  const query = { ...params };
  if (agentKey && !query.mailagent_key) query.mailagent_key = agentKey;

  const url = `${cfg.apiUrl}v1.1/email/`;
  const res = await axios.get(url, {
    headers: {
      Authorization: cfg.auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    params: query,
    timeout: 30000,
    validateStatus: () => true,
  });

  if (res.status >= 400) {
    const err = new Error(
      res.data?.error?.message ||
        res.data?.message ||
        `ZeptoMail logs HTTP ${res.status}`
    );
    err.status = res.status;
    err.data = res.data;
    throw err;
  }
  return res.data;
}

function applyZeptoLogToRecipient(r, log) {
  const delivery = log.email_delivery_details || {};
  const tracking = log.email_tracking_details || {};
  const info = log.email_info || {};

  const patch = { ...(r.toObject?.() || r) };
  if (info.email_reference) patch.emailReference = info.email_reference;

  const delivered = delivery.delivered || [];
  const hard = delivery.hardbounce || [];
  const soft = delivery.softbounce || [];
  const fail = delivery.mailfailure || [];

  const matchEvent = (arr) =>
    (arr || []).find((e) => normalizeEmail(e.recipient) === normalizeEmail(patch.email)) || arr?.[0];

  if (matchEvent(hard)) {
    const e = matchEvent(hard);
    patch.status = 'hard_bounced';
    patch.bouncedAt = e.time ? new Date(e.time) : new Date();
    patch.bounceType = 'hard';
    patch.bounceReason = e.reason || e.category || '';
  } else if (matchEvent(soft)) {
    const e = matchEvent(soft);
    patch.status = 'soft_bounced';
    patch.bouncedAt = e.time ? new Date(e.time) : new Date();
    patch.bounceType = 'soft';
    patch.bounceReason = e.reason || e.category || '';
  } else if (matchEvent(fail)) {
    const e = matchEvent(fail);
    patch.status = 'failed';
    patch.bounceReason = e.reason || e.category || '';
  } else if (matchEvent(delivered)) {
    const e = matchEvent(delivered);
    patch.status = 'delivered';
    patch.deliveredAt = e.time ? new Date(e.time) : new Date();
  }

  const open = tracking.email_open;
  if (open?.event_count) {
    patch.openCount = num(open.event_count);
    const first = open.details?.[0];
    patch.openedAt = first?.first_event_time || first?.time
      ? new Date(first.first_event_time || first.time)
      : new Date();
    if (patch.status === 'delivered' || patch.status === 'sent') patch.status = 'opened';
  }

  const click = tracking.email_link_click;
  if (click?.event_count) {
    patch.clickCount = num(click.event_count);
    const first = click.details?.[0];
    patch.clickedAt = first?.first_event_time || first?.time
      ? new Date(first.first_event_time || first.time)
      : new Date();
    patch.clickUrls = (click.details || [])
      .map((d) => d.click_url || d.url)
      .filter(Boolean);
    patch.status = 'clicked';
  }

  return patch;
}

async function syncZeptoMail(doc) {
  const from = new Date(doc.sentAt || doc.createdAt || Date.now());
  from.setHours(from.getHours() - 1);
  const to = new Date(doc.sentAt || doc.createdAt || Date.now());
  to.setDate(to.getDate() + 14);

  let logs = [];
  const tries = [];
  if (doc.clientReference) tries.push({ client_reference: doc.clientReference });
  if (doc.requestId) tries.push({ request_id: doc.requestId });
  if (doc.recipients?.[0]?.email) {
    tries.push({
      to: doc.recipients[0].email,
      date_from: formatZeptoDate(from),
      date_to: formatZeptoDate(to),
      limit: 50,
      offset: 0,
    });
  }

  let lastErr = null;
  for (const params of tries) {
    try {
      const data = await fetchZeptoLogs(params);
      const batch = data?.data?.logs || data?.logs || [];
      if (batch.length) {
        logs = batch;
        break;
      }
    } catch (err) {
      lastErr = err;
      logger.warn({ err: err.message, params }, '[emailReports] Zepto logs query failed');
    }
  }

  if (!logs.length) {
    if (lastErr) {
      doc.lastError = lastErr.message;
      doc.syncSource = 'zeptomail_error';
    } else {
      doc.syncSource = 'zeptomail_empty';
    }
    doc.lastSyncedAt = new Date();
    await doc.save();
    return doc;
  }

  // Prefer log matching messageId / client_reference
  const matchLog =
    logs.find((l) => {
      const info = l.email_info || {};
      return (
        (doc.messageId && String(info.message_id || '').includes(String(doc.messageId).replace(/[<>]/g, ''))) ||
        (doc.clientReference && String(l.request_id || '').includes(doc.clientReference)) ||
        (doc.emailReference && info.email_reference === doc.emailReference)
      );
    }) || logs[0];

  const info = matchLog.email_info || {};
  if (info.email_reference) doc.emailReference = info.email_reference;
  if (info.message_id) doc.messageId = info.message_id;
  if (matchLog.request_id) doc.requestId = matchLog.request_id;

  doc.recipients = (doc.recipients || []).map((r) => applyZeptoLogToRecipient(r, matchLog));
  if (!doc.recipients.length && info.to?.[0]?.address) {
    doc.recipients = [
      applyZeptoLogToRecipient(
        { email: info.to[0].address, status: 'sent', openCount: 0, clickCount: 0, clickUrls: [] },
        matchLog
      ),
    ];
  }

  recomputeTotals(doc);
  await detectReplies(doc);
  doc.providerRaw = {
    ...(doc.providerRaw && typeof doc.providerRaw === 'object' ? doc.providerRaw : {}),
    zeptoLog: matchLog,
  };
  doc.lastSyncedAt = new Date();
  doc.syncSource = 'zeptomail';
  doc.lastError = '';
  await doc.save();
  return doc;
}

async function syncEmailSend(id, organizationId) {
  const doc = await EmailSendLog.findOne({ _id: id, organizationId });
  if (!doc) {
    const err = new Error('Email send not found');
    err.statusCode = 404;
    throw err;
  }

  if (doc.provider === 'zoho_campaigns' || doc.campaignKey) {
    return syncZohoCampaign(doc);
  }
  if (doc.provider === 'zeptomail' || doc.provider === 'smtp') {
    return syncZeptoMail(doc);
  }
  doc.lastSyncedAt = new Date();
  await doc.save();
  return doc;
}

async function syncRecentCampaigns(organizationId, { limit = 20 } = {}) {
  const { campaignsRequest } = require('./campaignService');
  let settings = null;
  try {
    settings = await require('./marketingListService').resolveCampaignsSettings(organizationId);
  } catch (_) {}

  const res = await campaignsRequest(
    'GET',
    'recentcampaigns',
    { resfmt: 'JSON', limit: String(limit), sortorder: 'desc' },
    settings
  );

  const rows =
    res?.recent_campaigns ||
    res?.['recent-campaigns'] ||
    res?.campaigns ||
    res?.list_of_details ||
    [];
  const list = Array.isArray(rows) ? rows : [];
  let imported = 0;
  let synced = 0;

  for (const row of list) {
    const campaignKey = String(row.campaign_key || row.campaignKey || row.campaignkey || '').trim();
    if (!campaignKey) continue;

    let doc = await EmailSendLog.findOne({ organizationId, campaignKey });
    if (!doc) {
      doc = await recordEmailSend({
        organizationId,
        channel: 'marketing',
        provider: 'zoho_campaigns',
        emailType: 'campaign',
        subject: row.email_subject || row.subject || '',
        campaignName: row.campaign_name || row.name || '',
        campaignKey,
        fromEmail: row.email_from || row.from || '',
        status: 'sent',
        recipients: [],
        providerRaw: { recent: row },
        sentAt: row.sent_time ? new Date(row.sent_time) : new Date(),
      });
      imported += 1;
    }
    if (doc) {
      try {
        await syncZohoCampaign(doc, settings);
        synced += 1;
      } catch (err) {
        logger.warn({ err: err.message, campaignKey }, '[emailReports] sync recent campaign failed');
      }
    }
  }

  return { imported, synced, total: list.length };
}

async function listEmailReports(organizationId, query = {}) {
  const {
    channel,
    provider,
    status,
    search,
    page = 1,
    limit = 25,
    from,
    to,
  } = query;

  const filter = { organizationId };
  if (channel && channel !== 'all') filter.channel = channel;
  if (provider && provider !== 'all') filter.provider = provider;
  if (status && status !== 'all') filter.status = status;
  if (from || to) {
    filter.sentAt = {};
    if (from) filter.sentAt.$gte = new Date(from);
    if (to) filter.sentAt.$lte = new Date(to);
  }
  if (search) {
    const q = String(search).trim();
    filter.$or = [
      { subject: new RegExp(q, 'i') },
      { campaignName: new RegExp(q, 'i') },
      { fromEmail: new RegExp(q, 'i') },
      { campaignKey: q },
      { messageId: new RegExp(q, 'i') },
      { 'recipients.email': new RegExp(q, 'i') },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const lim = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * lim;

  const [items, total] = await Promise.all([
    EmailSendLog.find(filter)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('sentByUserId', 'name email')
      .lean(),
    EmailSendLog.countDocuments(filter),
  ]);

  let summary = {
    sends: 0,
    recipients: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    replied: 0,
    failed: 0,
  };

  try {
    const orgOid = mongoose.Types.ObjectId.isValid(String(organizationId))
      ? new mongoose.Types.ObjectId(String(organizationId))
      : null;
    if (orgOid) {
      const aggregate = await EmailSendLog.aggregate([
        { $match: { organizationId: orgOid } },
        {
          $group: {
            _id: null,
            sends: { $sum: 1 },
            recipients: { $sum: { $ifNull: ['$totals.sent', 0] } },
            delivered: { $sum: { $ifNull: ['$totals.delivered', 0] } },
            opened: { $sum: { $ifNull: ['$totals.opened', 0] } },
            clicked: { $sum: { $ifNull: ['$totals.clicked', 0] } },
            bounced: { $sum: { $ifNull: ['$totals.bounced', 0] } },
            replied: { $sum: { $ifNull: ['$totals.replied', 0] } },
            failed: { $sum: { $ifNull: ['$totals.failed', 0] } },
          },
        },
      ]);
      if (aggregate[0]) {
        summary = { ...summary, ...aggregate[0] };
        delete summary._id;
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[emailReports] summary aggregate failed');
  }

  summary.openRate = pct(summary.opened, summary.delivered || summary.recipients);
  summary.clickRate = pct(summary.clicked, summary.delivered || summary.recipients);
  summary.bounceRate = pct(summary.bounced, summary.recipients);

  return {
    items,
    pagination: { page: pageNum, limit: lim, total, pages: Math.ceil(total / lim) || 1 },
    summary,
  };
}

async function getEmailReportDetail(id, organizationId) {
  const doc = await EmailSendLog.findOne({ _id: id, organizationId })
    .populate('sentByUserId', 'name email')
    .lean();
  if (!doc) {
    const err = new Error('Email send not found');
    err.statusCode = 404;
    throw err;
  }
  return doc;
}

async function syncStaleReports(organizationId, { max = 15 } = {}) {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const stale = await EmailSendLog.find({
    organizationId,
    $or: [{ lastSyncedAt: null }, { lastSyncedAt: { $lt: cutoff } }],
    sentAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  })
    .sort({ sentAt: -1 })
    .limit(max);

  let ok = 0;
  let fail = 0;
  for (const doc of stale) {
    try {
      await syncEmailSend(doc._id, organizationId);
      ok += 1;
    } catch (_) {
      fail += 1;
    }
  }
  return { ok, fail, attempted: stale.length };
}

module.exports = {
  recordEmailSend,
  recomputeTotals,
  listEmailReports,
  getEmailReportDetail,
  syncEmailSend,
  syncRecentCampaigns,
  syncStaleReports,
  fetchZeptoLogs,
};
