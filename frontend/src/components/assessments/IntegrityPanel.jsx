import React, { useEffect, useState } from 'react';
import { Camera, Flag, Loader2, Monitor, Shield } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';

const LABELS = {
  start: 'Session started',
  submit: 'Submitted',
  tab_switch: 'Left the assessment tab',
  window_blur: 'Window lost focus',
  copy: 'Copied content',
  paste: 'Pasted content',
  fullscreen_exit: 'Exited full screen',
  snapshot: 'Webcam snapshot',
  camera_denied: 'Camera unavailable or blocked',
  context_menu: 'Opened context menu',
  print: 'Print attempt',
  devtools: 'Developer tools shortcut',
};

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function IntegrityPanel({ inviteId, live = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!inviteId) return undefined;
    let cancelled = false;
    const load = async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const res = await authenticatedFetch(`/api/assessments/invites/${inviteId}/integrity`);
        const json = await readApiJson(res);
        if (!res.ok || !json.success) throw new Error(json.message || 'Unable to load integrity report');
        if (!cancelled) {
          setData(json.data);
          setUpdatedAt(new Date());
          setError('');
        }
      } catch (err) {
        if (!cancelled && !silent) setError(err.message || 'Unable to load integrity report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load(false);
    if (!live) return () => { cancelled = true; };
    const timer = setInterval(() => load(true), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [inviteId, live]);

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 flex items-center justify-center gap-2 text-sm text-stone-500">
        <Loader2 size={16} className="animate-spin text-brand-600" /> Loading integrity report…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-amber-700">{error}</p>;
  }

  const p = data?.proctoring || {};
  const snapshots = data?.snapshots || [];
  const timeline = (data?.timeline || []).filter((row) => row.type !== 'snapshot' || row.skipped || row.type === 'camera_denied');

  return (
    <section className="rounded-xl border border-stone-200/90 bg-white overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="icon-box-ats !w-10 !h-10 !rounded-xl"><Shield strokeWidth={2.25} /></div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Integrity report</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Tab activity, copy/paste, and webcam captures from this attempt
              {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : ''}.
            </p>
          </div>
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            p.flagged || (p.riskScore || 0) > 0 ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}>
            <Flag size={12} /> Risk {p.riskScore || 0}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Tab switches', value: p.tabSwitchCount || 0 },
            { label: 'Focus lost', value: p.blurCount || 0 },
            { label: 'Copy / paste', value: p.copyPasteCount || 0 },
            { label: 'Webcam photos', value: snapshots.length || p.snapshotCount || 0 },
          ].map((item) => {
            const flagged = Number(item.value) > 0 && item.label !== 'Webcam photos';
            return (
            <div key={item.label} className={`rounded-xl border px-3 py-2.5 ${
              flagged ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-stone-50/80'
            }`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{item.label}</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${flagged ? 'text-amber-800' : 'text-stone-900'}`}>{item.value}</p>
            </div>
            );
          })}
        </div>

        {p.cameraDenied ? (
          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            The candidate did not provide a webcam feed. This is recorded on the attempt.
          </p>
        ) : null}

        {snapshots.length ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 inline-flex items-center gap-1.5">
              <Camera size={12} /> Webcam captures
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {snapshots.map((shot, index) => (
                <figure key={`${shot.at}-${index}`} className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                  <img src={shot.image} alt={`Webcam capture ${index + 1}`} className="w-full h-28 object-cover" />
                  <figcaption className="px-2 py-1 text-[10px] text-stone-500">
                    {formatWhen(shot.at)}{shot.stored ? ' · filed' : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-500">No webcam captures were stored for this attempt.</p>
        )}

        {timeline.length ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 inline-flex items-center gap-1.5">
              <Monitor size={12} /> Activity log
            </p>
            <ul className="max-h-48 overflow-y-auto divide-y divide-stone-100 rounded-xl border border-stone-200">
              {timeline.slice(-40).reverse().map((row, index) => (
                <li key={`${row.type}-${row.at}-${index}`} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-stone-800">{LABELS[row.type] || row.type}</span>
                  <span className="text-stone-400 tabular-nums whitespace-nowrap">{formatWhen(row.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-stone-500">No integrity events were recorded.</p>
        )}
      </div>
    </section>
  );
}
