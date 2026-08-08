'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  pushSupported,
  urlBase64ToUint8Array,
  vapidPublicKey,
} from '@/lib/push-client';

type Status = 'loading' | 'unsupported' | 'no-vapid' | 'denied' | 'off' | 'on';

/**
 * Opt-in / opt-out for browser push notifications (PWA).
 * Lives in Settings → Notifications — does not auto-prompt on app load.
 */
export function PushNotificationSettings() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setStatus('unsupported');
      return;
    }
    if (!vapidPublicKey()) {
      setStatus('no-vapid');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'on' : 'off');
    } catch {
      setStatus('off');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    const vapid = vapidPublicKey();
    if (!vapid || !pushSupported()) return;
    setBusy(true);
    try {
      await navigator.serviceWorker.register('/sw.js').catch(() => {});
      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        toast.error('Permission needed', 'Allow notifications in your browser to enable push alerts.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }
      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error('Subscribe failed');
      setStatus('on');
      toast.success('Push enabled', 'You will get alerts for new applications and interview reminders.');
    } catch (e) {
      toast.error('Could not enable push', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
      setStatus('off');
      toast.success('Push disabled', 'Browser push alerts are turned off on this device.');
    } catch {
      toast.error('Could not disable push');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-stone-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-brand-50">
          <Smartphone className="w-4 h-4 text-brand-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-stone-900">Browser push (PWA)</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Optional alerts on this device — new applications and interview reminders
          </p>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking status…
        </div>
      )}
      {status === 'unsupported' && (
        <p className="text-sm text-stone-500">Push notifications are not supported in this browser.</p>
      )}
      {status === 'no-vapid' && (
        <p className="text-sm text-stone-500">
          Push is not configured on this server (missing <code className="text-xs">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>).
          Ask your admin to set VAPID keys.
        </p>
      )}
      {status === 'denied' && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Notifications are blocked for this site. Enable them in your browser site settings, then refresh.
        </p>
      )}
      {(status === 'off' || status === 'on') && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            {status === 'on' ? (
              <>
                <Bell className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-stone-800">Push alerts are on for this device</span>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 text-stone-400" />
                <span className="font-medium text-stone-700">Push alerts are off</span>
              </>
            )}
          </div>
          {status === 'on' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void disable()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Turn off
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void enable()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Enable push
            </button>
          )}
        </div>
      )}
    </div>
  );
}
