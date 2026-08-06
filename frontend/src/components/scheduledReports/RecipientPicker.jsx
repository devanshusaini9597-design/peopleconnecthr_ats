import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Mail, X, Users } from 'lucide-react';
import { EMAIL_RE } from './scheduledReportsConstants';

export default function RecipientPicker({ members, membersLoading, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = value || [];
  const available = useMemo(
    () => (members || []).filter((m) => {
      const email = (m.email || '').toLowerCase();
      return email && !selected.includes(email);
    }),
    [members, selected]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available
      .filter((m) => {
        if (!q) return true;
        const name = (m.name || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 10);
  }, [available, query]);

  const addEmail = (raw) => {
    const email = String(raw || '').trim().replace(/,$/, '').toLowerCase();
    if (!email || !EMAIL_RE.test(email) || selected.includes(email)) return false;
    onChange([...selected, email]);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
    return true;
  };

  const removeEmail = (email) => onChange(selected.filter((e) => e !== email));

  const memberFor = (email) =>
    (members || []).find((m) => (m.email || '').toLowerCase() === email);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const showMenu = open && (
    membersLoading
    || suggestions.length > 0
    || (query.trim() && EMAIL_RE.test(query.trim()))
    || (!membersLoading && available.length === 0 && !query.trim())
  );

  return (
    <div ref={wrapRef} className="relative space-y-2">
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.slice(0, 6).map((m) => (
            <button
              key={m._id || m.email}
              type="button"
              onClick={() => addEmail(m.email)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-colors"
            >
              <Users size={11} className="text-stone-400" />
              {m.name || m.email}
            </button>
          ))}
          {available.length > 6 && (
            <button
              type="button"
              onClick={() => { setOpen(true); inputRef.current?.focus(); }}
              className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-dashed border-stone-300 text-stone-500 hover:border-brand-300 hover:text-brand-700"
            >
              +{available.length - 6} more
            </button>
          )}
        </div>
      )}

      {/* Single border only on this shell — inner input must stay borderless */}
      <div
        className="min-h-[42px] flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white cursor-text transition-[border-color,box-shadow] focus-within:border-brand-400 focus-within:shadow-[0_0_0_3px_rgba(13,148,136,0.12)]"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((email) => {
          const m = memberFor(email);
          return (
            <span
              key={email}
              className="inline-flex items-center gap-1 max-w-[220px] bg-brand-50 text-brand-800 border border-brand-100 pl-2 pr-1 py-0.5 rounded-lg text-[12px] font-medium"
            >
              <span className="truncate">{m?.name || email}</span>
              {m?.name && (
                <span className="hidden sm:inline text-brand-500/80 font-normal truncate max-w-[100px]">
                  {email}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
                className="p-0.5 rounded-md hover:bg-brand-100 text-brand-600 flex-shrink-0"
                aria-label={`Remove ${email}`}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && query.trim()) {
              e.preventDefault();
              addEmail(query);
            } else if (e.key === 'Backspace' && !query && selected.length > 0) {
              removeEmail(selected[selected.length - 1]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={
            selected.length === 0
              ? (membersLoading ? 'Loading team…' : members.length > 0 ? 'Search teammates or type an email…' : 'Type an email and press Enter…')
              : 'Add another…'
          }
          className="chip-input-ats pl-0 flex-1 min-w-[140px] h-8 text-sm font-medium outline-none border-0 shadow-none ring-0 bg-transparent py-0 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          autoComplete="off"
        />
      </div>

      {showMenu && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {membersLoading && (
            <div className="px-3 py-3 text-sm text-stone-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading teammates…
            </div>
          )}
          {!membersLoading && suggestions.length === 0 && !query.trim() && (
            <div className="px-3 py-3 text-sm text-stone-500">
              No teammates found. Type an email and press Enter.
            </div>
          )}
          {suggestions.map((m) => {
            const email = (m.email || '').toLowerCase();
            const initials = (m.name || m.email || '?')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <button
                key={m._id || email}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addEmail(email); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800 truncate">{m.name || 'Teammate'}</p>
                  <p className="text-[11px] text-stone-400 truncate">{m.email}</p>
                </div>
                {m.role && (
                  <span className="text-[10px] font-semibold capitalize text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                    {m.role}
                  </span>
                )}
              </button>
            );
          })}
          {query.trim() && EMAIL_RE.test(query.trim()) && !selected.includes(query.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addEmail(query); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-brand-50/60 border-t border-stone-100"
            >
              <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center flex-shrink-0">
                <Mail size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800">Add external email</p>
                <p className="text-[11px] text-stone-400 truncate">{query.trim().toLowerCase()}</p>
              </div>
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-stone-400 leading-relaxed">
        Click a teammate chip above, search the dropdown, or type any external email and press Enter.
      </p>
    </div>
  );
}
