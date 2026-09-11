/**
 * Map candidate/Excel statuses onto Organization.atsSettings.pipelineStages.
 * Never invent new stages on import — unknown values fall back to Rejected.
 */
const Organization = require('../models/Organization');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Job = require('../models/Job');
const { canonCandidateStatus, titleCaseStatus } = require('../utils/statusCanon');
const logger = require('../utils/logger');

function stageKey(value) {
  return String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function displayStage(value) {
  return canonCandidateStatus(value) || titleCaseStatus(value) || String(value || '').trim();
}

function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array(t.length + 1);
  const cur = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j += 1) prev[j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j += 1) prev[j] = cur[j];
  }
  return prev[t.length];
}

function fuzzyLimit(len) {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  if (len <= 16) return 2;
  return 3;
}

function buildStageMap(orgStages = []) {
  const byKey = new Map();
  for (const s of Array.isArray(orgStages) ? orgStages : []) {
    if (!s) continue;
    const k = stageKey(s);
    if (k && !byKey.has(k)) byKey.set(k, displayStage(s));
  }
  return byKey;
}

/**
 * Map a raw Excel/candidate status onto an existing org stage when possible.
 * options.unknownFallback — if set (e.g. 'Rejected'), unknown values use that
 * instead of creating a new stage label.
 */
function resolveStage(raw, orgStages = [], options = {}) {
  const unknownFallback = options.unknownFallback;
  const display = displayStage(raw);
  const key = stageKey(display);
  const byKey = buildStageMap(orgStages);

  const pickFallback = () => {
    const fbLabel = displayStage(unknownFallback || 'Rejected') || 'Rejected';
    const fbKey = stageKey(fbLabel);
    if (byKey.has(fbKey)) {
      return {
        label: byKey.get(fbKey),
        key: fbKey,
        matched: false,
        isNew: false,
        fallback: true,
      };
    }
    return {
      label: fbLabel,
      key: fbKey,
      matched: false,
      isNew: false,
      fallback: true,
    };
  };

  if (!key || key === 'UNSPECIFIED') {
    if (unknownFallback) return pickFallback();
    if (byKey.has('APPLIED')) {
      return { label: byKey.get('APPLIED'), key: 'APPLIED', matched: true, isNew: false };
    }
    return { label: 'Applied', key: 'APPLIED', matched: true, isNew: false };
  }

  if (byKey.has(key)) {
    return { label: byKey.get(key), key, matched: true, isNew: false };
  }

  let best = null;
  let bestDist = Infinity;
  let ties = 0;
  const limit = fuzzyLimit(key.length);
  if (limit > 0) {
    for (const [k, label] of byKey.entries()) {
      const d = levenshtein(key, k);
      if (d < bestDist) {
        bestDist = d;
        best = { label, key: k };
        ties = 1;
      } else if (d === bestDist) {
        ties += 1;
      }
    }
  }

  if (best && bestDist > 0 && bestDist <= limit && ties === 1) {
    return { label: best.label, key: best.key, matched: true, isNew: false, fuzzy: true };
  }

  if (unknownFallback) return pickFallback();

  return { label: display, key, matched: false, isNew: true };
}

async function loadOrgStages(orgId) {
  if (!orgId) return [];
  const org = await Organization.findById(orgId).select('atsSettings.pipelineStages').lean();
  return Array.isArray(org?.atsSettings?.pipelineStages) ? org.atsSettings.pipelineStages : [];
}

/**
 * Append missing stage labels to the org pipeline (manual / settings use only).
 */
async function promoteStages(orgId, names) {
  if (!orgId) return { added: [], stages: [] };
  const incoming = [...new Set(
    (Array.isArray(names) ? names : [names])
      .map((n) => displayStage(n))
      .filter(Boolean)
  )];
  if (!incoming.length) {
    const stages = await loadOrgStages(orgId);
    return { added: [], stages };
  }

  const org = await Organization.findById(orgId).select('atsSettings.pipelineStages');
  if (!org) return { added: [], stages: [] };

  const stages = Array.isArray(org.atsSettings?.pipelineStages)
    ? [...org.atsSettings.pipelineStages]
    : [];
  const seen = new Set(stages.map(stageKey).filter(Boolean));
  const added = [];

  for (const label of incoming) {
    const k = stageKey(label);
    if (!k || seen.has(k)) continue;
    stages.push(label);
    seen.add(k);
    added.push(label);
  }

  if (added.length) {
    if (!org.atsSettings) org.atsSettings = {};
    org.atsSettings.pipelineStages = stages;
    org.markModified('atsSettings');
    await org.save();
    logger.info({ orgId: String(orgId), added }, '[PIPELINE-SYNC] promoted stages');
  }

  return { added, stages };
}

function promoteStagesSafe(orgId, names) {
  if (!orgId) return Promise.resolve({ added: [], stages: [] });
  return promoteStages(orgId, names).catch((err) => {
    logger.warn({ err }, '[PIPELINE-SYNC] promote failed');
    return { added: [], stages: [] };
  });
}

/**
 * Heal drift: map candidate statuses onto org pipeline.
 * Exact/fuzzy match → org stage. Unknown → Rejected. Never auto-adds stages.
 */
async function reconcileOrgPipelineFromCandidates(orgId) {
  if (!orgId) return { added: [], remapped: 0, rejected: 0 };

  const stages = await loadOrgStages(orgId);
  const distinct = await Candidate.distinct('status', { organizationId: orgId });
  const remaps = [];

  for (const raw of distinct) {
    if (!raw) continue;
    const r = resolveStage(raw, stages, { unknownFallback: 'Rejected' });
    const fromKey = stageKey(raw);
    const toKey = stageKey(r.label);
    if (fromKey && toKey && fromKey !== toKey) {
      remaps.push({ from: raw, to: toKey, fallback: Boolean(r.fallback) });
    }
  }

  let remapped = 0;
  let rejected = 0;
  for (const m of remaps) {
    const result = await Candidate.updateMany(
      { organizationId: orgId, status: m.from },
      { $set: { status: m.to } }
    );
    const n = result.modifiedCount || 0;
    remapped += n;
    if (m.fallback) rejected += n;
  }

  if (remapped) {
    logger.info(
      { orgId: String(orgId), remapped, rejected },
      '[PIPELINE-SYNC] remapped unknown statuses (no promote)'
    );
  }
  return { added: [], remapped, rejected };
}

function reconcileOrgPipelineSafe(orgId) {
  if (!orgId) return Promise.resolve({ added: [], remapped: 0, rejected: 0 });
  return reconcileOrgPipelineFromCandidates(orgId).catch((err) => {
    logger.warn({ err }, '[PIPELINE-SYNC] reconcile failed');
    return { added: [], remapped: 0, rejected: 0 };
  });
}

/**
 * Keep Rejected on the org pipeline list so it always appears in settings + dashboard.
 * Does not remove/rename any existing stage.
 */
async function ensureCorePipelineStages(orgId, required = ['Rejected']) {
  if (!orgId) return { added: [], stages: [] };
  const needed = [...new Set(
    (Array.isArray(required) ? required : [required])
      .map((n) => displayStage(n))
      .filter(Boolean)
  )];
  if (!needed.length) {
    const stages = await loadOrgStages(orgId);
    return { added: [], stages };
  }

  const org = await Organization.findById(orgId).select('atsSettings.pipelineStages');
  if (!org) return { added: [], stages: [] };

  const stages = Array.isArray(org.atsSettings?.pipelineStages)
    ? [...org.atsSettings.pipelineStages]
    : [];
  const seen = new Set(stages.map(stageKey).filter(Boolean));
  const added = [];

  for (const label of needed) {
    const k = stageKey(label);
    if (!k || seen.has(k)) continue;
    stages.push(label);
    seen.add(k);
    added.push(label);
  }

  if (added.length) {
    if (!org.atsSettings) org.atsSettings = {};
    org.atsSettings.pipelineStages = stages;
    org.markModified('atsSettings');
    await org.save();
    logger.info({ orgId: String(orgId), added }, '[PIPELINE-SYNC] ensured core stages');
  }

  return { added, stages };
}

function ensureCorePipelineStagesSafe(orgId, required) {
  if (!orgId) return Promise.resolve({ added: [], stages: [] });
  return ensureCorePipelineStages(orgId, required).catch((err) => {
    logger.warn({ err }, '[PIPELINE-SYNC] ensure core stages failed');
    return { added: [], stages: [] };
  });
}

function normalizeStageKeys(names) {
  return [...new Set(
    (Array.isArray(names) ? names : [names])
      .map((n) => stageKey(n))
      .filter(Boolean)
  )];
}

async function remapCandidateStatuses(orgId, fromKeys, toKey) {
  const fromSet = new Set(normalizeStageKeys(fromKeys));
  if (!orgId || !toKey || !fromSet.size) return 0;

  const distinct = await Candidate.distinct('status', { organizationId: orgId });
  let total = 0;
  for (const raw of distinct) {
    if (!raw || !fromSet.has(stageKey(raw))) continue;
    const result = await Candidate.updateMany(
      { organizationId: orgId, status: raw },
      { $set: { status: toKey } }
    );
    total += result.modifiedCount || 0;
  }
  return total;
}

async function remapApplicationStages(orgId, fromKeys, toLabel) {
  const fromSet = new Set(normalizeStageKeys(fromKeys));
  if (!orgId || !toLabel || !fromSet.size) return 0;

  const distinct = await Application.distinct('stage', { organizationId: orgId });
  let total = 0;
  for (const raw of distinct) {
    if (!raw || !fromSet.has(stageKey(raw))) continue;
    const result = await Application.updateMany(
      { organizationId: orgId, stage: raw },
      { $set: { stage: toLabel } }
    );
    total += result.modifiedCount || 0;
  }
  return total;
}

async function remapJobPipelineStages(orgId, fromKeys, toLabel) {
  const fromSet = new Set(normalizeStageKeys(fromKeys));
  const toKey = stageKey(toLabel);
  if (!orgId || !toKey || !fromSet.size) return 0;

  const jobs = await Job.find({
    organizationId: orgId,
    pipelineStages: { $exists: true, $ne: [] },
  }).select('pipelineStages');
  let updated = 0;

  for (const job of jobs) {
    if (!Array.isArray(job.pipelineStages) || !job.pipelineStages.length) continue;
    let changed = false;
    const next = [];
    const seen = new Set();

    for (const stage of job.pipelineStages) {
      const key = stageKey(stage);
      if (fromSet.has(key)) {
        if (!seen.has(toKey)) {
          next.push(toLabel);
          seen.add(toKey);
        }
        changed = true;
      } else if (key && !seen.has(key)) {
        next.push(stage);
        seen.add(key);
      }
    }

    if (changed) {
      job.pipelineStages = next;
      job.markModified('pipelineStages');
      await job.save();
      updated += 1;
    }
  }
  return updated;
}

/**
 * Rename a pipeline stage org-wide. Candidate counts stay with the stage identity.
 */
async function renameStageLinked(orgId, oldName, newName) {
  const fromKey = stageKey(oldName);
  const toKey = stageKey(newName);
  const newLabel = displayStage(newName);

  if (!orgId || !fromKey || !toKey || !newLabel) {
    throw Object.assign(new Error('Invalid stage name'), { statusCode: 400 });
  }
  if (fromKey === toKey) {
    throw Object.assign(new Error('New name must be different'), { statusCode: 400 });
  }

  const org = await Organization.findById(orgId).select('atsSettings.pipelineStages');
  if (!org) throw Object.assign(new Error('Organization not found'), { statusCode: 404 });

  const stages = Array.isArray(org.atsSettings?.pipelineStages)
    ? [...org.atsSettings.pipelineStages]
    : [];
  const idx = stages.findIndex((s) => stageKey(s) === fromKey);
  if (idx === -1) {
    throw Object.assign(new Error('Stage not found'), { statusCode: 404 });
  }
  if (stages.some((s, i) => i !== idx && stageKey(s) === toKey)) {
    throw Object.assign(new Error('A stage with that name already exists'), { statusCode: 409 });
  }

  stages[idx] = newLabel;
  if (!org.atsSettings) org.atsSettings = {};
  org.atsSettings.pipelineStages = stages;
  org.markModified('atsSettings');
  await org.save();

  const candidatesUpdated = await remapCandidateStatuses(orgId, [fromKey], toKey);
  const applicationsUpdated = await remapApplicationStages(orgId, [fromKey], newLabel);
  const jobsUpdated = await remapJobPipelineStages(orgId, [fromKey], newLabel);

  logger.info(
    { orgId: String(orgId), from: fromKey, to: toKey, candidatesUpdated, applicationsUpdated, jobsUpdated },
    '[PIPELINE-SYNC] renamed stage'
  );

  return { stages, candidatesUpdated, applicationsUpdated, jobsUpdated };
}

/**
 * Merge two or more pipeline stages into one. Stats from all sources combine under the new name.
 */
async function mergeStagesLinked(orgId, sourceNames, newName) {
  const sources = [...new Set(
    (Array.isArray(sourceNames) ? sourceNames : [sourceNames])
      .map((n) => displayStage(n))
      .filter(Boolean)
  )];
  const newLabel = displayStage(newName);
  const toKey = stageKey(newLabel);
  const sourceKeys = normalizeStageKeys(sources);

  if (!orgId) throw Object.assign(new Error('Organization required'), { statusCode: 400 });
  if (sourceKeys.length < 2) {
    throw Object.assign(new Error('Select at least two different stages to merge'), { statusCode: 400 });
  }
  if (!toKey || !newLabel) {
    throw Object.assign(new Error('Enter a name for the merged stage'), { statusCode: 400 });
  }

  const org = await Organization.findById(orgId).select('atsSettings.pipelineStages');
  if (!org) throw Object.assign(new Error('Organization not found'), { statusCode: 404 });

  let stages = Array.isArray(org.atsSettings?.pipelineStages)
    ? [...org.atsSettings.pipelineStages]
    : [];
  const existingKeys = new Set(stages.map(stageKey).filter(Boolean));

  for (const key of sourceKeys) {
    if (!existingKeys.has(key)) {
      throw Object.assign(new Error('One or more stages not found'), { statusCode: 404 });
    }
  }

  const conflict = stages.find((s) => {
    const k = stageKey(s);
    return k === toKey && !sourceKeys.includes(k);
  });
  if (conflict) {
    throw Object.assign(new Error('A stage with that name already exists'), { statusCode: 409 });
  }

  let insertAt = stages.length;
  for (let i = 0; i < stages.length; i += 1) {
    if (sourceKeys.includes(stageKey(stages[i]))) {
      insertAt = Math.min(insertAt, i);
    }
  }

  stages = stages.filter((s) => !sourceKeys.includes(stageKey(s)));
  stages.splice(insertAt, 0, newLabel);

  if (!org.atsSettings) org.atsSettings = {};
  org.atsSettings.pipelineStages = stages;
  org.markModified('atsSettings');
  await org.save();

  const candidatesUpdated = await remapCandidateStatuses(orgId, sourceKeys, toKey);
  const applicationsUpdated = await remapApplicationStages(orgId, sourceKeys, newLabel);
  const jobsUpdated = await remapJobPipelineStages(orgId, sourceKeys, newLabel);

  logger.info(
    {
      orgId: String(orgId),
      mergedFrom: sourceKeys,
      to: toKey,
      candidatesUpdated,
      applicationsUpdated,
      jobsUpdated,
    },
    '[PIPELINE-SYNC] merged stages'
  );

  return {
    stages,
    mergedFrom: sources,
    candidatesUpdated,
    applicationsUpdated,
    jobsUpdated,
  };
}

module.exports = {
  stageKey,
  displayStage,
  resolveStage,
  loadOrgStages,
  promoteStages,
  promoteStagesSafe,
  reconcileOrgPipelineFromCandidates,
  reconcileOrgPipelineSafe,
  ensureCorePipelineStages,
  ensureCorePipelineStagesSafe,
  renameStageLinked,
  mergeStagesLinked,
  remapCandidateStatuses,
  remapApplicationStages,
  remapJobPipelineStages,
};
