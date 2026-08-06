const mongoose = require('mongoose');

/**
 * AuditLog Model
 * Records events for security and debugging.
 */
const auditLogSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

// Indexes
auditLogSchema.index({ organizationId: 1, timestamp: -1 });
auditLogSchema.index({ organizationId: 1, resource: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
// TTL index to auto-delete after 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

auditLogSchema.plugin(require('../utils/tenantPlugin'));

module.exports = mongoose.model('AuditLog', auditLogSchema);
