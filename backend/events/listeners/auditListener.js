const logger = require('../../utils/logger');
/**
 * Audit Listener
 * Listens for all events and creates AuditLog entries.
 */

const { on } = require('../eventBus');
const eventTypes = require('../eventTypes');
const mongoose = require('mongoose');

const initAuditListeners = () => {
  // We can loop over all event types to listen for them
  Object.values(eventTypes).forEach(eventType => {
    on(eventType, async (data) => {
      try {
        // Extract basic data that should be present
        const organizationId = data.organizationId;
        const userId = data.userId || data.changedById || data.actorId;
        
        if (!organizationId) {
          // If no organization context, we can't properly isolate this audit log
          return;
        }

        const AuditLog = mongoose.model('AuditLog');
        
        // Remove massive payload details if necessary, but we'll stringify it
        const metadata = { ...data };
        
        await AuditLog.create({
          organizationId,
          userId, // Can be null if system action
          action: eventType,
          resource: metadata.resourceType || 'unknown',
          resourceId: metadata.resourceId || metadata.id || null,
          details: metadata,
          ipAddress: metadata.ipAddress || null,
          userAgent: metadata.userAgent || null
        });
      } catch (error) {
        logger.error(`Failed to create audit log for event ${eventType}`, error);
      }
    });
  });
};

module.exports = { initAuditListeners };
