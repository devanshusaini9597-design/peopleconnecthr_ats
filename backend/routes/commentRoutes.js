const express = require('express');
const router = express.Router();
const CandidateComment = require('../models/CandidateComment');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');

router.use(requireFeature('candidates.collaboration'));

function extractMentions(body, users) {
  const mentioned = [];
  const lower = String(body || '');
  for (const u of users) {
    const handle = `@${(u.name || '').split(' ')[0]}`;
    const emailHandle = `@${(u.email || '').split('@')[0]}`;
    if (lower.includes(handle) || lower.includes(emailHandle) || lower.includes(`@${u.email}`)) {
      mentioned.push(u._id);
    }
  }
  // Also match <@userId>
  const idMatches = [...String(body).matchAll(/<@([a-f0-9]{24})>/gi)].map((m) => m[1]);
  return [...new Set([...mentioned.map(String), ...idMatches])];
}

router.get('/candidate/:candidateId', async (req, res) => {
  try {
    const rows = await CandidateComment.find({
      organizationId: req.user.organizationId,
      candidateId: req.params.candidateId
    })
      .populate('authorId', 'name email')
      .populate('mentions', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/candidate/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { body, isPrivate = false } = req.body;
    if (!body?.trim()) return res.status(400).json({ success: false, message: 'Comment body required' });

    const candidate = await Candidate.findOne({
      _id: req.params.candidateId,
      organizationId: req.user.organizationId
    });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const teammates = await User.find({ organizationId: req.user.organizationId, isActive: { $ne: false } })
      .select('name email')
      .lean();
    const mentionIds = extractMentions(body, teammates);

    const comment = await CandidateComment.create({
      organizationId: req.user.organizationId,
      candidateId: candidate._id,
      authorId: req.user.id || req.user._id,
      body: body.trim(),
      mentions: mentionIds,
      isPrivate: !!isPrivate
    });

    for (const uid of mentionIds) {
      if (String(uid) === String(req.user.id || req.user._id)) continue;
      try {
        await Notification.create({
          userId: uid,
          senderId: req.user.id || req.user._id,
          senderName: req.user.name || 'Teammate',
          type: 'mention',
          title: 'You were mentioned',
          message: `${req.user.name || 'A teammate'} mentioned you on ${candidate.name}`,
          candidateId: candidate._id,
          candidateName: candidate.name,
          priority: 'medium'
        });
      } catch { /* notification schema may vary */ }
    }

    const populated = await CandidateComment.findById(comment._id)
      .populate('authorId', 'name email')
      .populate('mentions', 'name email');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const comment = await CandidateComment.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!comment) return res.status(404).json({ success: false, message: 'Not found' });
    const isAuthor = String(comment.authorId) === String(req.user.id || req.user._id);
    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    if (!isAuthor && !isAdmin) return res.status(403).json({ success: false, message: 'Not allowed' });
    await comment.deleteOne();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
