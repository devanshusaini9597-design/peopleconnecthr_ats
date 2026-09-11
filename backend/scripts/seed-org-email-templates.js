/**
 * Seed enterprise email templates for every org (or one email's org).
 * Usage:
 *   node scripts/seed-org-email-templates.js
 *   node scripts/seed-org-email-templates.js deava@devlumiq.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const EmailTemplate = require('../models/EmailTemplate');
const { ensureDefaultCatalog } = require('../services/emailTemplateService');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);

  // Drop legacy global unique issues: remove templates with no organizationId
  const orphan = await EmailTemplate.deleteMany({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log('removed unscoped templates:', orphan.deletedCount);

  const emailArg = String(process.argv[2] || '')
    .trim()
    .toLowerCase();
  let orgs = [];
  if (emailArg) {
    const user = await User.findOne({ email: emailArg }).select('_id organizationId email');
    if (!user?.organizationId) {
      console.log(JSON.stringify({ ok: false, error: 'User/org not found', email: emailArg }));
      process.exit(1);
    }
    orgs = await Organization.find({ _id: user.organizationId }).select('_id name ownerId');
  } else {
    orgs = await Organization.find({}).select('_id name ownerId');
  }

  const results = [];
  for (const org of orgs) {
    const ownerId = org.ownerId || (await User.findOne({ organizationId: org._id }).select('_id'))?._id;
    if (!ownerId) {
      results.push({ org: org.name, skipped: true, reason: 'no owner' });
      continue;
    }
    const seeded = await ensureDefaultCatalog(ownerId, org._id);
    const count = await EmailTemplate.countDocuments({ organizationId: org._id });
    results.push({
      org: org.name,
      organizationId: String(org._id),
      added: seeded.added,
      catalog: seeded.total,
      totalInOrg: count,
    });
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
