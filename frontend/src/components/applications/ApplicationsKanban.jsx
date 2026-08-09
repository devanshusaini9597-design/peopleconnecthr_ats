import React from 'react';
import { Star, Clock, Briefcase } from 'lucide-react';
import { STAGES, classNames, formatDate, jobTitle } from './constants';

export default function ApplicationsKanban({
  stageFilter,
  getAppsByStage,
  dragOverStage,
  draggedAppId,
  handleDragOver,
  handleDrop,
  handleDragStart,
  handleDragEnd,
  openPanel,
  handleRatingChange,
  selectedJob,
}) {
  const stages = stageFilter === 'all' ? STAGES : STAGES.filter((s) => s.id === stageFilter);

  return (
    <div className="h-full min-h-0 w-full overflow-x-auto overflow-y-hidden p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4 h-full items-stretch w-max pr-2">
        {stages.map((stage) => {
          const stageApps = getAppsByStage(stage.id);
          const isOver = dragOverStage === stage.id;
          return (
            <div
              key={stage.id}
              className={classNames(
                'w-[240px] sm:w-[260px] md:w-[280px] flex-shrink-0 flex flex-col h-full rounded-2xl border transition-all duration-200 bg-stone-50/80',
                isOver ? 'border-brand-400 bg-brand-50/40 shadow-inner ring-2 ring-brand-200/60' : 'border-stone-200/80'
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className={classNames('flex-shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2 rounded-t-2xl', stage.color, stage.borderColor)}>
                <div className="flex items-center gap-2 min-w-0">
                  <stage.icon className={classNames('w-4 h-4 flex-shrink-0', stage.textColor)} />
                  <h3 className={classNames('font-bold text-sm truncate', stage.textColor)}>{stage.label}</h3>
                </div>
                <span className={classNames('px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 shadow-sm border flex-shrink-0 tabular-nums', stage.textColor, stage.borderColor)}>
                  {stageApps.length}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 space-y-2 scrollbar-thin">
                {stageApps.map((app) => (
                  <div
                    key={app._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, app._id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openPanel(app)}
                    className={classNames(
                      'bg-white p-3 rounded-xl shadow-sm border border-stone-200/80 cursor-grab active:cursor-grabbing transition-all duration-200',
                      'hover:shadow-md hover:border-brand-300 hover:-translate-y-0.5 group',
                      draggedAppId === app._id ? 'opacity-40 ring-2 ring-brand-400' : ''
                    )}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(app.candidate?.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <h4 className="font-bold text-stone-900 text-sm truncate group-hover:text-brand-700 transition-colors">
                          {app.candidate?.name || 'Unknown'}
                        </h4>
                      </div>
                      {app.source && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-md flex-shrink-0 max-w-[72px] truncate">
                          {app.source}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-stone-500 mb-2.5 flex items-center gap-1.5 min-w-0">
                      <Briefcase className="w-3 h-3 text-stone-400 flex-shrink-0" />
                      <span className="truncate">{jobTitle(app.job) || jobTitle(selectedJob)}</span>
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
                  </div>
                ))}

                {stageApps.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center text-stone-400 text-xs font-medium">
                    Drop here
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
