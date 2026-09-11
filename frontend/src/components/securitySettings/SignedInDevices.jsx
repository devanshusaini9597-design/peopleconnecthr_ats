import React, { useCallback, useEffect, useState } from 'react';
import { Laptop, Loader2, LogOut, MonitorSmartphone, ShieldOff } from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import ConfirmationModal from '../ConfirmationModal';
import { isPublicAuthPath } from '../../utils/authUtils';

function relativeTime(value) {
  if (!value) return 'Unknown';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'Unknown';
  const delta = Date.now() - then;
  if (delta < 60 * 1000) return 'Active now';
  const mins = Math.round(delta / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function SignedInDevices() {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/auth/sessions');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load devices');
      }
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      toast?.error?.('Could not load signed-in devices');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const finishRevoke = (revokedCurrent) => {
    if (revokedCurrent) {
      if (!isPublicAuthPath()) window.location.replace('/login?reason=expired');
      return;
    }
    load();
  };

  const revokeOne = async (session) => {
    setBusyId(session.id);
    try {
      const res = await authenticatedFetch(`/api/auth/sessions/${session.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to sign out that device');
      }
      toast?.success?.(session.current ? 'Signed out of this device' : 'That device was signed out');
      finishRevoke(data.revokedCurrent);
    } catch (err) {
      toast?.error?.(err.message || 'Failed to sign out that device');
    } finally {
      setBusyId('');
      setConfirm(null);
    }
  };

  const revokeOthers = async () => {
    setBusyId('others');
    try {
      const res = await authenticatedFetch('/api/auth/sessions/others', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to sign out other devices');
      }
      toast?.success?.(
        data.revoked ? `Signed out ${data.revoked} other device${data.revoked === 1 ? '' : 's'}` : 'No other devices were signed in'
      );
      load();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to sign out other devices');
    } finally {
      setBusyId('');
      setConfirm(null);
    }
  };

  const others = sessions.filter((s) => !s.current).length;

  return (
    <section
      data-tour="sec-devices"
      className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-4 min-w-0"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-brand-600" /> Signed-in devices
          </h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Sign out a lost laptop remotely. Logins still end 7 days after sign-in.
          </p>
        </div>
        {others > 0 && (
          <button
            type="button"
            onClick={() => setConfirm({ type: 'others' })}
            disabled={!!busyId}
            className="btn-secondary w-full sm:w-auto"
          >
            {busyId === 'others' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
            Sign out other devices
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 skeleton-ats rounded-xl" />
          <div className="h-16 skeleton-ats rounded-xl" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-stone-500">No active sessions.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-stone-200/80 bg-white px-3.5 py-3"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
                  <Laptop className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 tracking-tight">
                    {session.label || `${session.browser} on ${session.os}`}
                    {session.current && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {relativeTime(session.lastActiveAt)}
                    {session.ip ? ` · ${session.ip}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirm({ type: 'one', session })}
                disabled={!!busyId}
                className="h-9 px-3 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                {busyId === session.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Sign out
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.type === 'others') return revokeOthers();
          if (confirm?.session) return revokeOne(confirm.session);
        }}
        title={confirm?.type === 'others' ? 'Sign out other devices?' : 'Sign out this device?'}
        message={
          confirm?.type === 'others'
            ? 'Every other laptop or browser signed in with this account will need to log in again. This device stays signed in.'
            : confirm?.session?.current
              ? 'You will be signed out here and need to log in again.'
              : `Sign out ${confirm?.session?.label || 'that device'}? It will need to log in again.`
        }
        confirmText="Sign out"
        type="danger"
      />
    </section>
  );
}
