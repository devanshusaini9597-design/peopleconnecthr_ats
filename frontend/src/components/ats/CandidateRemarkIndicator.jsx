import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Info, MessageSquareText, X } from 'lucide-react';
import { capitalizeWords } from '../../utils/textFormatter';

const PANEL_W = 336;

function formatRemarkDisplay(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  const letters = value.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    const lower = value.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return value;
}

function formatPersonName(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  const letters = value.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 2 && letters === letters.toUpperCase()) {
    return capitalizeWords(value);
  }
  return value;
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

function RemarkCard({
  remark,
  candidateName,
  onClose,
  compact = false,
  title = 'Remark',
  subtitle = 'Internal recruiter note',
  emptyText = '',
  locked = false,
}) {
  const displayName = formatPersonName(candidateName);
  const displayRemark = useMemo(() => formatRemarkDisplay(remark), [remark]);
  const body = displayRemark || emptyText || 'No notes yet';

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl shadow-stone-900/14 ring-1 ring-white/90">
      <div className="h-[3px] bg-gradient-to-r from-amber-400 via-brand-500 to-teal-500" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-stone-100/90 bg-gradient-to-br from-amber-50/70 via-white to-brand-50/25">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 border border-amber-200/80 shadow-[0_4px_14px_-6px_rgba(217,119,6,0.35)] ring-1 ring-amber-100/70">
            <MessageSquareText size={16} strokeWidth={2.15} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800/80 inline-flex items-center gap-1">
              {title}
              {locked ? (
                <span className="normal-case tracking-normal text-[9px] font-semibold text-stone-500 bg-stone-100 border border-stone-200 rounded px-1 py-px">
                  Locked
                </span>
              ) : null}
            </p>
            {displayName ? (
              <p className="text-sm font-semibold text-stone-900 truncate leading-tight mt-0.5">{displayName}</p>
            ) : (
              <p className="text-sm font-semibold text-stone-900 leading-tight mt-0.5">Candidate note</p>
            )}
            {!compact && subtitle ? (
              <p className="text-[11px] text-stone-500 mt-0.5">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/80 text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            aria-label="Close remark"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
      <div className={`${compact ? 'px-4 py-3.5' : 'px-4 py-4'} bg-gradient-to-b from-white to-stone-50/50`}>
        <blockquote className="relative pl-3.5 border-l-[3px] border-amber-300/90">
          <p className={`leading-[1.7] whitespace-pre-wrap break-words ${compact ? 'text-[13px]' : 'text-[13.5px] font-medium'} ${displayRemark ? 'text-stone-800' : 'text-stone-500 italic'}`}>
            {body}
          </p>
        </blockquote>
      </div>
    </div>
  );
}

function RemarkPanel({
  remark, candidateName, onClose, coords, isNarrow, showAbove, onHoverStart, onHoverEnd,
  title, subtitle, emptyText, locked,
}) {
  const person = candidateName ? formatPersonName(candidateName) : 'Candidate';

  if (isNarrow) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-end justify-center bg-stone-900/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="w-full max-w-lg modal-panel-ats"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={`${title || 'Remark'} for ${person}`}
        >
          <div className="flex justify-center pt-3 pb-2">
            <span className="h-1 w-11 rounded-full bg-stone-300/80" aria-hidden="true" />
          </div>
          <RemarkCard
            remark={remark}
            candidateName={candidateName}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            emptyText={emptyText}
            locked={locked}
          />
        </div>
      </div>
    );
  }

  if (!coords) return null;

  return (
    <div
      className="fixed z-[9999] animate-fade-in"
      style={{
        left: coords.left,
        top: coords.top,
        width: PANEL_W,
        maxWidth: 'min(92vw, 21rem)',
        transform: showAbove ? 'translateY(calc(-100% - 12px))' : 'translateY(12px)',
      }}
      role="dialog"
      aria-label={`${title || 'Remark'} for ${person}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white border border-stone-200/80 shadow-[0_2px_6px_rgba(28,25,23,0.08)]"
        style={showAbove ? { bottom: -5 } : { top: -5 }}
        aria-hidden="true"
      />
      <RemarkCard
        remark={remark}
        candidateName={candidateName}
        compact
        title={title}
        subtitle={subtitle}
        emptyText={emptyText}
        locked={locked}
      />
    </div>
  );
}

/**
 * Info-icon popover for remarks / company notes (candidates table pattern).
 * alwaysShow: render even when empty (locked company notes on freelancer boards).
 * showBadge: unread red-dot (Facebook-style) until opened.
 */
export default function CandidateRemarkIndicator({
  remark,
  candidateName,
  alwaysShow = false,
  emptyText = 'No notes yet',
  title = 'Remark',
  subtitle = 'Internal recruiter note',
  locked = false,
  ariaLabel,
  showBadge = false,
  onOpen,
}) {
  const text = String(remark || '').trim();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [showAbove, setShowAbove] = useState(false);
  const [badgeVisible, setBadgeVisible] = useState(Boolean(showBadge));
  const anchorRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const isNarrow = useIsNarrow();
  const hasContent = Boolean(text);

  useEffect(() => {
    setBadgeVisible(Boolean(showBadge));
  }, [showBadge]);

  const close = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(false);
    setCoords(null);
    setShowAbove(false);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => close(), 180);
  }, [close]);

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const markOpened = useCallback(() => {
    if (badgeVisible) setBadgeVisible(false);
    onOpen?.();
  }, [badgeVisible, onOpen]);

  const openPanel = useCallback(() => {
    if (!hasContent && !alwaysShow) return;
    markOpened();
    if (isNarrow) {
      setOpen(true);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelH = 240;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - PANEL_W / 2),
      vw - PANEL_W - 12,
    );
    let top = rect.bottom;
    let above = false;
    if (top + panelH + 20 > vh - 12) {
      top = rect.top;
      above = true;
    }
    setCoords({ left, top });
    setShowAbove(above);
    setOpen(true);
  }, [hasContent, alwaysShow, isNarrow, markOpened]);

  const toggle = useCallback((e) => {
    e.stopPropagation();
    if (open) close();
    else openPanel();
  }, [open, close, openPanel]);

  useEffect(() => {
    if (!open || isNarrow) return undefined;
    const onPointerDown = (e) => {
      if (anchorRef.current?.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, isNarrow, close]);

  if (!hasContent && !alwaysShow) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        onMouseEnter={() => {
          cancelClose();
          if (!isNarrow && !open) openPanel();
        }}
        onMouseLeave={() => {
          if (!isNarrow) scheduleClose();
        }}
        className={[
          'relative h-7 w-7 inline-flex items-center justify-center rounded-lg border transition-all duration-200 flex-shrink-0',
          open
            ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-700 shadow-md shadow-amber-500/15 ring-2 ring-amber-200/60'
            : hasContent || badgeVisible
              ? 'border-amber-200/70 bg-gradient-to-br from-white to-amber-50/60 text-amber-600/90 shadow-sm shadow-amber-500/8 hover:border-amber-300 hover:text-amber-700 hover:shadow-md hover:shadow-amber-500/12 hover:-translate-y-px'
              : 'border-stone-200 bg-white text-stone-400 hover:border-stone-300 hover:text-stone-600 shadow-sm',
        ].join(' ')}
        title={ariaLabel || (locked ? 'Company notes (locked)' : 'View remark')}
        aria-expanded={open}
        aria-label={ariaLabel || (locked ? 'View company notes' : 'View candidate remark')}
      >
        <Info size={15} strokeWidth={2.25} aria-hidden="true" />
        {badgeVisible ? (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white shadow-sm"
            aria-hidden="true"
          />
        ) : null}
      </button>
      {open && createPortal(
        <RemarkPanel
          remark={text}
          candidateName={candidateName}
          onClose={close}
          coords={coords}
          isNarrow={isNarrow}
          showAbove={showAbove}
          onHoverStart={cancelClose}
          onHoverEnd={scheduleClose}
          title={title}
          subtitle={subtitle}
          emptyText={emptyText}
          locked={locked}
        />,
        document.body,
      )}
    </>
  );
}

