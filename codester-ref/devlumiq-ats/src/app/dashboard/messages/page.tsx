'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Send, Search, Plus, Loader2, Clock, CheckCheck,
  ArrowLeft, MoreVertical, Trash2, RefreshCw, Users, CheckCircle2, X
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { format, formatDistanceToNow } from 'date-fns';
import { ChannelMessageComposer } from '@/components/dashboard/ChannelMessageComposer';

interface ThreadSummary {
  id: string;
  candidateId?: string | null;
  subject: string;
  createdAt: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage: {
    id: string;
    fromName: string;
    body: string;
    direction: string;
    isRead: boolean;
    sentAt: string;
    channel?: 'EMAIL' | 'SMS' | 'WHATSAPP';
  } | null;
}

interface MessageItem {
  id: string;
  fromName: string;
  fromEmail: string;
  fromUserId?: string;
  body: string;
  direction: string;
  status: string;
  isRead: boolean;
  sentAt: string;
  createdAt: string;
  channel?: 'EMAIL' | 'SMS' | 'WHATSAPP';
  toPhone?: string | null;
}

function getInitials(s: string) {
  return s
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function MessagesPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [replyChannel, setReplyChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatData, setNewChatData] = useState({ to: '', subject: '' });
  const [creating, setCreating] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads
  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/threads', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.threads) ? data.threads : [];
        setThreads(list);
        setFilteredThreads(list);
        if (list.length > 0 && !activeThreadId) setActiveThreadId(list[0].id);
      } else {
        toast.error('Failed to load conversations');
      }
    } catch (error) {
      console.error('Failed to load threads:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoadingThreads(false);
    }
  }, [activeThreadId, toast]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Filter threads based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredThreads(threads);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = threads.filter(
      (t) =>
        t.subject.toLowerCase().includes(query) ||
        t.lastMessage?.fromName.toLowerCase().includes(query) ||
        t.lastMessage?.body.toLowerCase().includes(query)
    );
    setFilteredThreads(filtered);
  }, [threads, searchQuery]);

  // Load messages when thread changes
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    fetch(`/api/messages/threads/${activeThreadId}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
          // Mark unread count as 0 in thread list
          setThreads((prev) => prev.map((t) => (t.id === activeThreadId ? { ...t, unreadCount: 0 } : t)));
        } else {
          setMessages([]);
        }
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [activeThreadId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeThreadId]);

  const activeThread = threads.find((th) => th.id === activeThreadId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeThreadId) return;

    const text = input.trim();
    const candidateId = activeThread?.candidateId;

    if ((replyChannel === 'SMS' || replyChannel === 'WHATSAPP') && !candidateId) {
      toast.error('This thread is not linked to a candidate. Use the channel composer or link a candidate first.');
      return;
    }

    setSending(true);
    try {
      let res: Response;
      if (replyChannel === 'SMS') {
        res = await fetch('/api/messages/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ candidateId, message: text }),
        });
      } else if (replyChannel === 'WHATSAPP') {
        res = await fetch('/api/messages/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ candidateId, message: text }),
        });
      } else {
        res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            threadId: activeThreadId,
            subject: activeThread?.subject,
            body: text,
          }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        setInput('');
        toast.success(
          replyChannel === 'SMS' ? 'SMS sent' : replyChannel === 'WHATSAPP' ? 'WhatsApp sent' : 'Message sent',
        );

        const newMessage: MessageItem = {
          id: data.message?.id || Date.now().toString(),
          fromName: data.message?.fromName || 'You',
          fromEmail: data.message?.fromEmail || '',
          body: text,
          direction: 'OUTBOUND',
          status: data.message?.status || 'sent',
          isRead: true,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          channel: replyChannel,
          toPhone: data.message?.toPhone ?? null,
        };
        setMessages((prev) => [...prev, newMessage]);

        // SMS/WhatsApp may land on a different candidate thread — switch if needed
        if (data.thread?.id && data.thread.id !== activeThreadId) {
          setActiveThreadId(data.thread.id);
        }
        loadThreads();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to send message');
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatData.to || !newChatData.subject) return;

    setCreating(true);
    try {
      const res = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toEmail: newChatData.to,
          subject: newChatData.subject,
          message: 'Hello, I\'d like to start a conversation with you.',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Conversation started');
        setShowNewChat(false);
        setNewChatData({ to: '', subject: '' });
        // Add new thread and select it
        setThreads((prev) => [data.thread, ...prev]);
        setActiveThreadId(data.thread.id);
      } else {
        toast.error('Failed to start conversation');
      }
    } catch (error) {
      toast.error('Failed to start conversation');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!activeThreadId) return;
    setDeletingThread(true);
    try {
      const res = await fetch(`/api/messages/threads/${activeThreadId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Conversation deleted');
        setThreads((prev) => prev.filter((t) => t.id !== activeThreadId));
        setActiveThreadId(null);
        setMessages([]);
        setShowDeleteConfirm(false);
        setMobileView('list');
      } else {
        toast.error('Failed to delete conversation');
      }
    } catch {
      toast.error('Failed to delete conversation');
    } finally {
      setDeletingThread(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={MessageCircle}
        title={t('messages.title') || 'Messages'}
        subtitle={t('messages.subtitle') || 'Email, SMS & WhatsApp in one inbox'}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowNewChat(true)}
            className="btn-primary !px-4 !py-2.5 !text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </motion.button>
        </div>
      </PageHeader>

      <ChannelMessageComposer onSent={() => { void loadThreads(); }} />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-lg flex flex-col lg:flex-row min-h-[400px] sm:min-h-[480px] lg:min-h-[560px]"
      >
        {/* Thread List */}
        <div className={`${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'} flex-col lg:w-80 border-b lg:border-b-0 lg:border-r border-stone-200`}>
          <div className="p-3 border-b border-stone-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('messages.searchPlaceholder') || 'Search conversations...'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingThreads ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-stone-100 rounded-xl w-full animate-pulse" />
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  message={searchQuery ? 'No conversations found' : t('common.noRecordFound') || 'No conversations yet'}
                  icon={MessageCircle}
                  subMessage={searchQuery ? 'Try a different search term' : 'Start a new conversation'}
                />
              </div>
            ) : (
              filteredThreads.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => { setActiveThreadId(th.id); setMobileView('chat'); }}
                  className={`w-full text-left p-4 border-b border-stone-100 transition-all flex items-center gap-3 ${
                    activeThreadId === th.id
                      ? 'bg-brand-50 border-l-4 border-l-brand-500'
                      : 'hover:bg-stone-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    activeThreadId === th.id
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-stone-200 text-stone-600'
                  }`}>
                    {getInitials(th.subject)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm truncate ${
                        th.unreadCount > 0 ? 'text-stone-900' : 'text-stone-700'
                      }`}>
                        {th.subject}
                      </span>
                      {th.unreadCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      {th.lastMessage?.direction === 'OUTBOUND' && (
                        <span className="text-brand-600">You: </span>
                      )}
                      {th.lastMessage?.body ?? 'No messages yet'}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      {th.lastMessageAt ? formatDistanceToNow(new Date(th.lastMessageAt), { addSuffix: true }) : ''}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        {/* Chat Area */}
        <div className={`${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col flex-1 min-w-0`}>
          <AnimatePresence mode="wait">
            {activeThread ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                {/* Chat Header */}
                <div className="p-4 border-b border-stone-200 flex items-center gap-3 bg-white">
                  <button
                    onClick={() => { setActiveThreadId(null); setMobileView('list'); }}
                    className="lg:hidden p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center font-bold text-sm text-brand-700 flex-shrink-0">
                    {getInitials(activeThread.subject)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-stone-900 truncate">{activeThread.subject}</h2>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Users className="w-3 h-3" />
                      <span>{activeThread.lastMessage?.fromName || 'Candidate'}</span>
                      {messages.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{messages.length} messages</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
                  {loadingMessages ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                          <div className="h-16 bg-stone-200 rounded-2xl w-2/3 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-stone-400">
                      <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs">Start the conversation below</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((m, idx) => {
                        const isYou = m.direction === 'OUTBOUND';
                        const showDate = idx === 0 ||
                          new Date(m.sentAt).toDateString() !== new Date(messages[idx - 1].sentAt).toDateString();

                        return (
                          <div key={m.id}>
                            {showDate && (
                              <div className="flex justify-center my-4">
                                <span className="px-3 py-1 rounded-full bg-stone-200 text-stone-600 text-xs font-medium">
                                  {format(new Date(m.sentAt), 'EEEE, MMMM d')}
                                </span>
                              </div>
                            )}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              className={`flex ${isYou ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                                  isYou
                                    ? 'bg-brand-600 text-white rounded-br-md'
                                    : 'bg-white text-stone-900 rounded-bl-md border border-stone-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-xs font-semibold opacity-90">
                                    {isYou ? 'You' : m.fromName}
                                  </span>
                                  {m.channel && m.channel !== 'EMAIL' && (
                                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                      isYou ? 'bg-white/20' : 'bg-stone-100 text-stone-600'
                                    }`}>
                                      {m.channel}
                                    </span>
                                  )}
                                  <span className="text-xs opacity-60">·</span>
                                  <span className="text-xs opacity-60">
                                    {format(new Date(m.sentAt), 'h:mm a')}
                                  </span>
                                  {isYou && m.status === 'sent' && (
                                    <CheckCircle2 className="w-3 h-3 opacity-70" />
                                  )}
                                </div>
                                <p className="text-sm leading-relaxed">{m.body}</p>
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 border-t border-stone-200 bg-white space-y-2">
                  <div className="flex items-center gap-1.5">
                    {([
                      { value: 'EMAIL', label: 'Email' },
                      { value: 'SMS', label: 'SMS' },
                      { value: 'WHATSAPP', label: 'WhatsApp' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReplyChannel(opt.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          replyChannel === opt.value
                            ? 'bg-brand-600 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {(replyChannel === 'SMS' || replyChannel === 'WHATSAPP') && !activeThread.candidateId && (
                      <span className="text-[11px] text-amber-600 ml-1">No candidate linked</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        replyChannel === 'SMS'
                          ? 'Type SMS…'
                          : replyChannel === 'WHATSAPP'
                            ? 'Type WhatsApp message…'
                            : (t('messages.typeMessage') || 'Type your message...')
                      }
                      disabled={sending}
                      className="flex-1 px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:opacity-50"
                    />
                    <motion.button
                      type="submit"
                      disabled={!input.trim() || sending}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-5 py-3 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span className="hidden sm:inline">Send</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center text-stone-500 bg-stone-50/50"
              >
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-10 h-10 text-brand-600" />
                  </div>
                  <p className="font-medium">{t('messages.selectConversation') || 'Select a conversation'}</p>
                  <p className="text-sm text-stone-400 mt-1">Choose from the list or start a new chat</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewChat(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-brand-600 to-teal-500">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Start New Conversation
                </h3>
                <button
                  onClick={() => setShowNewChat(false)}
                  className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateThread} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">To</label>
                  <input
                    type="email"
                    required
                    value={newChatData.to}
                    onChange={(e) => setNewChatData({ ...newChatData, to: e.target.value })}
                    placeholder="candidate@email.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={newChatData.subject}
                    onChange={(e) => setNewChatData({ ...newChatData, subject: e.target.value })}
                    placeholder="e.g., Interview Follow-up"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewChat(false)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Start Chat
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">Delete Conversation?</h3>
                <p className="text-sm text-stone-500 mt-2">
                  This will permanently delete the entire conversation and cannot be undone.
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 font-semibold text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteThread}
                    disabled={deletingThread}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deletingThread ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
