/**
 * Enterprise email reporting — ledger + sync from Zoho Campaigns / ZeptoMail.
 */
const axios = require('axios');
const mongoose = require('mongoose');
const EmailSendLog = require('../models/EmailSendLog');
const logger = require('../utils/logger');
const { zonedTimeToUtc } = require('../utils/analyticsTime');

const IST_TZ = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const SENT_AT_TOLERANCE_MS = 4 * 60 * 1000;

/**
 * Zoho sometimes stamps an IST wall-clock as if it were UTC.
 * That shows up ~5.5h ahead of the real send (createdAt). Snap back to createdAt.
 * Historical imports have sentAt well before createdAt, so they are left alone.
 */
function alignSentAt(sentAt, createdAt) {
  const sent = sentAt ? new Date(sentAt) : null;
  const created = createdAt ? new Date(createdAt) : null;
  if (!sent || Number.isNaN(sent.getTime())) {
    return created && !Number.isNaN(created.getTime()) ? created : null;
  }
  if (!created || Number.isNaN(created.getTime())) return sent;
  const delta = sent.getTime() - created.getTime();
  if (delta > 0 && Math.abs(delta - IST_OFFSET_MS) <= SENT_AT_TOLERANCE_MS) return created;
  return sent;
}

function findHtmlString(value, depth = 0) {
  if (depth > 6 || value == null) return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.length > 80 && /<(html|table|div|body|p|td)\b/i.test(s)) return s;
    return '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findHtmlString(item, depth + 1);
      if (hit) return hit;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) {
      const hit = findHtmlString(v, depth + 1);
      if (hit) return hit;
    }
  }
  return '';
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pct = (part, whole) => {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
};

/**
 * Zoho Campaigns often returns wall-clock IST without a timezone.
 * On Railway (UTC), `new Date(str)` wrongly treats that as UTC → times look ~5.5h off in IST UI.
 * Epoch millis / ISO-with-offset are kept as-is.
 */
function parseProviderDate(raw, { assumeIst = true } = {}) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'number' || (/^\d+$/.test(String(raw).trim()) && String(raw).trim().length >= 10)) {
    const ms = Number(raw);
    const d = new Date(ms < 1e12 ? ms * 1000 : ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // Already has explicit offset / Z
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) || s.includes('T') && /[zZ]|[+-]\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (!assumeIst) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Parse common Zoho / en-IN wall-clock forms as Asia/Kolkata
  const cleaned = s
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // DD/MM/YYYY hh:mm[:ss] [AM|PM]
  let m = cleaned.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?)?$/
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    let hour = Number(m[4] || 0);
    const minute = Number(m[5] || 0);
    const second = Number(m[6] || 0);
    const ampm = (m[7] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return zonedTimeToUtc(year, month, day, hour, minute, second, IST_TZ);
  }

  // "24 Sep 2026 05:30 PM" / "Sep 24, 2026 5:30:00 PM"
  m = cleaned.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?)?$/
  );
  if (!m) {
    m = cleaned.match(
      /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?)?$/
    );
    if (m) {
      // swap to day, monthName, year
      m = [m[0], m[2], m[1], m[3], m[4], m[5], m[6], m[7]];
    }
  }
  if (m) {
    const months = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, sept: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
    };
    const day = Number(m[1]);
    const month = months[String(m[2]).toLowerCase()];
    const year = Number(m[3]);
    if (!month || !day || !year) {
      const fallback = new Date(s);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
    let hour = Number(m[4] || 0);
    const minute = Number(m[5] || 0);
    const second = Number(m[6] || 0);
    const ampm = (m[7] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return zonedTimeToUtc(year, month, day, hour, minute, second, IST_TZ);
  }

  // YYYY-MM-DD HH:mm:ss (no zone) → IST
  m = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    return zonedTimeToUtc(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] || 0),
      IST_TZ
    );
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

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
    const opened =
      Boolean(r.openedAt) ||
      num(r.openCount) > 0 ||
      s === 'opened' ||
      s === 'clicked' ||
      s === 'replied';
    const clicked = Boolean(r.clickedAt) || num(r.clickCount) > 0 || s === 'clicked';
    const delivered =
      Boolean(r.deliveredAt) ||
      opened ||
      clicked ||
      s === 'delivered' ||
      s === 'unsubscribed'; // opted out after delivery
    const unsubscribed = Boolean(r.unsubscribedAt) || s === 'unsubscribed';

    if (delivered) totals.delivered += 1;
    if (opened) totals.opened += 1;
    if (clicked) totals.clicked += 1;
    if (s === 'soft_bounced') {
      totals.softBounced += 1;
      totals.bounced += 1;
    }
    if (s === 'hard_bounced') {
      totals.hardBounced += 1;
      totals.bounced += 1;
    }
    if (s === 'failed') totals.failed += 1;
    if (unsubscribed) totals.unsubscribed += 1;
    if (s === 'spam') totals.spam += 1;
    if (s === 'replied' || r.repliedAt) totals.replied += 1;
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

/** Cap Mongo bodies; full HTML lives on S3 mail-archive when configured. */
const MAX_HTML_BODY = 48_000;
const MAX_TEXT_BODY = 8_000;
/** Allow larger remote preview fetches before clipping into Mongo. */
const MAX_PREVIEW_FETCH = 450_000;

function clipBody(value, max) {
  const s = value == null ? '' : String(value);
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}\n<!-- truncated -->` : s;
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

    const fullHtml = payload.htmlBody || payload.html || '';
    const fullText = payload.textBody || payload.text || '';

    const doc = new EmailSendLog({
      organizationId: payload.organizationId || null,
      sentByUserId: payload.userId || null,
      channel: payload.channel || 'transactional',
      provider: payload.provider || 'unknown',
      emailType: payload.emailType || '',
      subject: payload.subject || '',
      htmlBody: clipBody(fullHtml, MAX_HTML_BODY),
      textBody: clipBody(fullText, MAX_TEXT_BODY),
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

    try {
      const { storeOutbound } = require('./emailArchiveService');
      const archived = await storeOutbound({
        organizationId: doc.organizationId,
        sendLogId: doc._id,
        subject: doc.subject,
        html: fullHtml,
        text: fullText,
        from: doc.fromEmail,
        replyTo: doc.replyToEmail,
        recipients: doc.recipients,
        provider: doc.provider,
        channel: doc.channel,
        messageId: doc.messageId,
        emailType: doc.emailType,
        campaignKey: doc.campaignKey,
        sentAt: doc.sentAt,
      });
      if (archived?.archiveKey) {
        doc.archiveKey = archived.archiveKey;
        doc.archiveMetaKey = archived.archiveMetaKey || '';
        await EmailSendLog.updateOne(
          { _id: doc._id },
          { $set: { archiveKey: doc.archiveKey, archiveMetaKey: doc.archiveMetaKey } }
        );
      }
    } catch (archErr) {
      logger.warn({ err: archErr.message }, '[emailReports] mail-archive soft-fail');
    }

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
    const parsed = parseProviderDate(details.sent_time);
    if (parsed) doc.sentAt = alignSentAt(parsed, doc.createdAt) || parsed;
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
  // Keep engagement timestamps even when latest status is opt-out / bounce
  if (patch.openedAt || existing.openedAt) existing.openedAt = patch.openedAt || existing.openedAt;
  if (patch.clickedAt || existing.clickedAt) existing.clickedAt = patch.clickedAt || existing.clickedAt;
  if (patch.unsubscribedAt || existing.unsubscribedAt) {
    existing.unsubscribedAt = patch.unsubscribedAt || existing.unsubscribedAt;
  }
  existing.openCount = Math.max(num(existing.openCount), num(patch.openCount));
  existing.clickCount = Math.max(num(existing.clickCount), num(patch.clickCount));
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
        const sentAt =
          sentMs > 0
            ? new Date(sentMs < 1e12 ? sentMs * 1000 : sentMs)
            : parseProviderDate(row.sentdate || row.sent_date || row.sent_time) || undefined;
        upsertRecipient(map, email, {
          ...patchBase,
          name: [row.firstname, row.lastname].filter(Boolean).join(' ') || row.first_name || '',
          providerContactId: String(row.contactid || row.contact_id || ''),
          sentAt,
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
  const reportTotals = { ...(doc.totals || {}) };

  await syncCampaignRecipients(doc, campaignKey, cfg);

  // Keep Zoho campaign-report totals as source of truth (recipient buckets are
  // often incomplete / status-collapsed and were making Campaigns≈Recipients
  // and Delivered≈Opened). Only fill zeros from recipient-derived counts.
  if (doc.recipients?.length) {
    const before = { ...reportTotals };
    recomputeTotals(doc);
    const fromRecipients = { ...(doc.totals || {}) };
    doc.totals = {
      sent: Math.max(num(before.sent), num(fromRecipients.sent)),
      delivered: Math.max(num(before.delivered), num(fromRecipients.delivered)),
      opened: Math.max(num(before.opened), num(fromRecipients.opened)),
      clicked: Math.max(num(before.clicked), num(fromRecipients.clicked)),
      bounced: Math.max(num(before.bounced), num(fromRecipients.bounced)),
      softBounced: Math.max(num(before.softBounced), num(fromRecipients.softBounced)),
      hardBounced: Math.max(num(before.hardBounced), num(fromRecipients.hardBounced)),
      unsubscribed: Math.max(num(before.unsubscribed), num(fromRecipients.unsubscribed)),
      spam: Math.max(num(before.spam), num(fromRecipients.spam)),
      failed: Math.max(num(before.failed), num(fromRecipients.failed)),
      replied: Math.max(num(before.replied), num(fromRecipients.replied)),
      unopened: Math.max(num(before.unopened), num(fromRecipients.unopened)),
    };
    const base = doc.totals.delivered || doc.totals.sent || 0;
    doc.rates = {
      deliveryRate: pct(doc.totals.delivered, doc.totals.sent),
      openRate: pct(doc.totals.opened, base || doc.totals.sent),
      clickRate: pct(doc.totals.clicked, base || doc.totals.sent),
      bounceRate: pct(doc.totals.bounced, doc.totals.sent),
      unsubscribeRate: pct(doc.totals.unsubscribed, doc.totals.sent),
    };
  }

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
  // ZeptoMail accounts in India expect DD/MM/YYYY in IST wall-clock
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = (get('dayPeriod') || 'AM').toUpperCase();
  return `${day}/${month}/${year}, ${hour}:${minute} ${dayPeriod}`;
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

async function syncRecentCampaigns(organizationId, { limit = 50 } = {}) {
  const { campaignsRequest } = require('./campaignService');
  let settings = null;
  try {
    settings = await require('./marketingListService').resolveCampaignsSettings(organizationId);
  } catch (_) {}

  const range = Math.min(100, Math.max(5, Number(limit) || 50));
  const collectRows = (res) => {
    if (!res || typeof res !== 'object') return [];
    const candidates = [
      res.recent_campaigns,
      res['recent-campaigns'],
      res.recentcampaigns,
      res.campaigns,
      res.list_of_details,
      res.response?.recent_campaigns,
      res.response?.['recent-campaigns'],
      res.response?.campaigns,
    ];
    for (const c of candidates) {
      if (Array.isArray(c) && c.length) return c;
    }
    // Some Zoho payloads wrap a single object
    if (res.campaign_key || res.campaignKey) return [res];
    return [];
  };

  const endpoints = [
    ['recentcampaigns', { resfmt: 'JSON', sortorder: 'desc', fromindex: '1', range: String(range) }],
    ['recentsentcampaigns', { resfmt: 'JSON', sortorder: 'desc', fromindex: '1', range: String(range) }],
  ];

  const byKey = new Map();
  let fetchErrors = [];

  for (const [path, params] of endpoints) {
    try {
      const res = await campaignsRequest('GET', path, params, settings);
      const code = String(res?.code ?? res?.response?.code ?? '').trim();
      if (code && code !== '0' && code !== '200') {
        fetchErrors.push(`${path}: ${res?.message || res?.status || code}`);
        continue;
      }
      for (const row of collectRows(res)) {
        const campaignKey = String(
          row.campaign_key || row.campaignKey || row.campaignkey || row.key || ''
        ).trim();
        if (!campaignKey) continue;
        if (!byKey.has(campaignKey)) byKey.set(campaignKey, row);
      }
    } catch (err) {
      fetchErrors.push(`${path}: ${err.message}`);
      logger.warn({ err: err.message, path }, '[emailReports] recent campaigns fetch failed');
    }
  }

  const list = Array.from(byKey.values());
  let imported = 0;
  let synced = 0;

  for (const row of list) {
    const campaignKey = String(row.campaign_key || row.campaignKey || row.campaignkey || '').trim();
    if (!campaignKey) continue;

    let doc = await EmailSendLog.findOne({ organizationId, campaignKey });
    if (!doc) {
      const sentRaw = row.sent_time || row.sent_date || row.created_time || row.created_date;
      let sentAt = new Date();
      if (sentRaw) {
        const parsed = parseProviderDate(sentRaw);
        if (parsed) sentAt = parsed;
      }
      doc = await recordEmailSend({
        organizationId,
        channel: 'marketing',
        provider: 'zoho_campaigns',
        emailType: 'campaign',
        subject: row.email_subject || row.subject || row.campaign_name || '',
        campaignName: row.campaign_name || row.campaignname || row.name || '',
        campaignKey,
        fromEmail: row.email_from || row.from_email || row.from || '',
        status: 'sent',
        recipients: [],
        providerRaw: { recent: row },
        sentAt,
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

  return {
    imported,
    synced,
    total: list.length,
    error: list.length === 0 && fetchErrors.length ? fetchErrors.join('; ') : undefined,
  };
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
  const andClauses = [];

  if (channel && channel !== 'all') filter.channel = channel;
  if (provider && provider !== 'all') filter.provider = provider;
  if (status && status !== 'all') filter.status = status;

  const metric = String(query.metric || '').trim().toLowerCase();
  if (metric && metric !== 'all') {
    if (metric === 'delivered') {
      andClauses.push({
        $or: [
          { 'totals.delivered': { $gt: 0 } },
          { status: { $in: ['delivered', 'opened', 'clicked', 'replied', 'completed'] } },
        ],
      });
    } else if (metric === 'opened') {
      andClauses.push({
        $or: [
          { 'totals.opened': { $gt: 0 } },
          { status: { $in: ['opened', 'clicked', 'replied'] } },
        ],
      });
    } else if (metric === 'clicked') {
      andClauses.push({
        $or: [{ 'totals.clicked': { $gt: 0 } }, { status: 'clicked' }],
      });
    } else if (metric === 'bounced') {
      andClauses.push({
        $or: [
          { 'totals.bounced': { $gt: 0 } },
          { status: { $in: ['bounced', 'soft_bounced', 'hard_bounced'] } },
        ],
      });
    } else if (metric === 'failed') {
      andClauses.push({
        $or: [{ 'totals.failed': { $gt: 0 } }, { status: 'failed' }],
      });
    } else if (metric === 'replied') {
      andClauses.push({
        $or: [{ 'totals.replied': { $gt: 0 } }, { status: 'replied' }],
      });
    } else if (metric === 'unsubscribed') {
      andClauses.push({
        $or: [
          { 'totals.unsubscribed': { $gt: 0 } },
          { 'recipients.status': 'unsubscribed' },
        ],
      });
    }
  }

  if (from || to) {
    filter.sentAt = {};
    if (from) filter.sentAt.$gte = new Date(from);
    if (to) filter.sentAt.$lte = new Date(to);
  }
  if (search) {
    const q = String(search).trim();
    andClauses.push({
      $or: [
        { subject: new RegExp(q, 'i') },
        { campaignName: new RegExp(q, 'i') },
        { fromEmail: new RegExp(q, 'i') },
        { campaignKey: q },
        { messageId: new RegExp(q, 'i') },
        { 'recipients.email': new RegExp(q, 'i') },
      ],
    });
  }
  if (andClauses.length) filter.$and = andClauses;

  const pageNum = Math.max(1, Number(page) || 1);
  const lim = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * lim;

  const [items, total] = await Promise.all([
    EmailSendLog.find(filter)
      .select('-htmlBody -textBody')
      .sort({ sentAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(lim)
      .populate('sentByUserId', 'name email')
      .lean(),
    EmailSendLog.countDocuments(filter),
  ]);
  const sentAtFixes = [];
  for (const item of items) {
    const before = item.sentAt ? new Date(item.sentAt).getTime() : 0;
    presentSendTimes(item);
    const after = item.sentAt ? new Date(item.sentAt).getTime() : 0;
    if (before && after && before !== after) {
      sentAtFixes.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { sentAt: item.sentAt } },
        },
      });
    }
  }
  if (sentAtFixes.length) {
    EmailSendLog.bulkWrite(sentAtFixes, { ordered: false }).catch(() => {});
  }
  items.sort((a, b) => new Date(b.sentAt || b.createdAt || 0) - new Date(a.sentAt || a.createdAt || 0));

  let summary = {
    sends: 0,
    recipients: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    replied: 0,
    failed: 0,
    unsubscribed: 0,
  };
  const emptyChannel = () => ({
    sends: 0,
    recipients: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    replied: 0,
    failed: 0,
    unsubscribed: 0,
  });
  let channelSummaries = {
    marketing: emptyChannel(),
    transactional: emptyChannel(),
    system: emptyChannel(),
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
            unsubscribed: { $sum: { $ifNull: ['$totals.unsubscribed', 0] } },
          },
        },
      ]);
      if (aggregate[0]) {
        summary = { ...summary, ...aggregate[0] };
        delete summary._id;
      }

      const byChannel = await EmailSendLog.aggregate([
        { $match: { organizationId: orgOid } },
        {
          $group: {
            _id: '$channel',
            sends: { $sum: 1 },
            recipients: { $sum: { $ifNull: ['$totals.sent', 0] } },
            delivered: { $sum: { $ifNull: ['$totals.delivered', 0] } },
            opened: { $sum: { $ifNull: ['$totals.opened', 0] } },
            clicked: { $sum: { $ifNull: ['$totals.clicked', 0] } },
            bounced: { $sum: { $ifNull: ['$totals.bounced', 0] } },
            replied: { $sum: { $ifNull: ['$totals.replied', 0] } },
            failed: { $sum: { $ifNull: ['$totals.failed', 0] } },
            unsubscribed: { $sum: { $ifNull: ['$totals.unsubscribed', 0] } },
          },
        },
      ]);
      for (const row of byChannel) {
        const key = row._id || 'transactional';
        if (!channelSummaries[key]) continue;
        channelSummaries[key] = {
          sends: row.sends || 0,
          recipients: row.recipients || 0,
          delivered: row.delivered || 0,
          opened: row.opened || 0,
          clicked: row.clicked || 0,
          bounced: row.bounced || 0,
          replied: row.replied || 0,
          failed: row.failed || 0,
          unsubscribed: row.unsubscribed || 0,
        };
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[emailReports] summary aggregate failed');
  }

  const decorate = (s) => ({
    ...s,
    openRate: pct(s.opened, s.delivered || s.recipients),
    clickRate: pct(s.clicked, s.delivered || s.recipients),
    bounceRate: pct(s.bounced, s.recipients),
  });

  summary = decorate(summary);
  channelSummaries = {
    marketing: decorate(channelSummaries.marketing),
    transactional: decorate(channelSummaries.transactional),
    system: decorate(channelSummaries.system),
  };

  return {
    items,
    pagination: { page: pageNum, limit: lim, total, pages: Math.ceil(total / lim) || 1 },
    summary,
    channelSummaries,
  };
}

function collectPreviewUrls(value, acc = [], depth = 0) {
  if (depth > 6 || value == null) return acc;
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^https?:\/\//i.test(s) && /preview|EmailDisplay|SharedCampaign|CampaignsPreview/i.test(s)) acc.push(s);
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPreviewUrls(item, acc, depth + 1));
    return acc;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/preview/i.test(key) && typeof item === 'string' && /^https?:\/\//i.test(item)) acc.push(item.trim());
      else collectPreviewUrls(item, acc, depth + 1);
    }
  }
  return acc;
}

function extractEmailHtml(page) {
  const s = String(page || '');
  if (s.length < 80) return '';
  if (/accounts\.zoho|id="login"|name="password"/i.test(s) && !/<(table|td)\b/i.test(s)) return '';
  const marked = s.match(/<(?:div|td)[^>]+id=["'][^"']*(?:zcampaign|tmplContainer|contentOuter|campaignContent)[^"']*["'][^>]*>([\s\S]{80,})/i);
  if (marked) return marked[0];
  if (/<(html|table|td|body)\b/i.test(s)) return s;
  return '';
}

async function downloadPreviewHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      responseType: 'text',
      maxContentLength: MAX_PREVIEW_FETCH,
      maxRedirects: 5,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; PeopleConnectHR/1.0)',
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return extractEmailHtml(res.data);
  } catch (err) {
    logger.warn({ err: err.message, url: String(url).slice(0, 120) }, '[emailReports] preview url fetch failed');
    return '';
  }
}

async function fetchZohoCampaignHtml(doc) {
  let settings = null;
  try {
    settings = await require('./marketingListService').resolveCampaignsSettings(doc.organizationId);
  } catch (_) {}
  const { campaignsRequest } = require('./campaignService');
  const key = String(doc.campaignKey || '').trim();
  const urls = [...new Set(collectPreviewUrls(doc.providerRaw))];

  if (key) {
    const lists = [
      ['recentcampaigns', { resfmt: 'JSON', sortorder: 'desc', fromindex: '1', range: '50' }],
      ['recentsentcampaigns', { resfmt: 'JSON', sortorder: 'desc', fromindex: '1', range: '50' }],
      ['getcampaigndetails', { resfmt: 'JSON', campaignkey: key, campaigntype: 'normal' }],
    ];
    for (const [path, params] of lists) {
      try {
        const res = await campaignsRequest('GET', path, params, settings);
        const inline = findHtmlString(res);
        if (inline) return inline;
        const rows = []
          .concat(res?.recent_campaigns || [])
          .concat(res?.['recent-campaigns'] || [])
          .concat(res?.campaigns || []);
        for (const row of rows) {
          const rowKey = String(row.campaign_key || row.campaignKey || row.campaignkey || '').trim();
          if (rowKey && rowKey !== key) continue;
          collectPreviewUrls(row, urls);
        }
        collectPreviewUrls(res, urls);
      } catch (err) {
        logger.warn({ err: err.message, path, campaignKey: key }, '[emailReports] campaign html lookup failed');
      }
    }
  }

  for (const url of [...new Set(urls)]) {
    const html = await downloadPreviewHtml(url);
    if (html) return html;
  }
  return '';
}

async function hydratePreview(doc) {
  try {
    if (doc.archiveKey) {
      const { getArchivedHtml } = require('./emailArchiveService');
      const fromS3 = await getArchivedHtml(doc.archiveKey);
      if (fromS3 && /</.test(fromS3)) {
        doc.htmlBody = fromS3;
        return doc;
      }
    }
  } catch (_) { /* fall through */ }

  if (String(doc.htmlBody || '').trim().length > 40 && /</.test(doc.htmlBody)) return doc;
  const rawHtml = findHtmlString(doc.providerRaw);
  let html = rawHtml;
  if (!html) {
    const url = String(doc.providerRaw?.contentUrl || '').trim();
    if (/^https?:\/\//i.test(url)) {
      try {
        const res = await axios.get(url, {
          timeout: 8000,
          responseType: 'text',
          maxContentLength: 450_000,
          validateStatus: (status) => status >= 200 && status < 300,
        });
        const body = String(res.data || '');
        if (/<(html|table|div|body|p|td)\b/i.test(body)) html = body;
      } catch (_) { /* expired content_url */ }
    }
  }
  if (!html && doc.organizationId) {
    const or = [];
    if (doc.campaignKey) or.push({ campaignKey: doc.campaignKey });
    if (doc.subject) or.push({ subject: doc.subject });
    if (doc.campaignName) or.push({ campaignName: doc.campaignName });
    if (or.length) {
      const sibling = await EmailSendLog.findOne({
        organizationId: doc.organizationId,
        _id: { $ne: doc._id },
        $or: [
          { archiveKey: { $exists: true, $nin: [null, ''] } },
          { htmlBody: { $regex: '<', $options: 'i' } },
        ],
        $and: [{ $or: or }],
      }).select('htmlBody archiveKey').sort({ createdAt: -1 }).lean();
      if (sibling?.archiveKey) {
        try {
          const { getArchivedHtml } = require('./emailArchiveService');
          const fromS3 = await getArchivedHtml(sibling.archiveKey);
          if (fromS3) html = fromS3;
        } catch (_) { /* ignore */ }
      }
      if (!html && sibling?.htmlBody) html = sibling.htmlBody;
    }
  }
  if (!html && doc.campaignKey) {
    html = await fetchZohoCampaignHtml(doc);
  }
  if (html) {
    doc.htmlBody = html;
    try {
      await EmailSendLog.updateOne(
        { _id: doc._id },
        { $set: { htmlBody: clipBody(html, MAX_HTML_BODY) } }
      );
    } catch (_) { /* preview still returned */ }
  }
  return doc;
}

function presentSendTimes(item) {
  if (!item) return item;
  const aligned = alignSentAt(item.sentAt, item.createdAt);
  if (aligned) item.sentAt = aligned;
  return item;
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
  presentSendTimes(doc);
  await hydratePreview(doc);
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
