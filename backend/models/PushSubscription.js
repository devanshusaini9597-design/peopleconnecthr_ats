const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, default: '' },
    auth: { type: String, default: '' }
  },
  userAgent: { type: String, default: '' }
}, { timestamps: true });

pushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
