/**
 * Canonical "when was this candidate added/applied" for analytics.
 * Excel imports store the real date in `date` (string); createdAt is import time.
 */
const MS_DAY = 24 * 60 * 60 * 1000;

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Excel serial (days since 1899-12-30) → Date */
function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1 || n > 60000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(n * MS_DAY);
  const d = new Date(utc);
  return isValidDate(d) ? d : null;
}

/**
 * Parse candidate record date from Excel / manual entry strings.
 * Supports ISO, DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, and Excel serials.
 */
function parseRecordDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isValidDate(value) ? value : null;

  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Pure Excel serial as string
  if (/^\d{4,5}(\.\d+)?$/.test(raw)) {
    const fromSerial = excelSerialToDate(Number(raw));
    if (fromSerial) return fromSerial;
  }

  // ISO yyyy-mm-dd
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0));
    if (isValidDate(d)) return d;
  }

  // dd-mm-yyyy or dd/mm/yyyy (common in India)
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let day = Number(dmy[1]);
    let month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    // If first part > 12, it's definitely day-first
    if (day <= 12 && month <= 12 && day > month) {
      // ambiguous — prefer day-first for Indian ATS
    }
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (isValidDate(d) && d.getUTCFullYear() === year) return d;
  }

  // "15 Jan 2023" / "02 Sept 2026" / "3 August 2026" — normalize to UTC noon so
  // calendar day matches the DATE column (avoids IST off-by-one from local parse).
  const monName = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (monName) {
    const months = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8,
      oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
    };
    const mi = months[monName[2].toLowerCase()];
    const day = Number(monName[1]);
    const year = Number(monName[3]);
    if (mi != null && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, mi, day, 12, 0, 0));
      if (isValidDate(d) && d.getUTCFullYear() === year && d.getUTCMonth() === mi) return d;
    }
  }

  // Fallback native parse
  const parsed = new Date(raw);
  if (isValidDate(parsed) && parsed.getFullYear() >= 1990 && parsed.getFullYear() <= 2100) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
  }

  return null;
}

/** Resolve appliedAt for a candidate doc (DB row or import payload). */
function resolveAppliedAt(candidate, fallback = null) {
  const fromDate = parseRecordDate(candidate?.date);
  if (fromDate) return fromDate;
  if (candidate?.appliedAt && isValidDate(new Date(candidate.appliedAt))) {
    return new Date(candidate.appliedAt);
  }
  if (candidate?.createdAt && isValidDate(new Date(candidate.createdAt))) {
    return new Date(candidate.createdAt);
  }
  return fallback ? new Date(fallback) : null;
}

/** Mongo $expr helper: effective activity timestamp for aggregations. */
function activityDateExpr() {
  return { $ifNull: ['$appliedAt', '$createdAt'] };
}

/**
 * Mongo sort spec for the ATS candidate list.
 * Default / "date" uses entry date (appliedAt from Excel/manual date),
 * not createdAt (import time) — otherwise the DATE column looks scrambled.
 */
function candidateListSortSpec(sortField, sortOrder) {
  const dir = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const field = String(sortField || 'date').toLowerCase();
  if (field === 'name') return { name: dir, createdAt: -1 };
  if (field === 'email') return { email: dir, createdAt: -1 };
  if (field === 'position') return { position: dir, createdAt: -1 };
  if (field === 'location') return { location: dir, createdAt: -1 };
  if (field === 'company') return { companyName: dir, createdAt: -1 };
  if (field === 'status') return { status: dir, createdAt: -1 };
  if (field === 'spoc') return { spoc: dir, createdAt: -1 };
  if (field === 'createdat' || field === 'created_at') return { createdAt: dir, _id: dir };
  // date / default — entry date shown in the DATE column
  return { appliedAt: dir, createdAt: dir, _id: dir };
}

/** Merge base scope filter with activity-date range (appliedAt, fallback createdAt). */
function withActivityDateRange(baseFilter, dateFilter) {
  if (!dateFilter) return baseFilter;
  const clauses = [];
  if (dateFilter.$gte) {
    clauses.push({ $gte: [activityDateExpr(), dateFilter.$gte] });
  }
  if (dateFilter.$lte) {
    clauses.push({ $lte: [activityDateExpr(), dateFilter.$lte] });
  }
  if (dateFilter.$lt) {
    clauses.push({ $lt: [activityDateExpr(), dateFilter.$lt] });
  }
  if (!clauses.length) return baseFilter;
  return { ...baseFilter, $expr: { $and: clauses } };
}

const backfillInFlight = new Map();

/**
 * Backfill appliedAt from Excel/manual `date` so DATE-column sort is correct.
 * Concurrent callers for the same org share one run; completed orgs can re-run
 * (cheap no-ops) so a prior race/crash cannot permanently skip heal.
 */
async function backfillAppliedAtForOrg(organizationId, Candidate) {
  const key = String(organizationId || '');
  if (!key) return 0;

  if (backfillInFlight.has(key)) {
    return backfillInFlight.get(key);
  }

  const run = (async () => {
    const batch = 400;
    let lastId = null;
    let updated = 0;

    for (;;) {
      const q = { organizationId };
      if (lastId) q._id = { $gt: lastId };
      const rows = await Candidate.find(q)
        .select('_id date createdAt appliedAt')
        .sort({ _id: 1 })
        .limit(batch)
        .lean();
      if (!rows.length) break;

      const ops = [];
      for (const row of rows) {
        const target = resolveAppliedAt(row);
        if (!target) continue;
        const current = row.appliedAt ? new Date(row.appliedAt).getTime() : null;
        const targetMs = target.getTime();
        // Heal whenever entry date disagrees with appliedAt (import-time pollution)
        if (current != null && Math.abs(current - targetMs) < MS_DAY) continue;
        ops.push({
          updateOne: {
            filter: { _id: row._id },
            update: { $set: { appliedAt: target } },
          },
        });
      }
      if (ops.length) {
        await Candidate.bulkWrite(ops, { ordered: false });
        updated += ops.length;
      }
      lastId = rows[rows.length - 1]._id;
      if (rows.length < batch) break;
    }

    if (updated > 0) {
      const logger = require('./logger');
      logger.info({ organizationId: key, updated }, '[analytics] backfilled appliedAt from record dates');
    }
    return updated;
  })();

  backfillInFlight.set(key, run);
  try {
    return await run;
  } finally {
    backfillInFlight.delete(key);
  }
}

module.exports = {
  parseRecordDate,
  resolveAppliedAt,
  activityDateExpr,
  candidateListSortSpec,
  withActivityDateRange,
  backfillAppliedAtForOrg,
};
