import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

function splitTokens(raw) {
  return String(raw || '')
    .split(/[,;\n]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

export default function JobChipInput({
  values = [],
  onChange,
  suggestions = [],
  placeholder = 'TYPE AND PRESS ENTER',
  searchPlaceholder = 'Search…',
  required = false,
  allowCreate = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const selected = values.map((v) => String(v).toUpperCase());

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return (suggestions || [])
      .map((s) => String(s).toUpperCase())
      .filter((s) => s && !selected.includes(s) && (!q || s.includes(q)));
  }, [suggestions, selected, query]);

  const addMany = (rawParts) => {
    const next = [...selected];
    const seen = new Set(next);
    for (const part of rawParts) {
      const value = String(part || '').trim().toUpperCase();
      if (!value || seen.has(value)) continue;
      if (!allowCreate && suggestions.length && !suggestions.some((s) => String(s).toUpperCase() === value)) {
        continue;
      }
      seen.add(value);
      next.push(value);
    }
    onChange(next);
    setQuery('');
    inputRef.current?.focus();
  };

  const removeAt = (idx) => {
    onChange(selected.filter((_, i) => i !== idx));
    inputRef.current?.focus();
  };

  const updateMenuPosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const vv = window.visualViewport;
    const vw = vv?.width ?? window.innerWidth;
    const vh = vv?.height ?? window.innerHeight;
    const ox = vv?.offsetLeft ?? 0;
    const oy = vv?.offsetTop ?? 0;
    const spaceBelow = (oy + vh) - rect.bottom;
    const spaceAbove = rect.top - oy;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const width = Math.max(180, Math.min(rect.width, vw - pad * 2));
    let left = rect.left;
    if (left + width > ox + vw - pad) left = ox + vw - pad - width;
    if (left < ox + pad) left = ox + pad;
    const available = (openUp ? spaceAbove : spaceBelow) - 10;
    const maxHeight = Math.max(140, Math.min(280, available));
    setMenuStyle({
      position: 'fixed',
      left,
      width,
      zIndex: 320,
      maxHeight,
      boxSizing: 'border-box',
      overflow: 'hidden',
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onMove = () => updateMenuPosition();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, selected.length, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const exactMatch = filtered.find((item) => item === query.trim().toUpperCase());

  return (
    <div
      ref={rootRef}
      className="min-h-[42px] w-full min-w-0 max-w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex flex-wrap gap-1.5 items-center min-w-0">
        {selected.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1 max-w-full min-w-0 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-semibold uppercase bg-brand-50 text-brand-800 border border-brand-100"
          >
            <span className="truncate">{item}</span>
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={(e) => {
                e.stopPropagation();
                removeAt(idx);
              }}
              className="h-4 w-4 inline-flex items-center justify-center rounded text-brand-700 hover:bg-brand-100 flex-shrink-0"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          required={required && selected.length === 0}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[,;\n]/.test(text)) {
              e.preventDefault();
              addMany(splitTokens(text));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (exactMatch) addMany([exactMatch]);
              else if (allowCreate && query.trim()) addMany(splitTokens(query));
              else if (filtered[0]) addMany([filtered[0]]);
            } else if (e.key === 'Backspace' && !query && selected.length) {
              removeAt(selected.length - 1);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={selected.length ? '' : placeholder}
          className="chip-input-ats min-w-0 flex-1 basis-[6rem] text-sm font-medium uppercase outline-none bg-transparent py-0.5"
        />
      </div>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="rounded-lg border border-stone-200 bg-white shadow-lg shadow-stone-900/10 overflow-hidden flex flex-col"
        >
          <div className="px-2.5 py-2 border-b border-stone-100 bg-stone-50/80 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="w-full h-9 !pl-9 pr-2.5 rounded-md border border-stone-200 bg-white text-sm font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                className="w-full text-left px-3 py-1.5 text-[12px] font-semibold uppercase text-stone-700 hover:bg-brand-50 truncate"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addMany([item]);
                }}
              >
                {item}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-5 text-center text-sm text-stone-400">
                {query.trim() ? 'No matching locations' : 'No locations in the list — use Manage to add'}
              </p>
            )}
            {allowCreate && query.trim() && !selected.includes(query.trim().toUpperCase()) && !filtered.includes(query.trim().toUpperCase()) && (
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 truncate"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addMany([query]);
                }}
              >
                ADD “{query.trim().toUpperCase()}”
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
