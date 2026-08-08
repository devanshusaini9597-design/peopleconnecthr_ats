'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Send, Minimize2, ChevronLeft, Loader2,
  MessageSquarePlus, Sparkles,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useLocale } from '@/components/providers/LocaleProvider';

type ThreadSummary = {
  id: string; subject: string; createdAt: string; unreadCount?: number;
  lastMessage: { fromName: string; body: string; sentAt: string } | null;
};
type MessageItem = { id: string; fromName: string; body: string; direction: string; sentAt: string };

const QUICK_REPLIES = ['Sure, sounds good!', 'Can we reschedule?', 'Please send more details.', 'Thanks!'];

function getInitials(s: string) {
  return s.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatThreadTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  const totalUnread = threads.reduce((sum, th) => sum + (th.unreadCount ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    setLoadingThreads(true);
    fetch('/api/messages/threads', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { threads: [] }))
      .then((data: { threads?: ThreadSummary[] }) => {
        const list = Array.isArray(data?.threads) ? data.threads : [];
        setThreads(list);
        if (activeThread && !list.some((th) => th.id === activeThread)) setActiveThread(null);
      })
      .catch(() => setThreads([]))
      .finally(() => setLoadingThreads(false));
  }, [open]);

  useEffect(() => {
    if (!activeThread) { setMessages([]); return; }
    setLoadingMessages(true);
    fetch(`/api/messages/threads/${activeThread}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { messages?: MessageItem[] } | null) => {
        setMessages(Array.isArray(data?.messages) ? data.messages : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [activeThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeThread]);

  useEffect(() => {
    if (activeThread && open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [activeThread, open]);

  const handleSend = async (body?: string) => {
    const text = (body ?? input).trim();
    if (!text || !activeThread || sending) return;
    setInput('');
    setSending(true);
    const optimistic: MessageItem = {
      id: `opt-${Date.now()}`,
      fromName: 'You', body: text, direction: 'OUTBOUND',
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ threadId: activeThread, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.message) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...data.message } : m));
      }
    } catch {
      // keep optimistic message
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const thread = activeThread ? threads.find((th) => th.id === activeThread) : null;

  return (
    <>
      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`fixed z-[100] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/20 ${
              minimized
                ? 'w-72 sm:w-80 h-[52px] right-4 bottom-4 sm:right-6 sm:bottom-6'
                : 'w-[calc(100vw-2rem)] max-w-[380px] h-[min(68vh,540px)] right-4 bottom-4 sm:right-6 sm:bottom-6'
            }`}
            style={{ boxShadow: '0 8px 40px rgba(13,148,136,0.18), 0 2px 12px rgba(0,0,0,0.12)' }}
          >
            {/* ── Minimized bar ──────────────────────────────────────── */}
            {minimized ? (
              <button
                type="button" onClick={() => setMinimized(false)}
                className="w-full h-full flex items-center gap-3 px-4 text-left bg-gradient-to-r from-brand-600 to-teal-600 hover:from-brand-500 hover:to-teal-500 transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white text-sm truncate flex-1">{t('chat.title')}</span>
                {totalUnread > 0 && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-white text-brand-700 text-[10px] font-extrabold">{totalUnread}</span>
                )}
                <X className="w-3.5 h-3.5 text-white/80" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
              </button>
            ) : (
              <>
                {/* ── Gradient Header ────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-600 to-teal-600 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    {activeThread ? (
                      <button
                        type="button" onClick={() => setActiveThread(null)}
                        className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors -ml-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white text-sm leading-tight">
                        {thread ? thread.subject : t('chat.title')}
                      </h3>
                      {!thread && (
                        <p className="text-[11px] text-white/75 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button" onClick={() => setMinimized(true)}
                      className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button" onClick={() => setOpen(false)}
                      className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── Body ───────────────────────────────────────────── */}
                <div className="flex flex-col flex-1 min-h-0">
                  <AnimatePresence mode="wait">

                    {/* Thread list */}
                    {!thread && (
                      <motion.div
                        key="list"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.14 }}
                        className="flex-1 overflow-y-auto"
                      >
                        {loadingThreads ? (
                          <div className="p-3 space-y-2 animate-pulse">
                            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
                          </div>
                        ) : threads.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-[calc(100%-1px)] text-center p-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 flex items-center justify-center mb-4 shadow-sm">
                              <MessageSquarePlus className="w-7 h-7 text-brand-500" />
                            </div>
                            <p className="font-bold text-stone-800 text-sm">No messages yet</p>
                            <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                              Messages from candidates and team members will appear here.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-stone-100">
                            {threads.map((th) => (
                              <button
                                key={th.id} type="button" onClick={() => setActiveThread(th.id)}
                                className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-stone-50 transition-colors"
                              >
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center font-bold text-brand-700 text-sm flex-shrink-0">
                                  {getInitials(th.subject)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <p className="font-bold text-stone-900 text-sm truncate">{th.subject}</p>
                                    {th.lastMessage && (
                                      <span className="text-[10px] text-stone-400 flex-shrink-0">{formatThreadTime(th.lastMessage.sentAt)}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-stone-500 truncate">{th.lastMessage?.body ?? 'No messages'}</p>
                                </div>
                                {(th.unreadCount ?? 0) > 0 && (
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                                    {th.unreadCount}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Message view */}
                    {thread && (
                      <motion.div
                        key="thread"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.14 }}
                        className="flex flex-col flex-1 min-h-0"
                      >
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-stone-50/60">
                          {loadingMessages ? (
                            <div className="space-y-3 animate-pulse p-1">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`h-9 rounded-2xl bg-stone-200 ${i % 2 === 0 ? 'w-3/5' : 'w-2/5'}`} />
                                </div>
                              ))}
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-6">
                              <Sparkles className="w-7 h-7 text-stone-300 mb-2" />
                              <p className="text-xs text-stone-400">Start the conversation below</p>
                            </div>
                          ) : (
                            messages.map((m) => {
                              const isYou = m.direction === 'OUTBOUND';
                              return (
                                <div key={m.id} className={`flex ${isYou ? 'justify-end' : 'justify-start'}`}>
                                  <div
                                    className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-snug shadow-sm ${
                                      isYou
                                        ? 'bg-gradient-to-br from-brand-500 to-teal-600 text-white rounded-2xl rounded-br-sm'
                                        : 'bg-white text-stone-900 border border-stone-200 rounded-2xl rounded-bl-sm'
                                    }`}
                                  >
                                    <p>{m.body}</p>
                                    <p className={`text-[10px] mt-1 ${isYou ? 'text-white/75 text-right' : 'text-stone-400'}`}>
                                      {format(new Date(m.sentAt), 'h:mm a')}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Quick replies */}
                        <div className="flex-shrink-0 px-3 pt-2.5 flex gap-1.5 overflow-x-auto scrollbar-hide">
                          {QUICK_REPLIES.map((qr) => (
                            <button
                              key={qr} type="button" onClick={() => handleSend(qr)}
                              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all whitespace-nowrap"
                            >
                              {qr}
                            </button>
                          ))}
                        </div>

                        {/* Input */}
                        <div className="flex-shrink-0 p-3 pt-2">
                          <div className="flex gap-2 items-center bg-white border border-stone-200 rounded-xl px-3 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                            <input
                              ref={inputRef}
                              type="text" value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={handleKeyDown}
                              placeholder={t('chat.placeholder')}
                              disabled={sending}
                              className="flex-1 bg-transparent text-stone-900 text-sm placeholder:text-stone-400 outline-none disabled:opacity-60"
                            />
                            <motion.button
                              type="button" onClick={() => handleSend()}
                              disabled={!input.trim() || sending}
                              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                              className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-white disabled:opacity-40 transition-opacity shadow-sm"
                            >
                              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB Toggle button ───────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.93 }}
            className="fixed right-4 sm:right-6 bottom-4 sm:bottom-6 z-[99] w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/35 hover:shadow-brand-500/50 transition-shadow"
            style={{ width: 52, height: 52, background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }}
            aria-label={t('chat.open')}
          >
            <MessageCircle className="w-5 h-5 text-white" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-sm">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
