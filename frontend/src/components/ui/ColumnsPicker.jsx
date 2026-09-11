import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns3, Check } from 'lucide-react';

/**
 * Premium Columns picker — portal dropdown so it never clips inside overflow:hidden cards.
 * columns: [{ id, label, locked? }]
 */
export default function ColumnsPicker({
  columns = [],
  visibleIds = [],
  onChange,
  onSelectAll,
  onClearAll,
  onReset,
  buttonClassName = '',
  menuWidth = 288,
  'data-tour': dataTour,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const placeMenu = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = menuWidth;
    const pad = 8;
    const maxH = Math.min(360, Math.max(200, window.innerHeight - 24));
    let left = rect.right - width;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const height = Math.min(maxH, openUp ? spaceAbove : spaceBelow);

    if (openUp) {
      setMenuStyle({
        position: 'fixed',
        left,
        width,
        bottom: window.innerHeight - rect.top + 6,
        maxHeight: height,
        zIndex: 80,
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        left,
        width,
        top: rect.bottom + 6,
        maxHeight: height,
        zIndex: 80,
      });
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    const onWin = () => placeMenu();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, columns.length, menuWidth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = (id) => {
    const col = columns.find((c) => c.id === id);
    if (col?.locked) return;
    if (visibleIds.includes(id)) {
      if (visibleIds.length <= 2) return;
      onChange(visibleIds.filter((x) => x !== id));
    } else {
      onChange([...visibleIds, id]);
    }
  };

  return (
    <div className="relative shrink-0" data-tour={dataTour}>
      <button
        ref={btnRef}
        type="button"
        className={
          buttonClassName ||
          'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50 sm:flex-none'
        }
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Columns3 size={15} strokeWidth={1.75} />
        Columns
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[79] cursor-default"
              aria-label="Close columns"
              onClick={() => setOpen(false)}
            />
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10"
            >
              <div className="border-b border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Show fields</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {onSelectAll ? (
                    <button
                      type="button"
                      onClick={onSelectAll}
                      className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                    >
                      Select all
                    </button>
                  ) : null}
                  {onClearAll ? (
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                    >
                      Uncheck all
                    </button>
                  ) : null}
                  {onReset ? (
                    <button
                      type="button"
                      onClick={onReset}
                      className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
              <ul className="overflow-y-auto py-1 premium-select-scroll" style={{ maxHeight: (menuStyle.maxHeight || 320) - 72 }}>
                {columns.map((col) => {
                  const on = visibleIds.includes(col.id);
                  return (
                    <li key={col.id}>
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={on}
                        disabled={col.locked && on}
                        onClick={() => toggle(col.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-stone-50 disabled:opacity-60"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            on
                              ? 'border-brand-500 bg-brand-500 text-white'
                              : 'border-stone-300 bg-white text-transparent'
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-stone-800">{col.label}</span>
                        {col.locked ? (
                          <span className="shrink-0 text-[10px] font-semibold uppercase text-stone-400">
                            Required
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
