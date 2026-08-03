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

  // ── Pipeline (DEPRECATED — use Application model for per-job tracking) ──
  status: { 
    type: String, 
    default: 'Applied',
    enum: [
      'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 
      'Joined', 'Dropped', 'Rejected', 'Interested', 'Interested and scheduled'
    ] 
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

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ── Indexes ──────────────────────────────────────────────────────────

// Primary tenant-scoped queries
CandidateSchema.index({ organizationId: 1, createdAt: -1 });
CandidateSchema.index({ organizationId: 1, position: 1 });
CandidateSchema.index({ organizationId: 1, email: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
CandidateSchema.index({ organizationId: 1, status: 1 });
CandidateSchema.index({ organizationId: 1, source: 1 });

// Legacy user-scoped queries (backward compat during migration)
CandidateSchema.index({ createdBy: 1, createdAt: -1 });
CandidateSchema.index({ createdBy: 1, email: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: false } } });

// Full-text search
CandidateSchema.index({ name: 'text', email: 'text', position: 'text', skills: 'text' });

// Sharing queries
CandidateSchema.index({ 'sharedWith.userId': 1 });

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

// ── Pre-save hook: Normalize text fields ─────────────────────────────
CandidateSchema.pre('save', function(next) {
  // Name: Title Case
  if (this.name && typeof this.name === 'string' && this.name.trim()) {
    this.name = this.name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Other text fields: Trim + collapse spaces
  const textFields = ['position', 'location', 'companyName', 'client', 'spoc', 'source', 'fls', 'noticePeriod', 'feedback', 'remark'];
  textFields.forEach(field => {
    if (this[field] && typeof this[field] === 'string' && this[field].trim()) {
      this[field] = this[field].trim().replace(/\s+/g, ' ');
    }
  });

  // Email: ensure trimmed (lowercase handled by schema)
  if (this.email && typeof this.email === 'string') {
    this.email = this.email.trim();
  }

  next();
});

// ── Pre-findOneAndUpdate hook ────────────────────────────────────────
CandidateSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (!update) return next();

  // Normalize name if being updated
  if (update.$set?.name && typeof update.$set.name === 'string' && update.$set.name.trim()) {
    update.$set.name = update.$set.name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Normalize other text fields
  const textFields = ['position', 'location', 'companyName', 'client', 'spoc', 'source', 'fls', 'noticePeriod', 'feedback', 'remark'];
  textFields.forEach(field => {
    if (update.$set?.[field] && typeof update.$set[field] === 'string' && update.$set[field].trim()) {
      update.$set[field] = update.$set[field].trim().replace(/\s+/g, ' ');
    }
  });

  // Ensure email has no extra spaces
  if (update.$set?.email && typeof update.$set.email === 'string') {
    update.$set.email = update.$set.email.trim();
  }

  next();
});

module.exports = mongoose.model('Candidate', CandidateSchema);