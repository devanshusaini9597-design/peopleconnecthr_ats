import { authenticatedFetch } from './fetchUtils';

/** Keep each POST well under the server 10mb JSON body limit. */
export const IMPORT_CHUNK_SIZE = 200;
export const PENDING_SAVE_CHUNK_SIZE = 200;

/** Only fields the import endpoint needs — drops original/validation bloat. */
export function slimReadyRecord(row) {
  const fixed = row?.fixed || row || {};
  return {
    fixed: {
      name: fixed.name || '',
      email: fixed.email || '',
      contact: fixed.contact || fixed.phone || '',
      position: fixed.position || '',
      companyName: fixed.companyName || fixed.company || '',
      location: fixed.location || '',
      ctc: fixed.ctc || '',
      expectedCtc: fixed.expectedCtc || '',
      experience: fixed.experience != null ? String(fixed.experience) : '',
      noticePeriod: fixed.noticePeriod || '',
      status: fixed.status || 'Applied',
      source: fixed.source || '',
      client: fixed.client || '',
      spoc: fixed.spoc || '',
      remark: fixed.remark || '',
      fls: fixed.fls || '',
      date: fixed.date || '',
      skills: fixed.skills || '',
      product: fixed.product || '',
      pan: fixed.pan || '',
    },
  };
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postImportChunk(readySlice, reviewSlice, attempt = 1) {
  const res = await authenticatedFetch('/candidates/import-reviewed', {
    method: 'POST',
    body: JSON.stringify({ readyRecords: readySlice, reviewRecords: reviewSlice }),
  });

  const data = await res.json().catch(() => ({}));

  // Retry once on gateway / rate-limit / transient errors
  if (!res.ok && attempt < 3 && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504 || res.status >= 500)) {
    await sleep(800 * attempt);
    return postImportChunk(readySlice, reviewSlice, attempt + 1);
  }

  if (!res.ok) {
    const hint = res.status === 413 || /entity too large|payload|request entity/i.test(String(data.message || ''))
      ? ' Payload too large — try importing fewer rows at once.'
      : '';
    const err = new Error((data.message || `Import failed (HTTP ${res.status})`) + hint);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Import ready (and optional review) records in chunks.
 * Continues after a failed chunk so partial progress is kept.
 */
export async function importReviewedInChunks({
  readyRecords = [],
  reviewRecords = [],
  chunkSize = IMPORT_CHUNK_SIZE,
  onProgress,
} = {}) {
  // Dedupe by email client-side (last wins) to cut payload + server conflicts
  const readyMap = new Map();
  for (const row of readyRecords || []) {
    const slim = slimReadyRecord(row);
    const email = String(slim.fixed.email || '').trim().toLowerCase();
    if (!email) continue;
    slim.fixed.email = email;
    readyMap.set(email, slim);
  }
  const ready = [...readyMap.values()];

  const reviewMap = new Map();
  for (const row of reviewRecords || []) {
    const slim = row?.fixed || row?.original ? slimReadyRecord(row) : slimReadyRecord({ fixed: row });
    const email = String(slim.fixed.email || '').trim().toLowerCase();
    if (!email) continue;
    slim.fixed.email = email;
    reviewMap.set(email, slim);
  }
  const review = [...reviewMap.values()];

  if (ready.length === 0 && review.length === 0) {
    return { success: true, imported: 0, upserted: 0, modified: 0, message: 'No ready records to import' };
  }

  const readyChunks = chunkArray(ready, chunkSize);
  const reviewChunks = chunkArray(review, chunkSize);
  const totalChunks = Math.max(readyChunks.length, reviewChunks.length, 1);

  let imported = 0;
  let upserted = 0;
  let modified = 0;
  let writeErrors = 0;
  let failedChunks = 0;
  const chunkErrors = [];

  for (let i = 0; i < totalChunks; i++) {
    const readySlice = readyChunks[i] || [];
    const reviewSlice = reviewChunks[i] || [];
    if (readySlice.length === 0 && reviewSlice.length === 0) continue;

    onProgress?.({
      chunk: i + 1,
      totalChunks,
      sent: Math.min((i + 1) * chunkSize, ready.length + review.length),
      total: ready.length + review.length,
    });

    try {
      const data = await postImportChunk(readySlice, reviewSlice);
      imported += data.imported || 0;
      upserted += data.upserted || 0;
      modified += data.modified || 0;
      writeErrors += data.writeErrors || 0;
    } catch (err) {
      failedChunks += 1;
      chunkErrors.push(`Batch ${i + 1}/${totalChunks}: ${err.message}`);
      // Keep going — earlier batches may already be saved
    }
  }

  if (imported === 0 && failedChunks === totalChunks) {
    throw new Error(chunkErrors[0] || 'Import failed for all batches');
  }

  return {
    success: failedChunks === 0,
    imported,
    upserted,
    modified,
    writeErrors,
    failedChunks,
    chunkErrors,
    message: failedChunks
      ? `Imported ${imported} candidates (${failedChunks} batch(es) failed — retry those)`
      : `Successfully imported ${imported} candidates`,
  };
}

/**
 * Save pending review/blocked rows in chunks (same 10mb limit).
 */
export async function savePendingInChunks({ records, fileName, chunkSize = PENDING_SAVE_CHUNK_SIZE } = {}) {
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0) {
    throw new Error('No records provided');
  }

  const chunks = chunkArray(list, chunkSize);
  let count = 0;
  let batchId = null;
  let failed = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const res = await authenticatedFetch('/candidates/pending/save', {
        method: 'POST',
        body: JSON.stringify({ records: chunks[i], fileName, batchId: batchId || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Could not save pending (batch ${i + 1}/${chunks.length})`);
      }
      count += data.count ?? chunks[i].length;
      if (data.batchId) batchId = data.batchId;
    } catch (err) {
      failed += 1;
      if (failed === chunks.length) throw err;
    }
  }

  return { success: failed === 0, count, batchId, failedChunks: failed };
}
