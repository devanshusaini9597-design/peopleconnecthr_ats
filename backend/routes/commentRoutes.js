const express = require('express');
const router = express.Router();
const CandidateComment = require('../models/CandidateComment');
const Candidate = require('../models/Candidate');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { isFreelancer, candidateWriteScope } = require('../utils/dataScope');
const {
  listMentionables,
  extractMentionIds,
  extractTagMemberIds,
  notifyUser,
} = require('../utils/reportingScope');
const { listOrgTags } = require('../services/myTeamService');

router.use(requireFeature('candidates.collaboration'));

function candidateAccessFilter(req) {
  const user = req.user || {};
  if (isFreelancer(user)) {
    return { _id: req.params.candidateId, ...candidateWriteScope(req) };
  }
  return { _id: req.params.candidateId, organizationId: user.organizationId };
}

router.get('/mentionables', async (req, res) => {
  try {
    const [people, tags] = await Promise.all([
      listMentionables(req.user.organizationId, {
        excludeId: req.user.id || req.user._id,
      }),
      listOrgTags(req.user.organizationId),
    ]);
    res.json({
      success: true,
      data: people,
      tags: (tags || []).map((t) => ({
        id: String(t._id),
        name: t.name,
        handle: t.handle,
        type: 'tag',
        memberCount: (t.memberIds || []).length,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/candidate/:candidateId', async (req, res) => {
  try {
    const candidate = await Candidate.findOne(candidateAccessFilter(req)).select('_id');
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const rows = await CandidateComment.find({
      organizationId: req.user.organizationId,
      candidateId: candidate._id
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

    const candidate = await Candidate.findOne(candidateAccessFilter(req));
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const actorId = req.user.id || req.user._id;
    const [teammates, tags] = await Promise.all([
      listMentionables(req.user.organizationId),
      listOrgTags(req.user.organizationId),
    ]);
    const mentionIds = [...new Set([
      ...extractMentionIds(body, teammates),
      ...extractTagMemberIds(body, tags),
    ])].filter((id) => String(id) !== String(actorId));

    const comment = await CandidateComment.create({
      organizationId: req.user.organizationId,
      candidateId: candidate._id,
      authorId: actorId,
      body: body.trim(),
      mentions: mentionIds,
      isPrivate: !!isPrivate
    });

    await Promise.all(mentionIds.map((uid) => notifyUser(uid, {
      senderId: actorId,
      senderName: req.user.name || 'Teammate',
      type: 'mention',
      title: 'You were mentioned',
      message: `${req.user.name || 'A teammate'} mentioned you on ${candidate.name}`,
      candidateId: candidate._id,
      candidateName: candidate.name,
      candidatePosition: candidate.position || '',
      priority: 'medium',
    })));

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
