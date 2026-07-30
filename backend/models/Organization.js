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
    emailsResetAt: { type: Date }
  },
  settings: {
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' }
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
    careersPageDescription: { type: String, default: '' }
  },
  billingCustomerId: { type: String, default: '' },
  billingSubscriptionId: { type: String, default: '' },
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
