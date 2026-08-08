const mongoose = require('mongoose');

/**
 * Shared org picklist rows — CTC bands, notice periods, etc.
 * listKey: 'ctc' | 'notice'
 */
const orgListItemSchema = new mongoose.Schema({
  listKey: { type: String, required: true, index: true, enum: ['ctc', 'notice'] },
  name: { type: String, required: true },
  description: { type: String },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

orgListItemSchema.index({ organizationId: 1, listKey: 1, name: 1 });
orgListItemSchema.index({ createdBy: 1, listKey: 1, name: 1 });

module.exports = mongoose.model('OrgListItem', orgListItemSchema);
