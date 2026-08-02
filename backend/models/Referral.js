const mongoose = require('mongoose');
const crypto = require('crypto');

const referralSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  code: { type: String, required: true, index: true },
  referrerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referrerName: { type: String, default: '' },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  candidateEmail: { type: String, default: '' },
  candidateName: { type: String, default: '' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  rewardStatus: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'ineligible'],
    default: 'pending'
  },
  rewardAmount: { type: Number },
  rewardCurrency: { type: String, default: 'INR' },
  notes: { type: String, default: '' },
  hiredAt: { type: Date }
}, { timestamps: true });

referralSchema.index({ organizationId: 1, code: 1 });
referralSchema.index({ organizationId: 1, rewardStatus: 1 });

referralSchema.statics.generateCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

module.exports = mongoose.model('Referral', referralSchema);
