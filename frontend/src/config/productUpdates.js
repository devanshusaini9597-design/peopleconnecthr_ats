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
    id: '2026-09-17-jobs-careers-release-v4',
    date: '2026-09-17',
    title: 'Jobs & careers hiring upgrade',
    summary:
      'Post openings faster, track new jobs like unread mail, and give candidates a cleaner careers apply experience.',
    highlights: [
      {
        audience: 'all',
        title: 'Paste client JD into Post job',
        body: 'When a client shares a job on WhatsApp or email, paste the text in Post new job and use Extract & fill. Fields and the live preview update automatically — you can still edit everything by hand.',
      },
      {
        audience: 'all',
        title: 'Jobs page refresh',
        body: 'Clearer job cards, status filters, Urgent hiring tab, and pagination that follows your search across every page of results.',
      },
      {
        audience: 'all',
        title: 'Unread openings (Gmail-style)',
        body: 'New Open jobs stay highlighted with a New badge and a sidebar count until you open that job. The badge does not clear just by visiting the Jobs list.',
      },
      {
        audience: 'all',
        title: 'Mark urgent without full edit',
        body: 'Use More actions on a job card to mark or clear Urgent hiring instantly — no need to open the full editor.',
      },
      {
        audience: 'all',
        title: 'Job templates library',
        body: 'Starters now match common BFSI and insurance roles, alongside your saved templates, in a cleaner Job templates modal.',
      },
      {
        audience: 'all',
        title: 'Freelance Review stays dedicated',
        body: 'Freelance handoffs no longer sit on the Jobs page. Use Freelance Review in the sidebar for submissions and status updates.',
      },
      {
        audience: 'all',
        title: 'Public careers apply experience',
        body: 'Location filters use individual cities, apply steps no longer auto-submit, and candidates get clearer validation and leave warnings.',
      },
      {
        audience: 'admin',
        title: 'Careers publish & share',
        body: 'Publish drafts to your careers page from Jobs, then copy the apply link or share on LinkedIn. Organisation careers branding continues under Company Brand / Careers settings.',
      },
      {
        audience: 'admin',
        title: 'Role-aware What’s New',
        body: 'Each teammate sees release notes filtered for their role. Owners see the full set; hiring staff see recruiter-facing changes.',
      },
    ],
    explore: [
      {
        audience: 'all',
        label: 'Open Jobs',
        path: '/jobs',
        tourKey: 'skillnix_tour_jobs_v2',
      },
      {
        audience: 'all',
        label: 'Freelance Review',
        path: '/freelance-review',
      },
      {
        audience: 'all',
        label: 'Desk defaults',
        path: '/settings',
        hash: 'desk-defaults',
      },
      {
        audience: 'admin',
        label: 'Company brand',
        path: '/company-brand',
      },
      {
        audience: 'admin',
        label: 'Organisation settings',
        path: '/organization',
        tourKey: 'skillnix_tour_organization_v1',
      },
      {
        audience: 'all',
        label: 'Dashboard overview',
        path: '/dashboard',
        tourKey: 'skillnix_tour_dashboard_v1',
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
