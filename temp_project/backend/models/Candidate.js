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

const CandidateSchema = new mongoose.Schema({
  // ── Multi-tenancy ──────────────────────────────────────────────────
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    index: true,
    // Not required yet — migration will backfill existing records
  },

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

  // ── Tags & custom data ─────────────────────────────────────────────
  tags: [{ type: String, trim: true }],
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

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