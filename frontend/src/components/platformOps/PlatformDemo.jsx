import React from 'react';
import { Presentation } from 'lucide-react';
import { useToast } from '../Toast';
import usePlatformOps from './usePlatformOps';
import { formatCount, relativeTime } from './opsConstants';

export default function PlatformDemo() {
  const toast = useToast();
  const { summary } = usePlatformOps('demo');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.peopleconnecthr.com';
  const path = summary?.demo?.presentationPath || '/demo';
  const href = `${origin}${path}`;
  const ws = summary?.demo?.workspace;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">Client presentation</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Demo workspace</h1>
        <p className="mt-1 text-sm text-stone-400">
          This is the walkthrough account you open for buyers. It cannot be archived or given unfinished modules from this console.
        </p>
      </div>

      <section className="rounded-xl border border-stone-800 bg-stone-900/80 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <p className="text-white font-semibold">{ws?.name || 'Sales demo'}</p>
            <p className="text-xs text-stone-500">{ws?.domain || 'demo.peopleconnecthr.com'}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-stone-500 text-xs">Status</dt>
            <dd className="text-white font-medium">{ws ? 'Ready' : 'Will provision on first /demo visit'}</dd>
          </div>
          <div>
            <dt className="text-stone-500 text-xs">Seats</dt>
            <dd className="text-white font-medium tabular-nums">{ws ? formatCount(ws.demoUsers) : '—'}</dd>
          </div>
          <div>
            <dt className="text-stone-500 text-xs">Last used</dt>
            <dd className="text-white font-medium">{relativeTime(ws?.lastUsedAt)}</dd>
          </div>
          <div>
            <dt className="text-stone-500 text-xs">Share path</dt>
            <dd className="text-white font-medium">{path}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-stone-950 hover:bg-amber-400">Open presentation</a>
          <button
            type="button"
            className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-800"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(href);
                toast.success('Demo link copied');
              } catch {
                toast.error('Could not copy');
              }
            }}
          >
            Copy link
          </button>
        </div>
      </section>
    </div>
  );
}
