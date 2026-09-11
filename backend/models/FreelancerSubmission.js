const mongoose = require('mongoose');

const historyEntrySchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName: { type: String, default: '', trim: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const freelancerSubmissionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  spocUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
  note: { type: String, default: '', trim: true, maxlength: 2000 },
  feedback: { type: String, default: '', trim: true, maxlength: 4000 },
  feedbackRequestedAt: { type: Date },
  /** Stage-wise hiring notes (one entry per ATS stage label). `feedback` mirrors latest. */
  stageNotes: [{
    stage: { type: String, trim: true, maxlength: 80 },
    note: { type: String, default: '', trim: true, maxlength: 4000 },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String, default: '', trim: true },
  }],
  status: {
    type: String,
    enum: ['submitted', 'reviewing', 'shortlisted', 'selection', 'joined', 'rejected'],
    default: 'submitted',
    index: true,
  },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  /** Soft-close handoff — hidden from active desks; restore to reopen. */
  archivedAt: { type: Date, default: null, index: true },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  /**
   * Freelancer dismissed this handoff from their desk/pipeline only.
   * Company Freelance Review keeps the record until they archive/hard-delete.
   */
  freelancerDismissedAt: { type: Date, default: null, index: true },
  /** Structured stage scorecard (desk review) — latest snapshot. */
  scorecard: {
    recommendation: {
      type: String,
      enum: ['', 'strong_hire', 'hire', 'hold', 'no_hire'],
      default: '',
    },
    scores: [{
      criterion: { type: String, trim: true, maxlength: 80 },
      score: { type: Number, min: 1, max: 5 },
    }],
    summary: { type: String, default: '', trim: true, maxlength: 2000 },
    stage: { type: String, default: '', trim: true },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String, default: '', trim: true },
  },
  /** Stage-wise scorecards (one entry per ATS stage label). */
  stageScorecards: [{
    stage: { type: String, trim: true, maxlength: 80 },
    recommendation: {
      type: String,
      enum: ['', 'strong_hire', 'hire', 'hold', 'no_hire'],
      default: '',
    },
    scores: [{
      criterion: { type: String, trim: true, maxlength: 80 },
      score: { type: Number, min: 1, max: 5 },
    }],
    summary: { type: String, default: '', trim: true, maxlength: 2000 },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String, default: '', trim: true },
  }],
  /** Offer / hire moves need owner (or desk-ops) approval when requested by recruiters. */
  approval: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    targetStage: { type: String, default: '', trim: true },
    targetAtsStage: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true, maxlength: 1000 },
    requestedAt: { type: Date },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedByName: { type: String, default: '', trim: true },
    decidedAt: { type: Date },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedByName: { type: String, default: '', trim: true },
  },
  /** Set when SPOC/owner were notified of an SLA breach (once). */
  slaEscalatedAt: { type: Date, default: null },
  candidateSnapshot: {
    name: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    contact: { type: String, default: '', trim: true },
    position: { type: String, default: '', trim: true },
  },
  /** Embedded audit trail for desk actions (also mirrored to AuditLog). */
  history: { type: [historyEntrySchema], default: [] },
  qualityFlags: {
    hasResume: { type: Boolean, default: false },
    hasNote: { type: Boolean, default: false },
    hasNotice: { type: Boolean, default: false },
    hasExpectedCtc: { type: Boolean, default: false },
    missing: { type: [String], default: [] },
  },
}, { timestamps: true });

freelancerSubmissionSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 }, { unique: true });
freelancerSubmissionSchema.index({ organizationId: 1, freelancerId: 1, createdAt: -1 });
freelancerSubmissionSchema.index({ organizationId: 1, spocUserId: 1, status: 1 });
freelancerSubmissionSchema.index({ organizationId: 1, archivedAt: 1, createdAt: -1 });

module.exports = mongoose.model('FreelancerSubmission', freelancerSubmissionSchema);
