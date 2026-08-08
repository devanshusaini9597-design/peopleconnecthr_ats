import React from 'react';
import { Plus, Check, X, ClipboardList, Layers } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export function WorkflowsPanel({ workflows, onCreate }) {
  return (
    <section
      data-tour="appr-workflows"
      className="lg:col-span-6 card-ats-bordered relative overflow-hidden min-h-[20rem] flex flex-col"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Workflows</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {workflows.length} workflow{workflows.length === 1 ? '' : 's'}
          </p>
        </div>
        <span className="badge-neutral text-[10px] inline-flex items-center gap-1">
          <Layers className="w-3 h-3" /> Library
        </span>
      </div>
      <div className="relative flex-1 p-4 sm:p-5 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_40%)]">
        {workflows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            message="No workflows yet"
            subMessage="Create a workflow for job reqs or offers."
            tone="brand"
            compact
            action={(
              <button type="button" onClick={onCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> New workflow
              </button>
            )}
          />
        ) : (
          <ul className="space-y-2">
            {workflows.map((w) => (
              <li
                key={w._id}
                className="p-3.5 rounded-2xl border border-stone-200/80 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 text-sm truncate">{w.name}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5 capitalize">
                    {(w.entityType || '').replace(/_/g, ' ')} · {w.steps?.length || 0} steps
                  </p>
                </div>
                <span className={w.isActive ? 'badge-success self-start' : 'badge-neutral self-start'}>
                  {w.isActive ? 'Active' : 'Inactive'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function PendingApprovalsPanel({ pending, onAction }) {
  return (
    <section
      data-tour="appr-pending"
      className="lg:col-span-6 card-ats-bordered relative overflow-hidden min-h-[20rem] flex flex-col"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Pending approvals</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {pending.length} waiting
          </p>
        </div>
        <span className="badge-neutral text-[10px] inline-flex items-center gap-1">
          <Check className="w-3 h-3" /> Inbox
        </span>
      </div>
      <div className="relative flex-1 p-4 sm:p-5 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_40%)]">
        {pending.length === 0 ? (
          <EmptyState
            icon={Check}
            message="No pending approvals"
            subMessage="You're all caught up — nothing needs your review."
            tone="emerald"
            compact
          />
        ) : (
          <ul className="space-y-2.5">
            {pending.map((inst) => (
              <li key={inst._id} className="p-3.5 rounded-2xl border border-stone-200/80 bg-white space-y-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 text-sm truncate">
                    {inst.entityLabel || inst.entityType}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Step {(inst.currentStepIndex || 0) + 1} of {inst.steps?.length || 0}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => onAction({
                      id: inst._id,
                      action: 'approve',
                      label: inst.entityLabel || inst.entityType
                    })}
                    className="btn-primary !text-xs !py-2 w-full sm:w-auto"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction({
                      id: inst._id,
                      action: 'reject',
                      label: inst.entityLabel || inst.entityType
                    })}
                    className="btn-danger !text-xs !py-2 w-full sm:w-auto"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
