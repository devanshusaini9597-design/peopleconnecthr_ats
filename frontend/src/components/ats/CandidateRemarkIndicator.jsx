import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Info, MessageSquareText, X, ChevronDown, ChevronUp } from 'lucide-react';
import { capitalizeWords } from '../../utils/textFormatter';

const PANEL_W = 340;
const PREVIEW_BODY_MAX = 132;
const EXPANDED_BODY_MAX = 280;
const BODY_MIN_H = 28;

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

/** Drag-to-scroll surface — no visible scrollbar. */
function DragScroll({ height, children, className = '' }) {
  const ref = useRef(null);
  const drag = useRef({ active: false, startY: 0, startTop: 0, moved: false });

  const onPointerDown = (e) => {
    const el = ref.current;
    if (!el) return;
    drag.current = {
      active: true,
      startY: e.clientY,
      startTop: el.scrollTop,
      moved: false,
      pointerId: e.pointerId,
    };
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (e) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dy) > 3) drag.current.moved = true;
    el.scrollTop = drag.current.startTop - dy;
  };

  const endDrag = (e) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    drag.current.active = false;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ height }}
      className={`overflow-y-auto overscroll-contain touch-pan-y select-text cursor-grab active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {children}
    </div>
  );
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
  expanded = false,
  onToggleExpand,
  bodyMaxH,
}) {
  const displayName = formatPersonName(candidateName);
  const displayRemark = useMemo(() => formatRemarkDisplay(remark), [remark]);
  const body = displayRemark || emptyText || 'No notes yet';
  const measureRef = useRef(null);
  const [needsMore, setNeedsMore] = useState(false);
  const [naturalH, setNaturalH] = useState(BODY_MIN_H);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return undefined;
    const check = () => {
      const h = el.scrollHeight || BODY_MIN_H;
      setNaturalH(h);
      setNeedsMore(h > PREVIEW_BODY_MAX + 2);
    };
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [body, expanded]);

  // Cap with maxHeight (not fixed height) so short notes shrink to content.
  const cap = bodyMaxH ?? (expanded ? EXPANDED_BODY_MAX : PREVIEW_BODY_MAX);
  const useScroll = expanded && naturalH > EXPANDED_BODY_MAX;
  const bodyStyle = useScroll ? undefined : { maxHeight: cap };

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl shadow-stone-900/14 ring-1 ring-white/90">
      <div className="h-[3px] bg-gradient-to-r from-amber-400 via-brand-500 to-teal-500" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-stone-100 bg-amber-50/40">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 border border-amber-200/80">
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
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            aria-label="Close remark"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="px-4 pt-3.5 pb-2 bg-white">
        {useScroll ? (
          <DragScroll height={cap}>
            <blockquote className="pl-3.5 border-l-[3px] border-amber-300">
              <p
                ref={measureRef}
                className={`leading-[1.65] whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] ${
                  displayRemark ? 'text-stone-800 font-medium' : 'text-stone-500 italic'
                }`}
              >
                {body}
              </p>
            </blockquote>
          </DragScroll>
        ) : (
          <div className="overflow-hidden" style={bodyStyle}>
            <blockquote className="pl-3.5 border-l-[3px] border-amber-300">
              <p
                ref={measureRef}
                className={`leading-[1.65] whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] ${
                  displayRemark ? 'text-stone-800 font-medium' : 'text-stone-500 italic'
                }`}
              >
                {body}
              </p>
            </blockquote>
          </div>
        )}
      </div>

      {(needsMore || expanded) && typeof onToggleExpand === 'function' ? (
        <div className="px-3 pb-3 pt-1 border-t border-stone-100 bg-white">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpand();
            }}
            className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 hover:border-brand-200 transition-colors"
          >
            {expanded ? (
              <>
                Show less <ChevronUp size={14} />
              </>
            ) : (
              <>
                More… <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="h-2 bg-white" aria-hidden="true" />
      )}
    </div>
  );
}

function clampPanelPosition(anchorRect, panelW, panelH, preferAbove) {
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(panelW, vw - pad * 2);

  let left = anchorRect.left + anchorRect.width / 2 - width / 2;
  left = Math.min(Math.max(pad, left), vw - width - pad);

  const spaceBelow = vh - anchorRect.bottom - pad;
  const spaceAbove = anchorRect.top - pad;
  let above = preferAbove;
  if (preferAbove && spaceAbove < panelH && spaceBelow > spaceAbove) above = false;
  if (!preferAbove && spaceBelow < panelH && spaceAbove > spaceBelow) above = true;

  let top;
  if (above) {
    top = anchorRect.top - panelH - 12;
  } else {
    top = anchorRect.bottom + 12;
  }
  // Always keep fully on-screen
  top = Math.min(Math.max(pad, top), Math.max(pad, vh - panelH - pad));

  return { left, top, width, above };
}

function RemarkPanel({
  remark, candidateName, onClose, coords, isNarrow, showAbove, onHoverStart, onHoverEnd,
  title, subtitle, emptyText, locked, expanded, onToggleExpand, panelRef,
}) {
  const person = candidateName ? formatPersonName(candidateName) : 'Candidate';

  if (isNarrow) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-end justify-center bg-stone-900/50 backdrop-blur-sm p-0 sm:p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[min(88dvh,34rem)] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={`${title || 'Remark'} for ${person}`}
        >
          <div className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden">
            <span className="h-1 w-11 rounded-full bg-stone-300/80" aria-hidden="true" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <RemarkCard
              remark={remark}
              candidateName={candidateName}
              onClose={onClose}
              title={title}
              subtitle={subtitle}
              emptyText={emptyText}
              locked={locked}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              bodyMaxH={expanded
                ? Math.min(EXPANDED_BODY_MAX + 40, Math.round(window.innerHeight * 0.52))
                : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!coords) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-[9999] animate-fade-in"
      style={{
        left: coords.left,
        top: coords.top,
        width: coords.width || PANEL_W,
        maxWidth: 'min(92vw, 22rem)',
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
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}

/**
 * Info-icon popover for remarks / company notes (candidates table pattern).
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
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  const [badgeVisible, setBadgeVisible] = useState(Boolean(showBadge));
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const isNarrow = useIsNarrow();
  const hasContent = Boolean(text);

  useEffect(() => {
    setBadgeVisible(Boolean(showBadge));
  }, [showBadge]);

  const setPinnedState = useCallback((value) => {
    pinnedRef.current = Boolean(value);
    setPinned(Boolean(value));
  }, []);

  const close = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(false);
    setCoords(null);
    setShowAbove(false);
    setExpanded(false);
    setPinnedState(false);
  }, [setPinnedState]);

  const scheduleClose = useCallback(() => {
    if (pinnedRef.current) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => close(), 220);
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

  const placePanel = useCallback((preferAbove = false, isExpanded = false, bodyHint = PREVIEW_BODY_MAX) => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const bodyH = isExpanded ? Math.max(bodyHint, PREVIEW_BODY_MAX) : Math.min(Math.max(bodyHint, BODY_MIN_H), PREVIEW_BODY_MAX);
    const panelH = 64 + bodyH + 52;
    const pos = clampPanelPosition(rect, PANEL_W, panelH, preferAbove);
    setCoords({ left: pos.left, top: pos.top, width: pos.width });
    setShowAbove(pos.above);
  }, []);

  const openPanel = useCallback((fromClick = false) => {
    if (!hasContent && !alwaysShow) return;
    markOpened();
    if (fromClick) setPinnedState(true);
    setExpanded(false);
    if (isNarrow) {
      setOpen(true);
      return;
    }
    placePanel(false, false, BODY_MIN_H);
    setOpen(true);
  }, [hasContent, alwaysShow, isNarrow, markOpened, placePanel, setPinnedState]);

  const toggleExpand = useCallback(() => {
    cancelClose();
    setPinnedState(true);
    setExpanded((prev) => {
      const next = !prev;
      // Only reposition when expanding. Collapsing must not move the panel —
      // a jump under the cursor was closing the popover on Show less.
      if (next && !isNarrow) {
        requestAnimationFrame(() => placePanel(showAbove, true, EXPANDED_BODY_MAX));
      }
      return next;
    });
  }, [placePanel, showAbove, cancelClose, setPinnedState, isNarrow]);

  const toggle = useCallback((e) => {
    e.stopPropagation();
    if (open) close();
    else openPanel(true);
  }, [open, close, openPanel]);

  // Fine-tune once on open — do not re-run on expand/collapse (avoids jump-close on Show less)
  useEffect(() => {
    if (!open || isNarrow || !anchorRef.current) return undefined;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const h = panel.getBoundingClientRect().height || (64 + BODY_MIN_H + 52);
      const pos = clampPanelPosition(rect, PANEL_W, h, false);
      setCoords({ left: pos.left, top: pos.top, width: pos.width });
      setShowAbove(pos.above);
    });
    return () => cancelAnimationFrame(id);
  }, [open, isNarrow]);

  useEffect(() => {
    if (!open || isNarrow) return undefined;
    const onPointerDown = (e) => {
      if (anchorRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
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
          if (!isNarrow && !open) openPanel(false);
        }}
        onMouseLeave={() => {
          if (!isNarrow && !pinnedRef.current) scheduleClose();
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
          onHoverEnd={() => { if (!pinnedRef.current) scheduleClose(); }}
          title={title}
          subtitle={subtitle}
          emptyText={emptyText}
          locked={locked}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          panelRef={panelRef}
        />,
        document.body,
      )}
    </>
  );
}
