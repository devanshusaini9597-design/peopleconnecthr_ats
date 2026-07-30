import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { CheckSquare, Square, Edit, Trash2, Mail, FileText, MessageCircle } from 'lucide-react';

const VirtualizedCandidateTable = ({
  candidates,
  filteredCandidates,
  selectedIds,
  statusOptions,
  onEdit,
  onDelete,
  onSendEmail,
  onToggleSelection,
  onSelectAll,
  onStatusChange,
  onWhatsApp,
  isAllSelected,
  tableColumns
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {/* Table Header */}
          <thead>
            <tr className="bg-emerald-50 text-slate-700 border-b-2 border-emerald-100">
              <th className="p-4 w-[60px] text-center">
                <div 
                  onClick={() => onSelectAll(filteredCandidates.map(c => c._id))} 
                  className="cursor-pointer flex justify-center"
                >
                  {isAllSelected ? (
                    <CheckSquare size={20} className="text-indigo-600" />
                  ) : (
                    <Square size={20} className="text-slate-400" />
                  )}
                </div>
              </th>
              {tableColumns.map((column) => (
                <th
                  key={column.key}
                  className="p-4 font-bold text-sm whitespace-nowrap border-r border-emerald-100"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {filteredCandidates.length > 0 ? (
              filteredCandidates.map((candidate, index) => (
                <tr
                  key={candidate._id}
                  className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  {/* Checkbox */}
                  <td className="p-4 text-center w-[60px]">
                    <div
                      onClick={() => onToggleSelection(candidate._id)}
                      className="cursor-pointer flex justify-center"
                    >
                      {selectedIds.includes(candidate._id) ? (
                        <CheckSquare size={20} className="text-indigo-600" />
                      ) : (
                        <Square size={20} className="text-slate-300" />
                      )}
                    </div>
                  </td>

                  {/* Data Cells */}
                  {tableColumns.map((column) => (
                    <td
                      key={`${candidate._id}-${column.key}`}
                      className="p-4 text-sm border-r border-slate-200"
                    >
                      {column.render(candidate, index)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={tableColumns.length + 1}
                  className="p-8 text-center text-slate-500"
                >
                  <p className="text-lg font-semibold">No candidates found</p>
                  <p className="text-sm">Try adjusting your search or filter criteria</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VirtualizedCandidateTable;
