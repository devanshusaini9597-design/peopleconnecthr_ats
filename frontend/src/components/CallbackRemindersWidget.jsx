import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Phone, Calendar, RefreshCw, ChevronRight, ArrowRight, Clock, Check, AlarmClock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import { BASE_API_URL } from '../config';
import EmptyState from './ui/EmptyState';
import { formatNotifDate, dueLabel, dueTone } from './notificationBell/notificationBellHelpers';

const SNOOZE_OPTIONS = [
  { days: 1, label: '+1 day' },
  { days: 3, label: '+3 days' },
  { days: 7, label: '+1 week' },
];

function iconTone(daysRemaining) {
  if (daysRemaining < 0) return 'from-rose-100 to-rose-50 text-rose-700 ring-rose-200/70';
  if (daysRemaining === 0) return 'from-amber-100 to-amber-50 text-amber-800 ring-amber-200/70';
  return 'from-brand-100 to-teal-100 text-brand-700 ring-brand-200/60';
}

/**
 * Callback queue — same card / list-row pattern as Recent Job Openings.
 */
const CallbackRemindersWidget = () => {
  const navigate = useNavigate();
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [snoozeOpenId, setSnoozeOpenId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [actionError, setActionError] = useState('');
  const menuRef = useRef(null);
  const snoozeBtnRefs = useRef({});

  const fetchCallbacks = useCallback(async ({ soft = false } = {}) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const res = await authenticatedFetch(`${BASE_API_URL}/api/notifications/upcoming-callbacks`);
      const data = await res.json();
      if (data.success) {
        setCallbacks(data.callbacks || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch callbacks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCallbacks();
    const interval = setInterval(() => fetchCallbacks({ soft: true }), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCallbacks]);

  const placeMenu = useCallback((id) => {
    const btn = snoozeBtnRefs.current[id];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const menuH = 168;
    const openUp = window.innerHeight - r.bottom < menuH + 12;
    setMenuPos({
      top: openUp ? r.top - menuH - 6 : r.bottom + 6,
      left: Math.min(r.right - 148, window.innerWidth - 160),
    });
  }, []);

  useEffect(() => {
    if (!snoozeOpenId) {
      setMenuPos(null);
      return undefined;
    }
    placeMenu(snoozeOpenId);
    const onDoc = (e) => {
      const btn = snoozeBtnRefs.current[snoozeOpenId];
      if (menuRef.current?.contains(e.target) || btn?.contains(e.target)) return;
      setSnoozeOpenId(null);
    };
    const onReposition = () => placeMenu(snoozeOpenId);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [snoozeOpenId, placeMenu]);

  const candidateKey = (cb) => String(cb.candidateId || cb._id);

  const openCandidate = (cb) => {
    navigate(cb.candidateName ? `/ats?q=${encodeURIComponent(cb.candidateName)}` : '/ats');
  };

  const markDone = async (cb) => {
    const id = candidateKey(cb);
    setActionError('');
    setBusyId(id);
    setSnoozeOpenId(null);
    try {
      const res = await authenticatedFetch(
        `${BASE_API_URL}/api/notifications/upcoming-callbacks/${id}/complete`,
        { method: 'PUT' }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not mark done');
      setCallbacks((prev) => prev.filter((row) => candidateKey(row) !== id));
      setTotalCount((n) => Math.max(0, n - 1));
    } catch (err) {
      setActionError(err.message || 'Could not mark done');
    } finally {
      setBusyId(null);
    }
  };

  const snooze = async (cb, days) => {
    const id = candidateKey(cb);
    setActionError('');
    setBusyId(id);
    setSnoozeOpenId(null);
    try {
      const res = await authenticatedFetch(
        `${BASE_API_URL}/api/notifications/upcoming-callbacks/${id}/snooze`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not snooze');
      await fetchCallbacks({ soft: true });
    } catch (err) {
      setActionError(err.message || 'Could not snooze');
    } finally {
      setBusyId(null);
    }
  };

  const summary = useMemo(() => ({
    missed: callbacks.filter((c) => c.daysRemaining < 0).length,
    today: callbacks.filter((c) => c.daysRemaining === 0).length,
  }), [callbacks]);

  const activeCb = snoozeOpenId
    ? callbacks.find((c) => candidateKey(c) === snoozeOpenId)
    : null;

  return (
    <div data-tour="dash-callbacks" className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      <div className="flex items-center justify-between mb-4 gap-3 min-w-0">
        <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2 min-w-0">
          <Clock size={16} className="text-brand-600 flex-shrink-0" />
          <span className="truncate">Callback Reminders</span>
          {summary.missed > 0 ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-100 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {summary.missed} overdue
            </span>
          ) : summary.today > 0 ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-100 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {summary.today} today
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => fetchCallbacks({ soft: true })}
            disabled={refreshing || loading}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh callbacks"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/ats')}
            className="text-brand-600 hover:text-brand-700 text-sm font-semibold flex items-center gap-1 transition-all hover:gap-1.5"
          >
            View All <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {actionError ? (
        <p className="mb-3 text-[11px] font-medium text-rose-600 bg-rose-50 ring-1 ring-rose-100 rounded-lg px-2.5 py-1.5">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 skeleton-ats rounded-xl" />
          ))}
        </div>
      ) : callbacks.length === 0 ? (
        <EmptyState
          icon={Phone}
          tone="brand"
          compact
          message="No upcoming callbacks"
          subMessage="Set a callback date on a candidate to get reminders."
        />
      ) : (
        <div className="space-y-0.5">
          {callbacks.slice(0, 6).map((cb) => {
            const days = cb.daysRemaining ?? 0;
            const due = dueLabel(cb);
            const phone = cb.candidateContact || '';
            const id = candidateKey(cb);
            const busy = busyId === id;
            const metaLine = [
              cb.candidatePosition,
              cb.callBackDate ? formatNotifDate(cb.callBackDate) : null,
              phone || null,
            ].filter(Boolean).join(' · ');

            return (
              <div
                key={id}
                className={`list-row-ats justify-between w-full min-w-0 gap-2 transition-all duration-200 hover:bg-brand-50/50 hover:pl-4 group/cb ${busy ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => openCandidate(cb)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 ring-1 transition-transform duration-300 group-hover/cb:scale-105 ${iconTone(days)}`}>
                    <Phone size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate uppercase group-hover/cb:text-brand-700 transition-colors">
                      {cb.candidateName || 'Unknown candidate'}
                    </p>
                    <p className="text-xs text-stone-500 truncate flex items-center gap-1 mt-0.5">
                      <Calendar size={11} className="flex-shrink-0" />
                      <span className="truncate">{metaLine || 'No details'}</span>
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                  {due && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ring-1 whitespace-nowrap ${dueTone(cb)}`}>
                      {due}
                    </span>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      title={`Call ${phone}`}
                      aria-label="Call"
                    >
                      <Phone size={13} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => markDone(cb)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                    title="Mark complete"
                    aria-label="Mark complete"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    ref={(el) => { snoozeBtnRefs.current[id] = el; }}
                    type="button"
                    onClick={() => setSnoozeOpenId((cur) => (cur === id ? null : id))}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-stone-200 bg-white text-stone-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    title="Snooze"
                    aria-label="Snooze"
                    aria-expanded={snoozeOpenId === id}
                  >
                    <AlarmClock size={14} />
                  </button>
                  <ChevronRight size={14} className="text-stone-300 opacity-0 group-hover/cb:opacity-100 transition-opacity hidden sm:block" />
                </div>
              </div>
            );
          })}

          {totalCount > 6 && (
            <button
              type="button"
              onClick={() => navigate('/ats')}
              className="w-full mt-1 py-2.5 text-center text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50/50 rounded-xl transition-colors"
            >
              + {totalCount - 6} more in ATS
            </button>
          )}
        </div>
      )}

      {snoozeOpenId && activeCb && menuPos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[80] min-w-[148px] rounded-xl border border-stone-200 bg-white shadow-xl py-1.5"
          style={{ top: menuPos.top, left: Math.max(8, menuPos.left) }}
        >
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            Snooze
          </p>
          {SNOOZE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => snooze(activeCb, opt.days)}
              className="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-800"
            >
              {opt.label}
            </button>
          ))}
          <div className="border-t border-stone-100 my-1" />
          <button
            type="button"
            onClick={() => {
              setSnoozeOpenId(null);
              openCandidate(activeCb);
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
          >
            Open in ATS <ChevronRight size={12} />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CallbackRemindersWidget;
