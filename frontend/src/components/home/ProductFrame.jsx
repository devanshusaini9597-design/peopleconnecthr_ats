import React, { useState } from 'react';

/**
 * 16:10 product window. A file at `src` fills the frame.
 * Until that file exists, a designed scene keeps the section from looking empty.
 */
function Scene({ variant }) {
  if (variant === 'pipeline') {
    const cols = [
      ['Applied', 'bg-sky-500', 3],
      ['Screen', 'bg-amber-500', 2],
      ['Interview', 'bg-brand-500', 3],
      ['Offer', 'bg-violet-500', 1],
    ];
    return (
      <div className="grid h-full grid-cols-4 gap-2 p-3 sm:p-4">
        {cols.map(([name, dot, n]) => (
          <div key={name} className="flex flex-col rounded-xl border border-stone-200/80 bg-white p-2 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              <span className="text-[10px] font-bold text-stone-600">{name}</span>
              <span className="ml-auto text-[10px] font-semibold text-stone-400">{n}</span>
            </div>
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="mb-1.5 rounded-lg border border-stone-100 bg-stone-50 p-1.5">
                <div className="h-1.5 w-3/4 rounded bg-stone-200" />
                <div className="mt-1 h-1 w-1/2 rounded bg-stone-100" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'mail') {
    return (
      <div className="flex h-full flex-col gap-3 p-4 sm:p-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Mail plan</p>
          <p className="mt-1 text-lg font-bold text-stone-900">Premium</p>
          <p className="text-xs text-stone-500">6,240 of 10,000 emails this month</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-brand-500 to-teal-500" />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold text-stone-400">From name</p>
            <p className="mt-2 text-sm font-semibold text-stone-800">Northstar Talent</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-semibold text-emerald-700">Reply-to</p>
            <p className="mt-2 text-sm font-semibold text-emerald-900">hiring@company.com</p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'reports' || variant === 'billing') {
    const rows = variant === 'billing'
      ? [['Seats', '18 / 25', 72], ['Jobs', '31 / 50', 62], ['Candidates', '2.4k / 5k', 48], ['Email', '6.2k / 10k', 62]]
      : [['Delivered', '94%', 94], ['Opened', '61%', 61], ['Clicked', '22%', 22], ['Replied', '9%', 9]];
    return (
      <div className="grid h-full grid-cols-2 gap-3 p-4 sm:p-5">
        {rows.map(([label, value, pct]) => (
          <div key={label} className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
            <p className="text-xl font-bold tracking-tight text-stone-900">{value}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'careers') {
    return (
      <div className="flex h-full flex-col gap-2 bg-gradient-to-b from-white to-brand-50/40 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Careers</p>
            <p className="text-lg font-bold text-stone-900">Open roles</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow-sm ring-1 ring-brand-100">63 openings</span>
        </div>
        {['Premier Acquisition Manager', 'Relationship Manager', 'Branch Head'].map((title) => (
          <div key={title} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-stone-900">{title}</p>
              <p className="text-[11px] text-stone-400">Full time · India</p>
            </div>
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white">Apply</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="hidden w-28 shrink-0 flex-col gap-2 bg-stone-950 p-3 sm:flex">
        <div className="mb-2 h-6 w-16 rounded bg-white/20" />
        <div className="h-7 rounded-lg bg-teal-500/20 ring-1 ring-teal-400/30" />
        <div className="h-6 rounded-lg bg-white/5" />
        <div className="h-6 rounded-lg bg-white/5" />
        <div className="h-6 rounded-lg bg-white/5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 bg-[#f6f5f3] p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Workspace</p>
            <p className="text-sm font-bold text-stone-900">This month</p>
          </div>
          <div className="h-8 w-24 rounded-xl bg-gradient-to-r from-brand-600 to-teal-600 shadow-md shadow-brand-500/30" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Open jobs', '42', 'bg-sky-50'],
            ['In pipeline', '186', 'bg-brand-50'],
            ['Offers', '11', 'bg-emerald-50'],
          ].map(([label, n, bg]) => (
            <div key={label} className={`rounded-xl border border-white ${bg} p-2.5 shadow-sm`}>
              <p className="text-[10px] font-semibold text-stone-500">{label}</p>
              <p className="mt-1 text-lg font-bold text-stone-900">{n}</p>
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-5 gap-1.5">
          {['Applied', 'Screen', 'Interview', 'Offer', 'Hired'].map((name, i) => (
            <div key={name} className="rounded-lg border border-stone-200 bg-white p-1.5">
              <div className="mb-1 h-1.5 w-8 rounded bg-stone-200" />
              <div className="h-6 rounded-md bg-stone-50" />
              {i < 3 ? <div className="mt-1 h-6 rounded-md bg-stone-50" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductFrame({ src, alt, caption, variant = 'dashboard', className = '' }) {
  const [failed, setFailed] = useState(!src);

  return (
    <figure className={`gradient-border-wrap overflow-hidden shadow-2xl shadow-stone-900/10 ${className}`}>
      <div className="gradient-border-inner">
        <div className="flex h-11 items-center gap-2 border-b border-stone-100 bg-white/90 px-3 backdrop-blur">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 truncate rounded-md bg-stone-50 px-2 py-0.5 text-[11px] font-semibold text-stone-500 ring-1 ring-stone-100">
            {caption || 'People Connect HR'}
          </span>
        </div>
        <div className="relative aspect-[16/10] bg-[#f6f5f3]">
          {!failed && src ? (
            <img
              src={src}
              alt={alt || caption || 'Product screenshot'}
              className="absolute inset-0 h-full w-full object-contain"
              onError={() => setFailed(true)}
            />
          ) : (
            <Scene variant={variant} />
          )}
        </div>
      </div>
    </figure>
  );
}
