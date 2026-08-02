const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  jti: { type: String, required: true, unique: true, index: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  lastActivityAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

userSessionSchema.index({ userId: 1, revokedAt: 1, lastActivityAt: -1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
