const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getCompanyDomain,
  inviteTeamMember,
  listTeamMembers,
  listPendingInvitations,
  updateTeamMember,
  deleteTeamMember,
  acceptInvitation,
  declineInvitation,
} = require('../services/teamService');

// All routes require auth
router.use(verifyToken);

function handle(res, err) {
  const status = err.statusCode || 500;
  return res.status(status).json({ success: false, message: err.message });
}

// GET all team members in the current user's organization (shared roster —
// everyone in the same org sees the same team directory, regardless of who
// sent each invite). Falls back to the legacy per-inviter view only for
// accounts that somehow have no organizationId yet.
router.get('/', async (req, res) => {
  try {
    const members = await listTeamMembers(req.user);
    res.json({ success: true, members });
  } catch (err) {
    handle(res, err);
  }
});

// GET pending invitations (for the current user)
router.get('/pending', async (req, res) => {
  try {
    const invitations = await listPendingInvitations(req.user);
    res.json({ success: true, invitations });
  } catch (err) {
    handle(res, err);
  }
});

// GET company domain info
router.get('/domain-info', async (req, res) => {
  try {
    const companyInfo = await getCompanyDomain(req.user.id);
    res.json({
      success: true,
      domainInfo: companyInfo,
      userEmail: req.user.email
    });
  } catch (err) {
    handle(res, err);
  }
});

// POST - Invite a team member (with domain validation)
router.post('/', async (req, res) => {
  try {
    const result = await inviteTeamMember(req.user, req.body);
    res.status(201).json({
      success: true,
      member: result.member,
      message: result.message,
      requiresAcceptance: result.requiresAcceptance,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Team member with this email already exists' });
    }
    handle(res, err);
  }
});

// PUT - Update a team member
router.put('/:id', async (req, res) => {
  try {
    const member = await updateTeamMember(req.user, req.params.id, req.body);
    res.json({ success: true, member, message: 'Team member updated successfully' });
  } catch (err) {
    handle(res, err);
  }
});

// DELETE - Remove a team member
router.delete('/:id', async (req, res) => {
  try {
    await deleteTeamMember(req.user, req.params.id);
    res.json({ success: true, message: 'Team member removed successfully' });
  } catch (err) {
    handle(res, err);
  }
});

// POST - Accept invitation (for the invited user)
router.post('/accept-invitation/:id', async (req, res) => {
  try {
    await acceptInvitation(req.user, req.params.id);
    res.json({ success: true, message: 'Invitation accepted successfully' });
  } catch (err) {
    handle(res, err);
  }
});

// POST - Decline invitation (for the invited user)
router.post('/decline-invitation/:id', async (req, res) => {
  try {
    await declineInvitation(req.user, req.params.id);
    res.json({ success: true, message: 'Invitation declined' });
  } catch (err) {
    handle(res, err);
  }
});

module.exports = router;
