/**
 * MIS / Marketing contacts — Excel import, list, consent, marketing send.
 * Never writes to Candidate / Application collections.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const MisContact = require('../models/MisContact');
const { misListFilter, canViewOrgAnalytics } = require('../utils/dataScope');
const { normalizeText } = require('../utils/textNormalize');
const { publicSiteBase } = require('./emailBrandLayout');
const logger = require('../utils/logger');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function trimStr(v) {
  return String(v ?? '').trim();
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function phoneDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

const TEXT_FIELDS = [
  'name', 'position', 'location', 'state', 'companyName', 'experience',
  'ctc', 'expectedCtc', 'noticePeriod', 'skills', 'product', 'client', 'fls', 'source', 'remark',
];

function autoDetectHeaderMapping(headerRow) {
  const candidates = {};
  const set = (field, col, priority) => {
    if (!candidates[field] || candidates[field].priority < priority) {
      candidates[field] = { col, priority };
    }
  };
  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value || '').toLowerCase().trim();
    const norm = header.replace(/[^a-z0-9]/g, '');
    const has = (s) => header.includes(s) || norm.includes(s.replace(/[^a-z0-9]/g, ''));

    if (norm === 'name' || norm === 'candidatename' || norm === 'fullname') set('name', colNumber, 10);
    else if ((has('name') || has('candidate')) && !has('company')) set('name', colNumber, 5);

    if (norm === 'email' || norm === 'emailid') set('email', colNumber, 10);
    else if (has('email') || has('mail')) set('email', colNumber, 5);

    if (norm === 'contact' || norm === 'phone' || norm === 'mobile') set('contact', colNumber, 10);
    else if (has('contact') || has('phone') || has('mobile')) set('contact', colNumber, 5);

    if (norm === 'position' || norm === 'designation' || norm === 'role') set('position', colNumber, 10);
    else if (has('position') || has('role') || has('designation')) set('position', colNumber, 5);

    if (norm === 'company' || norm === 'companyname') set('companyName', colNumber, 10);
    else if (has('company') || has('employer')) set('companyName', colNumber, 5);

    if (norm === 'experience' || norm === 'exp') set('experience', colNumber, 10);
    else if (has('experience') || has('exp')) set('experience', colNumber, 5);

    if (norm === 'ctc' || norm === 'currentctc') set('ctc', colNumber, 10);
    else if (has('ctc') && !has('expected')) set('ctc', colNumber, 5);

    if (norm === 'expectedctc' || norm === 'ectc') set('expectedCtc', colNumber, 10);
    else if (has('expected') && has('ctc')) set('expectedCtc', colNumber, 5);

    if (norm === 'notice' || norm === 'noticeperiod') set('noticePeriod', colNumber, 10);
    else if (has('notice')) set('noticePeriod', colNumber, 5);

    if (norm === 'location' || norm === 'city') set('location', colNumber, 10);
    else if (has('location') || has('city')) set('location', colNumber, 5);

    if (norm === 'skills' || norm === 'skill') set('skills', colNumber, 10);
    else if (has('skill')) set('skills', colNumber, 5);

    if (norm === 'product') set('product', colNumber, 10);
    else if (has('product')) set('product', colNumber, 5);

    if (norm === 'client') set('client', colNumber, 10);
    else if (has('client')) set('client', colNumber, 5);

    if (norm === 'fls') set('fls', colNumber, 10);
    else if (has('fls')) set('fls', colNumber, 5);

    if (norm === 'source') set('source', colNumber, 10);
    else if (has('source')) set('source', colNumber, 5);

    if (norm === 'remark' || norm === 'remarks' || norm === 'notes') set('remark', colNumber, 10);
    else if (has('remark') || has('note')) set('remark', colNumber, 5);
  });

  const map = {};
  Object.entries(candidates).forEach(([k, v]) => { map[k] = v.col; });
  return map;
}

function cellStr(row, col) {
  if (!col) return '';
  const cell = row.getCell(col);
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function unsubscribeUrlFor(contact) {
  const secret = contact.ensureUnsubscribeSecret();
  const token = MisContact.unsubscribeTokenFor(contact._id, secret);
  const base = (publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const apiBase = (process.env.BACKEND_URL || process.env.API_URL || '').replace(/\/$/, '');
  // Prefer API unsubscribe endpoint (works without frontend route)
  const root = apiBase || base;
  if (!root) return '';
  return `${root}/api/mis/unsubscribe?id=${contact._id}&token=${token}`;
}

async function listContacts(user, query = {}) {
  const organizationId = user.organizationId;
  if (!organizationId) throw httpError('Organization required', 403);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const q = trimStr(query.q);
  const filter = misListFilter(organizationId, user);
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [
      { name: rx }, { email: rx }, { phone: rx }, { contact: rx },
      { position: rx }, { companyName: rx }, { location: rx }, { client: rx },
    ];
  }
  if (query.consent === 'yes') filter.marketingConsent = true;
  if (query.consent === 'no') filter.marketingConsent = false;
  if (query.unsubscribed === '1') filter.unsubscribedAt = { $ne: null };
  if (query.unsubscribed === '0') filter.unsubscribedAt = null;

  const [rows, total] = await Promise.all([
    MisContact.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean(),
    MisContact.countDocuments(filter),
  ]);

  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
    scope: canViewOrgAnalytics(user) ? 'organization' : 'mine',
  };
}

async function getContact(user, id) {
  const filter = misListFilter(user.organizationId, user, { _id: id });
  const row = await MisContact.findOne(filter).populate('createdBy', 'name email');
  if (!row) throw httpError('Contact not found', 404);
  return row;
}

async function createContact(user, body = {}) {
  const organizationId = user.organizationId;
  const email = normalizeEmail(body.email);
  const name = trimStr(body.name);
  if (!name) throw httpError('Name is required');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw httpError('Valid email is required');
  }
  const existing = await MisContact.findOne({ organizationId, email });
  if (existing) throw httpError('This email already exists in MIS', 409, { code: 'DUPLICATE_EMAIL' });

  const phone = phoneDigits(body.phone || body.contact);
  const doc = new MisContact({
    organizationId,
    createdBy: user.id || user._id,
    name: normalizeText(name),
    email,
    contact: phone,
    phone,
    marketingConsent: body.marketingConsent !== false,
    source: trimStr(body.source) || 'MIS Manual',
  });
  for (const key of TEXT_FIELDS) {
    if (key === 'name' || key === 'source') continue;
    if (body[key] != null) doc[key] = normalizeText(trimStr(body[key]));
  }
  doc.ensureUnsubscribeSecret();
  await doc.save();
  return doc;
}

async function updateContact(user, id, body = {}) {
  const filter = misListFilter(user.organizationId, user, { _id: id });
  const doc = await MisContact.findOne(filter);
  if (!doc) throw httpError('Contact not found', 404);

  if (body.name != null) doc.name = normalizeText(trimStr(body.name)) || doc.name;
  if (body.email != null) {
    const email = normalizeEmail(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpError('Valid email is required');
    if (email !== doc.email) {
      const clash = await MisContact.findOne({ organizationId: user.organizationId, email, _id: { $ne: doc._id } });
      if (clash) throw httpError('This email already exists in MIS', 409, { code: 'DUPLICATE_EMAIL' });
      doc.email = email;
    }
  }
  if (body.phone != null || body.contact != null) {
    const phone = phoneDigits(body.phone || body.contact);
    doc.phone = phone;
    doc.contact = phone;
  }
  for (const key of TEXT_FIELDS) {
    if (key === 'name') continue;
    if (body[key] != null) doc[key] = normalizeText(trimStr(body[key]));
  }
  if (typeof body.marketingConsent === 'boolean') {
    doc.marketingConsent = body.marketingConsent;
    if (body.marketingConsent && doc.unsubscribedAt) {
      // Re-consent clears unsubscribe
      doc.unsubscribedAt = null;
    }
  }
  doc.ensureUnsubscribeSecret();
  await doc.save();
  return doc;
}

async function deleteContact(user, id) {
  const filter = misListFilter(user.organizationId, user, { _id: id });
  const doc = await MisContact.findOneAndDelete(filter);
  if (!doc) throw httpError('Contact not found', 404);
  return { deleted: true };
}

async function bulkDelete(user, ids = []) {
  const idList = (ids || []).map(String).filter(Boolean);
  if (!idList.length) throw httpError('No contacts selected');
  const filter = misListFilter(user.organizationId, user, { _id: { $in: idList } });
  const result = await MisContact.deleteMany(filter);
  return { deleted: result.deletedCount || 0 };
}

async function bulkUpload(user, file) {
  if (!file) throw httpError('Excel file is required');
  const filePath = file.path
    || path.join(process.cwd(), 'uploads', file.filename);
  if (!fs.existsSync(filePath)) throw httpError('Uploaded file not found', 400);

  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.csv') {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw httpError('Spreadsheet is empty');

  const headerRow = sheet.getRow(1);
  const map = autoDetectHeaderMapping(headerRow);
  if (!map.name || !map.email) {
    throw httpError('Spreadsheet must include Name and Email columns');
  }

  const batchId = `mis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const organizationId = user.organizationId;
  const createdBy = user.id || user._id;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const name = cellStr(row, map.name);
    const email = normalizeEmail(cellStr(row, map.email));
    if (!name && !email) continue;
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      skipped += 1;
      errors.push({ row: r, message: 'Name and valid email required' });
      continue;
    }
    try {
      const phone = phoneDigits(cellStr(row, map.contact));
      const payload = {
        name: normalizeText(name),
        email,
        phone,
        contact: phone,
        uploadBatchId: batchId,
        source: normalizeText(cellStr(row, map.source)) || 'MIS Upload',
        marketingConsent: true,
      };
      for (const key of ['position', 'companyName', 'experience', 'ctc', 'expectedCtc', 'noticePeriod', 'location', 'skills', 'product', 'client', 'fls', 'remark']) {
        if (map[key]) payload[key] = normalizeText(cellStr(row, map[key]));
      }

      const existing = await MisContact.findOne({ organizationId, email });
      if (existing) {
        // Only update if leadership or owner of the row
        const canEdit = canViewOrgAnalytics(user)
          || String(existing.createdBy) === String(createdBy);
        if (!canEdit) {
          skipped += 1;
          errors.push({ row: r, message: 'Email owned by another uploader' });
          continue;
        }
        Object.assign(existing, payload);
        existing.ensureUnsubscribeSecret();
        await existing.save();
        updated += 1;
      } else {
        const doc = new MisContact({
          organizationId,
          createdBy,
          ...payload,
        });
        doc.ensureUnsubscribeSecret();
        await doc.save();
        created += 1;
      }
    } catch (err) {
      skipped += 1;
      errors.push({ row: r, message: err.message || 'Row failed' });
    }
  }

  try { fs.unlinkSync(filePath); } catch { /* ignore */ }

  return {
    batchId,
    created,
    updated,
    skipped,
    errors: errors.slice(0, 40),
    message: `Imported ${created} new, updated ${updated}, skipped ${skipped}`,
  };
}

async function sendMarketingToMis(user, body = {}) {
  const ids = (body.ids || []).map(String).filter(Boolean);
  if (!ids.length) throw httpError('Select at least one contact');
  if (!trimStr(body.subject) || !trimStr(body.htmlBody)) {
    throw httpError('Subject and message body are required');
  }

  const filter = misListFilter(user.organizationId, user, {
    _id: { $in: ids },
    marketingConsent: true,
    unsubscribedAt: null,
  });
  const contacts = await MisContact.find(filter).select('email name unsubscribeSecret').lean();
  if (!contacts.length) {
    throw httpError('No eligible contacts (need consent and not unsubscribed)');
  }

  // Append unsubscribe footer note when possible
  const { sendMarketing } = require('./emailOutboundService');
  const recipients = contacts.map((c) => c.email);
  // Rebuild docs for URL helper when needed
  const withFooter = `${body.htmlBody}
<p style="margin-top:24px;font-size:12px;color:#64748b;">
  You are receiving this as part of a marketing list. To unsubscribe, reply or use the link in your campaign settings.
</p>`;

  const result = await sendMarketing(user, {
    recipients,
    subject: body.subject,
    htmlBody: withFooter,
    campaignName: body.campaignName || `mis_${Date.now()}`,
    trackOpens: body.trackOpens !== false,
    trackClicks: body.trackClicks !== false,
  });

  return {
    ...result,
    attempted: ids.length,
    eligible: contacts.length,
  };
}

async function unsubscribePublic({ id, token }) {
  if (!id || !token) throw httpError('Invalid unsubscribe link', 400);
  const contact = await MisContact.findById(id);
  if (!contact) throw httpError('Contact not found', 404);
  const expected = MisContact.unsubscribeTokenFor(contact._id, contact.unsubscribeSecret);
  const a = Buffer.from(String(token));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw httpError('Invalid unsubscribe link', 403);
  }
  contact.marketingConsent = false;
  contact.unsubscribedAt = new Date();
  await contact.save();
  return {
    message: 'You have been unsubscribed from marketing emails.',
    email: contact.email,
  };
}

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  bulkDelete,
  bulkUpload,
  sendMarketingToMis,
  unsubscribePublic,
  unsubscribeUrlFor,
};
