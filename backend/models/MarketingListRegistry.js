const mongoose = require('mongoose');

/**
 * Persisted Zoho mailing list keys auto-created per purpose.
 * scopeKey = organizationId string, or "platform" when using env OAuth only.
 */
const marketingListRegistrySchema = new mongoose.Schema(
  {
    scopeKey: { type: String, required: true, index: true },
    purpose: {
      type: String,
      required: true,
      enum: ['subscribe', 'job_alerts', 'nurture', 'general'],
    },
    listKey: { type: String, required: true },
    listName: { type: String, default: '' },
  },
  { timestamps: true }
);

marketingListRegistrySchema.index({ scopeKey: 1, purpose: 1 }, { unique: true });

module.exports = mongoose.model('MarketingListRegistry', marketingListRegistrySchema);
