/**
 * Creates Company A / Company B owners on the staging database.
 * Usage: MONGODB_URL=... JWT_SECRET=... node scripts/seed-staging-module1-orgs.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'staging-seed-only';
}

const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { applyPlanLimits } = require('../config/planLimits');

const COMPANIES = [
  {
    name: 'Test Company A',
    slug: 'test-company-a',
    email: 'devanshusaini72+a.owner@gmail.com',
    password: 'TestCompanyA1',
    personName: 'Company A Owner',
  },
  {
    name: 'Test Company B',
    slug: 'test-company-b',
    email: 'devanshusaini72+b.owner@gmail.com',
    password: 'TestCompanyB1',
    personName: 'Company B Owner',
  },
];

async function upsertCompany(spec) {
  const email = spec.email.toLowerCase().trim();
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      name: spec.personName,
      email,
      password: spec.password,
      role: 'owner',
      signupStatus: 'active',
      isEmailVerified: true,
      isActive: true,
      companyName: spec.name,
      onboardingCompleted: true,
      signupApprovedAt: new Date(),
    });
    await user.save();
  } else {
    user.name = spec.personName;
    user.password = spec.password;
    user.role = 'owner';
    user.signupStatus = 'active';
    user.isEmailVerified = true;
    user.isActive = true;
    user.companyName = spec.name;
    user.onboardingCompleted = true;
    user.signupApprovedAt = user.signupApprovedAt || new Date();
    await user.save();
  }

  let org = user.organizationId
    ? await Organization.findById(user.organizationId)
    : await Organization.findOne({ slug: spec.slug });

  if (!org) {
    org = new Organization({
      name: spec.name,
      slug: spec.slug,
      ownerId: user._id,
      domain: 'gmail.com',
      allowedDomains: ['gmail.com'],
      plan: 'enterprise',
    });
    applyPlanLimits(org, 'enterprise');
    await org.save();
  } else {
    org.name = spec.name;
    org.slug = spec.slug;
    org.ownerId = user._id;
    org.domain = 'gmail.com';
    org.allowedDomains = ['gmail.com'];
    org.plan = 'enterprise';
    applyPlanLimits(org, 'enterprise');
    await org.save();
  }

  user.organizationId = org._id;
  user.role = 'owner';
  await user.save();
  return { email: user.email, org: org.slug };
}

async function main() {
  const uri = process.env.MONGODB_URL;
  if (!uri) {
    throw new Error('MONGODB_URL is required');
  }
  await mongoose.connect(uri);
  const created = [];
  for (const spec of COMPANIES) {
    created.push(await upsertCompany(spec));
  }
  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, created }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
