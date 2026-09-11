require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const { employeeDeskFilter, createdByFilter, spocOwnershipClauses, organizationIdMatch } = require('../utils/dataScope');

function unionDeskFilter(user, organizationId) {
  const spoc = employeeDeskFilter(user, organizationId);
  const own = createdByFilter(user);
  const orgMatch = organizationIdMatch(organizationId);
  const createdClause = orgMatch
    ? { $and: [own, { $or: [orgMatch, { organizationId: { $exists: false } }, { organizationId: null }] }] }
    : own;
  return { $or: [spoc, createdClause] };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const users = await User.find({
    email: /skillnixrecruitment\.com$/i,
    isActive: { $ne: false },
    role: { $nin: ['freelancer'] },
  })
    .select('name email role organizationId')
    .sort({ name: 1 })
    .lean();

  const mismatches = [];
  for (const u of users) {
    const spocOnly = await Candidate.countDocuments(
      employeeDeskFilter({ id: u._id, role: u.role, name: u.name, email: u.email }, u.organizationId)
    );
    const created = await Candidate.countDocuments({
      ...(organizationIdMatch(u.organizationId) || {}),
      ...createdByFilter({ id: u._id }),
    });
    const union = await Candidate.countDocuments(
      unionDeskFilter({ id: u._id, role: u.role, name: u.name, email: u.email }, u.organizationId)
    );

    // Distinct SPOCs on createdBy rows
    const spocOnCreated = await Candidate.aggregate([
      { $match: { createdBy: { $in: [u._id, String(u._id)] } } },
      { $group: { _id: '$spoc', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    if (spocOnly !== created || spocOnly === 0 && created > 0 || Math.abs(union - spocOnly) > 0) {
      mismatches.push({
        name: u.name,
        email: u.email,
        role: u.role,
        spocOnly,
        createdBy: created,
        union,
        spocOnCreated,
      });
    }
  }

  mismatches.sort((a, b) => (b.createdBy - b.spocOnly) - (a.createdBy - a.spocOnly));
  console.log(JSON.stringify(mismatches, null, 2));
  console.log('TOTAL_USERS', users.length, 'MISMATCH_ROWS', mismatches.length);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
