import React from 'react';

const TONE = {
  online: { dot: 'bg-emerald-500', label: 'Live', text: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-200' },
  away: { dot: 'bg-amber-400', label: 'Away', text: 'text-amber-800', bg: 'bg-amber-50 border-amber-200' },
  offline: { dot: 'bg-stone-300', label: 'Offline', text: 'text-stone-500', bg: 'bg-stone-50 border-stone-200' },
};

export function presenceFromLastActive(lastActiveAt) {
  if (!lastActiveAt) return 'offline';
  const age = Date.now() - new Date(lastActiveAt).getTime();
  if (Number.isNaN(age) || age < 0) return 'offline';
  if (age <= 75_000) return 'online';
  if (age <= 10 * 60_000) return 'away';
  return 'offline';
}

export function lastSeenLabel(lastActiveAt) {
  if (!lastActiveAt) return 'Never signed in';
  const age = Date.now() - new Date(lastActiveAt).getTime();
  if (Number.isNaN(age) || age < 0) return 'Never signed in';
  const mins = Math.floor(age / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(lastActiveAt).toLocaleDateString();
}

export default function PresenceBadge({ status, compact = false, lastLabel }) {
  const tone = TONE[status] || TONE.offline;
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full" title={lastLabel || tone.label}>
        <span className="relative flex h-2 w-2 shrink-0">
          {status === 'online' ? (
            <span className={`absolute inset-0 rounded-full ${tone.dot} opacity-60 animate-ping`} />
          ) : null}
          <span className={`relative h-2 w-2 rounded-full ${tone.dot}`} />
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wide truncate ${tone.text}`}>
          {tone.label}
          {lastLabel && status !== 'online' ? (
            <span className="normal-case tracking-normal font-semibold opacity-80"> · {lastLabel}</span>
          ) : null}
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${tone.bg} ${tone.text}`}>
      <span className="relative flex h-2 w-2 shrink-0">
        {status === 'online' ? (
          <span className={`absolute inset-0 rounded-full ${tone.dot} opacity-60 animate-ping`} />
        ) : null}
        <span className={`relative h-2 w-2 rounded-full ${tone.dot}`} />
      </span>
      {tone.label}
      {lastLabel && status !== 'online' ? (
        <span className="normal-case tracking-normal font-semibold opacity-80">· {lastLabel}</span>
      ) : null}
    </span>
  );
}
