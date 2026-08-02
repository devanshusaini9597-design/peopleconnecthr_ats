const mongoose = require('mongoose');
const crypto = require('crypto');

const surveyQuestionSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  type: { type: String, enum: ['rating', 'text', 'nps'], default: 'rating' },
  required: { type: Boolean, default: true }
}, { _id: true });

const surveyAnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId },
  prompt: { type: String },
  response: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const candidateSurveySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  triggerType: { type: String, enum: ['post_interview', 'post_rejection'], required: true },
  token: { type: String, unique: true, index: true },
  title: { type: String, default: 'Candidate Experience Survey' },
  questions: { type: [surveyQuestionSchema], default: [] },
  answers: { type: [surveyAnswerSchema], default: [] },
  status: { type: String, enum: ['pending', 'submitted', 'expired'], default: 'pending' },
  submittedAt: { type: Date },
  expiresAt: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

candidateSurveySchema.pre('save', function generateToken(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(24).toString('hex');
  }
  next();
});

candidateSurveySchema.index({ organizationId: 1, triggerType: 1, status: 1 });

module.exports = mongoose.model('CandidateSurvey', candidateSurveySchema);
