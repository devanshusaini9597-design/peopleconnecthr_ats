/**
 * Enterprise BYOK handoffs: on hire → HRIS + CRM; optional SIEM ship for audit-ish events.
 */
const { on } = require('../eventBus');
const eventTypes = require('../eventTypes');
const { getAdapter } = require('../../adapters');

function registerIntegrationHandoffListeners() {
  on(eventTypes.CANDIDATE_HIRED, async (data) => {
    const { organizationId, candidateId, jobId, applicationId, hiredAt } = data || {};
    if (!organizationId || !candidateId) return;

    try {
      const Candidate = require('../../models/Candidate');
      const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
      if (!candidate) return;

      const nameParts = String(candidate.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Candidate';
      const lastName = nameParts.slice(1).join(' ') || 'Hire';
      const hirePayload = {
        firstName,
        lastName,
        email: candidate.email,
        phone: candidate.contact || candidate.phone,
        jobTitle: candidate.position,
        department: candidate.client || candidate.companyName,
        startDate: (hiredAt || new Date()).toISOString().slice(0, 10),
        candidate,
        jobId,
        applicationId,
        hiredAt: hiredAt || new Date()
      };

      const hris = await getAdapter(organizationId, 'hris');
      if (hris && typeof hris.pushHire === 'function') {
        try {
          await hris.pushHire(hirePayload);
          console.log('[HRIS] pushHire succeeded for candidate', candidateId);
        } catch (err) {
          console.warn('[HRIS] pushHire failed:', err.message);
        }
      }

      const crm = await getAdapter(organizationId, 'crm');
      if (crm && typeof crm.upsertCandidate === 'function') {
        try {
          await crm.upsertCandidate({
            email: hirePayload.email,
            firstName,
            lastName,
            phone: hirePayload.phone,
            title: hirePayload.jobTitle,
            company: hirePayload.department,
            ...hirePayload
          });
          console.log('[CRM] upsertCandidate succeeded for candidate', candidateId);
        } catch (err) {
          console.warn('[CRM] upsertCandidate failed:', err.message);
        }
      }

      const siem = await getAdapter(organizationId, 'siem');
      if (siem && typeof siem.shipEvents === 'function') {
        try {
          await siem.shipEvents([{
            timestamp: new Date().toISOString(),
            action: 'candidate.hired',
            candidateId: String(candidateId),
            jobId: jobId ? String(jobId) : undefined,
            organizationId: String(organizationId)
          }]);
        } catch (err) {
          console.warn('[SIEM] shipEvents failed:', err.message);
        }
      }
    } catch (err) {
      console.error('[integrationHandoff] CANDIDATE_HIRED handler error:', err.message);
    }
  });
}

module.exports = { registerIntegrationHandoffListeners };
