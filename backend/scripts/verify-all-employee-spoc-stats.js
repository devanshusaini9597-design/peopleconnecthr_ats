require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const { employeeDeskFilter } = require('../utils/dataScope');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const users = await User.find({
    email: /skillnixrecruitment\.com$/i,
    isActive: { $ne: false },
  })
    .select('name email role organizationId')
    .sort({ role: 1, name: 1 })
    .lean();

  const rows = [];
  for (const u of users) {
    const filter = employeeDeskFilter(
      { id: u._id, role: u.role, name: u.name, email: u.email },
      u.organizationId
    );
    const total = await Candidate.countDocuments(filter);
    const byStatus = await Candidate.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusMap = {};
    for (const s of byStatus) statusMap[s._id || '(empty)'] = s.count;
    rows.push({
      email: u.email,
      name: u.name || '',
      role: u.role,
      total,
      applied: statusMap.APPLIED || statusMap.Applied || 0,
      statuses: statusMap,
    });
  }
  console.log(JSON.stringify(rows, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
