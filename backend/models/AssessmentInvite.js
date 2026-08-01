/**
 * AssessmentInvite Model — one candidate's attempt at one Assessment.
 * Candidate access is token-based (magic link, no account/password),
 * matching the pattern already used for the candidate portal.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  response: { type: String, default: '' }, // selected option index (as string) for MCQ, free text otherwise
  autoScore: { type: Number }, // set for multiple_choice on submit
  manualScore: { type: Number } // set by recruiter for text/code
}, { _id: false });

const assessmentInviteSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  token: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'in_progress', 'submitted', 'graded', 'expired'], default: 'pending' },
  answers: [answerSchema],
  totalScore: { type: Number },
  maxScore: { type: Number },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gradedAt: { type: Date },
  feedback: { type: String, default: '' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  submittedAt: { type: Date },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

assessmentInviteSchema.index({ organizationId: 1, assessmentId: 1, createdAt: -1 });

assessmentInviteSchema.statics.generateToken = function () {
  return crypto.randomBytes(24).toString('hex');
};

module.exports = mongoose.model('AssessmentInvite', assessmentInviteSchema);
