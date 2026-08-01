import React from 'react';
import { FileQuestion } from 'lucide-react';

const EmptyState = ({ message, subMessage, icon: Icon = FileQuestion, action, className = '' }) => (
  <div
    className={`flex flex-col items-center justify-center py-12 sm:py-16 px-6 text-center animate-fade-in ${className}`}
    role="status"
    aria-label={message}
  >
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 border border-stone-200/80 flex items-center justify-center mb-4 shadow-sm">
      <Icon className="w-7 h-7 text-stone-400" strokeWidth={1.75} />
    </div>
    <p className="text-stone-800 font-bold tracking-tight">{message}</p>
    {subMessage && <p className="text-sm text-stone-500 mt-1.5 max-w-sm leading-relaxed">{subMessage}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
