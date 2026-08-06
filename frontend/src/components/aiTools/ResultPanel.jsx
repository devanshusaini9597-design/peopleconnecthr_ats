import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (!text) return null;
  return (
    <button type="button" onClick={handleCopy} className="btn-secondary text-xs py-1.5 px-2.5 flex-shrink-0">
      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
    </button>
  );
};

export const ResultPanel = ({ label, children, copyText }) => (
  <div className="mt-4 card-ats-bordered p-4 sm:p-5 relative overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
    <div className="flex justify-between items-start gap-3 mb-3">
      {label && <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">{label}</p>}
      {copyText && <CopyButton text={copyText} />}
    </div>
    {children}
  </div>
);

export default ResultPanel;
