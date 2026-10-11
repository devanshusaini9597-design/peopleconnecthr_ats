import React from 'react';
import { ClipboardList, Copy, Pencil, Send, Shield, Trash2 } from 'lucide-react';
import { STATUS_BADGE, actionBtn } from './assessmentsConstants';
import { guardTableCopy } from '../../utils/tableCopyGuard';

export default function AssessmentLibraryTable({
  rows,
  tableScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
  onOpen,
  onEdit,
  onDuplicate,
  onInvite,
  onDelete,
}) {
  return (
    <div
      ref={tableScrollRef}
      className="cand-table-scroll overflow-x-auto select-none rounded-xl border border-stone-200"
      onCopy={guardTableCopy}
      onMouseDown={onTableDragScrollStart}
      onMouseMove={onTableDragScrollMove}
      onMouseUp={onTableDragScrollEnd}
      onMouseLeave={onTableDragScrollEnd}
    >
      <table className="cand-table-drag w-full text-left border-collapse min-w-[920px] select-none border border-stone-200">
        <thead>
          <tr className="bg-stone-100">
            {['Assessment', 'Status', 'Questions', 'Duration', 'Sent', 'Open', 'Done', 'Graded', 'Actions'].map((label) => (
              <th
                key={label}
                className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${
                  label === 'Actions' ? 'text-right' : ''
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a, rowIndex) => {
            const archived = a.isActive === false || a.status === 'archived';
            const status = archived ? 'archived' : (a.status || 'draft');
            return (
              <tr
                key={a._id}
                className={`transition-colors ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} hover:bg-brand-50/50`}
              >
                <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle min-w-[220px]">
                  <button type="button" onClick={() => onOpen(a)} className="text-left font-semibold text-stone-900 hover:text-brand-700">
                    <span className="inline-flex items-center gap-2">
                      {a.proctoring?.enabled ? <Shield className="w-3.5 h-3.5 text-brand-600" /> : <ClipboardList className="w-3.5 h-3.5 text-brand-600" />}
                      <span className="break-words">{a.title}</span>
                    </span>
                  </button>
                </td>
                <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                  <span className={STATUS_BADGE[status] || 'badge-neutral'}>{status}</span>
                </td>
                <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle tabular-nums">
                  {a.questions?.length || 0}
                </td>
                <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap">
                  {a.durationMinutes || 0} min
                </td>
                <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle tabular-nums">{a.inviteStats?.total || 0}</td>
                <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle tabular-nums">
                  {(a.inviteStats?.pending || 0) + (a.inviteStats?.in_progress || 0)}
                </td>
                <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle tabular-nums">{a.inviteStats?.submitted || 0}</td>
                <td className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle tabular-nums">{a.inviteStats?.graded || 0}</td>
                <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit ? (
                      <button type="button" onClick={() => onEdit(a)} className={actionBtn} title="Edit"><Pencil size={14} /></button>
                    ) : null}
                    {onDuplicate ? (
                      <button type="button" onClick={() => onDuplicate(a)} className={actionBtn} title="Duplicate"><Copy size={14} /></button>
                    ) : null}
                    {onInvite ? (
                      <button type="button" onClick={() => onInvite(a)} className={actionBtn} title="Invite"><Send size={14} /></button>
                    ) : null}
                    {onDelete ? (
                      <button type="button" onClick={() => onDelete(a)} className={`${actionBtn} text-stone-400 hover:text-red-600 hover:border-red-200`} title="Delete"><Trash2 size={14} /></button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
