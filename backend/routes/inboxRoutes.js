/**
 * Unified inbox routes — thin HTTP wrappers over inboxService.
 */
const express = require('express');
const router = express.Router();
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const inbox = require('../services/inboxService');

router.use(requireFeature('messaging.inbox'));

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.data) body.data = error.data;
  return res.status(status).json(body);
}

router.get('/stats', async (req, res) => {
  try {
    const data = await inbox.getInboxStats(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/threads', async (req, res) => {
  try {
    const data = await inbox.listThreads(req.user.organizationId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/threads/:id', async (req, res) => {
  try {
    const data = await inbox.getThread(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/threads', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await inbox.createOutbound(req.user.organizationId, req.user, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/threads/:id/reply', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await inbox.createOutbound(req.user.organizationId, req.user, {
      ...req.body,
      threadId: req.params.id,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/threads/:id/read', async (req, res) => {
  try {
    const data = await inbox.markThreadRead(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/threads/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await inbox.updateThread(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/consent/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await inbox.updateMessagingConsent(
      req.user.organizationId,
      req.params.candidateId,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
