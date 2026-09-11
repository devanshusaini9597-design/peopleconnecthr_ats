import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { presenceFromLastActive } from '../components/ui/PresenceBadge';

const PresenceContext = createContext({
  people: [],
  byId: {},
  liveCount: 0,
  awayCount: 0,
  refreshing: false,
  updatedAt: null,
  refresh: async () => {},
});

const POLL_MS = 20_000;

export function PresenceProvider({ children }) {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async ({ silent = true } = {}) => {
    if (!user) return;
    if (!silent) setRefreshing(true);
    try {
      const res = await authenticatedFetch('/api/presence', { cache: 'no-store' });
      const data = await readApiJson(res);
      const list = Array.isArray(data?.data) ? data.data : [];
      setPeople(list.map((p) => {
        const seenAt = p.lastActiveAt || p.lastLoginAt || null;
        return {
          ...p,
          lastActiveAt: seenAt,
          status: p.status || presenceFromLastActive(seenAt),
        };
      }));
      setUpdatedAt(new Date());
    } catch {
      /* keep last known */
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPeople([]);
      setUpdatedAt(null);
      return undefined;
    }
    load({ silent: true });
    const id = window.setInterval(() => load({ silent: true }), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user, load]);

  const value = useMemo(() => {
    const byId = {};
    for (const person of people) byId[String(person._id)] = person;
    return {
      people,
      byId,
      liveCount: people.filter((p) => p.status === 'online').length,
      awayCount: people.filter((p) => p.status === 'away').length,
      refreshing,
      updatedAt,
      refresh: () => load({ silent: false }),
    };
  }, [people, refreshing, updatedAt, load]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
