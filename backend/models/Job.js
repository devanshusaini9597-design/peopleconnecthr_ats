/**
 * Job Model — SkillNix SaaS ATS
 * 
 * Represents a job requisition/opening within an organization.
 * Jobs are linked to Candidates through the Application model.
 * 
 * MULTI-TENANCY: Every job belongs to an Organization via `organizationId`.
 * 
 * PIPELINE: Each job can have its own pipeline stages (defaults from org settings).
 * Applications track which stage a candidate is at for THIS specific job.
 * 
 * CAREERS PAGE: Jobs with `isPublished: true` appear on the org's public careers page.
 */

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // ── Multi-tenancy ──────────────────────────────────────────────────
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    index: true,
    // Not required yet — migration will backfill existing records
  },

  // ── Core job details ───────────────────────────────────────────────
  title: { type: String, required: true, trim: true },   // Renamed from 'role'
  role: { type: String, trim: true },                      // Kept for backward compat
  department: { type: String, default: '', trim: true },
  location: { type: String, required: true, trim: true },
  employmentType: { 
    type: String, 
    enum: ['full_time', 'part_time', 'contract', 'internship', 'freelance'],
    default: 'full_time'
  },

  // ── Compensation ───────────────────────────────────────────────────
  ctc: { type: String, default: '' },                      // Legacy field
  salaryRange: {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, default: 'INR' },
    displayPublicly: { type: Boolean, default: false }
  },

  // ── Requirements ───────────────────────────────────────────────────
  experience: { type: String, default: '' },               // e.g. "3-5 years"
  experienceRange: {
    min: { type: Number },                                  // in years
    max: { type: Number }
  },
  skills: [{ type: String, trim: true }],
  qualifications: [{ type: String, trim: true }],
  description: { type: String, default: '' },              // Full JD (HTML/markdown)
  responsibilities: [{ type: String, trim: true }],

  // ── Pipeline configuration ─────────────────────────────────────────
  pipelineStages: { 
    type: [String], 
    default: []  // Empty = use org defaults from Organization.atsSettings.pipelineStages
  },

  // ── Assignment ─────────────────────────────────────────────────────
  hiringManagers: [{ type: String, trim: true }],          // Legacy: array of emails
  assignedRecruiters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  hiringManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Status ─────────────────────────────────────────────────────────
  status: { 
    type: String, 
    enum: ['Draft', 'Open', 'On Hold', 'Closed', 'Cancelled'], 
    default: 'Open' 
  },
  closedAt: { type: Date },
  closedReason: { type: String, default: '' },

  // ── Publishing (Careers page) ──────────────────────────────────────
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },

  // ── External job board postings (Enterprise, see backend/adapters/jobBoardAdapter.js) ──
  jobBoardPostings: [{
    provider: { type: String },
    status: { type: String, enum: ['posted', 'removed', 'failed'], default: 'posted' },
    externalRef: { type: String, default: '' },
    postedAt: { type: Date, default: Date.now },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // ── Counters (denormalized for performance) ────────────────────────
  applicationCount: { type: Number, default: 0 },
  hiredCount: { type: Number, default: 0 },

  // ── Template system ────────────────────────────────────────────────
  isTemplate: { type: Boolean, default: false },

  // ── Metadata ───────────────────────────────────────────────────────
  openings: { type: Number, default: 1 },                  // Number of positions to fill
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  tags: [{ type: String, trim: true }],
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

  // ── Ownership ──────────────────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Legacy compat ──────────────────────────────────────────────────
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ── Pre-save: Sync title↔role for backward compat ────────────────────
jobSchema.pre('save', function(next) {
  // If title is set but role is not, sync role = title (backward compat)
  if (this.title && !this.role) {
    this.role = this.title;
  }
  // If role is set but title is not (legacy data), sync title = role
  if (this.role && !this.title) {
    this.title = this.role;
  }
  next();
});

// ── Indexes ──────────────────────────────────────────────────────────
jobSchema.index({ organizationId: 1, status: 1 });
jobSchema.index({ organizationId: 1, createdAt: -1 });
jobSchema.index({ organizationId: 1, isPublished: 1, status: 1 }); // Careers page query
jobSchema.index({ organizationId: 1, department: 1 });
jobSchema.index({ 'assignedRecruiters': 1 });
jobSchema.index({ title: 'text', description: 'text' });

// ── Instance methods ─────────────────────────────────────────────────

/**
 * Get the effective pipeline stages for this job.
 * Falls back to organization defaults if job-level stages not set.
 */
jobSchema.methods.getEffectivePipelineStages = async function() {
  if (this.pipelineStages && this.pipelineStages.length > 0) {
    return this.pipelineStages;
  }
  // Fall back to org defaults
  const Organization = mongoose.model('Organization');
  const org = await Organization.findById(this.organizationId).select('atsSettings.pipelineStages').lean();
  return org?.atsSettings?.pipelineStages || ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
};

/**
 * Publish this job to the careers page.
 */
jobSchema.methods.publish = function() {
  this.isPublished = true;
  this.publishedAt = new Date();
  if (this.status === 'Draft') {
    this.status = 'Open';
  }
  return this.save();
};

/**
 * Close this job with a reason.
 */
jobSchema.methods.close = function(reason = 'Position filled') {
  this.status = 'Closed';
  this.isPublished = false;
  this.closedAt = new Date();
  this.closedReason = reason;
  return this.save();
};

module.exports = mongoose.model('Job', jobSchema);