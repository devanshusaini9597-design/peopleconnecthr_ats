require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Candidate = require('../models/Candidate');

function escapeRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const users = await User.find({
    email: /skillnixrecruitment\.com$/i,
    role: { $nin: ['owner'] },
    isActive: { $ne: false },
  })
    .select('name email role organizationId')
    .lean();

  const rows = [];
  for (const u of users) {
    const id = u._id;
    const idStr = String(id);
    const org = u.organizationId;
    const orgStr = org ? String(org) : null;

    const byCreated = await Candidate.countDocuments({
      createdBy: { $in: [id, idStr] },
    });
    const byCreatedWithOrgStrict = org
      ? await Candidate.countDocuments({
          organizationId: org,
          createdBy: { $in: [id, idStr] },
        })
      : byCreated;
    const byCreatedWithOrgIn = org
      ? await Candidate.countDocuments({
          organizationId: { $in: [org, orgStr] },
          createdBy: { $in: [id, idStr] },
        })
      : byCreated;
    const byCreatedNoOrgReq = byCreated;

    const name = String(u.name || '').trim();
    const bySpocExact = name
      ? await Candidate.countDocuments({ spoc: new RegExp(`^${escapeRx(name)}$`, 'i') })
      : 0;

    const deskMine = await Candidate.countDocuments({
      $or: [
        { createdBy: { $in: [id, idStr] } },
        { 'sharedWith.userId': { $in: [id, idStr] } },
      ],
    });

    const oldBrokenDesk = org
      ? await Candidate.countDocuments({
          $or: [
            { organizationId: org, createdBy: { $in: [id, idStr] } },
            { createdBy: { $in: [id, idStr] }, organizationId: { $exists: false } },
            { createdBy: { $in: [id, idStr] }, organizationId: null },
            { organizationId: org, 'sharedWith.userId': { $in: [id, idStr] } },
          ],
        })
      : deskMine;

    if (byCreated >= 5 || deskMine >= 5 || bySpocExact >= 5) {
      rows.push({
        email: u.email,
        name: u.name,
        role: u.role,
        byCreatedNoOrgReq,
        byCreatedWithOrgStrict,
        byCreatedWithOrgIn,
        deskMine,
        oldBrokenDesk,
        bySpocExact,
        diffOrgStrict: byCreatedNoOrgReq - byCreatedWithOrgStrict,
        diffBroken: deskMine - oldBrokenDesk,
      });
    }
  }

  rows.sort((a, b) => b.deskMine - a.deskMine || b.byCreatedNoOrgReq - a.byCreatedNoOrgReq);
  console.log(JSON.stringify(rows, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
