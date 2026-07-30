/**
 * Internal Event Bus for SkillNix
 * 
 * Simple EventEmitter-based event bus for decoupled communication between modules.
 * This is the foundation that makes HRMS/CRM sync free later.
 * 
 * Usage:
 *   const { emit, on } = require('./events/eventBus');
 *   emit('candidate.hired', { organizationId, candidateId, jobId, applicationId });
 *   on('candidate.hired', async (data) => { ... });
 */

const { EventEmitter } = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Max listeners set to 50
    this.setMaxListeners(50);
  }

  /**
   * Emit an event with error handling and logging
   * @param {string} eventName 
   * @param {any} data 
   */
  emit(eventName, data) {
    console.log(`[EventBus] Emitting event: ${eventName} at ${new Date().toISOString()}`);
    // Wrap super.emit in try-catch just in case the synchronous part of emitter throws
    try {
      return super.emit(eventName, data);
    } catch (error) {
      console.error(`[EventBus] Error emitting event ${eventName}:`, error);
      return false;
    }
  }

  /**
   * Add a listener with error handling
   * @param {string} eventName 
   * @param {Function} listener 
   */
  on(eventName, listener) {
    const wrappedListener = async (...args) => {
      try {
        await listener(...args);
      } catch (error) {
        console.error(`[EventBus] Error in listener for event ${eventName}:`, error);
      }
    };
    
    // Store original listener so off() can work if needed (not perfectly implemented here for off, but acceptable for now)
    wrappedListener.original = listener;
    super.on(eventName, wrappedListener);
    return this;
  }
  
  /**
   * Add a one-time listener with error handling
   * @param {string} eventName 
   * @param {Function} listener 
   */
  once(eventName, listener) {
    const wrappedListener = async (...args) => {
      try {
        await listener(...args);
      } catch (error) {
        console.error(`[EventBus] Error in once listener for event ${eventName}:`, error);
      }
    };
    
    wrappedListener.original = listener;
    super.once(eventName, wrappedListener);
    return this;
  }
}

const eventBus = new EventBus();

module.exports = {
  emit: eventBus.emit.bind(eventBus),
  on: eventBus.on.bind(eventBus),
  off: eventBus.off.bind(eventBus),
  once: eventBus.once.bind(eventBus),
  listenerCount: eventBus.listenerCount.bind(eventBus),
  eventNames: eventBus.eventNames.bind(eventBus),
};
