/**
 * Demo account bootstrap — kept available for sales demos.
 */
const User = require('../models/User');
const Organization = require('../models/Organization');

const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@skillnix.app').toLowerCase().trim();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234!';
const DEMO_ORG_NAME = process.env.DEMO_ORG_NAME || 'SkillNix Demo';
const DEMO_ORG_SLUG = process.env.DEMO_ORG_SLUG || 'skillnix-demo';

const createDemoAccount = async () => {
  let user = await User.findOne({ email: DEMO_EMAIL });
  let organization = null;

  if (!user) {
    user = new User({
      name: 'Demo Recruiter',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      role: 'owner',
      isEmailVerified: true,
      onboardingCompleted: true,
      isActive: true,
    });
    await user.save();
  }

  if (user.organizationId) {
    organization = await Organization.findById(user.organizationId);
  }

  if (!organization) {
    let slug = DEMO_ORG_SLUG;
    let existingSlug = await Organization.findOne({ slug });
    let suffix = 1;
    while (existingSlug) {
      slug = `${DEMO_ORG_SLUG}-${suffix}`;
      existingSlug = await Organization.findOne({ slug });
      suffix += 1;
    }

    organization = new Organization({
      name: DEMO_ORG_NAME,
      slug,
      ownerId: user._id,
      plan: 'enterprise',
      usageCurrent: { users: 1, jobs: 0, candidates: 0, emailsSent: 0 },
      settings: { timezone: 'Asia/Kolkata', currency: 'INR', dateFormat: 'DD/MM/YYYY' },
      atsSettings: {
        pipelineStages: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'],
        defaultSources: ['LinkedIn', 'Indeed', 'Naukri', 'Referral', 'Direct'],
        enableCandidatePortal: true,
        enableCareersPage: true,
      },
    });
    await organization.save();
    user.organizationId = organization._id;
    await user.save();
  }

  if (user.organizationId && !organization.ownerId) {
    organization.ownerId = user._id;
    await organization.save();
  }

  if (organization.plan !== 'enterprise') {
    organization.plan = 'enterprise';
    await organization.save();
  }

  return { user, organization };
};

module.exports = {
  createDemoAccount,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG,
};
