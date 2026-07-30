const mongoose = require('mongoose');

/**
 * Interview Model
 * Tracks interviews scheduled with candidates.
 */
const interviewSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  interviewers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    email: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
  }],
  scheduledAt: { type: Date, required: true },
  duration: { type: Number, default: 60 },
  type: {
    type: String,
    enum: ['phone_screen', 'video', 'in_person', 'panel', 'technical', 'hr'],
    default: 'video'
  },
  location: { type: String, default: '' },
  meetingLink: { type: String, default: '' },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'],
    default: 'scheduled'
  },
  calendarEventId: { type: String, default: '' },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancellationReason: { type: String },
  feedback: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Indexes
interviewSchema.index({ organizationId: 1, scheduledAt: 1 });
interviewSchema.index({ applicationId: 1 });
interviewSchema.index({ 'interviewers.userId': 1, scheduledAt: 1 });
interviewSchema.index({ status: 1 });

module.exports = mongoose.model('Interview', interviewSchema);
