import React from 'react';
import { Star, Clock, Briefcase, GripVertical, Inbox } from 'lucide-react';
import { STAGES, classNames, formatDate, jobTitle } from './constants';
import MoveToButton from './MoveToButton';

function isTerminalStage(stage) {
  if (stage?.terminal) return true;
  return /reject|drop|declin/i.test(String(stage?.id || stage?.label || ''));
}

/**
 * Company pipeline board — column-centric (many cards per stage).
 * Visual language aligned with freelance boards; interaction stays fully editable.
 */
export default function ApplicationsKanban({
  stages: stagesProp,
  stageFilter,
  getAppsByStage,
  dragOverStage,
  draggedAppId,
  handleDragOver,
  handleDrop,
  handleDragStart,
  handleDragEnd,
  handleStageChange,
  openPanel,
  handleRatingChange,
  selectedJob,
}) {
  const allStages = stagesProp?.length ? stagesProp : STAGES;
  const stages = stageFilter === 'all'
    ? allStages
    : allStages.filter((s) => String(s.id).toLowerCase() === String(stageFilter).toLowerCase());

  return (
    <div className="h-full min-h-0 w-full overflow-x-auto overflow-y-hidden p-3 sm:p-4 bg-stone-50/30">
      <div className="flex gap-3 sm:gap-4 h-full items-stretch w-max pr-2">
        {stages.map((stage) => {
          const stageApps = getAppsByStage(stage.id);
          const isOver = dragOverStage === stage.id;
          const terminal = isTerminalStage(stage);
          const StageIcon = stage.icon || Inbox;

          return (
            <div
              key={stage.id}
              className={classNames(
                'w-[240px] sm:w-[260px] md:w-[280px] flex-shrink-0 flex flex-col h-full rounded-xl border bg-white transition-all duration-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                isOver
                  ? 'border-brand-400 bg-brand-50/40 shadow-inner ring-2 ring-brand-200/60 scale-[1.01]'
                  : 'border-stone-200/80'
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className={classNames(
                'flex-shrink-0 px-2.5 py-1.5 border-b flex items-center gap-1.5 rounded-t-xl',
                stage.color || 'bg-stone-50',
                stage.borderColor || 'border-stone-100'
              )}
              >
                <span className={classNames(
                  'w-6 h-6 rounded-md border bg-white flex items-center justify-center shrink-0',
                  stage.borderColor || 'border-stone-200',
                  stage.textColor || 'text-stone-500'
                )}
                >
                  <StageIcon className="w-3 h-3" strokeWidth={2.25} />
                </span>
                <h3 className={classNames(
                  'font-semibold text-[11px] tracking-wide truncate flex-1 min-w-0',
                  stage.textColor || 'text-stone-700'
                )}
                >
                  {stage.label}
                </h3>
                <span className={classNames(
                  'px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-white/95 shadow-sm border flex-shrink-0 tabular-nums',
                  stage.textColor || 'text-stone-600',
                  stage.borderColor || 'border-stone-200'
                )}
                >
                  {stageApps.length}
                </span>
                {terminal ? (
                  <span className="text-[8px] font-bold uppercase tracking-wide text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded shrink-0">
                    Terminal
                  </span>
                ) : null}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 space-y-2.5 scrollbar-thin bg-stone-50/40">
                {stageApps.map((app) => {
                  const name = app.candidate?.name || 'Unknown';
                  const mandate = jobTitle(app.job) || jobTitle(selectedJob) || 'Open role';
                  return (
                    <div
                      key={app._id}
                      draggable
                      onDragStart={(e) => {
                        if (e.target.closest('button, [role="listbox"]')) {
                          e.preventDefault();
                          return;
                        }
                        handleDragStart(e, app._id);
                      }}
                      onDragEnd={handleDragEnd}
                      onClick={() => openPanel(app)}
                      className={classNames(
                        'group/card bg-white rounded-xl border border-stone-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-200',
                        'hover:shadow-md hover:border-brand-300 hover:-translate-y-0.5',
                        draggedAppId === app._id ? 'opacity-40 ring-2 ring-brand-400' : ''
                      )}
                    >
                      <div className={classNames('h-1 w-full', stage.bar || 'bg-brand-500')} />
                      <div className="p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-stone-300 group-hover/card:text-brand-500 shrink-0">
                            <GripVertical size={14} strokeWidth={2.25} />
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm shadow-brand-500/20">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-stone-900 text-[13px] truncate group-hover/card:text-brand-700 transition-colors">
                              {name}
                            </h4>
                            <p className="text-[11px] text-stone-500 truncate mt-0.5 flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-brand-600 shrink-0" strokeWidth={2.25} />
                              <span className="truncate">{mandate}</span>
                            </p>
                          </div>
                          {app.source ? (
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-stone-50 text-stone-500 border border-stone-200 rounded-md flex-shrink-0 max-w-[72px] truncate">
                              {app.source}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                aria-label={`Rate ${star}`}
                                onClick={() => handleRatingChange(app._id, star)}
                                className="p-0.5"
                              >
                                <Star
                                  className={classNames(
                                    'w-3.5 h-3.5 transition-colors',
                                    star <= (app.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300 hover:text-amber-200'
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-stone-400 font-medium min-w-0">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{formatDate(app.createdAt || app.appliedAt)}</span>
                          </div>
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                          <MoveToButton app={app} stages={allStages} onMove={handleStageChange} compact />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {stageApps.length === 0 && (
                  <div className={classNames(
                    'min-h-[88px] border border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 px-3 text-center',
                    isOver
                      ? 'border-brand-400 bg-brand-50/70 text-brand-700'
                      : 'border-brand-200 bg-brand-50/40 text-brand-700'
                  )}
                  >
                    <span className="w-8 h-8 rounded-lg border border-brand-200 bg-white flex items-center justify-center shadow-sm text-brand-600">
                      <StageIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-wide">Place here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
