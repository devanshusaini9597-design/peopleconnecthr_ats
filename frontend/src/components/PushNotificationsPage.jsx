import React, { useEffect, useState, useCallback } from 'react';
import {
  Bell, Loader2, CheckCircle2, RefreshCw, BellOff,
  Calendar, AtSign, Megaphone, MonitorSmartphone, AlertCircle
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ConfirmationModal from './ConfirmationModal';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';

const PUSH_TOUR_KEY = 'skillnix_tour_push_notifications_v1';
const PUSH_TOUR_STEPS = [
  {
    title: 'Push Notifications',
    body: 'Get browser alerts for interviews, mentions, and announcements — even when SkillNix is in another tab.',
  },
  {
    target: '[data-tour="push-device"]',
    title: 'This device',
    body: 'Enable once per browser. Your browser will ask for permission — allow it to receive alerts.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="push-alerts"]',
    title: 'What you’ll get',
    body: 'Interview reminders, @mentions, and org announcements land as desktop/browser notifications.',
    placement: 'left',
  },
];

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const ALERT_TYPES = [
  { icon: Calendar, title: 'Interview reminders', desc: 'Upcoming interviews on your calendar' },
  { icon: AtSign, title: '@mention alerts', desc: 'When someone tags you on a candidate' },
  { icon: Megaphone, title: 'Announcements', desc: 'Org-wide updates from your team' },
];

export default function PushNotificationsPage() {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(PUSH_TOUR_KEY);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [status, setStatus] = useState('idle');
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSupported('serviceWorker' in navigator && 'PushManager' in window);
      const res = await authenticatedFetch('/api/push/vapid-public');
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setConfigured(!!data.data?.configured);
      setPublicKey(data.data?.publicKey || '');
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setStatus(sub ? 'subscribed' : 'idle');
        } catch {
          setStatus('idle');
        }
      } else {
        setStatus('idle');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const subscribe = async () => {
    if (!supported) {
      toast.error('Push is not supported in this browser');
      return;
    }
    if (!configured || !publicKey) {
      toast.error('Push service is not ready on the server yet. Ask an admin to finish setup.');
      return;
    }
    try {
      setStatus('working');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission denied — allow alerts in your browser settings');
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }
      const json = sub.toJSON();
      const res = await authenticatedFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys || {},
          userAgent: navigator.userAgent
        })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      setStatus('subscribed');
      toast.success('Push notifications enabled on this device');
    } catch (e) {
      setStatus('idle');
      toast.error(e.message);
    }
  };

  const unsubscribe = async () => {
    setConfirmLoading(true);
    try {
      setStatus('working');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await authenticatedFetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setStatus('idle');
      setConfirmDisable(false);
      toast.success('Push disabled on this device');
    } catch (e) {
      toast.error(e.message);
      setStatus('idle');
    } finally {
      setConfirmLoading(false);
    }
  };

  const isOn = status === 'subscribed';
  const isWorking = status === 'working';

  return (
    <FeatureGate
      feature="push.notifications"
      fallback={
        <UpgradeFeatureFallback
          title="Push notifications are a Professional feature"
          description="Upgrade for browser alerts on interviews, mentions, and announcements."
        />
      }
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Bell}
          title="Push Notifications"
          subtitle="Browser alerts for interviews, mentions, and announcements."
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          One click enables alerts on this browser. Your browser will ask for permission — allow it, and you’re done.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-28 skeleton-ats rounded-2xl" />)}
            </div>
            <div className="lg:col-span-5 h-64 skeleton-ats rounded-2xl" />
          </div>
        ) : !supported ? (
          <div className="card-ats-bordered relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <EmptyState
              icon={BellOff}
              tone="amber"
              message="Push not supported here"
              subMessage="Open SkillNix in Chrome, Edge, or Firefox on desktop to enable browser alerts."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-7 min-w-0 space-y-4">
              <section
                data-tour="push-device"
                className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-4"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
                      <MonitorSmartphone className="w-4 h-4 text-brand-600 shrink-0" />
                      This device
                    </h2>
                    <p className="text-[12px] text-stone-500 mt-1 leading-relaxed">
                      Enable alerts in this browser. You can turn them off anytime.
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                    isOn
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                  }`}>
                    {isOn ? 'On' : 'Off'}
                  </span>
                </div>

                <div className={`relative rounded-2xl border px-3.5 py-3 text-sm flex items-start gap-2.5 ${
                  configured
                    ? 'border-emerald-100 bg-emerald-50/60'
                    : 'border-amber-100 bg-amber-50/60'
                }`}>
                  {configured ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className={`font-semibold ${configured ? 'text-emerald-900' : 'text-amber-900'}`}>
                      {configured ? 'Push service ready' : 'Push service not ready'}
                    </p>
                    <p className={`text-[12px] mt-0.5 leading-relaxed ${configured ? 'text-emerald-800/80' : 'text-amber-800/80'}`}>
                      {configured
                        ? 'This workspace can send browser alerts.'
                        : 'Server keys are being applied. If this persists after a refresh later today, ask an admin to restart the backend (Railway peak hours can delay this).'}
                    </p>
                  </div>
                </div>

                <div className="relative flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    className="btn-primary w-full sm:w-auto"
                    disabled={isWorking || isOn || !configured}
                    onClick={subscribe}
                  >
                    {isWorking && !isOn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                    {isOn ? 'Enabled on this device' : 'Enable push'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary w-full sm:w-auto"
                    disabled={isWorking || !isOn}
                    onClick={() => setConfirmDisable(true)}
                  >
                    <BellOff className="w-4 h-4" /> Disable
                  </button>
                </div>

                {isOn && (
                  <p className="relative text-[12px] text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    This device will receive push alerts.
                  </p>
                )}
              </section>

              <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <h2 className="relative text-[15px] font-bold text-stone-900 tracking-tight">How to turn on</h2>
                <ol className="relative space-y-2.5 text-[13px] text-stone-600 leading-relaxed">
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">1</span>
                    <span>Click <span className="font-semibold text-stone-800">Enable push</span>.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
                    <span>When your browser asks, choose <span className="font-semibold text-stone-800">Allow</span>.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">3</span>
                    <span>Keep this browser signed in to receive alerts.</span>
                  </li>
                </ol>
              </section>
            </div>

            <aside data-tour="push-alerts" className="lg:col-span-5 min-w-0 lg:sticky lg:top-4 space-y-4">
              <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
                  <Bell className="w-4 h-4 text-brand-600 shrink-0" />
                  What you’ll get
                </h2>
                <ul className="relative space-y-2.5">
                  {ALERT_TYPES.map(({ icon: Icon, title, desc }) => (
                    <li
                      key={title}
                      className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-white p-3"
                    >
                      <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-900">{title}</span>
                        <span className="block text-[12px] text-stone-500 mt-0.5 leading-relaxed">{desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <h2 className="relative text-[15px] font-bold text-stone-900 tracking-tight">Preview</h2>
                <div className="relative rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-bold text-stone-900 truncate">SkillNix</p>
                        <span className="text-[10px] text-stone-400 shrink-0">now</span>
                      </div>
                      <p className="text-[12px] text-stone-600 mt-0.5 leading-relaxed">
                        Interview in 30 min — Priya Sharma · Frontend Engineer
                      </p>
                    </div>
                  </div>
                </div>
                <p className="relative text-[11px] text-stone-400 leading-relaxed">
                  Example of how an alert may look on your desktop.
                </p>
              </div>
            </aside>
          </div>
        )}

        <ConfirmationModal
          isOpen={confirmDisable}
          onClose={() => setConfirmDisable(false)}
          onConfirm={unsubscribe}
          title="Disable push on this device?"
          message="You will stop receiving browser alerts here until you enable push again."
          confirmText="Disable push"
          type="warning"
          isLoading={confirmLoading}
        />

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Push Notifications" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={PUSH_TOUR_STEPS}
          storageKey={PUSH_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
