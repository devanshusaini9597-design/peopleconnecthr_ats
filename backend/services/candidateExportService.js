const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  infoPanelHtml,
  loadOrgEmailBrand,
  escapeHtml,
} = require('./emailBrandLayout');
const logger = require('../utils/logger');

const CANDIDATE_EXPORT_ROLES = ['owner', 'admin', 'hr_manager'];
const MAX_EXPORT_IDS = 50_000;
const DEFAULT_TZ = 'Asia/Kolkata';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ROLE_LABEL = {
  owner: 'Owner',
  admin: 'Admin',
  hr_manager: 'HR Manager',
};

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Contact', key: 'contact', width: 16 },
  { header: 'Company', key: 'companyName', width: 22 },
  { header: 'Position', key: 'position', width: 22 },
  { header: 'Location', key: 'location', width: 18 },
  { header: 'Experience', key: 'experience', width: 14 },
  { header: 'Current CTC', key: 'ctc', width: 14 },
  { header: 'Expected CTC', key: 'expectedCtc', width: 14 },
  { header: 'Notice Period', key: 'noticePeriod', width: 16 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Client', key: 'client', width: 18 },
  { header: 'Product / Skill', key: 'product', width: 20 },
  { header: 'PAN No.', key: 'pan', width: 14 },
  { header: 'SPOC', key: 'spoc', width: 16 },
  { header: 'Source', key: 'source', width: 14 },
  { header: 'FLS', key: 'fls', width: 12 },
  { header: 'Date', key: 'date', width: 14 },
  { header: 'Remark', key: 'remark', width: 28 },
];

function canExportCandidates(role) {
  return CANDIDATE_EXPORT_ROLES.includes(String(role || ''));
}

function sanitizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id) || !mongoose.Types.ObjectId.isValid(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_EXPORT_IDS) break;
  }
  return out;
}

function tzAbbrev(timeZone) {
  const tz = String(timeZone || DEFAULT_TZ);
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IST';
  return tz;
}

/** Wall-clock parts in the org timezone. Independent of Railway server locale. */
function zonedParts(date, timeZone = DEFAULT_TZ) {
  const d = date instanceof Date ? date : new Date(date);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || DEFAULT_TZ,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      weekday: undefined,
    });
    const bag = {};
    for (const part of fmt.formatToParts(d)) {
      if (part.type !== 'literal') bag[part.type] = part.value;
    }
    if (bag.day && bag.month && bag.year) return bag;
  } catch {
    /* fall through */
  }
  // IST fallback (UTC+5:30) if ICU timezone data is missing
  const shifted = new Date(d.getTime() + 330 * 60 * 1000);
  let hours = shifted.getUTCHours();
  const dayPeriod = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return {
    day: String(shifted.getUTCDate()).padStart(2, '0'),
    month: MONTHS[shifted.getUTCMonth()],
    year: String(shifted.getUTCFullYear()),
    hour: String(hours),
    minute: String(shifted.getUTCMinutes()).padStart(2, '0'),
    dayPeriod,
  };
}

function formatOrgDateTime(date, timeZone = DEFAULT_TZ) {
  const parts = zonedParts(date, timeZone);
  if (!parts) return '';
  const period = String(parts.dayPeriod || '').replace(/\./g, '').toUpperCase();
  const hour = String(parts.hour || '').replace(/^0/, '') || '12';
  const minute = String(parts.minute || '00').padStart(2, '0');
  return `${parts.day} ${parts.month} ${parts.year}, ${hour}:${minute} ${period} ${tzAbbrev(timeZone)}`;
}

function formatOrgDate(date, timeZone = DEFAULT_TZ) {
  const parts = zonedParts(date, timeZone);
  if (!parts) return '';
  return `${parts.day} ${parts.month} ${parts.year}`;
}

function formatOrgTime(date, timeZone = DEFAULT_TZ) {
  const parts = zonedParts(date, timeZone);
  if (!parts) return '';
  const period = String(parts.dayPeriod || '').replace(/\./g, '').toUpperCase();
  const hour = String(parts.hour || '').replace(/^0/, '') || '12';
  const minute = String(parts.minute || '00').padStart(2, '0');
  return `${hour}:${minute} ${period} ${tzAbbrev(timeZone)}`;
}

function formatExportDate(value, timeZone = DEFAULT_TZ) {
  if (!value) return '';
  const formatted = formatOrgDate(value, timeZone);
  return formatted || String(value);
}

function rowFromCandidate(c, timeZone = DEFAULT_TZ) {
  return {
    name: c.name || '',
    email: c.email || '',
    contact: c.contact || '',
    companyName: c.companyName || '',
    position: c.position || '',
    location: c.location || '',
    experience: c.experience || '',
    ctc: c.ctc || '',
    expectedCtc: c.expectedCtc || '',
    noticePeriod: c.noticePeriod || '',
    status: c.status || '',
    client: c.client || '',
    product: c.product || '',
    pan: c.pan || '',
    spoc: c.spoc || '',
    source: c.source || '',
    fls: c.fls || '',
    date: formatExportDate(c.date, timeZone),
    remark: c.remark || '',
  };
}

function ownerNotifyRecipients(owners, actorId) {
  const actor = String(actorId || '');
  return (Array.isArray(owners) ? owners : []).filter((owner) => {
    if (!owner?.email) return false;
    if (actor && String(owner._id) === actor) return false;
    return true;
  });
}

function exportFileName(exportedAt = new Date(), timeZone = DEFAULT_TZ) {
  const stamp = formatOrgDate(exportedAt, timeZone).replace(/ /g, '-');
  return `Candidates_${stamp || 'export'}.xlsx`;
}

function buildExportNoticeFields({
  orgName,
  actorName,
  actorRole,
  actorEmail,
  count,
  selected,
  filename,
  exportedAt,
  timeZone,
}) {
  const when = formatOrgDateTime(exportedAt, timeZone);
  return [
    { label: 'Organization', value: orgName || '—' },
    { label: 'Exported by', value: actorName || '—' },
    { label: 'Role', value: actorRole || '—' },
    { label: 'Login ID', value: actorEmail || '—' },
    { label: 'Records', value: `${Number(count) || 0} candidate${Number(count) === 1 ? '' : 's'}` },
    { label: 'Scope', value: selected ? 'Selected candidates' : 'All candidates in the current list' },
    { label: 'Date', value: formatOrgDate(exportedAt, timeZone) || '—' },
    { label: 'Time', value: formatOrgTime(exportedAt, timeZone) || '—' },
    { label: 'When', value: when || '—' },
    { label: 'File', value: filename || '—' },
  ];
}

async function buildWorkbookBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Skillnix';
  const sheet = workbook.addWorksheet('Candidates');
  sheet.columns = EXPORT_COLUMNS;
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.height = 22;
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function loadOrgTimezone(organizationId) {
  if (!organizationId) return DEFAULT_TZ;
  try {
    const org = await Organization.findById(organizationId).select('settings.timezone').lean();
    return String(org?.settings?.timezone || '').trim() || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

async function notifyOwnersOfExport({
  actor,
  organizationId,
  count,
  selected,
  filename,
  exportedAt,
  timeZone,
}) {
  if (!organizationId) return { emailed: 0 };
  const owners = await User.find({
    organizationId,
    role: 'owner',
    isActive: { $ne: false },
  }).select('name email').lean();

  const recipients = ownerNotifyRecipients(owners, actor.id || actor._id);
  if (!recipients.length) return { emailed: 0 };

  const brand = await loadOrgEmailBrand(organizationId);
  const actorName = String(actor.name || '').trim() || actor.email || 'A teammate';
  const actorRole = ROLE_LABEL[actor.role] || String(actor.role || '').replace(/_/g, ' ') || 'Team member';
  const fields = buildExportNoticeFields({
    orgName: brand.name,
    actorName,
    actorRole,
    actorEmail: actor.email || '',
    count,
    selected: Boolean(selected),
    filename,
    exportedAt,
    timeZone,
  });

  const html = wrapBrandedEmailHtml({
    title: 'Candidate data was exported',
    eyebrow: 'Security notice',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">
        ${escapeHtml(actorName)} exported candidate records from ${escapeHtml(brand.name || 'your ATS')}.
      </p>
      ${infoPanelHtml(fields, brand.brandColor)}
      <p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">
        Times are shown in your organization timezone (${escapeHtml(tzAbbrev(timeZone))}).
      </p>`,
  });
  const when = formatOrgDateTime(exportedAt, timeZone);
  const text = [
    `${actorName} (${actorRole}) exported ${count} candidate(s) from ${brand.name || 'the ATS'}.`,
    actor.email ? `Login ID: ${actor.email}` : '',
    `When: ${when}`,
    filename ? `File: ${filename}` : '',
  ].filter(Boolean).join('\n');

  let emailed = 0;
  for (const owner of recipients) {
    try {
      await sendEmail(
        owner.email,
        `${brand.name || 'ATS'} · candidate export by ${actorName}`,
        html,
        text,
        {
          senderName: brand.name,
          organizationId,
          system: true,
        }
      );
      emailed += 1;
    } catch (err) {
      logger.warn({ err: err.message, to: owner.email }, '[candidate-export] owner email failed');
    }
  }
  return { emailed };
}

async function exportCandidates({ user, scopeFilter, ids, selected }) {
  const idList = sanitizeIds(ids);
  if (!idList.length) {
    const err = new Error('Select candidates to export');
    err.statusCode = 400;
    throw err;
  }

  const exportedAt = new Date();
  const timeZone = await loadOrgTimezone(user.organizationId);
  const rows = await Candidate.find({
    _id: { $in: idList },
    ...scopeFilter,
  }).select(EXPORT_COLUMNS.map((c) => c.key).join(' ')).lean();

  const buffer = await buildWorkbookBuffer(rows.map((row) => rowFromCandidate(row, timeZone)));
  const filename = exportFileName(exportedAt, timeZone);
  const actor = {
    id: String(user.id || user._id || ''),
    name: user.name || '',
    email: user.email || '',
    role: user.role || '',
    organizationId: user.organizationId,
  };

  try {
    await notifyOwnersOfExport({
      actor,
      organizationId: user.organizationId,
      count: rows.length,
      selected: Boolean(selected),
      filename,
      exportedAt,
      timeZone,
    });
  } catch (err) {
    logger.warn({ err: err.message }, '[candidate-export] owner notify failed');
  }

  return { buffer, filename, count: rows.length };
}

module.exports = {
  CANDIDATE_EXPORT_ROLES,
  MAX_EXPORT_IDS,
  DEFAULT_TZ,
  canExportCandidates,
  sanitizeIds,
  formatOrgDateTime,
  formatOrgDate,
  formatOrgTime,
  rowFromCandidate,
  ownerNotifyRecipients,
  buildExportNoticeFields,
  exportFileName,
  exportCandidates,
};

