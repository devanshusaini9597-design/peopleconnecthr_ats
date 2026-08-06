import React from 'react';
import {
  MessageSquare, Loader2, Send, Search, Trash2, X, AtSign, Calendar,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { formatWhen, initials } from './collaborationConstants';

export function CommentBody({ text }) {
  const parts = String(text || '').split(/(@[\w.+-]+)/g);
  return (
    <p className="text-sm text-stone-800 mt-1.5 whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => (
        part.startsWith('@') ? (
          <span key={i} className="font-semibold text-brand-700 bg-brand-50 rounded px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </p>
  );
}

export function CollabCandidateList({
  listLabel, listMode, q, setQ, searching, candidates, selected, selectCandidate,
}) {
  return (
    <div
      data-tour="collab-candidates"
      className="lg:col-span-4 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[28rem]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 pt-5 pb-3 border-b border-stone-100 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Candidates</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">{listLabel}</p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0 capitalize">
            {listMode === 'search' ? 'Search' : 'Recent'}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            id="collab-search"
            type="search"
            className="input-ats !pl-10 !pr-9 w-full"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Find candidate"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto overscroll-contain">
        {searching ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 skeleton-ats rounded-xl" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Search}
              tone={listMode === 'search' ? 'amber' : 'brand'}
              compact
              message={listMode === 'search' ? 'No candidates found' : 'No candidates yet'}
              subMessage={
                listMode === 'search'
                  ? 'Try another name or email.'
                  : 'Add candidates in the ATS, then collaborate here.'
              }
            />
          </div>
        ) : (
          candidates.map((c) => {
            const active = selected?._id === c._id;
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => selectCandidate(c)}
                className={`w-full text-left px-4 py-3 border-b border-stone-50 flex items-center gap-3 min-w-0 transition-colors ${
                  active
                    ? 'bg-brand-50/80 border-l-2 border-l-brand-500'
                    : 'hover:bg-brand-50/40 border-l-2 border-l-transparent'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    active
                      ? 'bg-brand-600 text-white'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                  }`}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-stone-900 truncate">{c.name || 'Unnamed'}</span>
                  <span className="block text-xs text-stone-500 truncate mt-0.5">
                    {c.email || c.position || 'No email'}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function CollabThreadPanel({
  selected, loading, comments, body, setBody, sending, post, onComposerKeyDown, setDeleteTarget,
}) {
  return (
    <div
      data-tour="collab-thread"
      className="lg:col-span-8 card-ats-bordered relative overflow-hidden flex flex-col min-w-0 min-h-[28rem]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      {!selected ? (
        <div className="relative flex-1 flex flex-col justify-center p-5 sm:p-6">
          <EmptyState
            icon={MessageSquare}
            tone="brand"
            message="Select a candidate"
            subMessage="Pick someone from the list to view the thread and post notes for your team."
          />
        </div>
      ) : (
        <>
          <div className="relative px-4 sm:px-5 pt-5 pb-3 border-b border-stone-100 flex items-start justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(selected.name)}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900 tracking-tight truncate">
                  {selected.name || 'Candidate'}
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                  {selected.email || 'No email'}
                  {selected.position ? ` · ${selected.position}` : ''}
                </p>
              </div>
            </div>
            <span className="badge-neutral text-[10px] flex-shrink-0">
              {loading ? '…' : `${comments.length} note${comments.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="relative flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3 min-h-[12rem]">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 skeleton-ats rounded-2xl" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                tone="amber"
                compact
                message="No comments yet"
                subMessage="Be the first to leave a note. Use @FirstName to notify a teammate."
              />
            ) : (
              comments.map((c) => {
                const authorName = c.authorId?.name || 'Teammate';
                const mentionList = Array.isArray(c.mentions) ? c.mentions : [];
                return (
                  <article
                    key={c._id}
                    className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm min-w-0"
                  >
                    <div className="flex justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                          {initials(authorName)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">{authorName}</p>
                          <p className="text-[10px] text-stone-400 font-medium inline-flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatWhen(c.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="p-2 rounded-xl text-stone-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0 transition-colors"
                        onClick={() => setDeleteTarget(c)}
                        aria-label="Delete comment"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <CommentBody text={c.body} />
                    {mentionList.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {mentionList.map((m) => (
                          <span
                            key={m._id || m.email || m.name}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-2 py-0.5"
                          >
                            <AtSign className="w-3 h-3" />
                            {m.name || m.email || 'Teammate'}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <div
            data-tour="collab-composer"
            className="relative px-4 sm:px-5 py-3 border-t border-stone-100 bg-stone-50/60 flex-shrink-0"
          >
            <label className="label-ats" htmlFor="collab-comment">Add a comment</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                id="collab-comment"
                className="input-ats resize-none flex-1 min-w-0"
                rows={2}
                placeholder="Share context for the team… use @FirstName to mention"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onComposerKeyDown}
              />
              <button
                type="button"
                className="btn-primary w-full sm:w-auto sm:self-end"
                disabled={sending || !body.trim()}
                onClick={post}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post
              </button>
            </div>
            <p className="text-[10px] text-stone-400 mt-1.5 font-medium">
              Tip: Ctrl/Cmd + Enter to post
            </p>
          </div>
        </>
      )}
    </div>
  );
}
