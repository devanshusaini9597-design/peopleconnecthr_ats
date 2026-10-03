const { getEntitlements, canUseFeature } = require('../config/planFeatures');
const { hasInternalPreviewAccess } = require('./vendorDomains');

function sessionEntitlements(user, org) {
  if (!org?.plan) return [];
  const internalPreviewAccess = hasInternalPreviewAccess(user, org);
  return getEntitlements(org.plan).filter((key) =>
    canUseFeature(org.plan, key, { internalPreviewAccess })
  );
}

function sessionPreviewFlags(user, org) {
  return {
    isDemo: Boolean(user?.isDemo),
    internalPreviewAccess: hasInternalPreviewAccess(user, org),
  };
}

module.exports = { sessionEntitlements, sessionPreviewFlags };
