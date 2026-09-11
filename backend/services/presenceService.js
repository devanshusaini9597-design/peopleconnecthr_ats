const User = require('../models/User');

const ONLINE_MS = 75_000;
const AWAY_MS = 10 * 60_000;

function lastSeenAt(user) {
  return user?.lastActiveAt || user?.lastLoginAt || null;
}

function presenceStatus(timestamp) {
  if (!timestamp) return 'offline';
  const age = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(age) || age < 0) return 'offline';
  if (age <= ONLINE_MS) return 'online';
  if (age <= AWAY_MS) return 'away';
  return 'offline';
}

function presentUser(user, currentUserId) {
  const seenAt = lastSeenAt(user);
  return {
    _id: user._id,
    name: user.name || user.email || 'Teammate',
    email: user.email || '',
    role: user.role || 'recruiter',
    profilePicture: user.profilePicture || '',
    lastActiveAt: seenAt,
    lastLoginAt: user.lastLoginAt || null,
    status: presenceStatus(seenAt),
    isYou: currentUserId ? String(user._id) === String(currentUserId) : false,
  };
}

async function heartbeat(user) {
  const now = new Date();
  await User.updateOne({ _id: user.id }, { $set: { lastActiveAt: now } });
  return { lastActiveAt: now, status: 'online' };
}

async function listOrgPresence(user) {
  if (!user?.organizationId) {
    return [{
      _id: user.id,
      name: user.name || user.email || 'You',
      email: user.email || '',
      role: user.role || 'recruiter',
      profilePicture: user.profilePicture || '',
      lastActiveAt: new Date(),
      lastLoginAt: new Date(),
      status: 'online',
      isYou: true,
    }];
  }

  const people = await User.find({
    organizationId: user.organizationId,
    isActive: { $ne: false },
  }).select('name email role lastActiveAt lastLoginAt profilePicture').sort({ name: 1 }).lean();

  return people.map((p) => presentUser(p, user.id));
}

module.exports = {
  ONLINE_MS,
  AWAY_MS,
  lastSeenAt,
  presenceStatus,
  heartbeat,
  listOrgPresence,
};
