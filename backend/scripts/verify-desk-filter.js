require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const { employeeDeskFilter } = require('../utils/dataScope');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const email = process.argv[2] || 'rangoli@skillnixrecruitment.com';
  const u = await User.findOne({ email }).lean();
  const filter = employeeDeskFilter(
    { id: u._id, role: u.role, name: u.name, email: u.email },
    u.organizationId
  );
  const total = await Candidate.countDocuments(filter);
  const byStatus = await Candidate.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  console.log(JSON.stringify({ email, total, byStatus, filterPreview: JSON.stringify(filter).slice(0, 400) }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
