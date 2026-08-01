const mongoose = require('mongoose');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

/**
 * IntegrationConfig Model
 * Stores API keys, email credentials, etc. for a tenant organization.
 *
 * SECURITY: `credentials` is encrypted at rest (AES-256-GCM, see utils/encryption.js).
 * - Never read `doc.credentials` directly expecting a plain object — it's an
 *   opaque encrypted string in the DB and in any `.lean()`/JSON response.
 * - Use `doc.getDecryptedCredentials()` to get the plaintext object back.
 * - Setting `doc.credentials = {...plain object...}` and calling `.save()`
 *   automatically encrypts it via the pre-save hook below.
 */
const integrationConfigSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  // Which product this integration belongs to — additive, defaults to 'ats'
  // since that's the only product today. Lets a future CRM/HRMS product
  // store its own integrations (payroll/biometric webhooks, etc.) in this
  // same collection instead of a parallel one, per the productization plan.
  product: { type: String, enum: ['ats', 'crm', 'hrms'], default: 'ats', index: true },
  provider: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: ['email', 'calendar', 'sms', 'ai', 'job_board', 'background_check', 'esign']
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
integrationConfigSchema.index({ organizationId: 1, product: 1, provider: 1 }, { unique: true });
integrationConfigSchema.index({ organizationId: 1, category: 1 });
integrationConfigSchema.index({ organizationId: 1, isActive: 1 });

// Encrypt credentials before every save, unless already encrypted (e.g. doc
// re-saved without touching credentials).
integrationConfigSchema.pre('save', function (next) {
  if (this.isModified('credentials') && this.credentials != null && !isEncrypted(this.credentials)) {
    this.credentials = encrypt(this.credentials);
  }
  next();
});

/**
 * Returns the decrypted credentials object. Returns {} if there are none,
 * and returns {} (logging a warning) if decryption fails — e.g. wrong
 * INTEGRATION_ENCRYPTION_KEY — rather than throwing and taking down a request.
 */
integrationConfigSchema.methods.getDecryptedCredentials = function () {
  if (!this.credentials) return {};
  if (!isEncrypted(this.credentials)) {
    // Legacy/plaintext record from before encryption was added.
    return this.credentials;
  }
  try {
    return decrypt(this.credentials) || {};
  } catch (err) {
    console.error(`[IntegrationConfig] Failed to decrypt credentials for ${this._id}:`, err.message);
    return {};
  }
};

module.exports = mongoose.model('IntegrationConfig', integrationConfigSchema);
