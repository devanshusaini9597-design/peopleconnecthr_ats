import { useEffect } from 'react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';

const HEARTBEAT_MS = 20_000;

/** Keeps lastActiveAt fresh while any signed-in user has the app tab visible. */
export default function usePresenceHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    const ping = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      authenticatedFetch('/api/presence/heartbeat', { method: 'POST' }).catch(() => {});
    };

    ping();
    const id = window.setInterval(ping, HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', ping);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', ping);
    };
  }, [user]);
}
