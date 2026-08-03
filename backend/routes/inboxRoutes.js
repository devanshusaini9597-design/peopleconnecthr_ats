/**
 * Unified multi-channel inbox — Professional+ (messaging.inbox)
 */

const express = require('express');
const router = express.Router();
const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const Candidate = require('../models/Candidate');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { sendEmail } = require('../services/emailService');
const { getAdapter } = require('../adapters');

router.use(requireFeature('messaging.inbox'));

function hasChannelConsent(candidate, channel) {
  if (!candidate) return true;
  const consent = candidate.messagingConsent || {};
  if (channel === 'email') return consent.email !== false;
  if (channel === 'sms') return !!consent.sms;
  if (channel === 'whatsapp') return !!consent.whatsapp;
  return true;
}

// GET /api/inbox/stats
router.get('/stats', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const base = { organizationId: orgId, archived: { $ne: true } };
    const [totalThreads, unreadAgg, msgStats] = await Promise.all([
      MessageThread.countDocuments(base),
      MessageThread.aggregate([
        { $match: base },
        { $group: { _id: null, unread: { $sum: '$unreadCount' } } }
      ]),
      Message.aggregate([
        { $match: { organizationId: orgId } },
        {
          $group: {
            _id: '$direction',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const inbound = msgStats.find((m) => m._id === 'inbound')?.count || 0;
    const outbound = msgStats.find((m) => m._id === 'outbound')?.count || 0;
    const replyRate = outbound > 0 ? Math.round((inbound / outbound) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalThreads,
        unreadCount: unreadAgg[0]?.unread || 0,
        inboundCount: inbound,
        outboundCount: outbound,
        replyRate
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/inbox/threads
router.get('/threads', async (req, res) => {
  try {
    const { q = '', archived = 'false', channel } = req.query;
    const filter = {
      organizationId: req.user.organizationId,
      archived: archived === 'true'
    };
    if (channel && channel !== 'all') filter.channel = channel;
    if (q.trim()) {
      filter.$or = [
        { subject: { $regex: q.trim(), $options: 'i' } },
        { 'participants.candidateName': { $regex: q.trim(), $options: 'i' } },
        { 'participants.candidateEmail': { $regex: q.trim(), $options: 'i' } },
        { lastMessagePreview: { $regex: q.trim(), $options: 'i' } }
      ];
    }

    const threads = await MessageThread.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, data: threads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/inbox/threads/:id
router.get('/threads/:id', async (req, res) => {
  try {
    const thread = await MessageThread.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).lean();
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    const messages = await Message.find({
      threadId: thread._id,
      organizationId: req.user.organizationId
    }).sort({ sentAt: 1 }).lean();

    res.json({ success: true, data: { thread, messages } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/inbox/threads — start / append outbound
router.post('/threads', requireRecruiterOrAbove, async (req, res) => {
  try {
    const {
      candidateId,
      channel = 'email',
      subject = '',
      body = '',
      bodyHtml = ''
    } = req.body;

    if (!body.trim()) {
      return res.status(400).json({ success: false, message: 'Message body is required' });
    }
    if (!['email', 'sms', 'whatsapp'].includes(channel)) {
      return res.status(400).json({ success: false, message: 'Invalid channel' });
    }

    const orgId = req.user.organizationId;
    let candidate = null;
    if (candidateId) {
      candidate = await Candidate.findOne({ _id: candidateId, organizationId: orgId });
      if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
      if (!hasChannelConsent(candidate, channel)) {
        return res.status(403).json({
          success: false,
          message: `Candidate has not consented to ${channel} messages`
        });
      }
    }

    const toAddress = channel === 'email'
      ? (candidate?.email || req.body.toAddress || '')
      : (candidate?.contact || candidate?.phone || req.body.toAddress || '');

    if (!toAddress) {
      return res.status(400).json({ success: false, message: 'No recipient address available' });
    }

    let sendStatus = 'sent';
    let errorMessage = '';

    try {
      if (channel === 'email') {
        await sendEmail(
          toAddress,
          subject || 'Message from recruiting team',
          bodyHtml || `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          body,
          { userId: req.user.id || req.user._id }
        );
      } else if (channel === 'sms') {
        const adapter = await getAdapter(orgId, 'sms');
        if (!adapter) throw new Error('SMS is not configured. Connect SMS in Integrations.');
        await adapter.send({ to: toAddress, message: body });
      } else if (channel === 'whatsapp') {
        const adapter = await getAdapter(orgId, 'whatsapp');
        if (!adapter) throw new Error('WhatsApp is not configured. Connect WhatsApp in Integrations.');
        if (typeof adapter.sendWhatsApp === 'function') {
          await adapter.sendWhatsApp({ to: toAddress, message: body });
        } else {
          await adapter.send({ to: toAddress, message: body });
        }
      }
    } catch (err) {
      sendStatus = 'failed';
      errorMessage = err.message;
    }

    let thread = null;
    if (candidateId) {
      thread = await MessageThread.findOne({
        organizationId: orgId,
        candidateId,
        archived: false
      }).sort({ lastMessageAt: -1 });
    }

    if (!thread) {
      thread = await MessageThread.create({
        organizationId: orgId,
        candidateId: candidateId || null,
        subject: subject || `Conversation with ${candidate?.name || toAddress}`,
        channel,
        participants: {
          candidateName: candidate?.name || '',
          candidateEmail: candidate?.email || '',
          candidatePhone: candidate?.contact || candidate?.phone || ''
        },
        unreadCount: 0,
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 160),
        lastDirection: 'outbound',
        createdBy: req.user.id || req.user._id
      });
    } else {
      thread.channel = thread.channel === channel ? channel : 'mixed';
      thread.lastMessageAt = new Date();
      thread.lastMessagePreview = body.slice(0, 160);
      thread.lastDirection = 'outbound';
      if (subject) thread.subject = subject;
      await thread.save();
    }

    const message = await Message.create({
      organizationId: orgId,
      threadId: thread._id,
      candidateId: candidateId || null,
      channel,
      direction: 'outbound',
      fromName: req.user.name || 'Recruiter',
      fromAddress: req.user.email || '',
      toAddress,
      subject,
      body,
      bodyHtml,
      status: sendStatus,
      isRead: true,
      sentBy: req.user.id || req.user._id,
      errorMessage,
      sentAt: new Date()
    });

    if (sendStatus === 'failed') {
      return res.status(502).json({
        success: false,
        message: errorMessage || 'Failed to send',
        data: { thread, message }
      });
    }

    res.status(201).json({ success: true, data: { thread, message } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/inbox/threads/:id/reply
router.post('/threads/:id/reply', requireRecruiterOrAbove, async (req, res) => {
  req.body.threadId = req.params.id;
  // Reuse create logic by finding candidate from thread
  try {
    const thread = await MessageThread.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    req.body.candidateId = thread.candidateId;
    req.body.subject = req.body.subject || thread.subject;
    req.body.channel = req.body.channel || (thread.channel === 'mixed' ? 'email' : thread.channel);

    // Delegate to same handler path by calling next creation inline
    const {
      channel = 'email',
      subject = '',
      body = '',
      bodyHtml = ''
    } = req.body;

    if (!body.trim()) {
      return res.status(400).json({ success: false, message: 'Message body is required' });
    }

    const orgId = req.user.organizationId;
    let candidate = null;
    if (thread.candidateId) {
      candidate = await Candidate.findOne({ _id: thread.candidateId, organizationId: orgId });
      if (candidate && !hasChannelConsent(candidate, channel)) {
        return res.status(403).json({
          success: false,
          message: `Candidate has not consented to ${channel} messages`
        });
      }
    }

    const toAddress = channel === 'email'
      ? (candidate?.email || thread.participants?.candidateEmail || '')
      : (candidate?.contact || candidate?.phone || thread.participants?.candidatePhone || '');

    if (!toAddress) {
      return res.status(400).json({ success: false, message: 'No recipient address available' });
    }

    let sendStatus = 'sent';
    let errorMessage = '';
    try {
      if (channel === 'email') {
        await sendEmail(
          toAddress,
          subject || thread.subject || 'Re: conversation',
          bodyHtml || `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          body,
          { userId: req.user.id || req.user._id }
        );
      } else if (channel === 'sms') {
        const adapter = await getAdapter(orgId, 'sms');
        if (!adapter) throw new Error('SMS is not configured');
        await adapter.send({ to: toAddress, message: body });
      } else if (channel === 'whatsapp') {
        const adapter = await getAdapter(orgId, 'whatsapp');
        if (!adapter) throw new Error('WhatsApp is not configured');
        if (typeof adapter.sendWhatsApp === 'function') {
          await adapter.sendWhatsApp({ to: toAddress, message: body });
        } else {
          await adapter.send({ to: toAddress, message: body });
        }
      }
    } catch (err) {
      sendStatus = 'failed';
      errorMessage = err.message;
    }

    thread.channel = thread.channel === channel ? channel : 'mixed';
    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = body.slice(0, 160);
    thread.lastDirection = 'outbound';
    await thread.save();

    const message = await Message.create({
      organizationId: orgId,
      threadId: thread._id,
      candidateId: thread.candidateId,
      channel,
      direction: 'outbound',
      fromName: req.user.name || 'Recruiter',
      fromAddress: req.user.email || '',
      toAddress,
      subject,
      body,
      bodyHtml,
      status: sendStatus,
      isRead: true,
      sentBy: req.user.id || req.user._id,
      errorMessage,
      sentAt: new Date()
    });

    if (sendStatus === 'failed') {
      return res.status(502).json({ success: false, message: errorMessage, data: { thread, message } });
    }

    res.status(201).json({ success: true, data: { thread, message } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/inbox/threads/:id/read
router.patch('/threads/:id/read', async (req, res) => {
  try {
    const thread = await MessageThread.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { unreadCount: 0 } },
      { new: true }
    );
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    await Message.updateMany(
      { threadId: thread._id, organizationId: req.user.organizationId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ success: true, data: thread });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/inbox/threads/:id — archive / star
router.patch('/threads/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.archived === 'boolean') update.archived = req.body.archived;
    if (typeof req.body.starred === 'boolean') update.starred = req.body.starred;
    if (req.body.subject != null) update.subject = req.body.subject;

    const thread = await MessageThread.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    );
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    res.json({ success: true, data: thread });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/inbox/consent/:candidateId
router.patch('/consent/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { email, sms, whatsapp } = req.body;
    const update = {};
    if (typeof email === 'boolean') update['messagingConsent.email'] = email;
    if (typeof sms === 'boolean') update['messagingConsent.sms'] = sms;
    if (typeof whatsapp === 'boolean') update['messagingConsent.whatsapp'] = whatsapp;
    update['messagingConsent.updatedAt'] = new Date();

    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.candidateId, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    ).select('name email messagingConsent');

    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
