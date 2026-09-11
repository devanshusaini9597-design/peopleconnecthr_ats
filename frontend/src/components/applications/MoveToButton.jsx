import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, Check, ChevronDown } from 'lucide-react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Premium stage picker — portal menu, high z-index, never clipped by parent overflow.
 */
export default function MoveToButton({
  app,
  stages = [],
  onMove,
  label = 'Update stage',
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  const current = String(app?.stage || app?.status || '').toLowerCase();
  const currentStage = stages.find((s) => String(s.id).toLowerCase() === current);
  const options = stages.filter((s) => String(s.id).toLowerCase() !== current);

  const placeMenu = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const width = Math.min(300, Math.max(rect.width, 240));
    const pad = 12;
    let left = rect.left;
    if (left + width > window.innerWidth - pad) left = window.innerWidth - pad - width;
    if (left < pad) left = pad;

    const menuMax = 320;
    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(menuMax, openUp ? spaceAbove : spaceBelow);

    setMenuStyle({
      position: 'fixed',
      left,
      width,
      zIndex: 10000,
      maxHeight: Math.max(160, maxHeight),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    const onReposition = () => placeMenu();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!options.length) return null;

  const stopBubble = (e) => e.stopPropagation();

  const selectStage = (stageId) => {
    setOpen(false);
    const id = app?._id;
    if (id) onMove?.(id, stageId);
    else onMove?.(stageId);
  };

  return (
    <div
      className="relative min-w-0"
      onClick={stopBubble}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cx(
          'w-full inline-flex items-center justify-between gap-2 rounded-xl border transition-all shadow-sm',
          compact ? 'h-9 px-3' : 'h-11 px-3.5',
          open
            ? 'border-brand-400 bg-brand-50 text-brand-900 ring-2 ring-brand-100'
            : 'border-stone-200 bg-white text-stone-800 hover:border-brand-300 hover:shadow'
        )}
      >
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-3.5 h-3.5 text-brand-700" strokeWidth={2.25} />
          </span>
          <span className="text-[13px] font-semibold truncate">{label}</span>
        </span>
        <ChevronDown
          className={cx('w-4 h-4 shrink-0 text-stone-400 transition-transform', open && 'rotate-180')}
          strokeWidth={2.25}
        />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Select pipeline stage"
          style={menuStyle}
          className="rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/15 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Select review stage
            </p>
            {currentStage ? (
              <p className="text-[13px] text-stone-700 mt-1">
                Current:{' '}
                <span className="font-semibold text-stone-900">{currentStage.label}</span>
              </p>
            ) : null}
          </div>
          <div className="py-1.5 overflow-y-auto overscroll-contain" style={{ maxHeight: (menuStyle.maxHeight || 280) - 64 }}>
            {options.map((s) => {
              const Icon = s.icon;
              const tint = s.text || s.textColor || 'text-stone-500';
              const soft = s.soft || s.color || 'bg-stone-50';
              const border = s.border || s.borderColor || 'border-stone-200';
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectStage(s.id);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-brand-50/80 transition-colors"
                >
                  <span className={cx(
                    'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm',
                    soft, border, tint
                  )}
                  >
                    {Icon ? <Icon className="w-4 h-4" strokeWidth={2.25} /> : <Check size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-stone-900 truncate">{s.label}</span>
                    {s.hint ? (
                      <span className="block text-[11px] text-stone-500 truncate mt-0.5">{s.hint}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
