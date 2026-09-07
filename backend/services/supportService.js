const SupportTicket = require('../models/SupportTicket');
const Organization = require('../models/Organization');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  brandButtonHtml,
  infoPanelHtml,
  loadOrgEmailBrand,
  escapeHtml,
} = require('./emailBrandLayout');
const logger = require('../utils/logger');

const CATEGORIES = {
  query: 'Query',
  issue: 'Issue',
  feedback: 'Feedback',
  feature: 'Feature request',
};

const SUPPORT_INBOX = 'support@skillnixrecruitment.com';
const DAILY_LIMIT = 8;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function teamInbox() {
  const raw = process.env.SUPPORT_TEAM_EMAIL || SUPPORT_INBOX;
  return String(raw)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function makeTicketRef() {
  const now = new Date();
  const y = String(now.getUTCFullYear()).slice(-2);
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SN-${y}${m}${d}-${rand}`;
}

async function createTicket(user, body = {}) {
  if (!user?.id && !user?._id) throw httpError('Sign in required', 401);

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

  notifyTeam(ticket).catch((err) => logger.warn({ err: err.message }, 'Support team email failed'));
  notifySubmitter(ticket).catch((err) => logger.warn({ err: err.message }, 'Support confirmation email failed'));

  return ticket.toObject();
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
    .sort({ createdAt: -1 })
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

async function addReply(user, ticketId, body = {}) {
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
  notifyTeamReply(ticket, reply).catch((err) => logger.warn({ err: err.message }, 'Support reply email failed'));
  return ticket.toObject();
}

async function notifyTeam(ticket) {
  const inbox = teamInbox();
  if (!inbox.length) return;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const categoryLabel = CATEGORIES[ticket.category] || ticket.category;
  const html = wrapBrandedEmailHtml({
    title: `${categoryLabel} · ${ticket.ticketRef}`,
    eyebrow: 'Product support',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">New ${escapeHtml(categoryLabel.toLowerCase())} from the ATS.</p>
      ${infoPanelHtml([
        { label: 'Ticket', value: ticket.ticketRef },
        { label: 'Type', value: categoryLabel },
        { label: 'Subject', value: ticket.subject },
        { label: 'From', value: ticket.userName || ticket.userEmail || 'User' },
        ticket.userEmail ? { label: 'Email', value: ticket.userEmail } : null,
        ticket.userRole ? { label: 'Role', value: ticket.userRole } : null,
        ticket.orgName ? { label: 'Organization', value: ticket.orgName } : null,
        ticket.pageUrl ? { label: 'Page', value: ticket.pageUrl } : null,
      ].filter(Boolean), brand.brandColor)}
      <p style="margin:16px 0 0 0;color:#334155;line-height:1.7;white-space:pre-wrap;">${escapeHtml(ticket.message)}</p>`,
  });
  await sendEmail(
    inbox[0],
    `[${ticket.ticketRef}] ${categoryLabel}: ${ticket.subject}`,
    html,
    `${ticket.ticketRef} · ${categoryLabel}\n${ticket.subject}\n\n${ticket.message}\n\nFrom: ${ticket.userName} <${ticket.userEmail}>`,
    {
      senderName: brand.name,
      organizationId: ticket.organizationId,
      system: true,
      senderEmail: ticket.userEmail || undefined,
      cc: inbox.slice(1).join(',') || undefined,
    }
  );
}

async function notifySubmitter(ticket) {
  if (!ticket.userEmail) return;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const categoryLabel = CATEGORIES[ticket.category] || ticket.category;
  const html = wrapBrandedEmailHtml({
    title: 'We received your message',
    eyebrow: 'Product support',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(ticket.userName || 'there')},</p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
        The Skillnix product team received your ${escapeHtml(categoryLabel.toLowerCase())}. We typically reply within one business day.
      </p>
      ${infoPanelHtml([
        { label: 'Ticket', value: ticket.ticketRef },
        { label: 'Type', value: categoryLabel },
        { label: 'Subject', value: ticket.subject },
      ], brand.brandColor)}
      <div style="text-align:center;">
        ${brandButtonHtml({ href: `mailto:${SUPPORT_INBOX}`, label: 'Email support', brandColor: brand.brandColor })}
      </div>`,
  });
  await sendEmail(
    ticket.userEmail,
    `Ticket ${ticket.ticketRef} received`,
    html,
    `We received your ${categoryLabel.toLowerCase()} (${ticket.ticketRef}). Our product team will reply shortly.`,
    {
      senderName: brand.name,
      organizationId: ticket.organizationId,
      system: true,
    }
  );
}

async function notifyTeamReply(ticket, reply) {
  const inbox = teamInbox();
  if (!inbox.length) return;
  const brand = await loadOrgEmailBrand(ticket.organizationId);
  const html = wrapBrandedEmailHtml({
    title: `Reply · ${ticket.ticketRef}`,
    eyebrow: 'Product support',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `<p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">A freelancer replied to an open support ticket.</p>${infoPanelHtml([
      { label: 'Ticket', value: ticket.ticketRef },
      { label: 'Subject', value: ticket.subject },
      { label: 'From', value: reply.authorName || reply.authorEmail || 'Freelancer' },
    ], brand.brandColor)}<p style="margin:16px 0 0 0;color:#334155;line-height:1.7;white-space:pre-wrap;">${escapeHtml(reply.body)}</p>`,
  });
  await sendEmail(
    inbox[0],
    `[${ticket.ticketRef}] Freelancer reply: ${ticket.subject}`,
    html,
    `${ticket.ticketRef} · Freelancer reply\n\n${reply.body}`,
    { senderName: brand.name, organizationId: ticket.organizationId, system: true, cc: inbox.slice(1).join(',') || undefined }
  );
}

module.exports = {
  CATEGORIES,
  SUPPORT_INBOX,
  teamInbox,
  makeTicketRef,
  createTicket,
  listMyTickets,
  getMyTicket,
  addReply,
};
