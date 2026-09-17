/**
 * MIS / Marketing contacts — separate from ATS Candidates.
 * Never merge into Candidate / Application / TalentPool.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const MisContactSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  contact: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  position: { type: String, default: '', trim: true },
  location: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  companyName: { type: String, default: '', trim: true },
  experience: { type: String, default: '', trim: true },
  ctc: { type: String, default: '', trim: true },
  expectedCtc: { type: String, default: '', trim: true },
  noticePeriod: { type: String, default: '', trim: true },
  skills: { type: String, default: '', trim: true },
  product: { type: String, default: '', trim: true },
  client: { type: String, default: '', trim: true },
  fls: { type: String, default: '' },
  source: { type: String, default: 'MIS Upload', trim: true },
  remark: { type: String, default: '' },

  marketingConsent: { type: Boolean, default: true },
  unsubscribedAt: { type: Date, default: null },
  /** Random secret for public unsubscribe links (store raw; treat as capability URL). */
  unsubscribeSecret: { type: String, default: '', index: true },

  uploadBatchId: { type: String, default: '', index: true },
}, { timestamps: true });

MisContactSchema.index({ organizationId: 1, email: 1 }, { unique: true });
MisContactSchema.index({ organizationId: 1, createdBy: 1, createdAt: -1 });

MisContactSchema.methods.ensureUnsubscribeSecret = function ensureUnsubscribeSecret() {
  if (!this.unsubscribeSecret) {
    this.unsubscribeSecret = crypto.randomBytes(24).toString('hex');
  }
  return this.unsubscribeSecret;
};

MisContactSchema.statics.unsubscribeTokenFor = function unsubscribeTokenFor(contactId, secret) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`mis-unsub:${String(contactId)}:${String(secret || '')}`)
    .digest('hex')
    .slice(0, 40);
};

module.exports = mongoose.model('MisContact', MisContactSchema);
