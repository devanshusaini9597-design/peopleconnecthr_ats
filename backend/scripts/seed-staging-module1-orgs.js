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

const ROLES = [
  { key: 'admin', slug: 'admin', label: 'Admin' },
  { key: 'hr_recruiter', slug: 'recruiter', label: 'HR Recruiter' },
  { key: 'hr_manager', slug: 'manager', label: 'HR Manager' },
  { key: 'sales', slug: 'sales', label: 'Sales' },
  { key: 'freelancer', slug: 'freelancer', label: 'Freelancer' },
  { key: 'other', slug: 'other', label: 'Other' },
];

const SHARED_INBOX = 'skillnix.qa@gmail.com';

const COMPANIES = [
  {
    tag: 'a',
    name: 'Test Company A',
    slug: 'test-company-a',
    email: `skillnix.qa+a.owner@gmail.com`,
    oldEmails: ['devanshusaini72+a.owner@gmail.com'],
    password: 'TestCompanyA1',
    personName: 'Company A Owner',
  },
  {
    tag: 'b',
    name: 'Test Company B',
    slug: 'test-company-b',
    email: `skillnix.qa+b.owner@gmail.com`,
    oldEmails: ['devanshusaini72+b.owner@gmail.com'],
    password: 'TestCompanyB1',
    personName: 'Company B Owner',
  },
];

async function findUserByEmails(emails) {
  const list = emails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean);
  return User.findOne({ email: { $in: list } });
}

async function upsertCompany(spec) {
  const email = spec.email.toLowerCase().trim();
  let user = await findUserByEmails([email, ...(spec.oldEmails || [])]);
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
    user.email = email;
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

  const members = [];
  for (const role of ROLES) {
    const memberEmail = `skillnix.qa+${spec.tag}.${role.slug}@gmail.com`;
    const oldMemberEmail = `devanshusaini72+${spec.tag}.${role.slug}@gmail.com`;
    const memberName = `Company ${spec.tag.toUpperCase()} ${role.label}`;
    let member = await findUserByEmails([memberEmail, oldMemberEmail]);
    if (!member) {
      member = new User({
        name: memberName,
        email: memberEmail,
        password: spec.password,
        role: role.key,
        signupStatus: 'active',
        isEmailVerified: true,
        isActive: true,
        companyName: spec.name,
        onboardingCompleted: true,
        organizationId: org._id,
        invitedBy: user._id,
        signupApprovedAt: new Date(),
      });
      await member.save();
    } else {
      member.email = memberEmail;
      member.name = memberName;
      member.password = spec.password;
      member.role = role.key;
      member.signupStatus = 'active';
      member.isEmailVerified = true;
      member.isActive = true;
      member.companyName = spec.name;
      member.onboardingCompleted = true;
      member.organizationId = org._id;
      member.invitedBy = user._id;
      await member.save();
    }
    members.push({ role: role.key, email: member.email });
  }

  return { email: user.email, org: org.slug, members };
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
  console.log(JSON.stringify({ ok: true, sharedInbox: SHARED_INBOX, created }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
