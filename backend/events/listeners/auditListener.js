const logger = require('../../utils/logger');
/**
 * Audit Listener
 * Listens for domain events and writes compact AuditLog rows.
 */

const { on } = require('../eventBus');
const eventTypes = require('../eventTypes');
const mongoose = require('mongoose');

function resourceFromAction(action) {
  const prefix = String(action || '').split('.')[0];
  if (prefix === 'user') return 'auth';
  return prefix || 'unknown';
}

function compactDetails(data = {}) {
  const keep = [
    'title', 'name', 'email', 'jobId', 'candidateId', 'applicationId',
    'source', 'stage', 'previousPlan', 'newPlan', 'message', 'reason',
  ];
  const out = {};
  for (const key of keep) {
    if (data[key] != null && data[key] !== '') out[key] = data[key];
  }
  return out;
}

async function persistAudit(eventType, data = {}) {
  const organizationId = data.organizationId;
  if (!organizationId) return;

  const AuditLog = mongoose.model('AuditLog');
  const userId = data.userId || data.changedById || data.actorId || null;
  const resourceId = data.resourceId || data.id || data.jobId || data.candidateId || data.applicationId || null;

  await AuditLog.create({
    organizationId,
    userId: userId || undefined,
    action: eventType,
    resource: data.resourceType || resourceFromAction(eventType),
    resourceId: resourceId || undefined,
    details: compactDetails(data),
    ipAddress: data.ipAddress || '',
    userAgent: data.userAgent || '',
  });
}

const initAuditListeners = () => {
  Object.values(eventTypes).forEach((eventType) => {
    on(eventType, async (data) => {
      try {
        await persistAudit(eventType, data || {});
      } catch (error) {
        logger.error(`Failed to create audit log for event ${eventType}`, error);
      }
    });
  });
};

module.exports = { initAuditListeners, persistAudit, compactDetails, resourceFromAction };
