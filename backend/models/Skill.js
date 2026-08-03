/**
 * Skill — org + system taxonomy for structured skill matching.
 * System skills (isSystem) are shared; org skills are tenant-scoped.
 */

const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true
  },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  category: { type: String, default: 'Other', trim: true },
  isSystem: { type: Boolean, default: false },
  onetCode: { type: String, default: '', trim: true }
}, { timestamps: true });

skillSchema.index({ slug: 1, organizationId: 1 }, { unique: true });
skillSchema.index({ category: 1, name: 1 });
skillSchema.index({ isSystem: 1, name: 1 });

module.exports = mongoose.model('Skill', skillSchema);
