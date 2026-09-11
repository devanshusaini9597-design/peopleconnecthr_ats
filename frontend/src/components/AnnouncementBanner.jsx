import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Info, CheckCircle2, AlertTriangle, Siren, ChevronDown, ChevronUp, Megaphone,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

const SEVERITY = {
  info: {
    icon: Info,
    wrap: 'bg-sky-50/90 border-sky-200/80 text-sky-950',
    iconWrap: 'bg-sky-100 text-sky-700',
    bar: 'bg-sky-500',
    chip: 'bg-sky-100 text-sky-800',
  },
  success: {
    icon: CheckCircle2,
    wrap: 'bg-emerald-50/90 border-emerald-200/80 text-emerald-950',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-800',
  },
  warning: {
    icon: AlertTriangle,
    wrap: 'bg-amber-50/90 border-amber-200/80 text-amber-950',
    iconWrap: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800',
  },
  critical: {
    icon: Siren,
    wrap: 'bg-red-50/90 border-red-200/80 text-red-950',
    iconWrap: 'bg-red-100 text-red-700',
    bar: 'bg-red-500',
    chip: 'bg-red-100 text-red-800',
  },
};

const SLIDE_MS = 12_000;
const SWIPE_PX = 48;
/** Soft preview when expanded — full text lives on Announcements page */
const EXPANDED_PREVIEW_CHARS = 320;

/**
 * In-app org announcements — compact enterprise strip.
 * Collapsed by default; expand for a short preview (no inner scrollbar).
 */
export default function AnnouncementBanner() {
  const { organization, user } = useAuth();
  const enabled = planHasFeature(organization?.plan, 'announcements');
  const [items, setItems] = useState([]);
  const [dismissing, setDismissing] = useState(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [slideKey, setSlideKey] = useState(0);
  const indexRef = useRef(0);
  const swipeRef = useRef(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/announcements');
      if (!res.ok) return;
      const data = await readApiJson(res);
      if (data.success) {
        const next = data.data || [];
        setItems(next);
        setIndex(0);
        indexRef.current = 0;
        setExpanded(false);
      }
    } catch {
      /* optional */
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener('announcements:refresh', onRefresh);
    return () => window.removeEventListener('announcements:refresh', onRefresh);
  }, [load]);

  const goTo = useCallback((nextIdx) => {
    if (!items.length) return;
    const n = ((nextIdx % items.length) + items.length) % items.length;
    indexRef.current = n;
    setIndex(n);
    setExpanded(false);
    setSlideKey((k) => k + 1);
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2 || hovered || expanded) return undefined;
    const timer = setInterval(() => {
      goTo(indexRef.current + 1);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [items.length, hovered, expanded, goTo]);

  const dismiss = async (id) => {
    setDismissing(id);
    try {
      await authenticatedFetch(`/api/announcements/${id}/dismiss`, { method: 'POST' });
      setItems((prev) => {
        const next = prev.filter((a) => a._id !== id);
        if (indexRef.current >= next.length) {
          indexRef.current = 0;
          setIndex(0);
        }
        setExpanded(false);
        return next;
      });
      window.dispatchEvent(new Event('announcements:changed'));
    } catch {
      /* ignore */
    } finally {
      setDismissing(null);
    }
  };

  const onPointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    swipeRef.current = { startX: e.clientX, pointerId: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerUp = (e) => {
    const d = swipeRef.current;
    swipeRef.current = null;
    try { e.currentTarget.releasePointerCapture?.(d?.pointerId); } catch { /* ignore */ }
    if (!d || items.length < 2) return;
    const dx = e.clientX - d.startX;
    if (dx <= -SWIPE_PX) goTo(indexRef.current + 1);
    else if (dx >= SWIPE_PX) goTo(indexRef.current - 1);
  };

  if (!enabled || items.length === 0) return null;

  const active = items[Math.min(index, items.length - 1)] || items[0];
  if (!active) return null;

  const meta = SEVERITY[active.severity] || SEVERITY.info;
  const Icon = meta.icon;
  const body = (active.body || '').trim();
  const hasBody = body.length > 0;
  const longBody = body.length > 90 || body.includes('\n');
  const previewBody = body.length > EXPANDED_PREVIEW_CHARS
    ? `${body.slice(0, EXPANDED_PREVIEW_CHARS).trimEnd()}…`
    : body;
  const truncatedPreview = body.length > EXPANDED_PREVIEW_CHARS;

  return (
    <div
      className="border-b border-stone-200/80 bg-white flex-shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-3 sm:px-4 lg:px-6 py-1.5">
        <div
          key={`${active._id}-${slideKey}`}
          className={`relative flex items-start gap-2.5 rounded-lg border ${meta.wrap} pl-3 pr-1.5 py-2 overflow-hidden ann-slide-in`}
          role="status"
          aria-live="polite"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${meta.bar}`} />

          <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${meta.iconWrap}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[13px] sm:text-sm font-semibold tracking-tight truncate">
                {active.title}
              </p>
              {items.length > 1 ? (
                <span className={`flex-shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${meta.chip}`}>
                  {Math.min(index, items.length - 1) + 1}/{items.length}
                </span>
              ) : null}
            </div>

            {hasBody && !expanded ? (
              <p className="text-[11px] sm:text-xs mt-0.5 leading-snug opacity-80 truncate">
                {body.replace(/\s+/g, ' ')}
              </p>
            ) : null}

            {hasBody && expanded ? (
              <div className="mt-1.5 space-y-1.5">
                <p className="text-[12px] sm:text-[13px] leading-relaxed opacity-90 whitespace-pre-wrap break-words">
                  {previewBody}
                </p>
                {truncatedPreview ? (
                  <Link
                    to="/announcements"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex text-[11px] font-semibold text-sky-800 hover:underline"
                  >
                    Read full notice
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0 -mt-0.5">
            {hasBody && (longBody || expanded) ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-white/70 transition-colors"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse announcement' : 'Expand announcement'}
              >
                {expanded ? (
                  <>
                    Less
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    More
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            ) : null}

            <Link
              to="/announcements"
              onClick={(e) => e.stopPropagation()}
              className="hidden sm:inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-white/70 transition-colors"
              title="Open Announcements"
            >
              <Megaphone className="w-3 h-3" />
              Open
            </Link>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(active._id);
              }}
              disabled={dismissing === active._id}
              className="p-1.5 rounded-md text-stone-500 hover:text-stone-800 hover:bg-white/80 flex-shrink-0 disabled:opacity-50"
              aria-label="Dismiss announcement"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ann-slide-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ann-slide-in {
          animation: ann-slide-in 0.28s ease-out;
        }
      `}</style>
    </div>
  );
}
