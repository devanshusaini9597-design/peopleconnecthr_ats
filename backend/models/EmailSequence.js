/**
 * Multi-step outreach sequences (email / SMS / WhatsApp) with delays.
 */

const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  stepNumber: { type: Number, required: true },
  channel: { type: String, enum: ['email', 'sms', 'whatsapp'], default: 'email' },
  delayDays: { type: Number, default: 0, min: 0 },
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate', default: null }
}, { _id: true });

const emailSequenceSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  triggerType: {
    type: String,
    enum: ['manual', 'application_received', 'stage_change', 'talent_pool_add'],
    default: 'manual'
  },
  triggerStage: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  steps: [stepSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

emailSequenceSchema.index({ organizationId: 1, isActive: 1 });

module.exports = mongoose.model('EmailSequence', emailSequenceSchema);
