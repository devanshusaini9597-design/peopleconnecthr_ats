const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Organization = require('../models/Organization');

/**
 * Purge candidates past retention period for an organization.
 * Skips records on legal hold or org-wide legal hold.
 * @param {string} organizationId
 * @returns {Promise<{ purged: number, skippedLegalHold: number }>}
 */
const purgeExpiredCandidates = async (organizationId) => {
  const org = await Organization.findById(organizationId)
    .select('complianceSettings');
  if (!org) return { purged: 0, skippedLegalHold: 0 };

  const defaultDays = org.complianceSettings?.defaultRetentionDays ?? 730;
  const byRegion = org.complianceSettings?.retentionDaysByRegion;
  const orgLegalHold = org.complianceSettings?.legalHoldEnabled;

  const cutoffDefault = new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);

  const query = {
    organizationId,
    gdprErasedAt: null,
    legalHold: { $ne: true },
    createdAt: { $lt: cutoffDefault }
  };

  if (orgLegalHold) {
    return { purged: 0, skippedLegalHold: -1 };
  }

  let candidates = await Candidate.find(query).select('_id location createdAt legalHold');

  // Apply per-region retention if configured
  if (byRegion && typeof byRegion.forEach === 'function') {
    candidates = candidates.filter((c) => {
      const region = c.location || 'default';
      const days = byRegion.get(region) ?? defaultDays;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return c.createdAt < cutoff;
    });
  }

  const ids = candidates.map((c) => c._id);
  if (!ids.length) return { purged: 0, skippedLegalHold: 0 };

  await Application.deleteMany({ candidateId: { $in: ids } });
  const result = await Candidate.deleteMany({ _id: { $in: ids } });

  return { purged: result.deletedCount || 0, skippedLegalHold: 0 };
};

/**
 * Run retention purge for all orgs with compliance.retentionPolicy entitled.
 */
const purgeAllOrganizations = async () => {
  const { planHasFeature } = require('../config/planFeatures');
  const orgs = await Organization.find({ isActive: { $ne: false } }).select('plan _id');
  const summary = [];

  for (const org of orgs) {
    if (!planHasFeature(org.plan, 'compliance.retentionPolicy')) continue;
    const result = await purgeExpiredCandidates(org._id);
    summary.push({ organizationId: org._id, ...result });
  }

  return summary;
};

module.exports = { purgeExpiredCandidates, purgeAllOrganizations };
