/**
 * CandidateSelector Component
 * ============================
 * Searchable candidate dropdown — matches the style used in the Assessments page.
 * Gradient circle avatars, AnimatePresence animation, live search, CheckCircle
 * selected indicator, click-outside to close.
 */

'use client';

// ─── Section Start: Imports ──────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, CheckCircle } from 'lucide-react';
// ─── Section End: Imports ────────────────────────────────────────────────────

// ─── Section Start: Types ────────────────────────────────────────────────────
export interface SelectorCandidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
}

interface CandidateSelectorProps {
  /** Full list of candidates to search through */
  candidates: SelectorCandidate[];
  /** Currently selected candidate (null = none) */
  selected: SelectorCandidate | null;
  /** Called when user picks a candidate */
  onSelect: (candidate: SelectorCandidate) => void;
  /**
   * Which secondary field to show under the candidate name.
   * 'email' | 'phone' | 'position'. Defaults to 'email'.
   */
  subtitle?: 'email' | 'phone' | 'position';
  /** Placeholder text shown when nothing is selected. */
  placeholder?: string;
}
// ─── Section End: Types ──────────────────────────────────────────────────────

// ─── Section Start: Helper ───────────────────────────────────────────────────
function getSubLabel(c: SelectorCandidate, subtitle: 'email' | 'phone' | 'position'): string {
  if (subtitle === 'phone') return c.phone ?? c.email ?? '';
  if (subtitle === 'position') return c.position ?? c.email ?? '';
  return c.email ?? '';
}
// ─── Section End: Helper ─────────────────────────────────────────────────────

// ─── Section Start: Component ────────────────────────────────────────────────
export function CandidateSelector({
  candidates,
  selected,
  onSelect,
  subtitle = 'email',
  placeholder = 'Select a candidate...',
}: CandidateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Reset search when closing ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // ── Live filter ─────────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = q
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.position?.toLowerCase().includes(q),
      )
    : candidates;

  return (
    // ─── Section Start: Wrapper ─────────────────────────────────────────────
    <div ref={dropdownRef} className="relative">

      {/* ── Trigger Button ───────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl text-sm transition-all ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-stone-200 hover:border-stone-300'
        }`}
      >
        {selected ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {selected.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-stone-900 truncate text-sm">{selected.name}</p>
              <p className="text-xs text-stone-500 truncate">{getSubLabel(selected, subtitle)}</p>
            </div>
          </div>
        ) : (
          <span className="text-stone-400 text-sm">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-stone-400 transition-transform flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown Panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Search Input */}
            <div className="p-2.5 border-b border-stone-100 bg-stone-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Candidate List */}
            <div className="max-h-56 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-stone-400">
                    {search ? `No results for "${search}"` : 'No candidates found'}
                  </p>
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelect(c);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      selected?.id === c.id ? 'bg-brand-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900 truncate">{c.name}</p>
                      <p className="text-xs text-stone-500 truncate">{getSubLabel(c, subtitle)}</p>
                    </div>
                    {selected?.id === c.id && (
                      <CheckCircle className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    // ─── Section End: Wrapper ───────────────────────────────────────────────
  );
}
// ─── Section End: Component ──────────────────────────────────────────────────

export default CandidateSelector;
