/**
 * DEI product surface — settings, metrics, self-ID, blind mode.
 */
const Organization = require('../models/Organization');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const DEFAULT_SETTINGS = {
  blindScreeningEnabled: false,
  diverseSlateAlerts: false,
  selfIdFormEnabled: true,
  minDiverseShortlist: 2
};

async function getSettings(organizationId) {
  const org = await Organization.findById(organizationId).select('deiSettings').lean();
  return org?.deiSettings || { ...DEFAULT_SETTINGS };
}

async function updateSettings(organizationId, body) {
  const {
    blindScreeningEnabled,
    diverseSlateAlerts,
    selfIdFormEnabled,
    minDiverseShortlist
  } = body;

  const update = {};
  if (typeof blindScreeningEnabled === 'boolean') update['deiSettings.blindScreeningEnabled'] = blindScreeningEnabled;
  if (typeof diverseSlateAlerts === 'boolean') update['deiSettings.diverseSlateAlerts'] = diverseSlateAlerts;
  if (typeof selfIdFormEnabled === 'boolean') update['deiSettings.selfIdFormEnabled'] = selfIdFormEnabled;
  if (minDiverseShortlist != null) {
    update['deiSettings.minDiverseShortlist'] = Math.max(1, Number(minDiverseShortlist) || 2);
  }

  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: update },
    { new: true }
  ).select('deiSettings');

  return org.deiSettings;
}

async function getMetrics(organizationId) {
  const org = await Organization.findById(organizationId).select('deiSettings atsSettings').lean();
  const stages = org?.atsSettings?.pipelineStages || ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

  const apps = await Application.find({ organizationId })
    .select('stage candidateId')
    .lean();

  const candidateIds = [...new Set(apps.map((a) => String(a.candidateId)).filter(Boolean))];
  const candidates = await Candidate.find({
    _id: { $in: candidateIds },
    organizationId
  }).select('demographics').lean();

  const demoMap = new Map(candidates.map((c) => [String(c._id), c.demographics || {}]));

  const funnel = stages.map((stage) => {
    const stageApps = apps.filter((a) => (a.stage || a.status) === stage);
    const gender = {};
    const ethnicity = {};
    for (const app of stageApps) {
      const d = demoMap.get(String(app.candidateId)) || {};
      if (d.declinedToSelfIdentify) continue;
      const g = d.genderIdentity || 'Unspecified';
      const e = d.ethnicity || 'Unspecified';
      gender[g] = (gender[g] || 0) + 1;
      ethnicity[e] = (ethnicity[e] || 0) + 1;
    }
    return {
      stage,
      total: stageApps.length,
      breakdown: { gender, ethnicity }
    };
  });

  let alert = null;
  if (org?.deiSettings?.diverseSlateAlerts) {
    const shortlistStage = stages.includes('Interview') ? 'Interview' : stages[Math.min(2, stages.length - 1)];
    const shortlist = funnel.find((f) => f.stage === shortlistStage);
    const genderKeys = Object.keys(shortlist?.breakdown?.gender || {}).filter((k) => k !== 'Unspecified');
    const minDiverse = org.deiSettings.minDiverseShortlist || 2;
    if (shortlist && shortlist.total >= minDiverse && genderKeys.length < 2) {
      alert = {
        message: `Diverse slate alert: "${shortlistStage}" shortlist lacks gender diversity in disclosed self-ID data.`,
        stage: shortlistStage
      };
    }
  }

  const disclosed = candidates.filter((c) => {
    const d = c.demographics || {};
    return !d.declinedToSelfIdentify && (d.genderIdentity || d.ethnicity);
  }).length;

  return {
    funnel,
    alert,
    summary: {
      totalCandidatesInPipeline: candidateIds.length,
      selfIdDisclosed: disclosed,
      disclosureRate: candidateIds.length
        ? Math.round((disclosed / candidateIds.length) * 100)
        : 0
    }
  };
}

async function recordSelfId(organizationId, body) {
  const {
    candidateId,
    genderIdentity = '',
    ethnicity = '',
    veteranStatus = '',
    disabilityStatus = '',
    declinedToSelfIdentify = false
  } = body;

  if (!candidateId) throw httpError('candidateId is required');

  const candidate = await Candidate.findOneAndUpdate(
    { _id: candidateId, organizationId },
    {
      $set: {
        demographics: {
          genderIdentity: declinedToSelfIdentify ? '' : String(genderIdentity).trim(),
          ethnicity: declinedToSelfIdentify ? '' : String(ethnicity).trim(),
          veteranStatus: declinedToSelfIdentify ? '' : String(veteranStatus).trim(),
          disabilityStatus: declinedToSelfIdentify ? '' : String(disabilityStatus).trim(),
          declinedToSelfIdentify: !!declinedToSelfIdentify
        }
      }
    },
    { new: true }
  ).select('name demographics');

  if (!candidate) throw httpError('Candidate not found', 404);
  return candidate;
}

async function getBlindMode(organizationId) {
  const org = await Organization.findById(organizationId).select('deiSettings').lean();
  return { enabled: !!org?.deiSettings?.blindScreeningEnabled };
}

module.exports = {
  getSettings,
  updateSettings,
  getMetrics,
  recordSelfId,
  getBlindMode,
};
