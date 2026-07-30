const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['hiring', 'interview', 'rejection', 'onboarding', 'document', 'marketing', 'custom'], default: 'custom' },
  subject: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  variables: [{ type: String }], // e.g. ['candidateName', 'position', 'company', 'ctc', 'location', 'date', 'time', 'venue', 'spoc']
}, { timestamps: true });

emailTemplateSchema.index({ createdBy: 1 });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
