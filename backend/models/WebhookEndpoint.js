const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

/**
 * WebhookEndpoint — an org-configured outbound webhook subscription.
 *
 * Gated by plan: Professional gets read-only event categories (candidate.*,
 * application.*, interview.* — informational events), Enterprise gets every
 * event type including team/org/integration changes. Enforced by
 * `ALLOWED_EVENTS_BY_FEATURE` in services/webhookDispatcher.js, not here —
 * this model just stores what the org asked to subscribe to.
 */
const webhookEndpointSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  url: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  events: {
    type: [String],
    default: [],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'At least one event type must be selected'
    }
  },
  secret: { type: String, required: true }, // encrypted at rest, see pre-save hook
  isActive: { type: Boolean, default: true },
  lastDeliveryAt: { type: Date },
  lastDeliveryStatus: { type: String, enum: ['success', 'failed', null], default: null },
  consecutiveFailures: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

webhookEndpointSchema.index({ organizationId: 1, isActive: 1 });

webhookEndpointSchema.pre('save', function (next) {
  if (this.isModified('secret') && this.secret && !isEncrypted(this.secret)) {
    this.secret = encrypt(this.secret);
  }
  next();
});

webhookEndpointSchema.methods.getDecryptedSecret = function () {
  if (!this.secret) return '';
  if (!isEncrypted(this.secret)) return this.secret; // legacy/plaintext
  try {
    return decrypt(this.secret) || '';
  } catch (err) {
    console.error(`[WebhookEndpoint] Failed to decrypt secret for ${this._id}:`, err.message);
    return '';
  }
};

/** Generates a new random signing secret (whsec_-prefixed, like Stripe's convention). */
webhookEndpointSchema.statics.generateSecret = () => `whsec_${crypto.randomBytes(24).toString('hex')}`;

module.exports = mongoose.model('WebhookEndpoint', webhookEndpointSchema);
