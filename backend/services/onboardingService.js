/**
 * Onboarding domain — register, verify, org create, invites.
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function register({ email, password }) {
  if (!email || !password || password.length < 8) {
    throw httpError('Invalid email or password (min 8 chars)', 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) throw httpError('Email already exists', 400);

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

  return { success: true, message: 'Registration successful. Please verify your email.' };
}

async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });
  if (!user) throw httpError('Invalid or expired token', 400);

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return { success: true, message: 'Email verified successfully' };
}

function resendVerification() {
  // STUB: Implement rate limiting and resend logic
  return { success: true, message: 'Verification email sent' };
}

async function createOrg(userId, { name }) {
  if (!name || name.length < 2) throw httpError('Organization name required', 400);

  const user = await User.findById(userId);
  if (!user.isEmailVerified) throw httpError('Email not verified', 403);
  if (user.organizationId) throw httpError('User already has an organization', 400);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const org = new Organization({ name, slug, ownerId: user._id });
  await org.save();

  user.organizationId = org._id;
  user.role = 'owner';
  await user.save();

  return { success: true, organization: org };
}

async function inviteTeammate(actor, { email, role, name, customRoleId }) {
  const inviteToken = crypto.randomBytes(32).toString('hex');

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.organizationId && existing.organizationId.toString() !== actor.organizationId.toString()) {
      throw httpError('Email belongs to another organization', 400);
    }
    if (existing.organizationId && existing.organizationId.toString() === actor.organizationId.toString()) {
      throw httpError('User already in organization', 400);
    }
  }

  let resolvedCustomRoleId = null;
  if (customRoleId) {
    const CustomRole = require('../models/CustomRole');
    const pack = await CustomRole.findOne({ _id: customRoleId, organizationId: actor.organizationId });
    if (!pack) throw httpError('Custom role not found', 400);
    resolvedCustomRoleId = pack._id;
  }

  const invitee = new User({
    email,
    role: role || 'recruiter',
    name: name || '',
    // Placeholder until invitee sets their own password on accept
    password: crypto.randomBytes(32).toString('hex'),
    inviteToken,
    inviteTokenExpires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    organizationId: actor.organizationId,
    invitedBy: actor.id,
    isActive: false,
    customRoleId: resolvedCustomRoleId,
  });
  await invitee.save();

  console.log(`[STUB] Invite link: /accept-invite?token=${inviteToken}`);
  return { success: true, message: 'Invitation sent' };
}

async function acceptInvite({ token, name, password }, req) {
  const user = await User.findOne({ inviteToken: token, inviteTokenExpires: { $gt: Date.now() } });
  if (!user) throw httpError('Invalid or expired invitation', 400);

  user.name = name || user.name;
  user.password = await bcrypt.hash(password, 10);
  user.isActive = true;
  user.isEmailVerified = true;
  user.inviteToken = undefined;
  user.inviteTokenExpires = undefined;
  await user.save();

  const { issueAuthToken } = require('./sessionService');
  const authToken = await issueAuthToken(user, req);

  return { setCookieToken: authToken, body: { success: true, user } };
}

async function getInvite(token) {
  const user = await User.findOne({
    inviteToken: token,
    inviteTokenExpires: { $gt: Date.now() }
  }).populate('organizationId invitedBy');
  if (!user) throw httpError('Invalid or expired invitation', 400);

  return {
    success: true,
    data: {
      orgName: user.organizationId.name,
      inviterName: user.invitedBy.name,
      role: user.role
    }
  };
}

async function completeOnboarding(userId) {
  await User.findByIdAndUpdate(userId, { onboardingCompleted: true });
  return { success: true, message: 'Onboarding completed' };
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  createOrg,
  inviteTeammate,
  acceptInvite,
  getInvite,
  completeOnboarding,
};
