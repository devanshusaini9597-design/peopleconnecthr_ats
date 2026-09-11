/**
 * Profile domain logic for /api/profile routes.
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Candidate = require('../models/Candidate');
const { getEntitlements } = require('../config/planFeatures');
const { normalizeText } = require('../utils/textNormalize');
const { ensureOrgPlanForDomain } = require('../utils/orgDomain');
const { createdByFilter } = require('../utils/dataScope');
const s3Service = require('./s3Service');

const UPLOADS_ROOT = path.join(__dirname, '..');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function unlinkLocalProfilePicture(profilePicture) {
  if (!profilePicture) return;
  const picPath = path.join(UPLOADS_ROOT, profilePicture);
  if (fs.existsSync(picPath)) fs.unlinkSync(picPath);
}

async function deleteProfilePicture(profilePicture) {
  if (!profilePicture) return;
  await s3Service.deleteStoredAsset(profilePicture);
  unlinkLocalProfilePicture(profilePicture);
}

async function getProfile(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) throw httpError('User not found', 404);

  let organization = null;
  let entitlements = [];
  if (user.organizationId) {
    await ensureOrgPlanForDomain(user.organizationId, user.email);
    organization = await Organization.findById(user.organizationId)
      .select('name slug logo plan planExpiresAt atsSettings settings usageCurrent usageLimits domain')
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
      mustChangePassword: Boolean(user.mustChangePassword),
      customRoleId: user.customRoleId || null,
      isPlatformOperator: require('../utils/orgDomain').isPlatformOperator(user),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
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
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture || '',
      role: user.role,
    },
  };
}

async function persistProfilePicture(userId, file) {
  const ext = path.extname(file.originalname || file.filename || '').toLowerCase() || '.jpg';
  const filename = `profile-${userId}-${Date.now()}${ext}`;
  const body = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
  if (!body) throw httpError('Could not read uploaded image', 400);

  const uploaded = await s3Service.uploadAsset({
    kind: 'profile',
    body,
    filename,
    originalName: file.originalname || filename,
    contentType: file.mimetype || 'image/jpeg',
  });
  if (uploaded?.publicPath) {
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
    }
    return uploaded.publicPath;
  }

  const dest = path.join(UPLOADS_ROOT, 'uploads');
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const localName = file.filename || filename;
  if (file.path && fs.existsSync(file.path)) {
    return `/uploads/${path.basename(file.path)}`;
  }
  fs.writeFileSync(path.join(dest, localName), body);
  return `/uploads/${localName}`;
}

async function updateProfilePicture(userId, file) {
  if (!file) throw httpError('No image file provided', 400);
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  const nextPath = await persistProfilePicture(userId, file);
  await deleteProfilePicture(user.profilePicture);
  user.profilePicture = nextPath;
  await user.save();

  return { profilePicture: user.profilePicture };
}

async function removeProfilePicture(userId) {
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  await deleteProfilePicture(user.profilePicture);
  user.profilePicture = '';
  await user.save();
}

async function changePassword(userId, { currentPassword, newPassword }, { keepJti } = {}) {
  if (!newPassword) {
    throw httpError('New password required', 400);
  }
  if (newPassword.length < 8) {
    throw httpError('New password must be at least 8 characters', 400);
  }

  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);

  if (!user.password.startsWith('$2')) {
    throw httpError('Your account requires a password reset. Please use "Forgot Password".', 400);
  }

  const forcedChange = Boolean(user.mustChangePassword);

  if (!forcedChange) {
    if (!currentPassword) {
      throw httpError('Current password required', 400);
    }
    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(currentPassword, user.password);
    } catch (bcryptErr) {
      console.error('[CHANGE-PASSWORD] bcrypt error:', bcryptErr.message);
      throw httpError('Server error during password verification', 500);
    }
    if (!passwordMatch) {
      throw httpError('Current password is incorrect', 400);
    }
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();

  const { revokeOtherSessions } = require('./sessionService');
  await revokeOtherSessions(userId, keepJti);
}

async function getProfileStats(user) {
  const own = createdByFilter(user);
  const candidateFilter = user.organizationId
    ? { organizationId: user.organizationId, ...own }
    : own;
  const candidateCount = await Candidate.countDocuments(candidateFilter);

  const dbUser = await User.findById(user.id).select('createdAt lastLoginAt isEmailVerified');
  const memberSince = dbUser?.createdAt || (dbUser?._id ? dbUser._id.getTimestamp() : null);

  return {
    totalCandidates: candidateCount,
    memberSince,
    lastLoginAt: dbUser?.lastLoginAt || null,
    isEmailVerified: Boolean(dbUser?.isEmailVerified),
    role: user.role,
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
