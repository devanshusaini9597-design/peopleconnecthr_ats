const mongoose = require('mongoose');

/**
 * Org-scoped email templates (enterprise).
 * Each organization gets its own starter pack + custom templates.
 */
const emailTemplateSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['hiring', 'interview', 'offer', 'rejection', 'onboarding', 'document', 'assessment', 'marketing', 'custom'],
    default: 'custom',
  },
  subject: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  /** Starter-pack template for this org (editable, not deletable). */
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  variables: [{ type: String }],
}, { timestamps: true });

emailTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });
emailTemplateSchema.index({ organizationId: 1, category: 1 });
emailTemplateSchema.index({ createdBy: 1 });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
