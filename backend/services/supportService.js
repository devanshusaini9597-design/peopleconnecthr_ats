const SupportTicket = require('../models/SupportTicket');
const Organization = require('../models/Organization');
const Notification = require('../models/Notification');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  brandButtonHtml,
  infoPanelHtml,
  loadOrgEmailBrand,
  escapeHtml,
} = require('./emailBrandLayout');
const { isFreelancer, organizationIdMatch } = require('../utils/dataScope');
const logger = require('../utils/logger');

const CATEGORIES = {
  query: 'Guidance request',
  issue: 'Technical issue',
  feedback: 'Product feedback',
  feature: 'Feature request',
};

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

const SUPPORT_INBOX = 'support@skillnixrecruitment.com';
const DAILY_LIMIT = 8;
const COMPANY_DESK_ROLES = new Set([
  'owner',
  'admin',
  'hr_manager',
  'hr_recruiter',
  'recruiter',
  'sales',
]);

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function teamInbox() {
  const raw = process.env.SUPPORT_TEAM_EMAIL || SUPPORT_INBOX;
  const list = String(raw)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.includes(SUPPORT_INBOX)) list.push(SUPPORT_INBOX);
  return [...new Set(list)];
}

function appBaseUrl() {
  return String(process.env.FRONTEND_URL || 'https://www.peopleconnecthr.com').replace(/\/$/, '');
}

function makeTicketRef() {
  const now = new Date();
  const y = String(now.getUTCFullYear()).slice(-2);
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SN-${y}${m}${d}-${rand}`;
}

function canAccessCompanyDesk(user) {
  if (!user || isFreelancer(user) || !user.organizationId) return false;
  return COMPANY_DESK_ROLES.has(String(user.role || ''));
}

function orgFilter(organizationId) {
  const match = organizationIdMatch(organizationId);
  if (!match) throw httpError('Organization required', 400);
  return match;
}

async function createTicket(user, body = {}) {
  if (!user?.id && !user?._id) throw httpError('Sign in required', 401);
  if (!isFreelancer(user)) throw httpError('Only freelancers can open support tickets', 403);

  const category = String(body.category || '').trim().toLowerCase();
  if (!CATEGORIES[category]) {
    throw httpError('Choose a type: query, issue, feedback, or feature request');
  }

  const subject = String(body.subject || '').trim().slice(0, 160);
  const message = String(body.message || '').trim().slice(0, 4000);
  if (!subject) throw httpError('Add a subject');
  if (!message) throw httpError('Add a message');

  const userId = user.id || user._id;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = await SupportTicket.countDocuments({
    userId,
    createdAt: { $gte: startOfDay },
  });
  if (todayCount >= DAILY_LIMIT) {
    throw httpError(`Daily support limit reached. Email ${SUPPORT_INBOX} if this is urgent.`, 429);
  }

  let orgName = '';
  if (user.organizationId) {
    const org = await Organization.findById(user.organizationId).select('name').lean();
    orgName = org?.name || '';
  }

  const ticket = await SupportTicket.create({
    ticketRef: makeTicketRef(),
    organizationId: user.organizationId || undefined,
    userId,
    category,
    subject,
    message,
    pageUrl: String(body.pageUrl || '').trim().slice(0, 500),
    userName: user.name || '',
    userEmail: user.email || '',
    userRole: user.role || '',
    orgName,
    status: 'open',
  });

  let teamEmailSent = false;
  let confirmationEmailSent = false;
  let confirmationEmailError = '';
  try {
    await notifyTeamNewTicket(ticket);
    teamEmailSent = true;
  } catch (err) {
    logger.warn({ err: err.message }, 'Support team email failed');
  }
  try {
    confirmationEmailSent = await notifySubmitterConfirmation(ticket);
  } catch (err) {
    confirmationEmailError = err.message || 'Confirmation email failed';
    logger.warn({ err: err.message }, 'Support confirmation email failed');
  }

  return {
    ...ticket.toObject(),
    teamEmailSent,
    confirmationEmailSent: Boolean(confirmationEmailSent),
    confirmationEmailError: confirmationEmailError || undefined,
  };
}

async function listMyTickets(user, query = {}) {
  const userId = user?.id || user?._id;
  if (!userId) throw httpError('Sign in required', 401);
  const filter = { userId };
  const status = String(query.status || 'active').trim().toLowerCase();
  if (status === 'active') filter.status = { $in: ['open', 'in_progress'] };
  if (status === 'resolved') filter.status = 'resolved';
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(25, Math.max(5, Number.parseInt(query.limit, 10) || 10));
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .select('ticketRef category subject message status replies createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function getMyTicket(user, ticketId) {
  const userId = user?.id || user?._id;
  if (!userId) throw httpError('Sign in required', 401);
  const ticket = await SupportTicket.findOne({ _id: ticketId, userId })
    .select('ticketRef category subject message status replies pageUrl createdAt updatedAt')
    .lean();
  if (!ticket) throw httpError('Ticket not found', 404);
  return ticket;
}

async function addFreelancerReply(user, ticketId, body = {}) {
  const userId = user?.id || user?._id;
  if (!userId) throw httpError('Sign in required', 401);
  const message = String(body.message || '').trim().slice(0, 4000);
  if (message.length < 2) throw httpError('Write a reply before sending');

  const ticket = await SupportTicket.findOne({ _id: ticketId, userId });
  if (!ticket) throw httpError('Ticket not found', 404);

  ticket.replies.push({
    body: message,
    authorType: 'freelancer',
    authorName: user.name || '',
    authorEmail: user.email || '',
  });
  if (ticket.status === 'resolved') ticket.status = 'open';
  await ticket.save();
  const reply = ticket.replies[ticket.replies.length - 1];
  notifyTeamFreelancerFollowUp(ticket, reply).catch((err) => {
    logger.warn({ err: err.message }, 'Support follow-up email failed');
  });
  return ticket.toObject();
}

async function listOrgTickets(user, query = {}) {
  if (!canAccessCompanyDesk(user)) throw httpError('Support desk access denied', 403);
  const filter = { ...orgFilter(user.organizationId) };
  const status = String(query.status || 'active').trim().toLowerCase();
  if (status === 'active') filter.status = { $in: ['open', 'in_progress'] };
  if (status === 'resolved') filter.status = 'resolved';
  if (status === 'open' || status === 'in_progress') filter.status = status;
  const q = String(query.q || '').trim();
  if (q) {
    filter.$or = [
      { ticketRef: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { subject: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { userName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { userEmail: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ];
  }
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(5, Number.parseInt(query.limit, 10) || 15));
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .select('ticketRef category subject message status userName userEmail replies createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function getOrgTicket(user, ticketId) {
  if (!canAccessCompanyDesk(user)) throw httpError('Support desk access denied', 403);
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    ...orgFilter(user.organizationId),
  }).lean();
  if (!ticket) throw httpError('Ticket not found', 404);
  return ticket;
}

async function addSupportReply(user, ticketId, body = {}) {
  if (!canAccessCompanyDesk(user)) throw httpError('Support desk access denied', 403);
  const message = String(body.message || '').trim().slice(0, 4000);
  if (message.length < 2) throw httpError('Write a reply before sending');

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    ...orgFilter(user.organizationId),
  });
  if (!ticket) throw httpError('Ticket not found', 404);

  const nextStatus = String(body.status || '').trim().toLowerCase();
  ticket.replies.push({
    body: message,
    authorType: 'support',
    authorName: user.name || '',
    authorEmail: user.email || '',
  });
  if (STATUS_LABELS[nextStatus]) {
    ticket.status = nextStatus;
  } else if (ticket.status === 'open') {
    ticket.status = 'in_progress';
  }
  await ticket.save();

  const reply = ticket.replies[ticket.replies.length - 1];
  notifyFreelancerSupportReply(ticket, reply, user).catch((err) => {
    logger.warn({ err: err.message }, 'Freelancer support-reply email failed');
  });
  createFreelancerSupportNotification(ticket, {
    title: `Support reply · ${ticket.ticketRef}`,
    message: `${user.name || 'Your hiring team'} replied on “${ticket.subject}”.`,
    senderId: user.id || user._id,
    senderName: user.name || 'Support',
  }).catch((err) => logger.warn({ err: err.message }, 'Support in-app notify failed'));

  return ticket.toObject();
}

async function updateOrgTicketStatus(user, ticketId, body = {}) {
  if (!canAccessCompanyDesk(user)) throw httpError('Support desk access denied', 403);
  const status = String(body.status || '').trim().toLowerCase();
  if (!STATUS_LABELS[status]) throw httpError('Status must be open, in_progress, or resolved');

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    ...orgFilter(user.organizationId),
  });
  if (!ticket) throw httpError('Ticket not found', 404);
  if (ticket.status === status) return ticket.toObject();

  const previous = ticket.status;
  ticket.status = status;
  await ticket.save();

  notifyFreelancerStatusChange(ticket, previous, user).catch((err) => {
    logger.warn({ err: err.message }, 'Freelancer status-change email failed');
  });
  createFreelancerSupportNotification(ticket, {
    title: `Ticket ${STATUS_LABELS[status].toLowerCase()} · ${ticket.ticketRef}`,
    message: `${user.name || 'Your hiring team'} marked “${ticket.subject}” as ${STATUS_LABELS[status]}.`,
    senderId: user.id || user._id,
    senderName: user.name || 'Support',
  }).catch((err) => logger.warn({ err: err.message }, 'Support status in-app notify failed'));

  return ticket.toObject();
}

async function sendSupportMail(to, subject, html, text, options = {}) {
  const systemOpts = {
    ...options,
    system: true,
    organizationId: undefined,
    userId: undefined,
    senderName: options.senderName || 'Skillnix Support',
  };
  await sendEmail(to, subject, html, text, systemOpts);
}

async function createFreelancerSupportNotification(ticket, { title, message, senderId, senderName }) {
  if (!ticket.userId) return;
  await Notification.create({
    userId: ticket.userId,
    senderId: senderId || null,
    senderName: senderName || 'Support',
    type: 'system',
    title,
    message,
    linkUrl: '/feedback',
    priority: 'high',
    actionRequired: false,
    status: 'pending',
  });
}

function signatureBlock(brand) {
  const org = escapeHtml(brand.name || 'Skillnix');
  return `
    <p style="margin:28px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">
      Kind regards,<br/>
      <strong style="color:#0f172a;">${org} Support</strong><br/>
      Enterprise recruiting operations
    </p>`;
}

async function notifyTeamNewTicket(ticket) {
  const inbox = teamInbox();
  if (!inbox.length) return;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const categoryLabel = CATEGORIES[ticket.category] || ticket.category;
  const deskUrl = `${appBaseUrl()}/support-desk`;
  const html = wrapBrandedEmailHtml({
    title: `New support ticket · ${ticket.ticketRef}`,
    eyebrow: 'Freelancer support desk',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;line-height:1.6;">
        A freelance recruiter submitted a new <strong>${escapeHtml(categoryLabel.toLowerCase())}</strong> that requires attention.
      </p>
      <p style="margin:0 0 16px 0;color:#475569;line-height:1.7;">
        Review the request in your Freelancer Support desk, update status for the submitter, and reply in-app. The freelancer receives both the in-app update and an email notification.
      </p>
      ${infoPanelHtml([
        { label: 'Ticket ID', value: ticket.ticketRef },
        { label: 'Category', value: categoryLabel },
        { label: 'Subject', value: ticket.subject },
        { label: 'Submitted by', value: ticket.userName || ticket.userEmail || 'Freelancer' },
        ticket.userEmail ? { label: 'Contact email', value: ticket.userEmail } : null,
        ticket.orgName ? { label: 'Organization', value: ticket.orgName } : null,
        ticket.pageUrl ? { label: 'Origin page', value: ticket.pageUrl } : null,
        { label: 'Status', value: STATUS_LABELS[ticket.status] || 'Open' },
      ].filter(Boolean), brand.brandColor)}
      <p style="margin:18px 0 8px 0;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;">Message</p>
      <p style="margin:0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#334155;line-height:1.75;white-space:pre-wrap;">${escapeHtml(ticket.message)}</p>
      <div style="text-align:center;margin-top:22px;">
        ${brandButtonHtml({ href: deskUrl, label: 'Open Freelancer Support desk', brandColor: brand.brandColor })}
      </div>
      ${signatureBlock(brand)}`,
  });
  await sendSupportMail(
    inbox[0],
    `[${ticket.ticketRef}] ${categoryLabel}: ${ticket.subject}`,
    html,
    [
      `New support ticket ${ticket.ticketRef}`,
      `Category: ${categoryLabel}`,
      `Subject: ${ticket.subject}`,
      `From: ${ticket.userName} <${ticket.userEmail}>`,
      `Organization: ${ticket.orgName || ''}`,
      '',
      ticket.message,
      '',
      `Open desk: ${deskUrl}`,
    ].join('\n'),
    {
      senderName: 'Skillnix Support',
      senderEmail: SUPPORT_INBOX,
      replyToEmail: ticket.userEmail || SUPPORT_INBOX,
      cc: inbox.slice(1).join(',') || undefined,
    }
  );
}

async function notifySubmitterConfirmation(ticket) {
  if (!ticket.userEmail) return false;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const categoryLabel = CATEGORIES[ticket.category] || ticket.category;
  const ticketUrl = `${appBaseUrl()}/feedback`;
  const html = wrapBrandedEmailHtml({
    title: 'Your support request has been received',
    eyebrow: 'Confirmation · Freelancer support',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:16px;color:#0f172a;">Dear ${escapeHtml(ticket.userName || 'Colleague')},</p>
      <p style="margin:0 0 14px 0;color:#475569;line-height:1.75;">
        Thank you for contacting support. Your request has been logged successfully and is visible to your hiring organization’s support desk. You will receive in-app and email updates when the team replies or changes the ticket status.
      </p>
      ${infoPanelHtml([
        { label: 'Ticket ID', value: ticket.ticketRef },
        { label: 'Category', value: categoryLabel },
        { label: 'Subject', value: ticket.subject },
        { label: 'Current status', value: STATUS_LABELS[ticket.status] || 'Open' },
        { label: 'Expected response', value: 'Within one business day' },
      ], brand.brandColor)}
      <p style="margin:16px 0 0 0;color:#475569;line-height:1.7;">
        Please retain your ticket ID for reference. You may add follow-up detail at any time from Support &amp; feedback in the ATS.
      </p>
      <div style="text-align:center;margin-top:22px;">
        ${brandButtonHtml({ href: ticketUrl, label: 'View ticket in ATS', brandColor: brand.brandColor })}
      </div>
      <p style="margin:18px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">
        Prefer email? Write to <a href="mailto:${SUPPORT_INBOX}" style="color:#0f766e;font-weight:600;">${SUPPORT_INBOX}</a> and include ${escapeHtml(ticket.ticketRef)}.
      </p>
      ${signatureBlock(brand)}`,
  });
  await sendSupportMail(
    ticket.userEmail,
    `Support request received · ${ticket.ticketRef}`,
    html,
    [
      `Dear ${ticket.userName || 'Colleague'},`,
      '',
      'Your support request has been received and logged.',
      `Ticket ID: ${ticket.ticketRef}`,
      `Category: ${categoryLabel}`,
      `Subject: ${ticket.subject}`,
      `Status: ${STATUS_LABELS[ticket.status] || 'Open'}`,
      '',
      `View in ATS: ${ticketUrl}`,
      `Or email ${SUPPORT_INBOX} with your ticket ID.`,
      '',
      'Kind regards,',
      `${brand.name || 'Skillnix'} Support`,
    ].join('\n'),
    {
      senderName: `${brand.name || 'Skillnix'} Support`,
      senderEmail: SUPPORT_INBOX,
      replyToEmail: SUPPORT_INBOX,
    }
  );
  return true;
}

async function notifyTeamFreelancerFollowUp(ticket, reply) {
  const inbox = teamInbox();
  if (!inbox.length) return;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const deskUrl = `${appBaseUrl()}/support-desk`;
  const html = wrapBrandedEmailHtml({
    title: `Follow-up on ${ticket.ticketRef}`,
    eyebrow: 'Freelancer support desk',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:16px;color:#0f172a;line-height:1.6;">
        The freelancer added a follow-up on an existing support ticket.
      </p>
      ${infoPanelHtml([
        { label: 'Ticket ID', value: ticket.ticketRef },
        { label: 'Subject', value: ticket.subject },
        { label: 'From', value: reply.authorName || reply.authorEmail || 'Freelancer' },
        { label: 'Status', value: STATUS_LABELS[ticket.status] || 'Open' },
      ], brand.brandColor)}
      <p style="margin:18px 0 8px 0;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;">Follow-up</p>
      <p style="margin:0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#334155;line-height:1.75;white-space:pre-wrap;">${escapeHtml(reply.body)}</p>
      <div style="text-align:center;margin-top:22px;">
        ${brandButtonHtml({ href: deskUrl, label: 'Respond in Support desk', brandColor: brand.brandColor })}
      </div>
      ${signatureBlock(brand)}`,
  });
  await sendSupportMail(
    inbox[0],
    `[${ticket.ticketRef}] Freelancer follow-up: ${ticket.subject}`,
    html,
    `${ticket.ticketRef} · Follow-up\n\n${reply.body}\n\nFrom: ${reply.authorName || ''} <${reply.authorEmail || ''}>\nDesk: ${deskUrl}`,
    {
      senderName: 'Skillnix Support',
      senderEmail: SUPPORT_INBOX,
      replyToEmail: reply.authorEmail || ticket.userEmail || SUPPORT_INBOX,
      cc: inbox.slice(1).join(',') || undefined,
    }
  );
}

async function notifyFreelancerSupportReply(ticket, reply, actor) {
  if (!ticket.userEmail) return;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const ticketUrl = `${appBaseUrl()}/feedback`;
  const actorName = actor?.name || reply.authorName || 'Support team';
  const html = wrapBrandedEmailHtml({
    title: `Update on your support request`,
    eyebrow: `Ticket ${ticket.ticketRef}`,
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:16px;color:#0f172a;">Dear ${escapeHtml(ticket.userName || 'Colleague')},</p>
      <p style="margin:0 0 14px 0;color:#475569;line-height:1.75;">
        ${escapeHtml(actorName)} from <strong style="color:#0f172a;">${escapeHtml(brand.name || 'your hiring organization')}</strong> has replied to your support request. The conversation is available in the ATS and summarized below.
      </p>
      ${infoPanelHtml([
        { label: 'Ticket ID', value: ticket.ticketRef },
        { label: 'Subject', value: ticket.subject },
        { label: 'Status', value: STATUS_LABELS[ticket.status] || 'Open' },
        { label: 'Replied by', value: actorName },
      ], brand.brandColor)}
      <p style="margin:18px 0 8px 0;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;">Support response</p>
      <p style="margin:0;padding:14px 16px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;color:#134e4a;line-height:1.75;white-space:pre-wrap;">${escapeHtml(reply.body)}</p>
      <div style="text-align:center;margin-top:22px;">
        ${brandButtonHtml({ href: ticketUrl, label: 'Open conversation in ATS', brandColor: brand.brandColor })}
      </div>
      ${signatureBlock(brand)}`,
  });
  await sendSupportMail(
    ticket.userEmail,
    `Support update · ${ticket.ticketRef} — ${ticket.subject}`,
    html,
    [
      `Dear ${ticket.userName || 'Colleague'},`,
      '',
      `${actorName} replied to your support ticket ${ticket.ticketRef}.`,
      `Subject: ${ticket.subject}`,
      `Status: ${STATUS_LABELS[ticket.status] || 'Open'}`,
      '',
      'Response:',
      reply.body,
      '',
      `Open in ATS: ${ticketUrl}`,
      '',
      'Kind regards,',
      `${brand.name || 'Skillnix'} Support`,
    ].join('\n'),
    {
      senderName: `${brand.name || 'Skillnix'} Support`,
      senderEmail: SUPPORT_INBOX,
      replyToEmail: actor?.email || SUPPORT_INBOX,
    }
  );
}

async function notifyFreelancerStatusChange(ticket, previousStatus, actor) {
  if (!ticket.userEmail) return;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const ticketUrl = `${appBaseUrl()}/feedback`;
  const actorName = actor?.name || 'Support team';
  const html = wrapBrandedEmailHtml({
    title: `Ticket status updated`,
    eyebrow: `Ticket ${ticket.ticketRef}`,
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:16px;color:#0f172a;">Dear ${escapeHtml(ticket.userName || 'Colleague')},</p>
      <p style="margin:0 0 14px 0;color:#475569;line-height:1.75;">
        ${escapeHtml(actorName)} updated the status of your support request. This change is reflected immediately in your Support &amp; feedback workspace.
      </p>
      ${infoPanelHtml([
        { label: 'Ticket ID', value: ticket.ticketRef },
        { label: 'Subject', value: ticket.subject },
        { label: 'Previous status', value: STATUS_LABELS[previousStatus] || previousStatus },
        { label: 'Current status', value: STATUS_LABELS[ticket.status] || ticket.status },
        { label: 'Updated by', value: actorName },
      ], brand.brandColor)}
      <div style="text-align:center;margin-top:22px;">
        ${brandButtonHtml({ href: ticketUrl, label: 'View ticket status', brandColor: brand.brandColor })}
      </div>
      ${signatureBlock(brand)}`,
  });
  await sendSupportMail(
    ticket.userEmail,
    `Status update · ${ticket.ticketRef} is now ${STATUS_LABELS[ticket.status] || ticket.status}`,
    html,
    [
      `Dear ${ticket.userName || 'Colleague'},`,
      '',
      `Ticket ${ticket.ticketRef} status changed from ${STATUS_LABELS[previousStatus] || previousStatus} to ${STATUS_LABELS[ticket.status] || ticket.status}.`,
      `Updated by: ${actorName}`,
      '',
      `View in ATS: ${ticketUrl}`,
      '',
      'Kind regards,',
      `${brand.name || 'Skillnix'} Support`,
    ].join('\n'),
    {
      senderName: `${brand.name || 'Skillnix'} Support`,
      senderEmail: SUPPORT_INBOX,
      replyToEmail: SUPPORT_INBOX,
    }
  );
}

async function unreadSupportCount(user) {
  const userId = user?.id || user?._id;
  if (!userId) throw httpError('Sign in required', 401);
  const count = await Notification.countDocuments({
    userId,
    linkUrl: '/feedback',
    isRead: false,
    isDismissed: { $ne: true },
  });
  return Math.max(0, Math.min(9, Number(count) || 0));
}

async function markSupportSeen(user) {
  const userId = user?.id || user?._id;
  if (!userId) throw httpError('Sign in required', 401);
  await Notification.updateMany(
    { userId, linkUrl: '/feedback', isRead: false },
    { $set: { isRead: true } }
  );
  return { ok: true };
}

// Back-compat alias used by older routes
const addReply = addFreelancerReply;

module.exports = {
  CATEGORIES,
  STATUS_LABELS,
  SUPPORT_INBOX,
  COMPANY_DESK_ROLES,
  teamInbox,
  makeTicketRef,
  canAccessCompanyDesk,
  createTicket,
  listMyTickets,
  getMyTicket,
  addReply,
  addFreelancerReply,
  listOrgTickets,
  getOrgTicket,
  addSupportReply,
  updateOrgTicketStatus,
  unreadSupportCount,
  markSupportSeen,
};
