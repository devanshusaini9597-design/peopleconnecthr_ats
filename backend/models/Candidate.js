/**
 * Candidate Model — SkillNix SaaS ATS
 * 
 * Represents a person in the talent pool. A Candidate can have multiple
 * Applications (one per job they apply to). The Application model tracks
 * pipeline stage, not this model — the `status` field here is kept for
 * backward compatibility but will be deprecated in favor of Application.stage.
 * 
 * MULTI-TENANCY: Every candidate belongs to an Organization via `organizationId`.
 * The `createdBy` field tracks which user added them.
 * 
 * UNIQUENESS: Email is unique per organization (not globally).
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { normalizeText, applyBlockLettersToObject, BLOCK_LETTER_FIELDS } = require('../utils/textNormalize');
const { resolveAppliedAt } = require('../utils/candidateActivityDate');

const CandidateSchema = new mongoose.Schema({
  // ── Multi-tenancy ──────────────────────────────────────────────────
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    index: true,
    // Not required yet — migration will backfill existing records
  },

  // Stable cross-product identity key (see docs/CRM_HRMS_READINESS.md).
  // Candidate (ATS) -> Contact (CRM) -> Employee (HRMS) are the same human
  // at different lifecycle stages; this key lets a future merge match them
  // by identity instead of fuzzy name/email matching across products.
  // Deterministic hash of organizationId+email so re-imports of the same
  // person land on the same personId without needing a lookup table.
  personId: { type: String, index: true },

  // ── Core fields ────────────────────────────────────────────────────
  srNo: { type: String },
  date: { type: String },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  contact: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true }, // Alias / additional phone

  // ── Professional details ───────────────────────────────────────────
  position: { type: String, default: '', trim: true },
  location: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  companyName: { type: String, default: '', trim: true },
  experience: { type: String, default: '', trim: true },
  ctc: { type: String, default: '', trim: true },
  expectedCtc: { type: String, default: '', trim: true },
  noticePeriod: { type: String, default: '', trim: true },
  skills: { type: String, default: '', trim: true },
  /** Product / skill line (e.g. Home Loan, Credit Cards) — distinct from free-text resume skills */
  product: { type: String, default: '', trim: true },
  /** Indian PAN — required when the selected Client has requiresPan enabled */
  pan: { type: String, default: '', trim: true, uppercase: true },

  // ── Pipeline (DEPRECATED — use Application model for per-job tracking) ──
  status: {
    type: String,
    default: 'APPLIED',
    // Org pipeline stages are free-text (Organization.atsSettings.pipelineStages).
    // Keep uppercase storage; do not clamp to a fixed enum.
    set: (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').toUpperCase() : v),
  },
  statusHistory: [{
    status: { type: String },
    remark: { type: String, default: 'Status Updated' },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: 'Recruiter' }
  }],
  hiredDate: { type: Date },

  // ── Metadata ───────────────────────────────────────────────────────
  fls: { type: String, default: '' },
  client: { type: String, default: '', trim: true },
  spoc: { type: String, default: '', trim: true },
  source: { type: String, default: '', trim: true },
  feedback: { type: String, default: '' },
  remark: { type: String, default: '' },
  callBackDate: { type: String, default: '' },

  // ── Resume ─────────────────────────────────────────────────────────
  resume: { type: String, default: '' },          // File path or S3 URL
  resumeText: { type: String, default: '' },      // Extracted text for search
  resumeParsedAt: { type: Date },

  // ── AI semantic search (ai.semanticSearch) ───────────────────────
  embedding: { type: [Number], default: undefined },
  embeddingUpdatedAt: { type: Date },

  // ── Tags & custom data ─────────────────────────────────────────────
  tags: [{ type: String, trim: true }],
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

  // ── Talent Pools add-on (candidates.talentPools) ───────────────────
  // Many-to-many: a candidate can sit in several pools (e.g. "Frontend
  // Bench", "Referrals 2026") independent of any specific job requisition.
  talentPoolIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TalentPool', index: true }],

  // ── DEI analytics add-on (analytics.dei) — optional, self-reported ──
  // Never required at intake; candidates choose to disclose via the
  // careers application form or the candidate portal. Used only in
  // aggregate funnel analytics, never shown next to an individual name
  // in recruiter-facing candidate lists.
  demographics: {
    genderIdentity: { type: String, default: '' },
    ethnicity: { type: String, default: '' },
    veteranStatus: { type: String, default: '' },
    disabilityStatus: { type: String, default: '' },
    declinedToSelfIdentify: { type: Boolean, default: false }
  },

  // ── Messaging consent (TCPA / WhatsApp / email opt-in) ──────────────
  messagingConsent: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    updatedAt: { type: Date }
  },
  phoneVerifiedAt: { type: Date },
  // Talent pool outreach consent
  talentPoolConsent: {
    optedIn: { type: Boolean, default: true },
    updatedAt: { type: Date }
  },

  // ── Marketing list consent (Zoho Campaigns / enterprise mailing list) ──
  // Separate from transactional messagingConsent.email — marketing requires
  // explicit opt-in and syncs to ZOHO list (org IntegrationConfig or platform env).
  marketingConsent: {
    optedIn: { type: Boolean, default: false },
    source: {
      type: String,
      default: '',
      enum: ['', 'subscribe', 'subscribe_confirm', 'marketing_send', 'talent_pool', 'import', 'manual', 'api', 'unsubscribe'],
    },
    listKey: { type: String, default: '' },
    topicId: { type: String, default: '' },
    /** true only when Zoho accepted listsubscribe — used so soft-ok does not hide Subscribe CTA */
    zohoEnrolled: { type: Boolean, default: undefined },
    // Per-purpose enrollment flags (enterprise multi-list)
    lists: {
      subscribe: { type: Boolean, default: false },
      job_alerts: { type: Boolean, default: false },
      nurture: { type: Boolean, default: false },
      general: { type: Boolean, default: false },
    },
    optedInAt: { type: Date },
    optedOutAt: { type: Date },
    updatedAt: { type: Date },
  },

  // ── GDPR self-service (always available, no plan gate) ─────────────
  gdprErasedAt: { type: Date },
  legalHold: { type: Boolean, default: false },

  // ── Ownership & sharing ────────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  sharedWith: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sharedAt: { type: Date, default: Date.now },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  /**
   * Freelancer desk soft-hide: candidate stays in the company/org DB but is
   * removed from the freelancer's own ATS list. Company users still see it.
   */
  hiddenFromFreelancerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  freelancerHiddenAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  /** Real application/add date (from Excel `date` column) — used for analytics, not import time */
  appliedAt: { type: Date, index: true },
}, { timestamps: true });

// ── Indexes ──────────────────────────────────────────────────────────

// Primary tenant-scoped queries
CandidateSchema.index({ organizationId: 1, appliedAt: -1 });
CandidateSchema.index({ organizationId: 1, createdAt: -1 });
CandidateSchema.index({ organizationId: 1, position: 1 });
CandidateSchema.index({ organizationId: 1, email: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
CandidateSchema.index({ organizationId: 1, status: 1 });
CandidateSchema.index({ organizationId: 1, source: 1 });
CandidateSchema.index({ organizationId: 1, spoc: 1, createdAt: -1 });
CandidateSchema.index({ organizationId: 1, createdBy: 1, createdAt: -1 });

// Legacy user-scoped queries (backward compat during migration)
CandidateSchema.index({ createdBy: 1, createdAt: -1 });
CandidateSchema.index({ createdBy: 1, email: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: false } } });

// Full-text search
CandidateSchema.index({ name: 'text', email: 'text', position: 'text', skills: 'text' });

// Sharing queries
CandidateSchema.index({ 'sharedWith.userId': 1 });

// ── Pre-save hook: appliedAt from Excel / manual date column ────────
CandidateSchema.pre('save', function appliedAtHook(next) {
  if (!this.appliedAt || this.isModified('date')) {
    const resolved = resolveAppliedAt(this);
    if (resolved) this.appliedAt = resolved;
  }
  next();
});

// ── Pre-save hook: Derive personId ────────────────────────────────────
CandidateSchema.pre('save', function(next) {
  if (!this.personId && this.email && this.organizationId) {
    this.personId = crypto
      .createHash('sha256')
      .update(`${this.organizationId.toString()}:${this.email.toLowerCase().trim()}`)
      .digest('hex')
      .slice(0, 32);
  }
  next();
});

// ── Pre-save hook: Normalize text fields (BLOCK LETTERS; email stays lowercase)
CandidateSchema.pre('save', function(next) {
  applyBlockLettersToObject(this);

  // Email: ensure trimmed (lowercase handled by schema)
  if (this.email && typeof this.email === 'string') {
    this.email = this.email.trim().toLowerCase();
  }

  next();
});

// ── Pre-findOneAndUpdate hook ────────────────────────────────────────
CandidateSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (!update) return next();

  if (update.$set && typeof update.$set === 'object') {
    applyBlockLettersToObject(update.$set);
  } else {
    // Direct update object (no $set)
    applyBlockLettersToObject(update);
  }

  for (const field of BLOCK_LETTER_FIELDS) {
    if (update[field] && typeof update[field] === 'string') {
      update[field] = normalizeText(update[field]);
    }
  }

  if (update.$set?.email && typeof update.$set.email === 'string') {
    update.$set.email = update.$set.email.trim().toLowerCase();
  }
  if (update.email && typeof update.email === 'string') {
    update.email = update.email.trim().toLowerCase();
  }

  next();
});

CandidateSchema.plugin(require('../utils/tenantPlugin'));

module.exports = mongoose.model('Candidate', CandidateSchema);