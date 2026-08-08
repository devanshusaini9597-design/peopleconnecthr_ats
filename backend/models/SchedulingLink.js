const mongoose = require('mongoose');
const crypto = require('crypto');

const schedulingLinkSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  token: { type: String, unique: true, index: true },
  interviewerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  candidateEmail: { type: String, default: '' },
  durationMinutes: { type: Number, default: 30 },
  timezone: { type: String, default: 'UTC' },
  availableDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  startHour: { type: Number, default: 9 },
  endHour: { type: Number, default: 17 },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  bookedAt: { type: Date },
  bookedSlot: { type: Date },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

schedulingLinkSchema.pre('save', function generateToken(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(24).toString('hex');
  }
  next();
});

module.exports = mongoose.model('SchedulingLink', schedulingLinkSchema);
