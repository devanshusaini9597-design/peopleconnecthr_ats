import React from 'react';
import {
  ListChecks, GripVertical, Trash2, Plus, Briefcase, ExternalLink, Pencil, GitMerge, Loader2,
} from 'lucide-react';
import Modal from '../ui/Modal';

export default function OrgPipelineTab({
  org,
  dragIndex,
  setDragIndex,
  movePipelineStage,
  removePipelineStage,
  addPipelineStage,
  newStage,
  setNewStage,
  navigate,
  pipelineBusy,
  renameTarget,
  setRenameTarget,
  renameDraft,
  setRenameDraft,
  mergeTarget,
  setMergeTarget,
  mergePartner,
  setMergePartner,
  mergeName,
  setMergeName,
  openRenameStage,
  openMergeStage,
  handleRenamePipelineStage,
  handleMergePipelineStages,
}) {
  const stages = org.atsSettings.pipelineStages || [];
  const mergeOptions = stages.filter(
    (s) => mergeTarget && s.toLowerCase() !== mergeTarget.toLowerCase()
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h3 className="section-title-ats">
          <ListChecks className="w-4 h-4 text-brand-600" />
          Pipeline stages
        </h3>
        <p className="text-sm text-stone-500 -mt-2 mb-4">
          Drag to reorder. Edit renames a stage and keeps its stats. Merge combines two stages under a new name.
          Rejected stays on the list for reporting. Save reordering and new stages with the bar below.
        </p>

        <div className="bg-stone-50/80 rounded-2xl p-3 space-y-2 border border-stone-100 max-w-2xl">
          {stages.map((stage, i) => (
            <div
              key={`${stage}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                movePipelineStage(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200/80 shadow-sm group hover:border-brand-200 hover:shadow-md hover:bg-brand-50/30 transition-all duration-200 relative overflow-hidden cursor-grab active:cursor-grabbing ${
                dragIndex === i ? 'opacity-60 ring-2 ring-brand-300' : ''
              }`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-400 to-teal-600 opacity-70" />
              <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 border border-brand-100 tabular-nums">
                {i + 1}
              </span>
              <GripVertical className="w-4 h-4 text-stone-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
              <span className="flex-1 text-sm font-semibold text-stone-800 min-w-0 truncate">{stage}</span>
              <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                <button
                  type="button"
                  onClick={() => openRenameStage(stage)}
                  disabled={pipelineBusy}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-brand-700 hover:border-brand-200 disabled:opacity-50"
                  aria-label={`Edit ${stage}`}
                  title="Rename stage"
                >
                  <Pencil size={14} />
                </button>
                {stages.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => openMergeStage(stage)}
                    disabled={pipelineBusy}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-teal-700 hover:border-teal-200 disabled:opacity-50"
                    aria-label={`Merge ${stage}`}
                    title="Merge with another stage"
                  >
                    <GitMerge size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePipelineStage(i)}
                  disabled={pipelineBusy}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                  aria-label={`Remove ${stage}`}
                  title="Remove from list"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 mt-1">
            <input
              type="text"
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPipelineStage(); } }}
              placeholder="New stage name…"
              className="flex-1 input-ats bg-white"
            />
            <button type="button" onClick={addPipelineStage} className="btn-primary whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add stage
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden max-w-2xl">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-brand-600" />
            CV sources & master lists
          </h3>
          <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
            Sources, positions, clients, and similar lists are managed where you use them — open
            Candidates → Add Candidate → Manage. That keeps one source of truth (enterprise pattern).
          </p>
          <button
            type="button"
            onClick={() => navigate('/ats')}
            className="btn-secondary mt-4"
          >
            <ExternalLink className="w-4 h-4" />
            Open Candidates
          </button>
        </div>
      </div>

      <Modal
        open={!!renameTarget}
        onClose={() => !pipelineBusy && setRenameTarget(null)}
        title="Rename pipeline stage"
        description="Candidate counts stay with this stage — only the label changes."
        size="sm"
        icon={Pencil}
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRenameTarget(null)}
              disabled={pipelineBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRenamePipelineStage}
              disabled={pipelineBusy || !renameDraft.trim()}
            >
              {pipelineBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rename'}
            </button>
          </div>
        )}
      >
        <label className="block text-sm font-medium text-stone-700 mb-1.5" htmlFor="rename-stage-input">
          Stage name
        </label>
        <input
          id="rename-stage-input"
          type="text"
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenamePipelineStage(); } }}
          className="input-ats w-full"
          autoFocus
        />
      </Modal>

      <Modal
        open={!!mergeTarget}
        onClose={() => !pipelineBusy && setMergeTarget(null)}
        title="Merge pipeline stages"
        description="Combine two stages into one. All candidate and application counts are added together."
        size="sm"
        icon={GitMerge}
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMergeTarget(null)}
              disabled={pipelineBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleMergePipelineStages}
              disabled={pipelineBusy || !mergePartner || !mergeName.trim()}
            >
              {pipelineBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Merge stages'}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">First stage</p>
            <p className="text-sm font-semibold text-stone-900 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
              {mergeTarget}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5" htmlFor="merge-partner-select">
              Merge with
            </label>
            <select
              id="merge-partner-select"
              value={mergePartner}
              onChange={(e) => setMergePartner(e.target.value)}
              className="input-ats w-full"
            >
              <option value="">Select a stage…</option>
              {mergeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5" htmlFor="merge-name-input">
              New stage name
            </label>
            <input
              id="merge-name-input"
              type="text"
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMergePipelineStages(); } }}
              className="input-ats w-full"
              placeholder="Name for merged stage"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
