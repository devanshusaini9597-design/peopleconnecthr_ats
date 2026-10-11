/**
 * AssessmentInvite — assignment + attempt for one candidate.
 * Access is token-based. Attempt deadline, answers and scoring live here so
 * the published assessment can change without rewriting an in-progress test.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  response: { type: String, default: '' },
  autoScore: { type: Number },
  manualScore: { type: Number },
  evaluatorComment: { type: String, default: '' },
}, { _id: false });

const assessmentInviteSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  token: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'in_progress', 'submitted', 'graded', 'expired', 'revoked'], default: 'pending' },
  attemptNumber: { type: Number, default: 1, min: 1 },
  answers: [answerSchema],
  totalScore: { type: Number },
  maxScore: { type: Number },
  percent: { type: Number },
  skillBreakdown: { type: mongoose.Schema.Types.Mixed, default: [] },
  aiSuggestion: { type: mongoose.Schema.Types.Mixed, default: null },
  scoringStatus: { type: String, enum: ['pending', 'pending_review', 'scored'], default: 'pending' },
  passFail: { type: String, enum: ['pending', 'pass', 'fail'], default: 'pending' },
  decision: { type: String, enum: ['none', 'shortlist', 'reject', 'advance'], default: 'none' },
  decisionReason: { type: String, default: '' },
  decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decisionAt: { type: Date },
  overrideReason: { type: String, default: '' },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gradedAt: { type: Date },
  feedback: { type: String, default: '' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date, default: Date.now },
  openedAt: { type: Date },
  startedAt: { type: Date },
  deadlineAt: { type: Date },
  lastSavedAt: { type: Date },
  submittedAt: { type: Date },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  publishedVersion: { type: Number, default: 1 },
  consent: {
    termsAcceptedAt: { type: Date },
    identityConfirmedAt: { type: Date },
    cameraAcknowledgedAt: { type: Date },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  proctoring: {
    events: [{
      type: { type: String },
      at: { type: Date, default: Date.now },
      questionId: { type: String, default: '' },
      meta: { type: mongoose.Schema.Types.Mixed }
    }],
    tabSwitchCount: { type: Number, default: 0 },
    copyPasteCount: { type: Number, default: 0 },
    blurCount: { type: Number, default: 0 },
    fullscreenExits: { type: Number, default: 0 },
    snapshotCount: { type: Number, default: 0 },
    cameraDenied: { type: Boolean, default: false },
    riskScore: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false }
  }
}, { timestamps: true });

assessmentInviteSchema.index({ organizationId: 1, assessmentId: 1, createdAt: -1 });
assessmentInviteSchema.index({ organizationId: 1, jobId: 1, status: 1 });
assessmentInviteSchema.index({ organizationId: 1, candidateId: 1, assessmentId: 1, attemptNumber: 1 });

assessmentInviteSchema.statics.generateToken = function () {
  return crypto.randomBytes(24).toString('hex');
};

module.exports = mongoose.model('AssessmentInvite', assessmentInviteSchema);
