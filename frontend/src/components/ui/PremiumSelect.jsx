import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, ChevronDown, Search } from 'lucide-react';
import PresenceAvatar from './PresenceAvatar';

/**
 * Premium searchable select — icon/avatar + label trigger, portal dropdown (works inside modals).
 * options: [{ value, label, description?, meta?, icon?, photo?, avatarName?, avatarEmail?, avatarKind?, flag? }]
 * flag: emoji string rendered in the leading badge (e.g. country flags)
 * compact: single-line trigger (no description under label)
 * variant "list": enterprise picklist — plain rows that match normal UI lists
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
  error = false,
  compact = false,
  id,
  /** Classic software picklist: plain text rows, no icon tiles */
  variant = 'default', // 'default' | 'list'
  /** Allow typing a value that is not in options (Add “VALUE”) */
  creatable = false,
  onCreate,
  createLabel,
  /** Keep the menu open and toggle values. `value` / `onChange` are arrays. */
  multiple = false,
  /** Server typeahead. Return option rows for the current query. */
  onSearch,
  minSearchChars = 0,
  /** Minimum dropdown width in px (useful in tight table cells) */
  menuMinWidth = 0,
}) {
  const isList = variant === 'list';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteOptions, setRemoteOptions] = useState(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const listId = useId();

  const selectedValues = useMemo(() => {
    if (multiple) {
      return (Array.isArray(value) ? value : (value ? [value] : []))
        .map((v) => String(v))
        .filter(Boolean);
    }
    if (value === '' && options.some((o) => o.value === '')) return [''];
    return value !== '' && value != null ? [String(value)] : [];
  }, [multiple, value, options]);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(selectedValues[0])),
    [options, selectedValues]
  );

  const displayLabel = useMemo(() => {
    if (!selectedValues.length) return '';
    const labels = selectedValues.map((v) => {
      const opt = options.find((o) => String(o.value) === String(v));
      return opt?.label || v;
    });
    return labels.join(', ');
  }, [options, selectedValues]);

  const optionHaystack = (o) =>
    `${o.label || ''} ${o.description || ''} ${o.meta || ''} ${o.searchText || ''}`.toLowerCase();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const matched = options.filter((o) => optionHaystack(o).includes(q));
    return matched.sort((a, b) => {
      const aName = `${a.description || ''} ${a.label || ''}`.toLowerCase();
      const bName = `${b.description || ''} ${b.label || ''}`.toLowerCase();
      const aStarts = aName.startsWith(q) || (a.description || '').toLowerCase().startsWith(q);
      const bStarts = bName.startsWith(q) || (b.description || '').toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });
  }, [options, query]);

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
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const floor = Math.max(120, Number(menuMinWidth) || (compact || isList ? 220 : 120));
    const width = Math.max(floor, Math.min(Math.max(rect.width, floor), vw - pad * 2));
    let left = rect.left;
    if (left + width > ox + vw - pad) left = ox + vw - pad - width;
    if (left < ox + pad) left = ox + pad;
    const available = (openUp ? spaceAbove : spaceBelow) - 10;
    const maxHeight = Math.max(120, Math.min(searchable ? 360 : 280, available));
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
    const onScroll = () => updateMenuPosition();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, compact, isList, searchable, menuMinWidth]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }

    const onPointerDown = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);

    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, searchable]);

  useEffect(() => {
    if (!open || !onSearch) {
      setRemoteOptions(null);
      setRemoteLoading(false);
      return undefined;
    }
    const q = query.trim();
    if (q.length < minSearchChars) {
      setRemoteOptions(null);
      setRemoteLoading(false);
      return undefined;
    }
    let cancelled = false;
    setRemoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await onSearchRef.current(q);
        if (!cancelled) setRemoteOptions(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setRemoteOptions([]);
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query, onSearch, minSearchChars]);

  const pick = (next) => {
    if (multiple) {
      const key = String(next);
      const exists = selectedValues.some((v) => String(v) === key);
      const updated = exists
        ? selectedValues.filter((v) => String(v) !== key)
        : [...selectedValues, key];
      onChange?.(updated);
      setQuery('');
      return;
    }
    onChange?.(next == null ? next : String(next));
    setOpen(false);
    setQuery('');
  };

  const hasPersonAvatar = (opt) => Boolean(
    opt && (opt.photo || opt.avatarUrl || opt.avatarName || opt.avatarEmail || opt.avatarKind)
  );

  const renderLeading = (opt, active = false, size = 32) => {
    if (!opt) return null;
    if (opt.avatarKind === 'org') {
      return (
        <span
          className={`flex-shrink-0 rounded-full flex items-center justify-center ring-2 ring-white ${
            active
              ? 'bg-gradient-to-br from-brand-500 to-teal-700 text-white shadow-sm shadow-brand-500/25'
              : 'bg-stone-100 text-stone-500'
          }`}
          style={{ width: size, height: size }}
        >
          <Building2 size={size >= 36 ? 16 : 14} strokeWidth={2.25} />
        </span>
      );
    }
    if (hasPersonAvatar(opt) || opt.photo || opt.avatarUrl) {
      return (
        <PresenceAvatar
          name={opt.avatarName || opt.label}
          email={opt.avatarEmail || opt.meta}
          photo={opt.photo || opt.avatarUrl}
          size={size}
          ringClass="ring-white"
        />
      );
    }
    if (opt?.flagSrc || opt?.flagIso) {
      const src = opt.flagSrc || `https://flagcdn.com/w40/${String(opt.flagIso).toLowerCase()}.png`;
      return (
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-stone-50 border border-stone-200/80 flex items-center justify-center overflow-hidden">
          <img src={src} alt="" className="w-5 h-3.5 object-cover rounded-[2px]" loading="lazy" />
        </span>
      );
    }
    if (opt?.flag) {
      return (
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-stone-50 border border-stone-200/80 flex items-center justify-center text-[1.15rem] leading-none">
          {opt.flag}
        </span>
      );
    }
    const OptIcon = opt?.icon || Icon;
    if (!OptIcon) return null;
    return (
      <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        active || (opt && String(opt.value) === String(value))
          ? 'bg-gradient-to-br from-brand-500 to-teal-700 text-white shadow-sm shadow-brand-500/20'
          : 'bg-stone-100 text-stone-400'
      }`}>
        <OptIcon size={15} strokeWidth={2.25} />
      </span>
    );
  };

  const realOptions = useMemo(
    () => options.filter((o) => o.value !== '' && o.value != null),
    [options]
  );

  const defaultListOptions = useMemo(
    () => options.filter((o) => o.value === '' || o.value == null),
    [options]
  );

  const listFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (onSearch && q.length >= minSearchChars) {
      const remote = (remoteOptions || []).filter((o) => o.value !== '' && o.value != null);
      const have = new Set(remote.map((o) => String(o.value)));
      const kept = realOptions.filter(
        (o) => selectedValues.includes(String(o.value)) && !have.has(String(o.value))
      );
      return [...kept, ...remote];
    }
    if (!isList) return filtered;
    const match = (rows) => (q ? rows.filter((o) => optionHaystack(o).includes(q)) : rows);
    return [...match(defaultListOptions), ...match(realOptions)];
  }, [isList, realOptions, defaultListOptions, filtered, query, onSearch, minSearchChars, remoteOptions, selectedValues]);

  const createQuery = query.trim();
  const canCreate = Boolean(
    creatable &&
    createQuery &&
    !realOptions.some((o) => String(o.label).toLowerCase() === createQuery.toLowerCase()
      || String(o.value).toLowerCase() === createQuery.toLowerCase())
  );

  const pickCreate = () => {
    const next = createQuery.toUpperCase();
    if (onCreate) onCreate(next);
    pick(next);
  };

  const richPeople = !isList && options.some((o) => hasPersonAvatar(o) || o.photo || o.avatarUrl || o.avatarKind);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          style={menuStyle}
          className="rounded-xl border border-stone-200/90 bg-white shadow-xl shadow-stone-900/12 overflow-hidden animate-fade-in flex flex-col ring-1 ring-black/[0.03]"
        >
          {searchable && (
            <div className="px-2.5 py-2 border-b border-stone-100 bg-gradient-to-b from-stone-50 to-white flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none z-[1]" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder={searchPlaceholder}
                  className="w-full h-9 !pl-9 pr-2.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                />
              </div>
              {minSearchChars > 0 && query.trim().length > 0 && query.trim().length < minSearchChars && (
                <p className="px-0.5 pt-1.5 text-[11px] text-stone-500 font-medium">
                  Type at least {minSearchChars} characters to search the full list
                </p>
              )}
              {remoteLoading && (
                <p className="px-0.5 pt-1.5 text-[11px] text-stone-400 font-medium">Searching…</p>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1.5 overscroll-contain premium-select-scroll">
            {allowClear && selectedValues.length > 0 && (
              <button
                type="button"
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange?.(multiple ? [] : '');
                  if (!multiple) {
                    setOpen(false);
                    setQuery('');
                  }
                }}
                className="w-full text-left px-3 py-2 text-[12px] font-semibold text-stone-400 hover:bg-stone-50 hover:text-stone-600"
              >
                Clear selection
              </button>
            )}
            {listFiltered.length === 0 && !canCreate ? (
              <p className="px-3 py-5 text-center text-sm text-stone-400">{emptyLabel}</p>
            ) : isList ? (
              <>
                {canCreate && (
                  <button
                    type="button"
                    role="option"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      pickCreate();
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    {createLabel ? createLabel(createQuery.toUpperCase()) : `Add “${createQuery.toUpperCase()}”`}
                  </button>
                )}
                {listFiltered.map((opt) => {
                  const active = selectedValues.some((v) => String(v) === String(opt.value));
                  return (
                    <button
                      key={`${String(opt.value)}-${opt.label}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        pick(opt.value);
                      }}
                      className={[
                        'flex items-start gap-2.5 mx-1 px-2.5 py-2 rounded-lg text-left text-[13px] transition-colors w-[calc(100%-0.5rem)]',
                        active
                          ? 'bg-brand-50 text-brand-900 font-semibold ring-1 ring-brand-100'
                          : 'text-stone-700 font-medium hover:bg-stone-50',
                      ].join(' ')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words whitespace-normal leading-snug">{opt.label}</span>
                        {opt.description ? (
                          <span className="block text-[11px] text-stone-500 break-words whitespace-normal font-normal mt-0.5 leading-snug">
                            {opt.description}
                          </span>
                        ) : null}
                      </span>
                      {active && <Check size={14} className="flex-shrink-0 text-brand-600 mt-0.5" strokeWidth={2.25} />}
                    </button>
                  );
                })}
              </>
            ) : (
              listFiltered.map((opt) => {
                const active = selectedValues.some((v) => String(v) === String(opt.value));
                const hasFlag = !!(opt.flagSrc || opt.flagIso || opt.flag);
                const person = hasPersonAvatar(opt) || opt.photo || opt.avatarUrl || opt.avatarKind;
                const hasIcon = !!(opt.icon || Icon) && !person && !hasFlag;
                return (
                  <button
                    key={`${String(opt.value)}-${opt.label}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      pick(opt.value);
                    }}
                    className={[
                      'flex items-center gap-2.5 mx-1 px-2.5 rounded-lg text-left text-[13px] transition-colors w-[calc(100%-0.5rem)]',
                      person ? 'py-2.5' : 'py-2',
                      active
                        ? 'bg-brand-50 text-brand-900 font-semibold ring-1 ring-brand-100'
                        : 'text-stone-700 font-medium hover:bg-stone-50',
                    ].join(' ')}
                  >
                    {person ? (
                      renderLeading(opt, active, 36)
                    ) : hasFlag ? (
                      opt.flagSrc || opt.flagIso ? (
                        <span className="flex-shrink-0 w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center overflow-hidden">
                          <img
                            src={opt.flagSrc || `https://flagcdn.com/w40/${String(opt.flagIso).toLowerCase()}.png`}
                            alt=""
                            className="w-5 h-3.5 object-cover rounded-[2px]"
                            loading="lazy"
                          />
                        </span>
                      ) : (
                        <span className="flex-shrink-0 w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center text-base leading-none">
                          {opt.flag}
                        </span>
                      )
                    ) : hasIcon ? (
                      <span className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
                        active ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {React.createElement(opt.icon || Icon, { size: 13, strokeWidth: 2 })}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block break-words whitespace-normal leading-snug">
                        {opt.label}
                        {hasFlag && opt.description ? (
                          <span className="font-medium text-stone-500"> · {opt.description}</span>
                        ) : null}
                      </span>
                      {!hasFlag && opt.description && (
                        <span className="block text-[11px] text-stone-500 break-words whitespace-normal font-normal mt-0.5 leading-snug">
                          {opt.description}
                        </span>
                      )}
                      {person && opt.meta ? (
                        <span className="block text-[10.5px] text-stone-400 break-words whitespace-normal font-normal mt-0.5 leading-snug">
                          {opt.meta}
                        </span>
                      ) : null}
                    </span>
                    {active && <Check size={14} className="text-brand-600 flex-shrink-0" strokeWidth={2.25} />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 w-full max-w-full ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        className={[
          'w-full min-w-0 max-w-full flex items-center text-left transition-all duration-200 border group/select',
          compact
            ? 'min-h-11 gap-1.5 rounded-lg px-2.5 py-1.5 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] hover:border-stone-300 hover:shadow-[0_2px_8px_rgba(28,25,23,0.06)]'
            : isList
              ? 'h-11 gap-2 rounded-lg px-3.5 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] hover:border-stone-300'
              : richPeople
                ? 'min-h-[48px] gap-2.5 rounded-xl px-3 py-2 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] hover:border-stone-300 hover:shadow-[0_2px_8px_rgba(28,25,23,0.06)]'
                : 'min-h-[42px] gap-2.5 rounded-xl px-3 py-2 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] hover:border-stone-300 hover:shadow-[0_2px_8px_rgba(28,25,23,0.06)]',
          error
            ? 'border-red-400 ring-2 ring-red-200'
            : open
              ? 'border-brand-500 ring-2 ring-brand-500/15 bg-white shadow-md shadow-brand-500/10'
              : 'border-stone-200/90',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        {!isList && !compact && renderLeading(
          selected || (richPeople ? { avatarKind: 'org', label: placeholder } : null),
          !!selected,
          richPeople ? 36 : 32
        )}
        {compact && Icon ? (
          <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${
            open || selected
              ? 'bg-brand-50 text-brand-700'
              : 'bg-stone-100 text-stone-400 group-hover/select:text-stone-500'
          }`}>
            <Icon size={11} strokeWidth={2.25} />
          </span>
        ) : null}
        <span className="min-w-0 flex-1 overflow-hidden" title={displayLabel || placeholder || ''}>
          <span className={`block break-words whitespace-normal leading-snug ${
            compact ? 'text-[12.5px] font-semibold tracking-tight line-clamp-2' : 'text-sm font-semibold line-clamp-2'
          } ${displayLabel ? 'text-stone-900' : 'text-stone-400'}`}>
            {displayLabel || placeholder}
          </span>
          {!isList && !compact && selected?.description && (
            <span className="block text-[11px] text-stone-500 break-words whitespace-normal font-medium mt-0.5 line-clamp-2">{selected.description}</span>
          )}
        </span>
        <ChevronDown
          size={compact ? 14 : 15}
          strokeWidth={2.25}
          className={`flex-shrink-0 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand-600' : 'group-hover/select:text-stone-500'}`}
        />
      </button>
      {menu}
    </div>
  );
}
