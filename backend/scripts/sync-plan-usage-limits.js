/**
 * Sync usageLimits from org.plan for every organization.
 * Fixes stale ceilings (e.g. plan=enterprise still stuck at maxJobs:10).
 *
 * Usage: node scripts/sync-plan-usage-limits.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const { applyPlanLimits, getLimitsForPlan } = require('../config/planLimits');

async function main() {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL missing');
  await mongoose.connect(process.env.MONGODB_URL);

  const orgs = await Organization.find({}).select('name domain plan usageLimits');
  let updated = 0;
  for (const org of orgs) {
    const before = {
      maxJobs: org.usageLimits?.maxJobs,
      maxUsers: org.usageLimits?.maxUsers,
      maxCandidates: org.usageLimits?.maxCandidates,
    };
    applyPlanLimits(org, org.plan || 'starter');
    const after = getLimitsForPlan(org.plan || 'starter');
    const changed =
      before.maxJobs !== after.maxJobs
      || before.maxUsers !== after.maxUsers
      || before.maxCandidates !== after.maxCandidates;
    if (changed) {
      await org.save();
      updated += 1;
      console.log(`${org.name || org._id} (${org.plan}): jobs ${before.maxJobs} → ${after.maxJobs}`);
    }
  }

  console.log(JSON.stringify({ scanned: orgs.length, updated }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
