import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * Premium searchable select — icon + label trigger, custom panel (no native OS blue chrome).
 * options: [{ value, label, description?, icon? }]
 */
export default function PremiumSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select…',
  icon: Icon,
  searchable = false,
  searchPlaceholder = 'Search…',
  disabled = false,
  className = '',
  emptyLabel = 'No options',
  allowClear = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label || ''} ${o.description || ''} ${o.searchText || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, searchable]);

  const pick = (next) => {
    onChange?.(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={[
          'w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200',
          'bg-stone-50 hover:bg-white focus:bg-white',
          open
            ? 'border-brand-400 ring-2 ring-brand-500/20 bg-white shadow-sm'
            : 'border-stone-200 hover:border-brand-300',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        {Icon && (
          <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            selected
              ? 'bg-gradient-to-br from-brand-500 to-teal-700 text-white shadow-sm shadow-brand-500/20'
              : 'bg-stone-100 text-stone-400'
          }`}>
            <Icon size={15} strokeWidth={2.25} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold truncate ${selected ? 'text-stone-900' : 'text-stone-400'}`}>
            {selected?.label || placeholder}
          </span>
          {selected?.description && (
            <span className="block text-[11px] text-stone-400 truncate font-medium">{selected.description}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand-600' : ''}`}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1.5 left-0 right-0 rounded-2xl border border-stone-200/90 bg-white shadow-xl shadow-stone-900/10 overflow-hidden animate-fade-in"
        >
          {searchable && (
            <div className="p-2 border-b border-stone-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white"
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1.5 scrollbar-thin">
            {allowClear && value && (
              <button
                type="button"
                role="option"
                onClick={() => pick('')}
                className="w-full text-left px-3 py-2 rounded-xl text-sm text-stone-500 hover:bg-stone-50 font-medium"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-stone-400 font-medium">{emptyLabel}</p>
            ) : (
              filtered.map((opt) => {
                const active = String(opt.value) === String(value);
                const OptIcon = opt.icon || Icon;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(opt.value)}
                    className={[
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors',
                      active ? 'bg-brand-50 text-brand-800' : 'hover:bg-stone-50 text-stone-800',
                    ].join(' ')}
                  >
                    {OptIcon && (
                      <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                        active ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500'
                      }`}>
                        <OptIcon size={13} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[11px] text-stone-400 truncate">{opt.description}</span>
                      )}
                    </span>
                    {active && <Check size={15} className="text-brand-600 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
