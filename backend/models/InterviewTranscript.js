const mongoose = require('mongoose');

const interviewTranscriptSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  source: { type: String, enum: ['upload', 'manual', 'meeting_bot'], default: 'manual' },
  rawText: { type: String, default: '' },
  aiSummary: { type: String, default: '' },
  suggestedScorecard: { type: mongoose.Schema.Types.Mixed },
  meetingBotId: { type: String, default: '' },
  consentCaptured: { type: Boolean, default: false },
  retentionDeleteAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

interviewTranscriptSchema.index({ organizationId: 1, interviewId: 1 }, { unique: true });

module.exports = mongoose.model('InterviewTranscript', interviewTranscriptSchema);
