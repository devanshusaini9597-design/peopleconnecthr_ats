/**
 * Profile domain logic for /api/profile routes.
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Candidate = require('../models/Candidate');
const { generateToken } = require('../middleware/authMiddleware');
const { getEntitlements } = require('../config/planFeatures');
const { normalizeText } = require('../utils/textNormalize');

const UPLOADS_ROOT = path.join(__dirname, '..');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function unlinkProfilePicture(profilePicture) {
  if (!profilePicture) return;
  const picPath = path.join(UPLOADS_ROOT, profilePicture);
  if (fs.existsSync(picPath)) fs.unlinkSync(picPath);
}

async function getProfile(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) throw httpError('User not found', 404);

  let organization = null;
  let entitlements = [];
  if (user.organizationId) {
    organization = await Organization.findById(user.organizationId)
      .select('name slug logo plan planExpiresAt atsSettings settings usageCurrent usageLimits')
      .lean();
    if (organization) {
      entitlements = getEntitlements(organization.plan);
    }
  }

  const { getEffectivePermissions } = require('../middleware/permissionMiddleware');
  const permissions = await getEffectivePermissions(user);

  return {
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture || '',
      role: user.role,
      organizationId: user.organizationId,
      isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboardingCompleted,
      customRoleId: user.customRoleId || null,
      permissions,
    },
    organization,
    entitlements,
  };
}

async function updateProfile(userId, { name, phone }) {
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  if (name !== undefined) user.name = normalizeText(name);
  if (phone !== undefined) user.phone = phone.trim();
  await user.save();

  return {
    token: generateToken(user),
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture || '',
      role: user.role,
    },
  };
}

async function updateProfilePicture(userId, file) {
  if (!file) throw httpError('No image file provided', 400);
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  unlinkProfilePicture(user.profilePicture);
  user.profilePicture = `/uploads/${file.filename}`;
  await user.save();

  return { profilePicture: user.profilePicture };
}

async function removeProfilePicture(userId) {
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  unlinkProfilePicture(user.profilePicture);
  user.profilePicture = '';
  await user.save();
}

async function changePassword(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw httpError('Current and new password required', 400);
  }
  if (newPassword.length < 8) {
    throw httpError('New password must be at least 8 characters', 400);
  }

  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  if (!user.password.startsWith('$2')) {
    throw httpError('Your account requires a password reset. Please use "Forgot Password".', 400);
  }

  let passwordMatch = false;
  try {
    passwordMatch = await bcrypt.compare(currentPassword, user.password);
  } catch (bcryptErr) {
    console.error('[CHANGE-PASSWORD] bcrypt error:', bcryptErr.message);
    throw httpError('Server error during password verification', 500);
  }

  if (!passwordMatch) {
    throw httpError('Current password is incorrect', 401);
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
}

async function getProfileStats(user) {
  const candidateFilter = user.organizationId
    ? { organizationId: user.organizationId }
    : { createdBy: user.id };
  const candidateCount = await Candidate.countDocuments(candidateFilter);

  const dbUser = await User.findById(user.id).select('createdAt');
  const memberSince = dbUser?.createdAt || (dbUser?._id ? dbUser._id.getTimestamp() : null);

  let orgStats = null;
  if (user.organizationId) {
    orgStats = await Organization.findById(user.organizationId)
      .select('usageCurrent usageLimits plan planExpiresAt')
      .lean();
  }

  return {
    totalCandidates: candidateCount,
    memberSince,
    role: user.role,
    organization: orgStats,
  };
}

module.exports = {
  httpError,
  getProfile,
  updateProfile,
  updateProfilePicture,
  removeProfilePicture,
  changePassword,
  getProfileStats,
};
