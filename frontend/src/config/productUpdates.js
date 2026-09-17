/**
 * Product release notes for company employees (not freelancers).
 *
 * Keep ONE entry in PRODUCT_UPDATES per product release.
 * Replace / bump `id` only when you intentionally ship release notes — do not
 * add day-by-day mini releases. Role filtering uses `audience` on each item.
 *
 * audience:
 *   'all'      — every company role
 *   'admin'    — owner, admin, hr_manager (owners always see every item)
 *   'employee' — non-admin hiring roles
 */

export const PRODUCT_UPDATES_STORAGE_KEY = 'skillnix_product_updates_seen_v1';
export const PRODUCT_UPDATES_DAILY_KEY_PREFIX = 'skillnix_whats_new_day_';

/** Stable per-user key segment so dismiss/seen never leak across accounts on one browser. */
export function productUpdatesUserKey(userId) {
  const raw = String(userId || '').trim();
  return raw || 'anon';
}

/** Per-user: last release marked read. */
export function productUpdatesSeenStorageKey(userId) {
  return `${PRODUCT_UPDATES_STORAGE_KEY}__u_${productUpdatesUserKey(userId)}`;
}

/** Local calendar date YYYY-MM-DD for “first login today” gating. */
export function localCalendarDayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Per-user + calendar day: daily auto-open gate. */
export function productUpdatesDailyStorageKey(userId, now = new Date()) {
  return `${PRODUCT_UPDATES_DAILY_KEY_PREFIX}${productUpdatesUserKey(userId)}_${localCalendarDayKey(now)}`;
}

export function readSeenProductUpdateId(userId) {
  try {
    return localStorage.getItem(productUpdatesSeenStorageKey(userId)) || '';
  } catch {
    return '';
  }
}

export function writeSeenProductUpdateId(userId, updateId) {
  try {
    localStorage.setItem(productUpdatesSeenStorageKey(userId), String(updateId || ''));
  } catch {
    /* ignore */
  }
}

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

/**
 * Single product release for the current ship.
 * Replace this object (and bump `id`) only when release notes are intentionally published.
 */
export const PRODUCT_UPDATES = [
  {
    id: '2026-09-17-ats-product-release-v3',
    date: '2026-09-17',
    title: 'ATS workspace improvements',
    summary:
      'This release improves candidate intake, search, and stage tracking across the ATS workspace.',
    highlights: [
      {
        audience: 'all',
        title: 'Desk defaults for faster intake',
        body: 'Save preferred client, source, product, and FLS under Profile → Desk defaults. Values pre-fill automatically when you add a candidate.',
      },
      {
        audience: 'admin',
        title: 'Role-based team defaults',
        body: 'Set organisation defaults per role in Organisation → Team. A user’s personal desk defaults always take priority when configured.',
      },
      {
        audience: 'all',
        title: 'Status history on each candidate',
        body: 'Open History beside Status in Edit Candidate to review every stage change with date and user.',
      },
      {
        audience: 'all',
        title: 'Stage metrics by entry date',
        body: 'Dashboard stage cards count candidates who entered that stage in the selected period. Total Candidates remains full inventory.',
      },
      {
        audience: 'all',
        title: 'Candidate search experience',
        body: 'Apply filters with Search. While results update, the table is locked and dimmed so records cannot be edited mid-refresh.',
      },
      {
        audience: 'all',
        title: 'Date sorting',
        body: 'Use the sort icons in the Candidates toolbar to order by oldest or newest. Sorting applies immediately.',
      },
      {
        audience: 'admin',
        title: 'Role-aware product updates',
        body: 'Release notes are delivered to each team member individually and filtered by role, so staff see only the changes that apply to their workspace.',
      },
    ],
    explore: [
      {
        audience: 'all',
        label: 'Open Candidates',
        path: '/candidates',
      },
      {
        audience: 'all',
        label: 'Desk defaults',
        path: '/settings',
        hash: 'desk-defaults',
      },
      {
        audience: 'all',
        label: 'Dashboard overview',
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
        label: 'Organisation walkthrough',
        path: '/organization',
        tourKey: 'skillnix_tour_organization_v1',
      },
      {
        audience: 'all',
        label: 'Reports & analytics',
        path: '/reports',
      },
    ],
  },
];

function itemAudience(item) {
  if (typeof item === 'string') return 'all';
  return item?.audience || 'all';
}

/**
 * Role-scoped release: only highlights/explore the user may see.
 * Drops the entire release if nothing remains for that role.
 */
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

/** True when this update is newer than the last one the user marked seen. */
export function isProductUpdateUnseen(updateId, seenId) {
  if (!updateId) return false;
  if (!seenId) return true;
  if (seenId === updateId) return false;
  const seenIdx = PRODUCT_UPDATES.findIndex((u) => u.id === seenId);
  const updateIdx = PRODUCT_UPDATES.findIndex((u) => u.id === updateId);
  if (updateIdx < 0) return false;
  if (seenIdx < 0) return true;
  return updateIdx < seenIdx;
}

/** Visible updates with `unseen` flag for unread highlighting. */
export function getProductUpdatesWithSeenState(role, seenId) {
  return getVisibleProductUpdates(role).map((u) => ({
    ...u,
    unseen: isProductUpdateUnseen(u.id, seenId),
  }));
}

/** Count of visible updates newer than the last one marked seen. */
export function countUnseenProductUpdates(seenId, role) {
  return getProductUpdatesWithSeenState(role, seenId).filter((u) => u.unseen).length;
}

export function hasUnseenProductUpdates(seenId, role) {
  return countUnseenProductUpdates(seenId, role) > 0;
}

/**
 * Auto-open What's New for unread releases on every user dashboard.
 * Unread must never be blocked by a session flag (Strict Mode remounts used to
 * leave only the header badge). Already-read daily reminder still uses session/day gates.
 */
export function shouldAutoOpenWhatsNew({ role, seenId, shownToday, shownThisSession } = {}) {
  const latest = getLatestProductUpdate(role);
  if (!latest) return false;
  if (hasUnseenProductUpdates(seenId, role)) return true;
  if (shownThisSession) return false;
  if (!shownToday) return true;
  return false;
}

export function productUpdatesSessionAutoKey(userId, role) {
  const uid = productUpdatesUserKey(userId);
  const id = latestProductUpdateId(role) || 'none';
  const day = localCalendarDayKey();
  return `${PRODUCT_UPDATES_STORAGE_KEY}_auto_${uid}_${day}_${id}`;
}
