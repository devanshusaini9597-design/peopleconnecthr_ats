/**
 * Grant Enterprise + unlimited usageLimits for internal Skillnix / PCHR orgs.
 * SaaS customer orgs keep plan ceilings; these domains stay unlimited.
 *
 * Usage: node scripts/grant-internal-enterprise.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Company = require('../models/Company');
const { getEnterpriseOrgDomains } = require('../utils/orgDomain');
const { applyPlanLimits } = require('../config/planLimits');

async function main() {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL missing');
  await mongoose.connect(process.env.MONGODB_URL);

  const domains = getEnterpriseOrgDomains();
  const domainRegexes = domains.map((d) => new RegExp(`^${d.replace(/\./g, '\\.')}$`, 'i'));

  const orgFilter = {
    $or: [
      { domain: { $in: domains } },
      { domain: { $in: domainRegexes } },
      { allowedDomains: { $in: domains } },
      { slug: { $regex: /skillnix|peopleconnect|devlumiq/i } },
      { name: { $regex: /skillnix|people\s*connect/i } },
    ],
  };

  const orgs = await Organization.find(orgFilter);
  const results = [];
  for (const org of orgs) {
    org.plan = 'enterprise';
    if (!org.productPlans) org.productPlans = {};
    org.productPlans.ats = 'enterprise';
    applyPlanLimits(org, 'enterprise');
    if (org.domain && !Array.isArray(org.allowedDomains)) org.allowedDomains = [org.domain];
    if (org.domain && Array.isArray(org.allowedDomains)
      && !org.allowedDomains.map((d) => String(d).toLowerCase()).includes(String(org.domain).toLowerCase())) {
      org.allowedDomains.push(org.domain);
    }
    await org.save();
    results.push({
      id: String(org._id),
      name: org.name,
      domain: org.domain,
      plan: org.plan,
      maxJobs: org.usageLimits?.maxJobs,
      maxUsers: org.usageLimits?.maxUsers,
      maxCandidates: org.usageLimits?.maxCandidates,
    });
  }

  for (const domain of domains) {
    await Company.updateMany(
      {
        $or: [
          { domain },
          { domain: { $regex: new RegExp(`^${domain.replace(/\./g, '\\.')}$`, 'i') } },
          { allowedDomains: domain },
        ],
      },
      {
        $set: { domain },
        $addToSet: { allowedDomains: domain },
      }
    );
  }

  console.log(JSON.stringify({ domains, updatedOrgs: results.length, orgs: results }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
