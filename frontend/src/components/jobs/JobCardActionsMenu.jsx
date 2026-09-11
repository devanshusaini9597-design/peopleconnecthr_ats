import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye, Unlock, PauseCircle, Lock, Globe2, BookmarkPlus, Trash2, Loader2, MoreHorizontal,
} from 'lucide-react';

const MENU_W = 260;

function clampMenuPos(btn) {
  const rect = btn.getBoundingClientRect();
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(MENU_W, vw - pad * 2);
  const estimatedH = Math.min(420, vh - pad * 2);
  let left = rect.right - width;
  if (left < pad) left = pad;
  if (left + width > vw - pad) left = vw - pad - width;
  const spaceBelow = vh - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openDown = spaceBelow >= 220 || spaceBelow >= spaceAbove;
  const maxH = Math.max(160, openDown ? spaceBelow : spaceAbove);
  const top = openDown ? rect.bottom + 6 : Math.max(pad, rect.top - Math.min(estimatedH, maxH) - 6);
  return { top, left, width, maxH: Math.min(estimatedH, maxH) };
}

/**
 * Premium overflow menu — portaled so it is never clipped by page overflow.
 */
export default function JobCardActionsMenu({
  open,
  onToggle,
  job,
  status,
  hasJobBoard,
  posting,
  onView,
  onMarkOpen,
  onHold,
  onClose,
  onPostBoard,
  onSaveTemplate,
  onDelete,
}) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: MENU_W, maxH: 360 });

  const place = () => {
    if (!btnRef.current) return;
    setPos(clampMenuPos(btnRef.current));
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onReposition = () => place();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    const onKey = (e) => {
      if (e.key === 'Escape') onToggle();
    };
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      onToggle();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onToggle]);

  if (!job) return null;

  const itemClass =
    'w-full min-w-0 flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold text-stone-700 hover:bg-stone-50 transition-colors text-left';

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
        className="fixed z-[220] flex flex-col min-w-0 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl shadow-stone-900/15 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2.5 border-b border-stone-100 bg-gradient-to-r from-stone-50/90 via-white to-teal-50/40 flex-shrink-0 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Job actions</p>
          <p className="text-[12px] font-semibold text-stone-800 break-words leading-snug mt-0.5">
            {job.role || job.title || 'Opening'}
          </p>
        </div>

        <div className="p-1.5 space-y-0.5 overflow-y-auto overflow-x-hidden min-h-0 flex-1 overscroll-contain">
          <button type="button" role="menuitem" onClick={onView} className={itemClass}>
            <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center flex-shrink-0">
              <Eye size={14} strokeWidth={2} />
            </span>
            <span className="min-w-0 truncate">View job</span>
          </button>

          {status !== 'Open' ? (
            <button type="button" role="menuitem" onClick={onMarkOpen} className={itemClass}>
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center justify-center flex-shrink-0">
                <Unlock size={14} strokeWidth={2} />
              </span>
              <span className="min-w-0 truncate">Mark Open</span>
            </button>
          ) : null}

          {status !== 'On Hold' && status !== 'Closed' ? (
            <button type="button" role="menuitem" onClick={onHold} className={itemClass}>
              <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center justify-center flex-shrink-0">
                <PauseCircle size={14} strokeWidth={2} />
              </span>
              <span className="min-w-0 truncate">Put on hold</span>
            </button>
          ) : null}

          {status !== 'Closed' ? (
            <button type="button" role="menuitem" onClick={onClose} className={itemClass}>
              <span className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 border border-stone-200 inline-flex items-center justify-center flex-shrink-0">
                <Lock size={14} strokeWidth={2} />
              </span>
              <span className="min-w-0 truncate">Close job</span>
            </button>
          ) : null}

          {hasJobBoard ? (
            <button
              type="button"
              role="menuitem"
              onClick={onPostBoard}
              disabled={posting}
              className={`${itemClass} disabled:opacity-50`}
            >
              <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 inline-flex items-center justify-center flex-shrink-0">
                {posting ? <Loader2 size={14} className="animate-spin" /> : <Globe2 size={14} strokeWidth={2} />}
              </span>
              <span className="min-w-0 truncate">Post to job board</span>
            </button>
          ) : null}

          <button type="button" role="menuitem" onClick={onSaveTemplate} className={`${itemClass} sm:hidden`}>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 inline-flex items-center justify-center flex-shrink-0">
              <BookmarkPlus size={14} strokeWidth={2} />
            </span>
            <span className="min-w-0 truncate">Save as template</span>
          </button>
        </div>

        <div className="p-1.5 pt-1 border-t border-stone-100 flex-shrink-0">
          <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            className="w-full min-w-0 flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-100 inline-flex items-center justify-center flex-shrink-0">
              <Trash2 size={14} strokeWidth={2} />
            </span>
            <span className="min-w-0 truncate">Delete job</span>
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="More job actions"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-colors flex-shrink-0 ${
          open
            ? 'border-brand-300 bg-brand-50 text-brand-700'
            : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:border-stone-300'
        }`}
      >
        <MoreHorizontal size={15} strokeWidth={2} />
      </button>
      {menu}
    </>
  );
}
