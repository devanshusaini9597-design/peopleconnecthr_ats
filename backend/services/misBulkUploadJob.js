/**
 * Async MIS Excel import jobs with live progress (created / duplicates / failed).
 * In-memory store — fine for single-instance Railway; jobs expire after 1h.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const MisContact = require('../models/MisContact');
const { normalizeText } = require('../utils/textNormalize');
const logger = require('../utils/logger');

const misUploadJobs = new Map();
const MIS_JOB_TTL_MS = 60 * 60 * 1000;

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

function cellStr(row, col) {
  if (!col) return '';
  const cell = row.getCell(col);
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

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

    if (norm === 'fls' || norm === 'nonfls') set('fls', colNumber, 10);
    else if (has('fls')) set('fls', colNumber, 5);

    if (norm === 'source') set('source', colNumber, 10);
    else if (has('source')) set('source', colNumber, 5);

    if (norm === 'remark' || norm === 'remarks' || norm === 'notes') set('remark', colNumber, 10);
    else if (has('remark') || has('note')) set('remark', colNumber, 5);
  });

  const map = {};
  Object.keys(candidates).forEach((k) => { map[k] = candidates[k].col; });
  return map;
}

function jobSnapshot(job) {
  if (!job) return null;
  const processed = (job.created || 0)
    + (job.duplicates || 0)
    + (job.duplicatesInFile || 0)
    + (job.skipped || 0)
    + (job.blank || 0);
  const totalRows = job.totalRows || 0;
  const percent = totalRows > 0
    ? Math.min(100, Math.round((processed / totalRows) * 100))
    : (job.status === 'done' ? 100 : 0);
  return {
    jobId: job.jobId,
    status: job.status,
    phase: job.status === 'done' ? 'done' : job.status === 'error' ? 'error' : 'processing',
    fileName: job.fileName || '',
    totalRows,
    pendingTotal: job.pendingTotal || 0,
    processed,
    percent,
    created: job.created || 0,
    duplicates: job.duplicates || 0,
    duplicatesInFile: job.duplicatesInFile || 0,
    skipped: job.skipped || 0,
    blank: job.blank || 0,
    updated: 0,
    errors: (job.errors || []).slice(0, 40),
    error: job.error || null,
    message: job.status === 'done'
      ? `Done · ${job.created || 0} added · ${job.duplicates || 0} duplicates · ${job.duplicatesInFile || 0} in-file repeats · ${job.skipped || 0} failed/invalid`
      : job.status === 'error'
        ? (job.error || 'Import failed')
        : `Processing ${processed.toLocaleString()} of ${totalRows.toLocaleString()} rows…`,
  };
}

function scheduleJobCleanup(jobId) {
  setTimeout(() => { misUploadJobs.delete(jobId); }, MIS_JOB_TTL_MS);
}

async function processMisUploadJob(jobId) {
  const job = misUploadJobs.get(jobId);
  if (!job || job.status !== 'processing') return;

  const CHUNK = 100;
  const { organizationId, createdBy, pending } = job;

  try {
    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK);
      const emails = chunk.map((c) => c.payload.email);
      let existingEmails = new Set();
      try {
        const existingRows = await MisContact.find({
          organizationId,
          email: { $in: emails },
        }).select('email').lean();
        existingEmails = new Set(existingRows.map((e) => e.email));
      } catch (err) {
        job.skipped += chunk.length;
        if (job.errors.length < 50) {
          job.errors.push({ row: chunk[0]?.row, message: err.message || 'Lookup failed' });
        }
        continue;
      }

      const ops = [];
      for (const item of chunk) {
        if (existingEmails.has(item.payload.email)) {
          job.duplicates += 1;
          continue;
        }
        ops.push({
          insertOne: {
            document: {
              organizationId,
              createdBy,
              ...item.payload,
              unsubscribeSecret: crypto.randomBytes(16).toString('hex'),
            },
          },
        });
      }

      if (ops.length) {
        try {
          const result = await MisContact.bulkWrite(ops, { ordered: false });
          job.created += result.insertedCount || Number(result.nInserted || 0) || 0;
        } catch (err) {
          for (const item of chunk) {
            if (existingEmails.has(item.payload.email)) continue;
            try {
              const doc = new MisContact({
                organizationId,
                createdBy,
                ...item.payload,
              });
              doc.ensureUnsubscribeSecret();
              await doc.save();
              job.created += 1;
            } catch (rowErr) {
              if (rowErr?.code === 11000) {
                job.duplicates += 1;
              } else {
                job.skipped += 1;
                if (job.errors.length < 50) {
                  job.errors.push({ row: item.row, message: rowErr.message || 'Row failed' });
                }
              }
            }
          }
          logger.warn({ err: err.message, jobId }, 'MIS upload job chunk fell back to per-row');
        }
      }

      await new Promise((r) => setImmediate(r));
    }

    job.pending = [];
    job.status = 'done';
  } catch (err) {
    job.status = 'error';
    job.error = err.message || 'Import failed';
    logger.error({ err: err.message, jobId }, 'MIS upload job failed');
  }
}

async function startBulkUploadJob(user, file) {
  if (!user || user.role !== 'owner') {
    throw httpError('MIS is available to the company owner only', 403, { code: 'MIS_OWNER_ONLY' });
  }
  if (!file) throw httpError('Excel file is required');
  const filePath = file.path
    || path.join(process.cwd(), 'uploads', file.filename);
  if (!fs.existsSync(filePath)) throw httpError('Uploaded file not found', 400);

  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(file.originalname || '').toLowerCase();
  try {
    if (ext === '.csv') await workbook.csv.readFile(filePath);
    else await workbook.xlsx.readFile(filePath);
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw httpError(err.message || 'Could not read spreadsheet', 400);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw httpError('Spreadsheet is empty');
  }

  const headerRow = sheet.getRow(1);
  const map = autoDetectHeaderMapping(headerRow);
  if (!map.name || !map.email) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw httpError('Spreadsheet must include Name and Email columns');
  }

  const batchId = `mis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const organizationId = user.organizationId;
  const createdBy = user.id || user._id;
  const pending = [];
  const seenEmails = new Set();
  let duplicatesInFile = 0;
  let skipped = 0;
  let blank = 0;
  const errors = [];

  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const name = cellStr(row, map.name);
    const email = normalizeEmail(cellStr(row, map.email));
    if (!name && !email) {
      blank += 1;
      continue;
    }
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      skipped += 1;
      if (errors.length < 50) errors.push({ row: r, message: 'Name and valid email required' });
      continue;
    }
    if (seenEmails.has(email)) {
      duplicatesInFile += 1;
      if (errors.length < 50) {
        errors.push({ row: r, message: 'Duplicate email in this file — kept first row only' });
      }
      continue;
    }
    seenEmails.add(email);

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
    pending.push({ row: r, payload });
  }

  try { fs.unlinkSync(filePath); } catch { /* ignore */ }

  const totalRows = Math.max(0, sheet.rowCount - 1);
  const jobId = `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const job = {
    jobId,
    organizationId: String(organizationId),
    userId: String(user.id || user._id),
    fileName: file.originalname || file.filename || 'upload',
    status: 'processing',
    batchId,
    createdBy,
    pending,
    pendingTotal: pending.length,
    totalRows,
    created: 0,
    duplicates: 0,
    duplicatesInFile,
    skipped,
    blank,
    errors,
    error: null,
    startedAt: Date.now(),
  };
  misUploadJobs.set(jobId, job);
  scheduleJobCleanup(jobId);

  setImmediate(() => {
    processMisUploadJob(jobId).catch((err) => {
      const j = misUploadJobs.get(jobId);
      if (j) {
        j.status = 'error';
        j.error = err.message || 'Import failed';
      }
    });
  });

  return {
    ...jobSnapshot(job),
    async: true,
  };
}

function getBulkUploadJob(user, jobId) {
  if (!user || user.role !== 'owner') {
    throw httpError('MIS is available to the company owner only', 403, { code: 'MIS_OWNER_ONLY' });
  }
  const job = misUploadJobs.get(String(jobId || ''));
  if (!job) throw httpError('Upload job not found or expired', 404, { code: 'JOB_NOT_FOUND' });
  if (String(job.organizationId) !== String(user.organizationId)
    || String(job.userId) !== String(user.id || user._id)) {
    throw httpError('Upload job not found or expired', 404, { code: 'JOB_NOT_FOUND' });
  }
  return jobSnapshot(job);
}

module.exports = {
  startBulkUploadJob,
  getBulkUploadJob,
};
