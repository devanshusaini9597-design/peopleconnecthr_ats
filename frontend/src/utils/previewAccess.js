export function userCanUsePreview(user, featureKey) {
  if (!user || user.isDemo) return false;
  if (user.internalPreviewAccess) return true;
  if (!featureKey) return false;
  return Array.isArray(user.previewModules) && user.previewModules.includes(featureKey);
}

export function previewFeatureCtx(user) {
  return {
    isDemo: Boolean(user?.isDemo),
    internalPreviewAccess: Boolean(user?.internalPreviewAccess),
    previewModules: user?.previewModules,
  };
}
