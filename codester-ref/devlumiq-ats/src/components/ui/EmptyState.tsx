'use client';

import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  /** Main message (e.g. "No record found.") */
  message: string;
  /** Optional secondary line */
  subMessage?: string;
  /** Optional icon; defaults to FileQuestion */
  icon?: React.ElementType;
  /** Extra class for the wrapper */
  className?: string;
}

export function EmptyState({ message, subMessage, icon: Icon = FileQuestion, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-stone-400" />
      </div>
      <p className="text-stone-600 font-semibold">{message}</p>
      {subMessage && <p className="text-sm text-stone-500 mt-1">{subMessage}</p>}
    </div>
  );
}
