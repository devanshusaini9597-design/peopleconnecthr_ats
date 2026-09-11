require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Candidate = require('../models/Candidate');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const email = process.argv[2] || 'rangoli@skillnixrecruitment.com';
  const u = await User.findOne({ email }).select('name email role organizationId').lean();
  if (!u) {
    console.log('user not found');
    process.exit(1);
  }
  const id = u._id;
  const idStr = String(id);
  const org = u.organizationId;

  const created = await Candidate.find({ createdBy: { $in: [id, idStr] } })
    .select('name status organizationId createdBy spoc createdAt')
    .lean();

  const orgIds = {};
  for (const c of created) {
    const k = c.organizationId == null ? 'null' : `${typeof c.organizationId}:${String(c.organizationId)}`;
    orgIds[k] = (orgIds[k] || 0) + 1;
  }

  const spocHits = await Candidate.countDocuments({
    spoc: /rangoli/i,
  });
  const spocList = await Candidate.find({ spoc: /rangoli/i })
    .select('name spoc createdBy organizationId status')
    .limit(40)
    .lean();

  const orgWide = org
    ? await Candidate.countDocuments({ organizationId: { $in: [org, String(org)] } })
    : null;

  // Same org candidates where createdBy is missing/null
  const orphansInOrg = org
    ? await Candidate.countDocuments({
        organizationId: { $in: [org, String(org)] },
        $or: [{ createdBy: { $exists: false } }, { createdBy: null }],
      })
    : 0;

  console.log(
    JSON.stringify(
      {
        user: { email: u.email, name: u.name, role: u.role, organizationId: String(org) },
        createdCount: created.length,
        createdOrgIdBreakdown: orgIds,
        spocHits,
        orgWide,
        orphansInOrg,
        sampleSpoc: spocList.slice(0, 10).map((c) => ({
          name: c.name,
          spoc: c.spoc,
          createdBy: c.createdBy ? String(c.createdBy) : null,
          status: c.status,
        })),
        statuses: created.reduce((acc, c) => {
          const s = c.status || '(empty)';
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
