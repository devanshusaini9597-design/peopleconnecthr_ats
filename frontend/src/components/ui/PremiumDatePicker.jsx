import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toIso = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseIso = (value) => {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const formatDisplay = (value) => {
  const d = parseIso(value);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Enterprise date field — replaces native browser calendar with a branded popover.
 * value / onChange use ISO strings: YYYY-MM-DD
 */
export default function PremiumDatePicker({
  value = '',
  onChange,
  placeholder = 'Select date',
  disabled = false,
  allowClear = true,
  className = '',
  error = false,
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIso(value), [value]);
  const [view, setView] = useState(() => selected || new Date());
  const [menuStyle, setMenuStyle] = useState({});
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (open) setView(selected || new Date());
  }, [open, selected]);

  const updateMenuPosition = () => {
    const el = rootRef.current;
    const menu = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;

    // Fit width to viewport (full-bleed on small phones with side padding)
    const width = Math.min(Math.max(280, rect.width), vw - pad * 2);
    let left = rect.left + (rect.width - width) / 2; // center under trigger when narrower
    if (left + width > vw - pad) left = vw - pad - width;
    if (left < pad) left = pad;

    const measuredH = menu?.offsetHeight || 0;
    const estimatedH = measuredH > 0 ? measuredH : 340;
    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openUp = spaceBelow < Math.min(estimatedH, 300) && spaceAbove > spaceBelow;
    const available = Math.max(220, openUp ? spaceAbove - gap : spaceBelow - gap);
    const maxHeight = Math.min(380, available);

    setMenuStyle({
      position: 'fixed',
      left,
      width,
      zIndex: 230,
      maxHeight,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      ...(openUp
        ? { bottom: vh - rect.top + gap, top: 'auto' }
        : { top: rect.bottom + gap, bottom: 'auto' }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    // Re-measure after paint so real menu height is used
    const raf = requestAnimationFrame(() => updateMenuPosition());
    const onScroll = () => updateMenuPosition();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, view]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const startPad = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const cells = [];

    for (let i = 0; i < startPad; i += 1) {
      cells.push({ date: new Date(year, month - 1, prevMonthDays - startPad + 1 + i), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ date: new Date(year, month, d), outside: false });
    }
    let next = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ date: new Date(year, month + 1, next), outside: true });
      next += 1;
    }
    return cells;
  }, [view]);

  const monthLabel = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  const pick = (d) => {
    onChange?.(toIso(d));
    setOpen(false);
  };

  const clear = () => {
    onChange?.('');
    setOpen(false);
  };

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="dialog"
          aria-label="Choose date"
          style={menuStyle}
          className="rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10 animate-fade-in flex flex-col overflow-hidden"
        >
          <div className="px-3.5 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white flex items-center justify-between gap-2 flex-shrink-0">
            <p className="text-sm font-bold text-stone-900 tracking-tight truncate">{monthLabel}</p>
            <div className="inline-flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={15} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="px-3 pt-3 pb-2 min-h-0 overflow-y-auto overscroll-contain flex-1">
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {WEEKDAYS.map((d) => (
                <div key={d} className="h-7 text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map(({ date, outside }) => {
                const isSelected = sameDay(date, selected);
                const isToday = sameDay(date, today);
                return (
                  <button
                    key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                    type="button"
                    onClick={() => pick(date)}
                    className={[
                      'h-9 rounded-lg text-[13px] font-semibold transition-colors',
                      outside ? 'text-stone-300' : 'text-stone-700',
                      isSelected
                        ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-sm shadow-brand-500/25'
                        : isToday
                          ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
                          : 'hover:bg-stone-100',
                    ].join(' ')}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-3 py-2.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2 flex-shrink-0">
            {allowClear ? (
              <button
                type="button"
                onClick={clear}
                className="h-8 px-2.5 rounded-md text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-white transition-colors"
              >
                Clear
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="h-8 px-3 rounded-md text-xs font-semibold text-brand-700 bg-white border border-brand-200 hover:bg-brand-50 transition-colors"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        className={[
          'relative field-premium field-premium-icon w-full flex items-center gap-2 text-left',
          allowClear && value ? 'pr-10' : 'pr-9',
          error ? 'border-red-400 ring-2 ring-red-200' : open ? '!border-brand-500 !ring-2 !ring-brand-500/15 !bg-white' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${value ? 'text-stone-900' : 'text-stone-400'}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {!(allowClear && value) && (
          <ChevronRight
            size={14}
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-transform ${open ? 'rotate-90 text-brand-600' : ''}`}
          />
        )}
      </button>
      {allowClear && value ? (
        <button
          type="button"
          title="Clear date"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 z-[1]"
        >
          <X size={13} />
        </button>
      ) : null}
      {menu}
    </div>
  );
}
