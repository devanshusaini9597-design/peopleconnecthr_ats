import React from 'react';
import { useAuth } from '../context/AuthContext';
import { canUseFeature } from '../config/planFeatures';

/**
 * Plan-based gate — the sibling of <RoleGate roles={[...]}>.
 *
 * RoleGate answers "can this role do this?" (RBAC axis).
 * FeatureGate answers "does this org's plan include this feature?" (entitlement axis).
 *
 * Usage:
 *   <FeatureGate feature="analytics.advanced" fallback={<UpgradePrompt />}>
 *     <AdvancedAnalyticsPanel />
 *   </FeatureGate>
 *
 * NOTE: this only hides UI. The matching backend route MUST also call
 * requireFeature('analytics.advanced') — a hidden button with an unprotected
 * API route is a bypassable paywall, not real gating.
 */
export default function FeatureGate({ feature, children, fallback = null }) {
  const { organization, user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!organization || !canUseFeature(organization.plan, feature, {
    internalPreviewAccess: Boolean(user?.internalPreviewAccess),
  })) {
    return fallback;
  }

  return <>{children}</>;
}
