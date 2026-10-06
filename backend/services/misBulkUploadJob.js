/**
 * Async MIS Excel import jobs with live progress (created / duplicates / failed).
 * In-memory store — fine for single-instance Railway; jobs expire after 1h.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const MisContact = require('../models/MisContact');
const { isMisCompanyRole } = require('../utils/dataScope');
const { normalizeText } = require('../utils/textNormalize');
const { autoDetectHeaderMapping } = require('../utils/misHeaderMap');
const { autoFixMisRow, looksLikeEmail } = require('../utils/misRowFix');
const { parseRecordDate } = require('../utils/candidateActivityDate');
const logger = require('../utils/logger');
const { clientSafeError } = require('../utils/clientSafeError');

function deskScopeForUser(user) {
  return user?.role === 'owner' ? 'org' : 'personal';
}

function cellValue(row, col) {
  if (!col) return null;
  const cell = row.getCell(col);
  const v = cell?.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.result != null) return v.result;
  if (typeof v === 'object' && v.text != null) return v.text;
  return v;
}

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

function hasAnyRowValue(raw) {
  return Object.values(raw || {}).some((v) => String(v || '').trim());
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

function jobSnapshot(job) {
  if (!job) return null;
  const processed = (job.created || 0)
    + (job.duplicates || 0)
    + (job.duplicatesInFile || 0)
    + (job.skipped || 0)
    + (job.blank || 0);
  const totalRows = job.totalRows || 0;
  const percent = job.status === 'parsing'
    ? 0
    : totalRows > 0
      ? Math.min(100, Math.round((processed / totalRows) * 100))
      : (job.status === 'done' ? 100 : 0);
  let message;
  if (job.status === 'done') {
    const backfilled = job.datesBackfilled || 0;
    message = `Done · ${job.created || 0} added · ${job.duplicates || 0} duplicates · ${job.duplicatesInFile || 0} in-file repeats · ${job.skipped || 0} failed/invalid`
      + (backfilled ? ` · ${backfilled} tracker dates filled` : '');
  } else if (job.status === 'error') {
    message = clientSafeError(job.error, 'The spreadsheet could not be imported. Check the file and try again.');
  } else if (job.status === 'parsing') {
    message = 'Reading spreadsheet…';
  } else {
    message = `Processing ${processed.toLocaleString()} of ${totalRows.toLocaleString()} rows…`;
  }
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
    datesBackfilled: job.datesBackfilled || 0,
    skipped: job.skipped || 0,
    blank: job.blank || 0,
    updated: job.datesBackfilled || 0,
    errors: (job.errors || []).slice(0, 40).map((entry) => ({
      ...entry,
      message: clientSafeError(entry?.message, 'This row could not be imported.'),
    })),
    error: job.error ? clientSafeError(job.error, 'The spreadsheet could not be imported. Check the file and try again.') : null,
    message,
  };
}

function scheduleJobCleanup(jobId) {
  setTimeout(() => { misUploadJobs.delete(jobId); }, MIS_JOB_TTL_MS);
}

function pushJobError(errors, sheetName, row, message) {
  if (errors.length >= 50) return;
  errors.push({
    row,
    sheet: sheetName || '',
    message,
  });
}

async function ingestSheet(sheet, { seenEmails, pending, errors, batchId }) {
  const sheetName = String(sheet?.name || 'Sheet').trim() || 'Sheet';
  let headerRow;
  try {
    headerRow = sheet.getRow(1);
  } catch {
    return { used: false, dataRows: 0, duplicatesInFile: 0, skipped: 0, blank: 0 };
  }
  const map = autoDetectHeaderMapping(headerRow);
  if (!map.name || !map.email) {
    return { used: false, dataRows: 0, duplicatesInFile: 0, skipped: 0, blank: 0 };
  }

  let duplicatesInFile = 0;
  let skipped = 0;
  let blank = 0;
  const last = Number(sheet.rowCount) || 1;

  for (let r = 2; r <= last; r += 1) {
    const row = sheet.getRow(r);
    const raw = {
      name: cellStr(row, map.name),
      email: cellStr(row, map.email),
      contact: map.contact ? cellStr(row, map.contact) : '',
      phone: '',
      source: map.source ? cellStr(row, map.source) : '',
    };
    for (const key of ['position', 'companyName', 'experience', 'ctc', 'expectedCtc', 'noticePeriod', 'location', 'skills', 'product', 'client', 'fls', 'remark', 'status']) {
      raw[key] = map[key] ? cellStr(row, map[key]) : '';
    }

    if (!hasAnyRowValue(raw)) {
      blank += 1;
      continue;
    }

    const { row: fixed, fixes } = autoFixMisRow(raw);
    const name = String(fixed.name || '').trim();
    const email = String(fixed.email || '').trim().toLowerCase();

    if (!name && !email) {
      blank += 1;
      continue;
    }
    if (!name || !looksLikeEmail(email)) {
      skipped += 1;
      pushJobError(
        errors,
        sheetName,
        r,
        fixes.length
          ? `Name and valid email required (tried auto-fix: ${fixes.join(', ')})`
          : 'Name and valid email required'
      );
      continue;
    }
    if (seenEmails.has(email)) {
      duplicatesInFile += 1;
      pushJobError(errors, sheetName, r, 'Duplicate email in this file — kept first row only');
      continue;
    }
    seenEmails.add(email);

    const phone = String(fixed.phone || fixed.contact || '').trim();
    const payload = {
      name: normalizeText(name),
      email,
      phone,
      contact: phone,
      uploadBatchId: batchId,
      source: normalizeText(fixed.source) || 'MIS Upload',
      marketingConsent: true,
    };
    for (const key of ['position', 'companyName', 'experience', 'ctc', 'expectedCtc', 'noticePeriod', 'location', 'skills', 'product', 'client', 'fls', 'remark', 'status']) {
      if (fixed[key]) payload[key] = normalizeText(fixed[key]);
    }
    const parsedDate = map.recordDate
      ? parseRecordDate(cellValue(row, map.recordDate))
      : null;
    if (parsedDate) payload.recordDate = parsedDate;
    pending.push({ row: r, sheet: sheetName, payload });
    if (r % 500 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return {
    used: true,
    dataRows: Math.max(0, last - 1),
    duplicatesInFile,
    skipped,
    blank,
  };
}

async function parseAndQueueRows(job) {
  const filePath = job.filePath;
  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(job.fileName || filePath || '').toLowerCase();
  try {
    if (ext === '.csv') await workbook.csv.readFile(filePath);
    else await workbook.xlsx.readFile(filePath);
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw httpError(err.message || 'Could not read spreadsheet', 400);
  }

  const sheets = Array.isArray(workbook.worksheets) ? workbook.worksheets.filter(Boolean) : [];
  if (!sheets.length) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw httpError('Spreadsheet is empty');
  }

  const pending = [];
  const seenEmails = new Set();
  const errors = [];
  let duplicatesInFile = 0;
  let skipped = 0;
  let blank = 0;
  let totalRows = 0;
  let usedSheets = 0;
  const skippedSheetNames = [];

  for (let i = 0; i < sheets.length; i += 1) {
    const stats = await ingestSheet(sheets[i], {
      seenEmails,
      pending,
      errors,
      batchId: job.batchId,
    });
    if (!stats.used) {
      const rowCount = Number(sheets[i].rowCount) || 0;
      if (rowCount > 1) skippedSheetNames.push(String(sheets[i].name || `Sheet ${i + 1}`));
      continue;
    }
    usedSheets += 1;
    totalRows += stats.dataRows;
    duplicatesInFile += stats.duplicatesInFile;
    skipped += stats.skipped;
    blank += stats.blank;
  }

  if (!usedSheets) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw httpError('Spreadsheet must include Name and Email columns on at least one sheet');
  }

  for (const name of skippedSheetNames) {
    pushJobError(errors, name, 1, 'Sheet skipped — no Name and Email headers');
  }

  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  job.filePath = null;

  job.pending = pending;
  job.pendingTotal = pending.length;
  job.totalRows = totalRows;
  job.duplicatesInFile = duplicatesInFile;
  job.skipped = skipped;
  job.blank = blank;
  job.errors = errors;
  job.status = 'processing';
}

async function runMisUploadJob(jobId) {
  const job = misUploadJobs.get(jobId);
  if (!job) return;
  try {
    job.status = 'parsing';
    await parseAndQueueRows(job);
    await processMisUploadJob(jobId);
  } catch (err) {
    const j = misUploadJobs.get(jobId);
    if (j) {
      j.status = 'error';
      j.error = err.message || 'Import failed';
      if (j.filePath) {
        try { fs.unlinkSync(j.filePath); } catch { /* ignore */ }
        j.filePath = null;
      }
    }
    logger.error({ err: err.message, jobId }, 'MIS upload job failed');
  }
}

async function processMisUploadJob(jobId) {
  const job = misUploadJobs.get(jobId);
  if (!job || job.status !== 'processing') return;

  const CHUNK = 100;
  const { organizationId, createdBy, pending, deskScope } = job;
  if (job.datesBackfilled == null) job.datesBackfilled = 0;

  try {
    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK);
      const emails = chunk.map((c) => c.payload.email);
      let existingByEmail = new Map();
      try {
        const existingRows = await MisContact.find({
          organizationId,
          email: { $in: emails },
        }).select('email recordDate').lean();
        existingByEmail = new Map(existingRows.map((e) => [e.email, e]));
      } catch (err) {
        job.skipped += chunk.length;
        if (job.errors.length < 50) {
          job.errors.push({ row: chunk[0]?.row, sheet: chunk[0]?.sheet, message: err.message || 'Lookup failed' });
        }
        continue;
      }

      const ops = [];
      for (const item of chunk) {
        const existing = existingByEmail.get(item.payload.email);
        if (existing) {
          job.duplicates += 1;
          // Recover tracker dates on already-imported rows that never stored them
          if (item.payload.recordDate && !existing.recordDate) {
            ops.push({
              updateOne: {
                filter: {
                  organizationId,
                  email: item.payload.email,
                  $or: [{ recordDate: null }, { recordDate: { $exists: false } }],
                },
                update: { $set: { recordDate: item.payload.recordDate } },
              },
            });
          }
          continue;
        }
        ops.push({
          insertOne: {
            document: {
              organizationId,
              createdBy,
              deskScope: deskScope || 'personal',
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
          job.datesBackfilled += result.modifiedCount || Number(result.nModified || 0) || 0;
        } catch (err) {
          for (const item of chunk) {
            if (existingByEmail.has(item.payload.email)) {
              if (item.payload.recordDate) {
                try {
                  const upd = await MisContact.updateOne(
                    {
                      organizationId,
                      email: item.payload.email,
                      $or: [{ recordDate: null }, { recordDate: { $exists: false } }],
                    },
                    { $set: { recordDate: item.payload.recordDate } }
                  );
                  if (upd.modifiedCount) job.datesBackfilled += 1;
                } catch { /* ignore */ }
              }
              continue;
            }
            try {
              const doc = new MisContact({
                organizationId,
                createdBy,
                deskScope: deskScope || 'personal',
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
                  job.errors.push({
                    row: item.row,
                    sheet: item.sheet,
                    message: clientSafeError(rowErr, 'This row could not be imported. Check the name and email, then try again.'),
                  });
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
    job.error = clientSafeError(err, 'The spreadsheet could not be imported. Check the file and try again.');
    logger.error({ err: err.message, jobId }, 'MIS upload job failed');
  }
}

/**
 * Accept uploaded file and return a jobId immediately.
 * Parse + DB import run in the background so Railway/proxy does not time out.
 */
async function startBulkUploadJob(user, file) {
  if (!user || !isMisCompanyRole(user)) {
    throw httpError('MIS is available to company employees only', 403, { code: 'MIS_COMPANY_ONLY' });
  }
  if (!file) throw httpError('Excel file is required');
  const filePath = file.path
    || path.join(process.cwd(), 'uploads', file.filename);
  if (!fs.existsSync(filePath)) throw httpError('Uploaded file not found', 400);

  const jobId = `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const batchId = `mis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const job = {
    jobId,
    organizationId: String(user.organizationId),
    userId: String(user.id || user._id),
    fileName: file.originalname || file.filename || 'upload',
    filePath,
    status: 'parsing',
    batchId,
    createdBy: user.id || user._id,
    deskScope: deskScopeForUser(user),
    pending: [],
    pendingTotal: 0,
    totalRows: 0,
    created: 0,
    duplicates: 0,
    duplicatesInFile: 0,
    datesBackfilled: 0,
    skipped: 0,
    blank: 0,
    errors: [],
    error: null,
    startedAt: Date.now(),
  };
  misUploadJobs.set(jobId, job);
  scheduleJobCleanup(jobId);

  setImmediate(() => {
    runMisUploadJob(jobId).catch((err) => {
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
  if (!user || !isMisCompanyRole(user)) {
    throw httpError('MIS is available to company employees only', 403, { code: 'MIS_COMPANY_ONLY' });
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
