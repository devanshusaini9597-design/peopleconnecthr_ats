'use client';

import { useEffect, useState } from 'react';
import { Linkedin, Search, Building2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const BOARD_META = [
  { id: 'LINKEDIN', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'INDEED', name: 'Indeed', icon: Search, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'GLASSDOOR', name: 'Glassdoor', icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
] as const;

interface CredStatus {
  board: string;
  configured: boolean;
  isActive: boolean;
  accountName: string | null;
}

interface JobBoardIntegrationProps {
  jobId: string;
  jobTitle: string;
}

export function JobBoardIntegration({ jobId, jobTitle }: JobBoardIntegrationProps) {
  const toast = useToast();
  const [creds, setCreds] = useState<CredStatus[]>([]);
  const [posting, setPosting] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastMessage, setLastMessage] = useState('');

  useEffect(() => {
    fetch('/api/jobboards/credentials', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.credentials) setCreds(json.credentials);
      })
      .catch(() => {});
  }, []);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const post = async () => {
    if (!selected.length) {
      toast.error('Select boards', 'Choose at least one board to post to.');
      return;
    }
    setPosting('all');
    setLastMessage('');
    try {
      const res = await fetch('/api/jobboards/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, boards: selected }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error('Post failed', json.error || 'Unknown error');
        return;
      }
      setLastMessage(json.message || 'Done');
      toast.success('Job boards', json.message || 'Records updated');
    } catch {
      toast.error('Post failed', 'Network error');
    } finally {
      setPosting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-stone-900">Post “{jobTitle}” to job boards</h3>
        <p className="text-xs text-stone-500 mt-1">
          Live posting runs when board credentials are saved. Without credentials, a draft record is created (same as before).
        </p>
      </div>

      <div className="space-y-2">
        {BOARD_META.map((b) => {
          const Icon = b.icon;
          const status = creds.find((c) => c.board === b.id);
          const live = !!status?.configured;
          const isOn = selected.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                isOn ? 'border-brand-300 bg-brand-50/50' : 'border-stone-200 bg-white hover:bg-stone-50'
              }`}
            >
              <div className={`p-2 rounded-lg ${b.bg} ${b.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-900">{b.name}</p>
                <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                  {live ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> Credentials ready — will attempt live post
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-500" /> No credentials — will create draft record
                    </>
                  )}
                </p>
              </div>
              <span
                className={`w-4 h-4 rounded border ${isOn ? 'bg-brand-600 border-brand-600' : 'border-stone-300 bg-white'}`}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={post}
        disabled={!!posting}
        className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {posting ? 'Posting…' : 'Post to selected boards'}
      </button>

      {lastMessage && <p className="text-xs text-stone-600 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">{lastMessage}</p>}

      <p className="text-[11px] text-stone-400">
        Manage API keys under Job Boards settings, or{' '}
        <code className="bg-stone-100 px-1 rounded">PUT /api/jobboards/credentials</code>.
      </p>
    </div>
  );
}
