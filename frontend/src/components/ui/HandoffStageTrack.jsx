import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Handoff pipeline stage track — matches the reference board:
 * equal-width cards, Cleared / Current / Skipped states, mobile-safe scroll.
 */
export default function HandoffStageTrack({
  stages = [],
  kinds = [],
  interactive = false,
  disabled = false,
  onSelect,
  hint,
}) {
  if (!stages.length) return null;

  return (
    <div className="space-y-2">
      <div className="-mx-0.5 overflow-x-auto overscroll-x-contain scrollbar-thin">
        <ol className="flex w-max min-w-full gap-2.5 sm:gap-3 px-0.5 pb-0.5">
          {stages.map((stage, i) => {
            const kind = kinds[i] || 'empty';
            const StageIcon = stage.icon;
            const isCurrent = kind === 'current';
            const isDone = kind === 'done';
            const isSkipped = kind === 'skipped';
            const isEmpty = !isCurrent && !isDone && !isSkipped;
            // Cleared stages stay locked; empty + skipped remain movable when interactive
            const canMove = interactive && !isCurrent && !isDone && !disabled;

            let statusLabel = 'Move here';
            if (isCurrent) statusLabel = 'Current';
            else if (isDone) statusLabel = 'Cleared';
            else if (isSkipped) statusLabel = 'Skipped';

            const shellClass = cx(
              'relative flex w-full min-w-[9.5rem] sm:min-w-0 flex-1 items-center gap-3',
              'rounded-2xl border bg-white px-3.5 py-3 text-left',
              'transition-all duration-200',
              isCurrent && 'border-emerald-400 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-200/80',
              isDone && 'border-teal-200/90 bg-white',
              isSkipped && 'border-stone-200 bg-stone-50/90',
              isEmpty && 'border-dashed border-stone-300 bg-white hover:border-brand-300 hover:bg-brand-50/30',
              canMove && 'cursor-pointer',
              !canMove && 'cursor-default',
              disabled && canMove && 'pointer-events-none opacity-50'
            );

            const barClass = cx(
              'absolute inset-x-0 top-0 h-[3px] rounded-t-2xl',
              isCurrent && 'bg-emerald-500',
              isDone && 'bg-teal-500',
              isSkipped && 'bg-stone-300',
              isEmpty && 'bg-transparent'
            );

            const iconWrap = cx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
              isCurrent && 'border-emerald-200 bg-emerald-100 text-emerald-700',
              isDone && 'border-teal-200 bg-teal-50 text-teal-600',
              isSkipped && 'border-stone-200 bg-stone-100 text-stone-400',
              isEmpty && 'border-stone-200 bg-white text-stone-400'
            );

            const titleClass = cx(
              'block truncate text-[13px] font-semibold leading-tight tracking-tight',
              isCurrent && 'text-emerald-900',
              isDone && 'text-stone-800',
              isSkipped && 'text-stone-400',
              isEmpty && 'text-stone-600'
            );

            const statusClass = cx(
              'mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em]',
              isCurrent && 'text-emerald-600',
              isDone && 'text-teal-600',
              isSkipped && 'text-stone-400',
              isEmpty && 'text-stone-400'
            );

            const body = (
              <>
                <span className={barClass} aria-hidden="true" />
                <span className={iconWrap} aria-hidden="true">
                  {isDone || isCurrent ? (
                    <CheckCircle2 size={18} strokeWidth={2.25} />
                  ) : isSkipped ? (
                    <XCircle size={18} strokeWidth={2} />
                  ) : StageIcon ? (
                    <StageIcon size={16} strokeWidth={2.25} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={titleClass}>{stage.label}</span>
                  <span className={statusClass}>{statusLabel}</span>
                </span>
              </>
            );

            return (
              <li key={stage.id} className="flex min-w-[9.5rem] flex-1 sm:min-w-0">
                {canMove ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect?.(stage.id)}
                    className={shellClass}
                    title={`Move to ${stage.label}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div
                    className={shellClass}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {hint ? (
        <p className="px-0.5 text-[12px] font-medium text-stone-400">{hint}</p>
      ) : null}
    </div>
  );
}
