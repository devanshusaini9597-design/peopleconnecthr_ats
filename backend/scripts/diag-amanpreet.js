require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const { employeeDeskFilter, spocOwnershipClauses } = require('../utils/dataScope');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);

  const users = await User.find({
    $or: [{ name: /amanpreet/i }, { email: /amanpreet/i }],
    isActive: { $ne: false },
  })
    .select('name email role organizationId')
    .lean();

  console.log(
    'USERS',
    JSON.stringify(
      users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        org: String(u.organizationId),
      })),
      null,
      2
    )
  );

  const spocVals = await Candidate.aggregate([
    { $match: { spoc: /aman/i } },
    { $group: { _id: '$spoc', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 40 },
  ]);
  console.log('SPOC_LIKE_AMAN', JSON.stringify(spocVals, null, 2));

  for (const u of users) {
    const filter = employeeDeskFilter(
      { id: u._id, role: u.role, name: u.name, email: u.email },
      u.organizationId
    );
    const total = await Candidate.countDocuments(filter);
    const created = await Candidate.countDocuments({
      createdBy: { $in: [u._id, String(u._id)] },
    });
    const clauses = spocOwnershipClauses(u);
    console.log(
      JSON.stringify(
        {
          email: u.email,
          name: u.name,
          deskTotal: total,
          createdByTotal: created,
          tokens: clauses.map((c) => String(c.spoc)),
          filter,
        },
        null,
        2
      )
    );
  }

  // Sample candidates with empty/odd SPOC for createdBy = amanpreet
  for (const u of users) {
    const sample = await Candidate.find({ createdBy: { $in: [u._id, String(u._id)] } })
      .select('name spoc status organizationId')
      .limit(15)
      .lean();
    const spocDist = await Candidate.aggregate([
      { $match: { createdBy: { $in: [u._id, String(u._id)] } } },
      { $group: { _id: '$spoc', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    console.log('CREATED_BY_SPOC_DIST', u.email, JSON.stringify(spocDist, null, 2));
    console.log(
      'CREATED_BY_SAMPLE',
      u.email,
      JSON.stringify(
        sample.map((c) => ({ name: c.name, spoc: c.spoc, status: c.status })),
        null,
        2
      )
    );
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
