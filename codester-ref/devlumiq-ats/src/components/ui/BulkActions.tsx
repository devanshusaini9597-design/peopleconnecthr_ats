'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckSquare, Square, X, Trash2, ArrowRightLeft, 
  Mail, Download, MoreHorizontal, CheckCircle2
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onDelete: (ids: string[]) => Promise<void>;
  onStatusChange: (ids: string[], status: string) => Promise<void>;
  onExport: (ids: string[]) => void;
  onEmail: (ids: string[]) => void;
}

const STATUS_OPTIONS = [
  { value: 'Applied', label: 'Applied', color: 'bg-brand-100 text-brand-700' },
  { value: 'Screening', label: 'Screening', color: 'bg-warm-100 text-warm-700' },
  { value: 'Interview', label: 'Interview', color: 'bg-amber-100 text-amber-700' },
  { value: 'Offer', label: 'Offer', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'Hired', label: 'Hired', color: 'bg-green-100 text-green-700' },
  { value: 'Rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
];

export function BulkActionsBar({
  selectedIds,
  onClearSelection,
  onDelete,
  onStatusChange,
  onExport,
  onEmail,
}: BulkActionsBarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const toast = useToast();

  if (selectedIds.length === 0) return null;

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} candidate(s)?`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await onDelete(selectedIds);
      toast.success('Deleted', `Successfully deleted ${selectedIds.length} candidate(s)`);
      onClearSelection();
    } catch (error) {
      toast.error('Error', 'Failed to delete candidates');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setIsProcessing(true);
    setShowStatusMenu(false);
    try {
      await onStatusChange(selectedIds, status);
      toast.success('Status Updated', `Moved ${selectedIds.length} candidate(s) to ${status}`);
      onClearSelection();
    } catch (error) {
      toast.error('Error', 'Failed to update status');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl"
      >
        <div className="bg-stone-900 text-white rounded-2xl shadow-2xl shadow-stone-900/30 p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
          {/* Selection Count */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">{selectedIds.length} selected</p>
              <button
                onClick={onClearSelection}
                className="text-xs text-stone-400 hover:text-white transition-colors"
              >
                Clear selection
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-stone-700 hidden sm:block" />

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Status Change */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors font-medium text-sm"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Change Status
              </button>
              
              {showStatusMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-stone-200 py-2 min-w-[180px]">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status.value}
                      onClick={() => handleStatusChange(status.value)}
                      className="w-full text-left px-4 py-2.5 hover:bg-stone-50 flex items-center gap-2 text-stone-700"
                    >
                      <span className={`w-2 h-2 rounded-full ${status.color.split(' ')[0].replace('bg-', 'bg-').replace('100', '500')}`} />
                      {status.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email */}
            <button
              onClick={() => onEmail(selectedIds)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors font-medium text-sm"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </button>

            {/* Export */}
            <button
              onClick={() => onExport(selectedIds)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium text-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>

          {/* Close */}
          <button
            onClick={onClearSelection}
            className="p-2 rounded-xl hover:bg-stone-800 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface BulkSelectCheckboxProps {
  checked: boolean;
  onChange: () => void;
  indeterminate?: boolean;
}

export function BulkSelectCheckbox({ checked, onChange, indeterminate }: BulkSelectCheckboxProps) {
  return (
    <button
      onClick={onChange}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked || indeterminate
          ? 'bg-brand-500 border-brand-500'
          : 'border-stone-300 hover:border-brand-400'
      }`}
    >
      {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
      {indeterminate && <div className="w-2.5 h-0.5 bg-white rounded-full" />}
    </button>
  );
}
