const express = require('express');
const router = express.Router();
const InterviewTranscript = require('../models/InterviewTranscript');
const Interview = require('../models/Interview');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { getAdapter } = require('../adapters');

router.use(requireFeature('ai.interviewTranscription'));

router.get('/interview/:interviewId', async (req, res) => {
  try {
    const row = await InterviewTranscript.findOne({
      organizationId: req.user.organizationId,
      interviewId: req.params.interviewId
    }).lean();
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/interview/:interviewId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.interviewId,
      organizationId: req.user.organizationId
    });
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    const { rawText = '', source = 'manual', consentCaptured = false, meetingBotId = '' } = req.body;
    const row = await InterviewTranscript.findOneAndUpdate(
      { organizationId: req.user.organizationId, interviewId: interview._id },
      {
        $set: {
          candidateId: interview.candidateId || interview.applicationId,
          rawText,
          source,
          consentCaptured: !!consentCaptured,
          meetingBotId,
          createdBy: req.user.id || req.user._id,
          retentionDeleteAt: new Date(Date.now() + 90 * 86400000)
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/interview/:interviewId/summarize', requireRecruiterOrAbove, async (req, res) => {
  try {
    const row = await InterviewTranscript.findOne({
      organizationId: req.user.organizationId,
      interviewId: req.params.interviewId
    });
    if (!row || !row.rawText?.trim()) {
      return res.status(400).json({ success: false, message: 'No transcript text to summarize' });
    }

    const adapter = await getAdapter(req.user.organizationId, 'ai');
    if (!adapter) {
      return res.status(400).json({
        success: false,
        message: 'AI is not configured. Add your OpenAI/Anthropic key in Integrations (BYOK).'
      });
    }

    const prompt = `Summarize this interview transcript for hiring decision. Include: strengths, concerns, culture fit, recommended next step.\n\nTRANSCRIPT:\n${row.rawText.slice(0, 12000)}`;
    let summary = '';
    if (typeof adapter.generateText === 'function') {
      summary = await adapter.generateText(prompt);
    } else if (typeof adapter._chat === 'function') {
      summary = await adapter._chat([{ role: 'user', content: prompt }]);
    } else {
      throw new Error('AI adapter does not support text generation');
    }

    row.aiSummary = typeof summary === 'string' ? summary : (summary?.text || JSON.stringify(summary));
    await row.save();
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** BYOK meeting bot stub — stores bot id; real Recall.ai webhook can update later */
router.post('/interview/:interviewId/meeting-bot', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { meetingUrl = '', botProvider = 'recall' } = req.body;
    const interview = await Interview.findOne({
      _id: req.params.interviewId,
      organizationId: req.user.organizationId
    });
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    const botId = `${botProvider}_${Date.now().toString(36)}`;
    const row = await InterviewTranscript.findOneAndUpdate(
      { organizationId: req.user.organizationId, interviewId: interview._id },
      {
        $set: {
          source: 'meeting_bot',
          meetingBotId: botId,
          consentCaptured: !!req.body.consentCaptured,
          rawText: meetingUrl
            ? `[Meeting bot joined: ${meetingUrl}]\nTranscript will appear when the BYOK provider webhook delivers it.`
            : '[Meeting bot requested — awaiting transcript webhook]',
          createdBy: req.user.id || req.user._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      data: row,
      message: 'Meeting bot scheduled (BYOK). Connect Recall.ai webhook to receive live transcripts.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
