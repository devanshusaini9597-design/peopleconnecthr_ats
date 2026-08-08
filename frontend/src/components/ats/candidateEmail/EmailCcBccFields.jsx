import React from 'react';
import { X } from 'lucide-react';

export default function EmailCcBccFields({
  emailCC, setEmailCC, emailBCC, setEmailBCC,
  teamMembers, ccInput, setCcInput, bccInput, setBccInput,
  showCCPicker, setShowCCPicker, showBCCPicker, setShowBCCPicker,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" onClick={e => e.stopPropagation()}>
      {/* CC Field */}
      <div className="relative">
        <label className="block text-[10px] font-semibold text-stone-500 mb-1">CC (Optional)</label>
        <div className="min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1.5 border border-stone-200 rounded-lg focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 bg-white cursor-text"
          onClick={() => document.getElementById('cc-input')?.focus()}>
          {emailCC.map((email, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-medium max-w-[180px]">
              <span className="truncate">{teamMembers.find(m => m.email === email)?.name || email}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setEmailCC(prev => prev.filter((_, idx) => idx !== i)); }}
                className="hover:bg-brand-200 rounded p-0.5 flex-shrink-0"><X size={10} /></button>
            </span>
          ))}
          <input id="cc-input" type="text" value={ccInput}
            onChange={(e) => { setCcInput(e.target.value); setShowCCPicker(true); setShowBCCPicker(false); }}
            onFocus={() => { if (ccInput || teamMembers.length > 0) setShowCCPicker(true); setShowBCCPicker(false); }}
            onBlur={() => setTimeout(() => setShowCCPicker(false), 200)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && ccInput.trim()) {
                e.preventDefault();
                const email = ccInput.trim().replace(/,$/, '');
                if (email.includes('@') && !emailCC.includes(email.toLowerCase())) {
                  setEmailCC(prev => [...prev, email.toLowerCase()]);
                }
                setCcInput(''); setShowCCPicker(false);
              } else if (e.key === 'Backspace' && !ccInput && emailCC.length > 0) {
                setEmailCC(prev => prev.slice(0, -1));
              }
            }}
            placeholder={emailCC.length === 0 ? (teamMembers.length > 0 ? "Type name or email..." : "email@example.com") : ""}
            className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5"
          />
        </div>
        {showCCPicker && (() => {
          const q = ccInput.toLowerCase();
          const filtered = teamMembers.filter(m =>
            !emailCC.includes(m.email.toLowerCase()) &&
            (q === '' || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
          );
          return filtered.length > 0 ? (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-xl max-h-36 overflow-y-auto">
              {filtered.map(m => (
                <button key={m._id} type="button"
                  onMouseDown={(e) => { e.preventDefault(); setEmailCC(prev => [...prev, m.email]); setCcInput(''); setShowCCPicker(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 transition-colors">
                  <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-brand-700">{m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-stone-800 truncate">{m.name}</p>
                    <p className="text-[10px] text-stone-400 truncate">{m.email}</p>
                  </div>
                  {m.role && m.role !== 'Team Member' && <span className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{m.role}</span>}
                </button>
              ))}
            </div>
          ) : null;
        })()}
      </div>

      {/* BCC Field */}
      <div className="relative">
        <label className="block text-[10px] font-semibold text-stone-500 mb-1">BCC (Optional)</label>
        <div className="min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1.5 border border-stone-200 rounded-lg focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 bg-white cursor-text"
          onClick={() => document.getElementById('bcc-input')?.focus()}>
          {emailBCC.map((email, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-medium max-w-[180px]">
              <span className="truncate">{teamMembers.find(m => m.email === email)?.name || email}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setEmailBCC(prev => prev.filter((_, idx) => idx !== i)); }}
                className="hover:bg-amber-200 rounded p-0.5 flex-shrink-0"><X size={10} /></button>
            </span>
          ))}
          <input id="bcc-input" type="text" value={bccInput}
            onChange={(e) => { setBccInput(e.target.value); setShowBCCPicker(true); setShowCCPicker(false); }}
            onFocus={() => { if (bccInput || teamMembers.length > 0) setShowBCCPicker(true); setShowCCPicker(false); }}
            onBlur={() => setTimeout(() => setShowBCCPicker(false), 200)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && bccInput.trim()) {
                e.preventDefault();
                const email = bccInput.trim().replace(/,$/, '');
                if (email.includes('@') && !emailBCC.includes(email.toLowerCase())) {
                  setEmailBCC(prev => [...prev, email.toLowerCase()]);
                }
                setBccInput(''); setShowBCCPicker(false);
              } else if (e.key === 'Backspace' && !bccInput && emailBCC.length > 0) {
                setEmailBCC(prev => prev.slice(0, -1));
              }
            }}
            placeholder={emailBCC.length === 0 ? (teamMembers.length > 0 ? "Type name or email..." : "email@example.com") : ""}
            className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5"
          />
        </div>
        {showBCCPicker && (() => {
          const q = bccInput.toLowerCase();
          const filtered = teamMembers.filter(m =>
            !emailBCC.includes(m.email.toLowerCase()) &&
            (q === '' || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
          );
          return filtered.length > 0 ? (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-xl max-h-36 overflow-y-auto">
              {filtered.map(m => (
                <button key={m._id} type="button"
                  onMouseDown={(e) => { e.preventDefault(); setEmailBCC(prev => [...prev, m.email]); setBccInput(''); setShowBCCPicker(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50 transition-colors">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-amber-700">{m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-stone-800 truncate">{m.name}</p>
                    <p className="text-[10px] text-stone-400 truncate">{m.email}</p>
                  </div>
                  {m.role && m.role !== 'Team Member' && <span className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{m.role}</span>}
                </button>
              ))}
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}
