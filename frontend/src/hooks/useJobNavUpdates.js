import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';

/**
 * Jobs sidebar badge — same as Announcements:
 * poll the server count. Jobs page calls markJobsSeen() once on mount.
 * Posting while already on Jobs does not clear the badge.
 */
const POLL_MS = 5_000;

let holdMinUntil = 0;
let holdMinCount = 0;
let jobsVisitSeenAt = null;

export function markJobsSeen() {
  if (!jobsVisitSeenAt) jobsVisitSeenAt = new Date().toISOString();
  holdMinUntil = 0;
  holdMinCount = 0;
  authenticatedFetch('/api/jobs/mark-seen', {
    method: 'POST',
    body: JSON.stringify({ seenAt: jobsVisitSeenAt }),
  })
    .then((res) => {
      if (res.ok) window.dispatchEvent(new CustomEvent('jobs:changed'));
    })
    .catch(() => {});
}

export function resetJobsSeenVisit() {
  jobsVisitSeenAt = null;
}

/** Optimistic bump after posting (server count is the source of truth). */
export function bumpJobsNav(by = 1) {
  holdMinCount = Math.max(1, Number(by) || 1);
  holdMinUntil = Date.now() + 8_000;
  window.dispatchEvent(new CustomEvent('jobs:nav-badge', {
    detail: { bump: holdMinCount },
  }));
}

export function ensureJobsBadge(min = 1) {
  bumpJobsNav(min);
}

export default function useJobNavUpdates() {
  const { user } = useAuth();
  const location = useLocation();
  const [newCount, setNewCount] = useState(0);
  const enabled = Boolean(user?._id || user?.id);
  const onJobs = location.pathname === '/jobs'
    || location.pathname.startsWith('/jobs/')
    || location.pathname === '/mandates'
    || location.pathname.startsWith('/mandates/');

  // New visit timestamp the next time Jobs is opened (do not mark-seen here).
  useEffect(() => {
    if (!onJobs) resetJobsSeenVisit();
  }, [onJobs]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setNewCount(0);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/jobs/unread-count', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const count = Number(body?.count ?? 0);
      const next = Number.isFinite(count) ? Math.max(0, Math.min(9, count)) : 0;
      setNewCount((prev) => {
        if (Date.now() < holdMinUntil) {
          return Math.min(9, Math.max(holdMinCount, next, prev));
        }
        return next;
      });
    } catch {
      /* ignore */
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;
    const id = window.setInterval(refresh, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onBump = (event) => {
      const bump = Number(event?.detail?.bump || 0);
      if (Number.isFinite(bump) && bump > 0) {
        setNewCount((n) => Math.min(9, Math.max(n, bump)));
      }
      window.setTimeout(() => { refresh(); }, 900);
    };
    const onRefresh = () => { refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    window.addEventListener('jobs:changed', onRefresh);
    window.addEventListener('jobs:nav-badge', onBump);
    window.addEventListener('notifications:refresh', onRefresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('jobs:changed', onRefresh);
      window.removeEventListener('jobs:nav-badge', onBump);
      window.removeEventListener('notifications:refresh', onRefresh);
    };
  }, [refresh, enabled]);

  return newCount;
}
