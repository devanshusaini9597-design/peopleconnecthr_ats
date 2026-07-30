const mongoose = require('mongoose');

/**
 * IntegrationConfig Model
 * Stores API keys, email credentials, etc. for a tenant organization.
 */
const integrationConfigSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  provider: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: ['email', 'calendar', 'sms', 'ai', 'job_board', 'background_check']
  },
  displayName: { type: String },
  credentials: { type: mongoose.Schema.Types.Mixed },
  isActive: { type: Boolean, default: false },
  isValidated: { type: Boolean, default: false },
  lastValidatedAt: { type: Date },
  validationError: { type: String, default: '' },
  configuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'validated', 'activated', 'deactivated', 'deleted']
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    details: { type: String }
  }]
}, { timestamps: true });

// Indexes
integrationConfigSchema.index({ organizationId: 1, provider: 1 }, { unique: true });
integrationConfigSchema.index({ organizationId: 1, category: 1 });
integrationConfigSchema.index({ organizationId: 1, isActive: 1 });

module.exports = mongoose.model('IntegrationConfig', integrationConfigSchema);
