const mongoose = require('mongoose');

/**
 * Scorecard Model
 * Evaluation criteria filled out by interviewers.
 */
const scorecardSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
  interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  /** Optional library template used for this evaluation */
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScorecardTemplate', default: null, index: true },
  criteria: [{
    name: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    weight: { type: Number, default: 1, min: 0.5, max: 5 },
    comment: { type: String, default: '' }
  }],
  overallRating: { type: Number, min: 1, max: 5, required: true },
  recommendation: {
    type: String,
    enum: ['strong_yes', 'yes', 'neutral', 'no', 'strong_no'],
    required: true
  },
  strengths: { type: String, default: '' },
  concerns: { type: String, default: '' },
  notes: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  isDraft: { type: Boolean, default: false }
}, { timestamps: true });

// Indexes
scorecardSchema.index({ interviewId: 1, interviewerId: 1 }, { unique: true });
scorecardSchema.index({ applicationId: 1 });
scorecardSchema.index({ organizationId: 1, submittedAt: -1 });

module.exports = mongoose.model('Scorecard', scorecardSchema);
