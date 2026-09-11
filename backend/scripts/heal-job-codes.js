/**
 * Heal job IDs for one org or all orgs (missing + duplicate → unique per organization).
 *
 * Usage:
 *   node scripts/heal-job-codes.js
 *   node scripts/heal-job-codes.js --org skillnixrecruitment
 *   node scripts/heal-job-codes.js --slug skillnixrecruitment
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Organization = require('../models/Organization');
const { healOrganizationJobCodes } = require('../services/jobCodeService');

async function main() {
  const uri = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URL in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const args = process.argv.slice(2);
  const slugIdx = args.findIndex((a) => a === '--slug' || a === '--org');
  let orgIds = [];

  if (slugIdx >= 0 && args[slugIdx + 1]) {
    const needle = String(args[slugIdx + 1]).toLowerCase();
    const org = await Organization.findOne({
      $or: [
        { slug: needle },
        { name: new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ],
    }).select('_id name slug').lean();
    if (!org) {
      console.error(`No organization matched: ${needle}`);
      process.exit(1);
    }
    orgIds = [org._id];
    console.log(`Healing job codes for: ${org.name} (${org.slug})`);
  } else {
    const orgs = await Organization.find({}).select('_id name slug').lean();
    orgIds = orgs.map((o) => o._id);
    console.log(`Healing job codes for ${orgIds.length} organization(s)…`);
  }

  let totalFixed = 0;
  let totalAssigned = 0;
  for (const orgId of orgIds) {
    const result = await healOrganizationJobCodes(orgId);
    totalFixed += result.fixed;
    totalAssigned += result.assigned;
    if (result.fixed || result.assigned) {
      const org = await Organization.findById(orgId).select('name slug').lean();
      console.log(
        `  ${org?.name || orgId}: ${result.assigned} assigned, ${result.fixed} duplicates fixed (${result.total} jobs)`
      );
    }
  }

  console.log(`Done. ${totalAssigned} new IDs, ${totalFixed} duplicates repaired.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
