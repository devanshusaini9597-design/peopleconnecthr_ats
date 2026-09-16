/**
 * Product release notes shown to company employees (not freelancers).
 * Add a new entry at the TOP when you ship. Bump `id` each release.
 *
 * Optional `explore` items:
 *   { label, path, hash?, tourKey? }
 *   tourKey opens that page's ProductTour after navigation.
 */

export const PRODUCT_UPDATES = [
  {
    id: '2026-09-16-whats-new-enterprise',
    date: '2026-09-16',
    dateLabel: 'September 2026',
    title: 'Desk defaults, status history & stage metrics',
    summary:
      'This release reduces repetitive data entry on Add Candidate, adds an auditable status timeline, and aligns dashboard stage KPIs with when candidates entered each stage.',
    highlights: [
      {
        title: 'Personal desk defaults',
        body: 'Save your usual client, source, product, and FLS under Profile → Desk defaults. Values pre-fill automatically when you add a candidate.',
      },
      {
        title: 'Role-based team defaults',
        body: 'Administrators can set defaults per role in Organization → Team. Personal defaults always override role defaults when present.',
      },
      {
        title: 'Sticky last-used values',
        body: 'If no default is set, Add Candidate remembers your most recent client, source, product, and FLS for the next entry.',
      },
      {
        title: 'Candidate status history',
        body: 'Use History on a candidate record to review who changed status, when, and from which stage to which.',
      },
      {
        title: 'Stage metrics by entry date',
        body: 'Dashboard stage cards count candidates who entered that stage this month. Total Candidates remains all-time inventory.',
      },
    ],
    explore: [
      {
        label: 'Desk defaults',
        path: '/settings',
        hash: 'desk-defaults',
      },
      {
        label: 'Profile tour',
        path: '/settings',
        hash: 'desk-defaults',
        tourKey: 'skillnix_tour_profile_v2',
      },
      {
        label: 'Dashboard tour',
        path: '/dashboard',
        tourKey: 'skillnix_tour_dashboard_v1',
      },
      {
        label: 'Team role defaults',
        path: '/organization?tab=team',
      },
      {
        label: 'Organization tour',
        path: '/organization',
        tourKey: 'skillnix_tour_organization_v1',
      },
      {
        label: 'Reports & Analytics',
        path: '/reports',
      },
    ],
  },
];

export const PRODUCT_UPDATES_STORAGE_KEY = 'skillnix_product_updates_seen_v1';

export function latestProductUpdateId() {
  return PRODUCT_UPDATES[0]?.id || '';
}

export function getLatestProductUpdate() {
  return PRODUCT_UPDATES[0] || null;
}

/** Count of updates newer than the last one marked seen (Facebook-style badge). */
export function countUnseenProductUpdates(seenId) {
  if (!PRODUCT_UPDATES.length) return 0;
  if (!seenId) return PRODUCT_UPDATES.length;
  const idx = PRODUCT_UPDATES.findIndex((u) => u.id === seenId);
  if (idx < 0) return PRODUCT_UPDATES.length;
  return idx;
}

export function hasUnseenProductUpdates(seenId) {
  return countUnseenProductUpdates(seenId) > 0;
}
