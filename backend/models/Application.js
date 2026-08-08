const mongoose = require('mongoose');

/**
 * Application Model
 * Represents a candidate's application pipeline for a specific job.
 */
const applicationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  stage: { type: String, required: true },
  stageHistory: [{
    stage: { type: String },
    movedAt: { type: Date, default: Date.now },
    movedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remark: { type: String }
  }],
  source: { type: String, default: 'Direct' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  isRejected: { type: Boolean, default: false },
  rejectionReason: { type: String, default: '' },
  rejectedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isHired: { type: Boolean, default: false },
  hiredAt: { type: Date },
  appliedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // ── Enterprise integrations (BYOK, see backend/adapters/) ────────────
  backgroundCheck: {
    provider: { type: String, default: '' },
    candidateId: { type: String, default: '' },
    invitationId: { type: String, default: '' },
    status: { type: String, enum: ['not_started', 'pending', 'complete', 'suspended', ''], default: '' },
    result: { type: String, default: '' },
    orderedAt: { type: Date },
    orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  esign: {
    provider: { type: String, default: '' },
    envelopeId: { type: String, default: '' },
    status: { type: String, enum: ['not_sent', 'sent', 'completed', 'declined', 'voided', ''], default: '' },
    sentAt: { type: Date },
    completedAt: { type: Date },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

// Indexes
applicationSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 }, { unique: true });
applicationSchema.index({ organizationId: 1, stage: 1 });
applicationSchema.index({ organizationId: 1, assignedTo: 1, stage: 1 });
applicationSchema.index({ organizationId: 1, isRejected: 1 });
applicationSchema.index({ appliedAt: -1 });

applicationSchema.plugin(require('../utils/tenantPlugin'));

module.exports = mongoose.model('Application', applicationSchema);
