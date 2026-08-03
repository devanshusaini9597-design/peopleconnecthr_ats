/**
 * Auto-enroll candidates into sequences on application events.
 * Gated by messaging.sequences plan entitlement.
 */

const { on } = require('../eventBus');
const eventTypes = require('../eventTypes');
const mongoose = require('mongoose');
const { planHasFeature } = require('../../config/planFeatures');

const initSequenceTriggerListeners = () => {
  const enroll = async ({ organizationId, candidateId, triggerType, triggerStage }) => {
    if (!organizationId || !candidateId) return;
    try {
      const Organization = mongoose.model('Organization');
      const EmailSequence = mongoose.model('EmailSequence');
      const SequenceEnrollment = mongoose.model('SequenceEnrollment');

      const org = await Organization.findById(organizationId).select('plan');
      if (!planHasFeature(org?.plan, 'messaging.sequences')) return;

      const filter = {
        organizationId,
        isActive: true,
        triggerType
      };
      if (triggerType === 'stage_change' && triggerStage) {
        filter.triggerStage = triggerStage;
      }

      const sequences = await EmailSequence.find(filter);
      for (const seq of sequences) {
        try {
          const delay = seq.steps?.[0]?.delayDays || 0;
          await SequenceEnrollment.create({
            organizationId,
            sequenceId: seq._id,
            candidateId,
            status: 'active',
            currentStep: 0,
            nextSendAt: new Date(Date.now() + delay * 86400000)
          });
        } catch {
          // duplicate enrollment
        }
      }
    } catch (err) {
      console.warn('[sequenceTrigger]', err.message);
    }
  };

  on(eventTypes.APPLICATION_CREATED, async (data) => {
    await enroll({
      organizationId: data.organizationId,
      candidateId: data.candidateId,
      triggerType: 'application_received'
    });
  });

  on(eventTypes.APPLICATION_STAGE_CHANGED, async (data) => {
    await enroll({
      organizationId: data.organizationId,
      candidateId: data.candidateId,
      triggerType: 'stage_change',
      triggerStage: data.stage || data.toStage || data.newStage
    });
  });
};

module.exports = { initSequenceTriggerListeners };
