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
    id: '2026-09-16-whats-new-explore',
    date: '2026-09-16',
    dateLabel: 'September 2026',
    title: 'Desk defaults, status history & clearer stage metrics',
    summary:
      'Configure your Add Candidate preferences once, review every status change on a clear timeline, and measure stage movement by the date candidates entered each stage.',
    highlights: [
      {
        title: 'Personal desk defaults',
        body: 'Under Profile → Desk defaults, set your usual client, source, product, and FLS. These values apply automatically on Add Candidate. Enable Lock defaults to keep your selections fixed.',
      },
      {
        title: 'Role-based defaults for your team',
        body: 'Administrators can define defaults by role in Organization → Team. Personal desk defaults always take priority when set.',
      },
      {
        title: 'Last-used field memory',
        body: 'When no default is configured, Add Candidate remembers your most recent client, source, product, and FLS to speed up recurring work.',
      },
      {
        title: 'Status history on every candidate',
        body: 'Open a candidate and use History to see who changed status, when, and from which stage to which — including earlier records where available.',
      },
      {
        title: 'Dashboard stage metrics by entry date',
        body: 'Stage cards (Interview, Offer, Turn Up, and similar) count candidates who entered that stage this month, not only those first added this month. Total Candidates remains all-time.',
      },
    ],
    explore: [
      {
        label: 'Open desk defaults',
        path: '/settings',
        hash: 'desk-defaults',
      },
      {
        label: 'Take a tour — Profile & desk defaults',
        path: '/settings',
        hash: 'desk-defaults',
        tourKey: 'skillnix_tour_profile_v2',
      },
      {
        label: 'Take a tour — Dashboard',
        path: '/dashboard',
        tourKey: 'skillnix_tour_dashboard_v1',
      },
      {
        label: 'Organization → Team (role defaults)',
        path: '/organization?tab=team',
      },
      {
        label: 'Take a tour — Organization',
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
