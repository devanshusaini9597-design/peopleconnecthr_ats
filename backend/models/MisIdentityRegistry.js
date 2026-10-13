/**
 * Durable MIS identity index — survives row removal so the same person
 * cannot be added again under a variant email or number.
 */
const mongoose = require('mongoose');

const MisIdentityRegistrySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  emailKey: { type: String, default: '', index: true },
  phoneKey: { type: String, default: '', index: true },
  nameKey: { type: String, default: '' },
  companyKey: { type: String, default: '' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'MisContact', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['active', 'removed'], default: 'active', index: true },
  firstSeenAt: { type: Date, default: Date.now, index: true },
  lastSeenAt: { type: Date, default: Date.now },
  removedAt: { type: Date, default: null },
}, { timestamps: true });

MisIdentityRegistrySchema.index({ organizationId: 1, emailKey: 1 });
MisIdentityRegistrySchema.index({ organizationId: 1, phoneKey: 1 });
MisIdentityRegistrySchema.index({ organizationId: 1, status: 1, firstSeenAt: 1 });

module.exports = mongoose.model('MisIdentityRegistry', MisIdentityRegistrySchema);
