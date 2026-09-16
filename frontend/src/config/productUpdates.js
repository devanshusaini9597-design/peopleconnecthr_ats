/**
 * Product release notes shown to company employees (not freelancers).
 * Add a new entry at the TOP when you ship. Bump `id` each release.
 */
export const PRODUCT_UPDATES = [
  {
    id: '2026-09-16-desk-defaults',
    date: '2026-09-16',
    title: 'Desk defaults & smarter pipeline stats',
    summary: 'Faster candidate entry and clearer monthly stage reporting.',
    highlights: [
      'Desk defaults: pre-fill FLS, client, source, and more from Profile or Team settings.',
      'Role defaults & sticky last-used values for company hiring desks.',
      'Dashboard stage cards count by when a candidate entered the stage (e.g. Turn Up in September).',
      'Status history on the candidate edit form.',
    ],
  },
];

export const PRODUCT_UPDATES_STORAGE_KEY = 'skillnix_product_updates_seen_v1';

export function latestProductUpdateId() {
  return PRODUCT_UPDATES[0]?.id || '';
}

export function hasUnseenProductUpdates(seenId) {
  const latest = latestProductUpdateId();
  if (!latest) return false;
  return String(seenId || '') !== latest;
}
