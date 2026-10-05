/**
 * Unified inbox routes — thin HTTP wrappers over inboxService.
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireRecruiterOrAbove, requireMisCompany, requireMailboxAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { multerFileFilter } = require('../utils/uploadAllowlist');
const inbox = require('../services/inboxService');
const inboxImap = require('../services/inboxImapService');
const { MAX_BYTES, MAX_FILES } = require('../services/inboxAttachmentStore');

router.use(requireFeature('messaging.inbox'));
router.use(requireMisCompany);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FILES },
  fileFilter: multerFileFilter,
});

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.data) body.data = error.data;
  return res.status(status).json(body);
}

function maybeUpload(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) {
    return upload.array('files', MAX_FILES)(req, res, next);
  }
  return next();
}

function outboundBody(req, extra = {}) {
  return {
    ...req.body,
    ...extra,
    files: req.files || [],
  };
}

router.get('/stats', async (req, res) => {
  try {
    const data = await inbox.getInboxStats(req.user.organizationId, req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/mailbox', async (req, res) => {
  try {
    const data = await inboxImap.getMailboxStatus(req.user.organizationId, req.user);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/mailbox', requireMailboxAdmin, async (req, res) => {
  try {
    const data = await inboxImap.saveMailbox(req.user.organizationId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/mailbox/sync', requireMailboxAdmin, async (req, res) => {
  try {
    const data = await inboxImap.pollOrganization(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/assignees', async (req, res) => {
  try {
    const data = await inbox.listAssignees(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/threads', async (req, res) => {
  try {
    const data = await inbox.listThreads(req.user.organizationId, req.query, req.user);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/threads/:id', async (req, res) => {
  try {
    const data = await inbox.getThread(req.user.organizationId, req.params.id, req.user);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/threads/:id/messages/:messageId/attachments/:attachmentId', async (req, res) => {
  try {
    const file = await inbox.downloadAttachment(req.user.organizationId, req.user, {
      threadId: req.params.id,
      messageId: req.params.messageId,
      attachmentId: req.params.attachmentId,
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    res.send(file.buffer);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/threads/draft', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await inbox.saveDraft(req.user.organizationId, req.user, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/threads', requireRecruiterOrAbove, maybeUpload, async (req, res) => {
  try {
    const data = await inbox.createOutbound(req.user.organizationId, req.user, outboundBody(req));
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/threads/:id/reply', requireRecruiterOrAbove, maybeUpload, async (req, res) => {
  try {
    const data = await inbox.createOutbound(req.user.organizationId, req.user, outboundBody(req, {
      threadId: req.params.id,
    }));
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/threads/:id/read', async (req, res) => {
  try {
    const data = await inbox.markThreadRead(req.user.organizationId, req.params.id, req.user);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/threads/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await inbox.updateThread(req.user.organizationId, req.params.id, req.body, req.user);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/threads/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await inbox.deleteThread(req.user.organizationId, req.params.id, req.user);
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
