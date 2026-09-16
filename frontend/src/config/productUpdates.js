/**
 * Product release notes shown to company employees (not freelancers).
 * Add a new entry at the TOP when you ship. Bump `id` each release.
 *
 * audience on highlights / explore:
 *   'all'    — every company role
 *   'admin'  — owner, admin, hr_manager (owners always see everything)
 *   'employee' — non-admin hiring roles
 *
 * Optional explore: { label, path, hash?, tourKey?, audience? }
 */

export const PRODUCT_UPDATES_STORAGE_KEY = 'skillnix_product_updates_seen_v1';

const ADMIN_AUDIENCE_ROLES = new Set(['owner', 'admin', 'hr_manager']);

export function formatProductUpdateDate(dateStr) {
  if (!dateStr) return '';
  const raw = String(dateStr).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function isAdminAudienceRole(role) {
  return ADMIN_AUDIENCE_ROLES.has(String(role || ''));
}

/** Owners see every item; others follow audience. */
export function canSeeProductAudience(role, audience = 'all') {
  const r = String(role || '');
  if (r === 'owner') return true;
  const a = String(audience || 'all').toLowerCase();
  if (a === 'all' || a === 'everyone') return true;
  if (a === 'admin') return isAdminAudienceRole(r);
  if (a === 'employee') return !isAdminAudienceRole(r);
  return true;
}

export const PRODUCT_UPDATES = [
  {
    id: '2026-09-16-role-aware-notes',
    date: '2026-09-16',
    title: 'Desk defaults, status history & stage metrics',
    summary:
      'This release speeds up Add Candidate with saved desk defaults, adds an auditable status timeline, and aligns dashboard stage KPIs with stage entry dates.',
    highlights: [
      {
        audience: 'all',
        title: 'Personal desk defaults',
        body: 'Save your usual client, source, product, and FLS under Profile → Desk defaults. Values pre-fill automatically when you add a candidate.',
      },
      {
        audience: 'admin',
        title: 'Role-based team defaults',
        body: 'Set defaults per role in Organization → Team. Personal desk defaults always override role defaults when present.',
      },
      {
        audience: 'all',
        title: 'Candidate status history',
        body: 'Use History on a candidate record to review who changed status, when, and from which stage to which.',
      },
      {
        audience: 'all',
        title: 'Stage metrics by entry date',
        body: 'Dashboard stage cards count candidates who entered that stage this month. Total Candidates remains all-time inventory.',
      },
    ],
    explore: [
      {
        audience: 'all',
        label: 'Desk defaults',
        path: '/settings',
        hash: 'desk-defaults',
      },
      {
        audience: 'all',
        label: 'Profile tour',
        path: '/settings',
        hash: 'desk-defaults',
        tourKey: 'skillnix_tour_profile_v2',
      },
      {
        audience: 'all',
        label: 'Dashboard tour',
        path: '/dashboard',
        tourKey: 'skillnix_tour_dashboard_v1',
      },
      {
        audience: 'admin',
        label: 'Team role defaults',
        path: '/organization?tab=team',
      },
      {
        audience: 'admin',
        label: 'Organization tour',
        path: '/organization',
        tourKey: 'skillnix_tour_organization_v1',
      },
      {
        audience: 'all',
        label: 'Reports & Analytics',
        path: '/reports',
      },
    ],
  },
];

function itemAudience(item) {
  if (typeof item === 'string') return 'all';
  return item?.audience || 'all';
}

export function filterProductUpdateForRole(update, role) {
  if (!update) return null;
  const highlights = (update.highlights || []).filter((h) => canSeeProductAudience(role, itemAudience(h)));
  const explore = (update.explore || []).filter((e) => canSeeProductAudience(role, itemAudience(e)));
  if (!highlights.length && !explore.length) return null;
  return {
    ...update,
    highlights,
    explore,
    dateLabel: formatProductUpdateDate(update.date),
  };
}

export function getVisibleProductUpdates(role) {
  return PRODUCT_UPDATES
    .map((u) => filterProductUpdateForRole(u, role))
    .filter(Boolean);
}

export function latestProductUpdateId(role) {
  const visible = getVisibleProductUpdates(role);
  return visible[0]?.id || PRODUCT_UPDATES[0]?.id || '';
}

export function getLatestProductUpdate(role) {
  return getVisibleProductUpdates(role)[0] || null;
}

/** Count of visible updates newer than the last one marked seen. */
export function countUnseenProductUpdates(seenId, role) {
  const visible = getVisibleProductUpdates(role);
  if (!visible.length) return 0;
  if (!seenId) return visible.length;
  const idx = visible.findIndex((u) => u.id === seenId);
  if (idx < 0) return visible.length;
  return idx;
}

export function hasUnseenProductUpdates(seenId, role) {
  return countUnseenProductUpdates(seenId, role) > 0;
}
