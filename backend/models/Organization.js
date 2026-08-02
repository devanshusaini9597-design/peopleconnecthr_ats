const mongoose = require('mongoose');

/**
 * Organization Model
 * Central tenant model for SaaS ATS.
 */
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true, trim: true },
  domain: { type: String, trim: true, lowercase: true },
  allowedDomains: [{ type: String }],
  logo: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: {
    type: String,
    enum: ['free_trial', 'starter', 'professional', 'enterprise'],
    default: 'free_trial'
  },
  planExpiresAt: { type: Date },
  usageLimits: {
    maxUsers: { type: Number, default: 5 },
    maxJobs: { type: Number, default: 10 },
    maxCandidates: { type: Number, default: 500 },
    maxEmailsPerMonth: { type: Number, default: 1000 }
  },
  usageCurrent: {
    users: { type: Number, default: 1 },
    jobs: { type: Number, default: 0 },
    candidates: { type: Number, default: 0 },
    emailsSent: { type: Number, default: 0 },
    emailsResetAt: { type: Date },
    jobBoardPostsExtra: { type: Number, default: 0 },
    assessmentsExtra: { type: Number, default: 0 }
  },
  settings: {
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' }
  },
  // Enterprise security / compliance controls (gated by planFeatures keys).
  securitySettings: {
    mfaEnforced: { type: Boolean, default: false },
    sessionIdleMinutes: { type: Number, default: 480 },
    maxConcurrentSessions: { type: Number, default: 10 },
    ipAllowlist: [{ type: String }],
    aiTone: { type: String, default: 'professional' }
  },
  complianceSettings: {
    retentionDaysByRegion: { type: Map, of: Number, default: undefined },
    defaultRetentionDays: { type: Number, default: 730 },
    legalHoldEnabled: { type: Boolean, default: false }
  },
  // shared = multi-tenant SaaS; dedicated = single-tenant/VPC SKU (ops provisions infra).
  deploymentTier: {
    type: String,
    enum: ['shared', 'dedicated'],
    default: 'shared'
  },
  atsSettings: {
    pipelineStages: {
      type: [String],
      default: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired']
    },
    defaultSources: {
      type: [String],
      default: ['LinkedIn', 'Indeed', 'Naukri', 'Referral', 'Direct']
    },
    enableCandidatePortal: { type: Boolean, default: true },
    enableCareersPage: { type: Boolean, default: true },
    careersPageTitle: { type: String, default: '' },
    careersPageDescription: { type: String, default: '' },
    // Custom domain for the careers page (Enterprise, 'careers.customDomain').
    // Code-side this is just "resolve org by domain instead of by slug" —
    // the customer must additionally CNAME this domain to the frontend's
    // hosting (Vercel/Render) and the frontend must handle the
    // hostname-based routing; that DNS/hosting step happens outside this repo.
    careersCustomDomain: { type: String, default: '', trim: true, lowercase: true },
    // Careers-page brand color — always free to set, matching the reference
    // product's "colors/logo stay free, kit extras gated" stance.
    brandColor: { type: String, default: '#4F46E5' },
    // White-Label Kit add-on (feature: 'whiteLabel', Enterprise). `enabled`
    // is only honored by public-facing routes when the org's plan is
    // actually entitled — see routes/careersRoutes.js — so a downgraded
    // org can't keep the toggle working by editing this document directly.
    whiteLabel: {
      enabled: { type: Boolean, default: false },
      hidePoweredBy: { type: Boolean, default: false },
      emailFromName: { type: String, default: '', trim: true }
    },
    // Career page builder blocks (careers.pageBuilder / careers.whiteLabelBuilder).
    pageBlocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Candidate portal localization (portal.localization).
    portalLocalization: {
      enabled: { type: Boolean, default: false },
      defaultLocale: { type: String, default: 'en' },
      supportedLocales: { type: [String], default: ['en'] }
    }
  },
  billingCustomerId: { type: String, default: '' },
  billingSubscriptionId: { type: String, default: '' },

  // ── Multi-product readiness (see docs/CRM_HRMS_READINESS.md) ─────────
  // This SaaS ships ATS-only today. `productPlans` lets a future CRM/HRMS
  // product share this same Organization/billing root without assuming
  // ATS is the only product forever — e.g. an org could be
  // { ats: 'professional', hrms: 'starter' } once HRMS ships, billed
  // and entitled independently per product via the same planFeatures.js
  // pattern (just namespaced by product).
  productPlans: {
    ats: { type: String, enum: ['free_trial', 'starter', 'professional', 'enterprise'], default: 'free_trial' }
    // crm / hrms keys added here once those products exist — intentionally
    // absent (not stubbed with a default) so "does this org have CRM?" is
    // answerable by `'crm' in org.productPlans`, not by a placeholder value.
  },

  isActive: { type: Boolean, default: true },
  deactivatedAt: { type: Date },
  deactivationReason: { type: String }
}, { timestamps: true });

// Indexes
organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ domain: 1 });
organizationSchema.index({ plan: 1 });
organizationSchema.index({ isActive: 1 });
organizationSchema.index({ 'atsSettings.careersCustomDomain': 1 }, { unique: true, sparse: true });

// Keep productPlans.ats mirrored to the legacy top-level `plan` field so the
// two can never drift — `plan` stays the source of truth every existing
// requireFeature()/checkPlanLimit() call already reads; productPlans is
// purely additive for future CRM/HRMS entitlement checks.
organizationSchema.pre('save', function (next) {
  if (this.isModified('plan') || (this.isNew && !this.productPlans?.ats)) {
    this.productPlans = this.productPlans || {};
    this.productPlans.ats = this.plan;
  }
  next();
});

// Pre-save hook: auto-generate slug from name if not set
organizationSchema.pre('save', async function (next) {
  if (!this.isModified('name') || this.slug) {
    return next();
  }
  
  let baseSlug = this.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  
  let uniqueSlug = baseSlug;
  let counter = 1;
  let exists = await this.constructor.findOne({ slug: uniqueSlug });
  
  while (exists) {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    uniqueSlug = `${baseSlug}-${randomSuffix}`;
    exists = await this.constructor.findOne({ slug: uniqueSlug });
    counter++;
    if (counter > 10) break; // Safeguard
  }
  
  this.slug = uniqueSlug;
  next();
});

// Method: isWithinPlanLimits
organizationSchema.methods.isWithinPlanLimits = function (resource) {
  const limitField = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}`;
  if (this.usageLimits[limitField] === undefined || this.usageCurrent[resource] === undefined) {
    return false;
  }
  return this.usageCurrent[resource] < this.usageLimits[limitField];
};

// Method: incrementUsage
organizationSchema.methods.incrementUsage = async function (resource) {
  const update = { $inc: {} };
  update.$inc[`usageCurrent.${resource}`] = 1;
  return this.constructor.findByIdAndUpdate(this._id, update, { new: true });
};

// Method: decrementUsage
organizationSchema.methods.decrementUsage = async function (resource) {
  const org = await this.constructor.findById(this._id);
  if (org && org.usageCurrent[resource] > 0) {
    const update = { $inc: {} };
    update.$inc[`usageCurrent.${resource}`] = -1;
    return this.constructor.findByIdAndUpdate(this._id, update, { new: true });
  }
  return org;
};

module.exports = mongoose.model('Organization', organizationSchema);
