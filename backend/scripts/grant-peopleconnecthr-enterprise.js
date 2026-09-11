/**
 * One-shot: grant Enterprise plan / allowedDomains for peopleconnecthr.com
 * (same treatment as skillnix.com on the ENTERPRISE_ORG_DOMAINS allowlist).
 *
 * Usage: node scripts/grant-peopleconnecthr-enterprise.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Company = require('../models/Company');

const DOMAIN = 'peopleconnecthr.com';

async function main() {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL missing');
  await mongoose.connect(process.env.MONGODB_URL);

  const orgFilter = {
    $or: [
      { domain: DOMAIN },
      { domain: { $regex: /^peopleconnecthr\.com$/i } },
      { allowedDomains: DOMAIN },
    ],
  };

  const orgRes = await Organization.updateMany(orgFilter, {
    $set: {
      plan: 'enterprise',
      domain: DOMAIN,
      'productPlans.ats': 'enterprise',
      'usageLimits.maxUsers': -1,
      'usageLimits.maxJobs': -1,
      'usageLimits.maxCandidates': -1,
      'usageLimits.maxEmailsPerMonth': -1,
    },
    $addToSet: { allowedDomains: DOMAIN },
  });

  const companyRes = await Company.updateMany(
    {
      $or: [
        { domain: DOMAIN },
        { domain: { $regex: /^peopleconnecthr\.com$/i } },
        { allowedDomains: DOMAIN },
      ],
    },
    {
      $set: { domain: DOMAIN },
      $addToSet: { allowedDomains: DOMAIN },
    }
  );

  const orgs = await Organization.find(orgFilter)
    .select('name domain plan allowedDomains productPlans')
    .lean();

  console.log(
    JSON.stringify(
      {
        orgMatched: orgRes.matchedCount,
        orgModified: orgRes.modifiedCount,
        companyMatched: companyRes.matchedCount,
        companyModified: companyRes.modifiedCount,
        orgs,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
