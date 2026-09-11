import React, { useRef } from 'react';
import { statusCardStyle } from '../dashboard/statusKpiMeta';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function useDragScroll() {
  const ref = useRef(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, textarea, [role="button"]')) return;
    const el = ref.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
      pointerId: e.pointerId,
    };
    try { el.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (e) => {
    if (!drag.current.active || !ref.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    if (drag.current.moved) {
      e.preventDefault();
      ref.current.scrollLeft = drag.current.scrollLeft - dx;
    }
  };

  const onPointerUp = (e) => {
    const wasDrag = drag.current.moved;
    drag.current.active = false;
    drag.current.moved = false;
    try { ref.current?.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    if (wasDrag && ref.current) {
      ref.current.dataset.suppressClick = '1';
      window.setTimeout(() => {
        if (ref.current) delete ref.current.dataset.suppressClick;
      }, 80);
    }
  };

  const guardClick = (e) => {
    if (ref.current?.dataset.suppressClick === '1') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp, guardClick };
}

/**
 * Horizontal drag-scroll pipeline strip with dashboard StatCard look/effects.
 */
export default function PipelineStageSummary({
  stages = [],
  getCount,
  counts,
  stageFilter = 'all',
  setStageFilter,
  total = 0,
  hint = 'Hiring pipeline',
  showHint = true,
  tourAttr = 'apps-stage-summary',
}) {
  const scroll = useDragScroll();

  if (!stages.length) return null;

  const resolveCount = (stage) => {
    if (typeof getCount === 'function') return Number(getCount(stage)) || 0;
    if (counts && typeof counts === 'object') {
      return Number(counts[stage.id] ?? counts[stage.key]) || 0;
    }
    return 0;
  };

  const activeLabel = stageFilter !== 'all'
    ? (stages.find((s) => String(s.id).toLowerCase() === String(stageFilter).toLowerCase())?.label || stageFilter)
    : null;

  return (
    <section data-tour={tourAttr} className="space-y-2 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-stone-500">Pipeline</p>
          {showHint ? (
            <p className="text-[12px] text-stone-500 mt-0.5 break-words">
              {activeLabel
                ? <>Stage · <span className="font-semibold text-stone-800">{activeLabel}</span></>
                : hint}
            </p>
          ) : activeLabel ? (
            <p className="text-[12px] text-stone-500 mt-0.5 break-words">
              Stage · <span className="font-semibold text-stone-800">{activeLabel}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center h-7 px-2.5 rounded-lg border border-stone-200 bg-stone-50 text-[11px] font-semibold text-stone-700 tabular-nums">
            {Number(total) || 0} candidates
          </span>
          {activeLabel ? (
            <button
              type="button"
              onClick={() => setStageFilter?.('all')}
              className="h-7 px-2.5 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scroll.ref}
        className="overflow-x-auto overscroll-x-contain select-none cursor-grab active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={scroll.onPointerDown}
        onPointerMove={scroll.onPointerMove}
        onPointerUp={scroll.onPointerUp}
        onPointerCancel={scroll.onPointerUp}
        onClickCapture={scroll.guardClick}
        role="list"
        aria-label="Pipeline stages"
      >
        <div className="flex gap-3 sm:gap-4 w-max min-w-full pb-0.5">
          {stages.map((stage, index) => {
            const id = stage.id || stage.key;
            const label = stage.label || id;
            const count = resolveCount(stage);
            const active = String(stageFilter).toLowerCase() === String(id).toLowerCase();
            const style = statusCardStyle(label, index);
            const Icon = stage.icon || style.icon;

            return (
              <button
                key={id}
                type="button"
                role="listitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setStageFilter?.(active ? 'all' : id);
                  window.requestAnimationFrame(() => {
                    document
                      .querySelector('[data-tour="freelance-review-boards"], [data-tour="freelancer-pipeline-boards"]')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }}
                className={cx(
                  'group relative flex-shrink-0 w-[168px] sm:w-[188px] text-left',
                  'card-ats-bordered px-4 py-4 min-h-[120px] flex flex-col justify-between overflow-hidden',
                  'transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 hover:border-transparent',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-[0.995]',
                  active && 'ring-2 ring-brand-400 ring-offset-2 border-transparent'
                )}
                title={label}
                aria-pressed={active}
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.gradient} transition-all duration-300 group-hover:h-1.5`} />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0) 40%, rgba(0,0,0,0.025))' }}
                />
                <div className="relative flex items-start justify-between gap-2 min-w-0 flex-1">
                  <div className="flex-1 min-w-0 pr-1 flex flex-col">
                    <p className="text-stone-500 text-[13px] font-medium leading-5 min-h-10 line-clamp-2 break-words">
                      {label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1.5 tabular-nums tracking-tight">
                      {count}
                    </p>
                    <div className="mt-2 min-h-[1.25rem]">
                      {active ? (
                        <p className="text-xs text-brand-600 font-semibold">Active filter</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-xl flex-shrink-0 bg-gradient-to-br ${style.gradient} shadow-md transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3`}>
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
