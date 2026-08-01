const mongoose = require('mongoose');
const crypto = require('crypto');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },

  // ── Agency mode (Enterprise) ──────────────────────────────────────
  // Per-client candidate sharing/permissions: empty array = visible to the
  // whole org (today's default behavior, unchanged for Starter/Professional).
  // Enforced in clientController.js/candidateController.js scopeFilter only
  // when the org's plan includes 'agency.clientSharing' — see comments there.
  restrictedToUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Client-facing read-only pipeline portal ('agency.clientPortal').
  portal: {
    enabled: { type: Boolean, default: false },
    token: { type: String },
    contactEmail: { type: String, default: '', trim: true }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

clientSchema.statics.generatePortalToken = () => crypto.randomBytes(24).toString('hex');

clientSchema.index({ createdBy: 1, name: 1 }, { unique: true });
clientSchema.index({ organizationId: 1, name: 1 });
clientSchema.index({ 'portal.token': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Client', clientSchema);
