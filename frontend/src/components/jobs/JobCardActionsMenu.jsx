import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Unlock, PauseCircle, Lock, BookmarkPlus, Trash2, MoreHorizontal, ChevronRight,
  AlertTriangle, Sparkles,
} from 'lucide-react';

const MENU_W = 268;

function clampMenuPos(btn) {
  const rect = btn.getBoundingClientRect();
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(MENU_W, vw - pad * 2);
  const estimatedH = Math.min(400, vh - pad * 2);
  let left = rect.right - width;
  if (left < pad) left = pad;
  if (left + width > vw - pad) left = vw - pad - width;
  const spaceBelow = vh - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;
  const maxH = Math.max(160, openDown ? spaceBelow : spaceAbove);
  const top = openDown ? rect.bottom + 8 : Math.max(pad, rect.top - Math.min(estimatedH, maxH) - 8);
  return { top, left, width, maxH: Math.min(estimatedH, maxH) };
}

function ActionRow({ onClick, icon: Icon, iconClass, label, hint, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        'group/row w-full min-w-0 flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-all duration-200',
        danger
          ? 'text-red-600 hover:bg-red-50/90 hover:ring-1 hover:ring-red-100'
          : 'text-stone-800 hover:bg-stone-50 hover:ring-1 hover:ring-stone-200/80',
      ].join(' ')}
    >
      <span
        className={[
          'w-9 h-9 rounded-xl inline-flex items-center justify-center flex-shrink-0 border shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-transform duration-200 group-hover/row:scale-[1.04]',
          iconClass,
        ].join(' ')}
      >
        <Icon size={15} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-semibold leading-tight truncate ${danger ? 'text-red-600' : 'text-stone-800'}`}>
          {label}
        </span>
        {hint ? (
          <span className={`block text-[11px] font-medium leading-snug mt-0.5 truncate ${danger ? 'text-red-400' : 'text-stone-400'}`}>
            {hint}
          </span>
        ) : null}
      </span>
      <ChevronRight
        size={14}
        strokeWidth={2}
        className={`flex-shrink-0 opacity-0 -translate-x-1 transition-all duration-200 group-hover/row:opacity-60 group-hover/row:translate-x-0 ${
          danger ? 'text-red-400' : 'text-stone-400'
        }`}
      />
    </button>
  );
}

/**
 * Compact overflow menu — status + urgent + template + delete.
 * View / Edit / Share live on the card toolbar.
 */
export default function JobCardActionsMenu({
  open,
  onToggle,
  job,
  status,
  onMarkOpen,
  onHold,
  onClose,
  onSaveTemplate,
  onDelete,
  onToggleUrgent,
}) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: MENU_W, maxH: 280 });
  const isUrgent = String(job?.priority || '').toLowerCase() === 'urgent';

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

  const title = job.role || job.title || 'Opening';

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
        className="fixed z-[220] flex flex-col min-w-0 overflow-hidden rounded-2xl border border-stone-200/90 bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_-18px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-3.5 pt-3 pb-2.5 flex-shrink-0 min-w-0 overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-br from-brand-50/90 via-white to-teal-50/50 pointer-events-none"
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-500 via-teal-500 to-brand-400" aria-hidden />
          <div className="relative min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">More actions</p>
            <p className="text-[13px] font-bold text-stone-900 break-words leading-snug mt-1 truncate" title={title}>
              {title}
            </p>
            {status ? (
              <span className="mt-1.5 inline-flex items-center rounded-md border border-stone-200/90 bg-white/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                {status}
              </span>
            ) : null}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent flex-shrink-0" />

        <div className="p-1.5 space-y-0.5 overflow-y-auto overflow-x-hidden min-h-0 flex-1 overscroll-contain">
          {status !== 'Open' ? (
            <ActionRow
              onClick={onMarkOpen}
              icon={Unlock}
              iconClass="bg-emerald-50 text-emerald-700 border-emerald-100"
              label={status === 'Draft' ? 'Publish & open' : 'Mark as open'}
              hint={status === 'Draft' ? 'Make this role live' : 'Resume hiring'}
            />
          ) : null}

          {status !== 'On Hold' && status !== 'Closed' ? (
            <ActionRow
              onClick={onHold}
              icon={PauseCircle}
              iconClass="bg-amber-50 text-amber-700 border-amber-100"
              label="Put on hold"
              hint="Pause applications temporarily"
            />
          ) : null}

          {status !== 'Closed' ? (
            <ActionRow
              onClick={onClose}
              icon={Lock}
              iconClass="bg-stone-100 text-stone-600 border-stone-200"
              label="Close job"
              hint="Stop accepting candidates"
            />
          ) : null}

          {typeof onToggleUrgent === 'function' ? (
            <ActionRow
              onClick={onToggleUrgent}
              icon={isUrgent ? Sparkles : AlertTriangle}
              iconClass={isUrgent ? 'bg-stone-100 text-stone-600 border-stone-200' : 'bg-red-50 text-red-600 border-red-100'}
              label={isUrgent ? 'Clear urgent' : 'Mark as urgent'}
              hint={isUrgent ? 'Remove urgent hiring flag' : 'Highlight as urgent hiring'}
            />
          ) : null}

          <ActionRow
            onClick={onSaveTemplate}
            icon={BookmarkPlus}
            iconClass="bg-sky-50 text-sky-700 border-sky-100"
            label="Save as template"
            hint="Reuse for future openings"
          />
        </div>

        <div className="p-1.5 pt-1 border-t border-stone-100/90 bg-gradient-to-b from-stone-50/40 to-white flex-shrink-0">
          <ActionRow
            onClick={onDelete}
            icon={Trash2}
            iconClass="bg-red-50 text-red-600 border-red-100"
            label="Delete job"
            hint="Permanently remove this opening"
            danger
          />
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
        className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-all duration-200 flex-shrink-0 ${
          open
            ? 'border-brand-300 bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/10'
            : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:border-stone-300 hover:text-stone-700'
        }`}
      >
        <MoreHorizontal size={15} strokeWidth={2} />
      </button>
      {menu}
    </>
  );
}
