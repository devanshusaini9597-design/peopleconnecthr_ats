const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const svc = require('../services/supportService');
const { isFreelancer } = require('../utils/dataScope');

const router = express.Router();
router.use(verifyToken);

function handle(res, error) {
  res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Request failed' });
}

function requireFreelancer(req, res, next) {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelancer access required' });
  }
  return next();
}

function requireCompanyDesk(req, res, next) {
  if (!svc.canAccessCompanyDesk(req.user)) {
    return res.status(403).json({ success: false, message: 'Support desk access denied' });
  }
  return next();
}

/** Company / hiring-team support desk */
router.get('/org/tickets', requireCompanyDesk, async (req, res) => {
  try {
    const data = await svc.listOrgTickets(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/org/tickets/:id', requireCompanyDesk, async (req, res) => {
  try {
    const data = await svc.getOrgTicket(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/org/tickets/:id/replies', requireCompanyDesk, async (req, res) => {
  try {
    const data = await svc.addSupportReply(req.user, req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/org/tickets/:id/status', requireCompanyDesk, async (req, res) => {
  try {
    const data = await svc.updateOrgTicketStatus(req.user, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/** Freelancer self-service tickets */
router.get('/unread-count', requireFreelancer, async (req, res) => {
  try {
    const count = await svc.unreadSupportCount(req.user);
    res.json({ success: true, count });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/mark-seen', requireFreelancer, async (req, res) => {
  try {
    const data = await svc.markSupportSeen(req.user);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/tickets', requireFreelancer, async (req, res) => {
  try {
    const data = await svc.listMyTickets(req.user, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/tickets/:id', requireFreelancer, async (req, res) => {
  try {
    const data = await svc.getMyTicket(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/tickets', requireFreelancer, async (req, res) => {
  try {
    const data = await svc.createTicket(req.user, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/tickets/:id/replies', requireFreelancer, async (req, res) => {
  try {
    const data = await svc.addFreelancerReply(req.user, req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
