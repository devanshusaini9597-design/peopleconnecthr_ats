const mongoose = require('mongoose');

const sequenceEnrollmentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  sequenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailSequence',
    required: true,
    index: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active'
  },
  currentStep: { type: Number, default: 0 },
  nextSendAt: { type: Date, default: Date.now },
  enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
  lastError: { type: String, default: '' }
}, { timestamps: true });

sequenceEnrollmentSchema.index({ sequenceId: 1, candidateId: 1 }, { unique: true });
sequenceEnrollmentSchema.index({ status: 1, nextSendAt: 1 });

module.exports = mongoose.model('SequenceEnrollment', sequenceEnrollmentSchema);
