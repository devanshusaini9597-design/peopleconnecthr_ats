const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const User = require('../models/User');
const Organization = require('../models/Organization');

/**
 * POST /register
 * Create new user account (public)
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Invalid email or password (min 8 chars)' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    const user = new User({
      email,
      password: hashedPassword,
      emailVerificationToken,
      emailVerificationExpires
    });
    
    await user.save();
    console.log(`[STUB] Verification Token for ${email}: ${emailVerificationToken}`);
    
    res.json({ success: true, message: 'Registration successful. Please verify your email.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /verify-email
 * Verify email with token (public)
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ emailVerificationToken: token, emailVerificationExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /resend-verification
 */
router.post('/resend-verification', async (req, res) => {
  // STUB: Implement rate limiting and resend logic
  res.json({ success: true, message: 'Verification email sent' });
});

/**
 * POST /create-org
 * Create organization (protected)
 */
router.post('/create-org', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.length < 2) return res.status(400).json({ success: false, message: 'Organization name required' });
    
    const user = await User.findById(req.user.id);
    if (!user.isEmailVerified) return res.status(403).json({ success: false, message: 'Email not verified' });
    if (user.organizationId) return res.status(400).json({ success: false, message: 'User already has an organization' });
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    const org = new Organization({ name, slug, ownerId: user._id });
    await org.save();
    
    user.organizationId = org._id;
    user.role = 'owner';
    await user.save();
    
    res.json({ success: true, organization: org });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /invite
 * Invite teammate (protected, owner/admin)
 */
router.post('/invite', verifyToken, requireOrganization, requireAdmin, checkPlanLimit('users'), async (req, res) => {
  try {
    const { email, role, name } = req.body;
    const inviteToken = crypto.randomBytes(32).toString('hex');
    
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.organizationId && existing.organizationId.toString() !== req.user.organizationId.toString()) {
        return res.status(400).json({ success: false, message: 'Email belongs to another organization' });
      }
      if (existing.organizationId && existing.organizationId.toString() === req.user.organizationId.toString()) {
        return res.status(400).json({ success: false, message: 'User already in organization' });
      }
    }
    
    const invitee = new User({
      email,
      role,
      name,
      inviteToken,
      inviteTokenExpires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      organizationId: req.user.organizationId,
      invitedBy: req.user.id,
      isActive: false
    });
    await invitee.save();
    
    console.log(`[STUB] Invite link: /accept-invite?token=${inviteToken}`);
    res.json({ success: true, message: 'Invitation sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /accept-invite
 */
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, name, password } = req.body;
    const user = await User.findOne({ inviteToken: token, inviteTokenExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired invitation' });
    
    user.name = name || user.name;
    user.password = await bcrypt.hash(password, 10);
    user.isActive = true;
    user.isEmailVerified = true;
    user.inviteToken = undefined;
    user.inviteTokenExpires = undefined;
    await user.save();
    
    // STUB: Increment org usage
    // Generate JWT
    const authToken = jwt.sign({ id: user._id, role: user.role, organizationId: user.organizationId }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    
    res.json({ success: true, token: authToken, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /invite/:token
 */
router.get('/invite/:token', async (req, res) => {
  try {
    const user = await User.findOne({ inviteToken: req.params.token, inviteTokenExpires: { $gt: Date.now() } }).populate('organizationId invitedBy');
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired invitation' });
    
    res.json({ success: true, data: { orgName: user.organizationId.name, inviterName: user.invitedBy.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /complete-onboarding
 */
router.post('/complete-onboarding', verifyToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { onboardingCompleted: true });
    res.json({ success: true, message: 'Onboarding completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
