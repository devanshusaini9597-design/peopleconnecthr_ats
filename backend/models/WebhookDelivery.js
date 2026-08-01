const mongoose = require('mongoose');

/**
 * WebhookDelivery — audit trail of outbound webhook attempts, so org admins
 * can debug "why didn't my Zapier/webhook fire". Capped by a TTL index
 * (90 days) so this doesn't grow unbounded like a real event log would.
 */
const webhookDeliverySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebhookEndpoint', required: true, index: true },
  eventType: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  success: { type: Boolean, required: true },
  responseStatus: { type: Number },
  errorMessage: { type: String },
  attemptNumber: { type: Number, default: 1 },
  durationMs: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

webhookDeliverySchema.index({ endpointId: 1, createdAt: -1 });
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('WebhookDelivery', webhookDeliverySchema);
