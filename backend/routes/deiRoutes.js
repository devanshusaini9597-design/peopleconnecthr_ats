/**
 * DEI product surface — Enterprise (analytics.dei)
 * Blind screening settings, voluntary self-ID, diverse-slate alerts, funnel.
 */

const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const { requireAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

router.use(requireFeature('analytics.dei'));

// GET /api/dei/settings
router.get('/settings', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId).select('deiSettings').lean();
    const settings = org?.deiSettings || {
      blindScreeningEnabled: false,
      diverseSlateAlerts: false,
      selfIdFormEnabled: true,
      minDiverseShortlist: 2
    };
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/dei/settings
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const {
      blindScreeningEnabled,
      diverseSlateAlerts,
      selfIdFormEnabled,
      minDiverseShortlist
    } = req.body;

    const update = {};
    if (typeof blindScreeningEnabled === 'boolean') update['deiSettings.blindScreeningEnabled'] = blindScreeningEnabled;
    if (typeof diverseSlateAlerts === 'boolean') update['deiSettings.diverseSlateAlerts'] = diverseSlateAlerts;
    if (typeof selfIdFormEnabled === 'boolean') update['deiSettings.selfIdFormEnabled'] = selfIdFormEnabled;
    if (minDiverseShortlist != null) {
      update['deiSettings.minDiverseShortlist'] = Math.max(1, Number(minDiverseShortlist) || 2);
    }

    const org = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      { $set: update },
      { new: true }
    ).select('deiSettings');

    res.json({ success: true, data: org.deiSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/dei/metrics — aggregate funnel only
router.get('/metrics', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const org = await Organization.findById(orgId).select('deiSettings atsSettings').lean();
    const stages = org?.atsSettings?.pipelineStages || ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

    const apps = await Application.find({ organizationId: orgId })
      .select('stage candidateId')
      .lean();

    const candidateIds = [...new Set(apps.map((a) => String(a.candidateId)).filter(Boolean))];
    const candidates = await Candidate.find({
      _id: { $in: candidateIds },
      organizationId: orgId
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

    res.json({
      success: true,
      data: {
        funnel,
        alert,
        summary: {
          totalCandidatesInPipeline: candidateIds.length,
          selfIdDisclosed: disclosed,
          disclosureRate: candidateIds.length
            ? Math.round((disclosed / candidateIds.length) * 100)
            : 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/dei/self-id — candidate or recruiter recording voluntary self-ID
router.post('/self-id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const {
      candidateId,
      genderIdentity = '',
      ethnicity = '',
      veteranStatus = '',
      disabilityStatus = '',
      declinedToSelfIdentify = false
    } = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'candidateId is required' });
    }

    const candidate = await Candidate.findOneAndUpdate(
      { _id: candidateId, organizationId: req.user.organizationId },
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

    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/dei/blind-mode — whether recruiter UI should hide PII fields
router.get('/blind-mode', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId).select('deiSettings').lean();
    res.json({
      success: true,
      data: {
        enabled: !!org?.deiSettings?.blindScreeningEnabled
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
