'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, User, Inbox, Search, Send, Plus, Trash2, RefreshCw,
  CheckCircle, Clock, ArrowLeft, MoreVertical, Paperclip,
  Archive, Star, Reply, Forward, Loader2,
  TrendingUp, MessageSquare, Eye, CheckCheck, X
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { format, formatDistanceToNow } from 'date-fns';

interface ThreadSummary {
  id: string;
  subject: string;
  createdAt: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage: {
    id: string;
    fromName: string;
    fromEmail: string;
    body: string;
    direction: string;
    isRead: boolean;
    sentAt: string;
  } | null;
}

interface MessageItem {
  id: string;
  fromName: string;
  fromEmail: string;
  fromUserId?: string;
  toEmail?: string;
  body: string;
  bodyHtml?: string;
  direction: string;
  status: string;
  isRead: boolean;
  readAt?: string;
  attachments?: any[];
  sentAt: string;
  createdAt: string;
}

interface InboxStats {
  totalThreads: number;
  totalMessages: number;
  unreadCount: number;
  inboundCount: number;
  outboundCount: number;
  replyRate: number;
}

export default function InboxPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<ThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<{
    id: string;
    subject: string;
    createdAt: string;
    lastMessageAt: string;
    unreadCount: number;
    messages: MessageItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Load threads and stats
  const loadData = useCallback(async () => {
    try {
      const [threadsRes, statsRes] = await Promise.all([
        fetch('/api/messages/threads', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/messages/stats', { credentials: 'include', cache: 'no-store' }),
      ]);

      if (threadsRes.ok) {
        const data = await threadsRes.json();
        const list = Array.isArray(data?.threads) ? data.threads : [];
        setThreads(list);
        setFilteredThreads(list);
        if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Failed to load inbox data:', error);
      toast.error('Failed to load inbox data');
    } finally {
      setLoading(false);
    }
  }, [selectedId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter threads based on search and tab
  useEffect(() => {
    let filtered = threads;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.subject.toLowerCase().includes(query) ||
          t.lastMessage?.fromName.toLowerCase().includes(query) ||
          t.lastMessage?.body.toLowerCase().includes(query)
      );
    }

    if (activeTab === 'unread') {
      filtered = filtered.filter((t) => t.unreadCount > 0);
    }

    setFilteredThreads(filtered);
  }, [threads, searchQuery, activeTab]);

  // Load thread detail
  useEffect(() => {
    if (!selectedId) {
      setThreadDetail(null);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/messages/threads/${selectedId}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subject != null && Array.isArray(data.messages)) {
          setThreadDetail(data);
          // Update thread unread count in list
          setThreads((prev) =>
            prev.map((t) => (t.id === selectedId ? { ...t, unreadCount: 0 } : t))
          );
        } else {
          setThreadDetail(null);
        }
      })
      .catch(() => setThreadDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const selectedThread = threads.find((e) => e.id === selectedId);

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeData.to || !composeData.message) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toEmail: composeData.to,
          subject: composeData.subject || 'No Subject',
          message: composeData.message,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Message sent successfully');
        setShowCompose(false);
        setComposeData({ to: '', subject: '', message: '' });
        // Add new thread to list
        setThreads((prev) => [data.thread, ...prev]);
        setSelectedId(data.thread.id);
        loadData();
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedId) return;

    setSendingReply(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          threadId: selectedId,
          toEmail: threadDetail?.messages[0]?.fromEmail,
          subject: threadDetail?.subject,
          body: replyMessage,
        }),
      });

      if (res.ok) {
        toast.success('Reply sent');
        setReplyMessage('');
        // Refresh thread detail
        const detailRes = await fetch(`/api/messages/threads/${selectedId}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (detailRes.ok) {
          const data = await detailRes.json();
          setThreadDetail(data);
        }
        loadData();
      } else {
        toast.error('Failed to send reply');
      }
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/messages/threads/${selectedId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Thread deleted');
        setThreads((prev) => prev.filter((t) => t.id !== selectedId));
        setSelectedId(null);
        setThreadDetail(null);
        loadData();
      } else {
        toast.error('Failed to delete thread');
      }
    } catch (error) {
      toast.error('Failed to delete thread');
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markAll: true }),
      });

      if (res.ok) {
        toast.success('All messages marked as read');
        setThreads((prev) => prev.map((t) => ({ ...t, unreadCount: 0 })));
        loadData();
      }
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={Inbox}
        title={t('inbox.title') || 'Inbox'}
        subtitle={t('inbox.subtitle') || 'Manage your email conversations'}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCompose(true)}
            className="btn-primary !px-4 !py-2.5 !text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Compose
          </motion.button>
        </div>
      </PageHeader>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total"
            value={stats.totalThreads}
            icon={MessageSquare}
            iconClassName="text-brand-600 bg-brand-50"
          />
          <StatCard
            label="Unread"
            value={stats.unreadCount}
            icon={Mail}
            iconClassName="text-amber-600 bg-amber-50"
          />
          <StatCard
            label="Sent"
            value={stats.outboundCount}
            icon={CheckCircle}
            iconClassName="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            label="Reply Rate"
            value={`${stats.replyRate}%`}
            icon={TrendingUp}
            iconClassName="text-sky-600 bg-sky-50"
          />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-lg flex flex-col lg:flex-row min-h-[420px] sm:min-h-[480px] lg:min-h-[520px]"
      >
        {/* Thread List Sidebar */}
        <div className={`${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'} flex-col lg:w-96 border-b lg:border-b-0 lg:border-r border-stone-200`}>
          {/* Search and Filters */}
          <div className="p-4 border-b border-stone-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('inbox.searchPlaceholder') || 'Search emails...'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'all'
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'unread'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Unread ({threads.reduce((acc, t) => acc + t.unreadCount, 0)})
              </button>
              <button
                onClick={handleMarkAllRead}
                className="p-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                onClick={loadData}
                className="p-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-20 bg-stone-100 rounded-xl w-full animate-pulse" />
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  message={searchQuery ? 'No threads match your search' : t('common.noRecordFound') || 'No emails yet'}
                  icon={Mail}
                  subMessage={searchQuery ? 'Try a different search term' : 'Start a conversation by clicking Compose'}
                />
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => { setSelectedId(thread.id); setMobileView('detail'); }}
                  className={`w-full text-left p-4 border-b border-stone-100 transition-all ${
                    selectedId === thread.id
                      ? 'bg-brand-50 border-l-4 border-l-brand-500'
                      : 'hover:bg-stone-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {thread.unreadCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                      )}
                      <span
                        className={`font-semibold text-sm truncate ${
                          thread.unreadCount > 0 ? 'text-stone-900' : 'text-stone-600'
                        }`}
                      >
                        {thread.lastMessage?.fromName ?? '—'}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-400 flex-shrink-0">
                      {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p
                    className={`text-sm truncate mt-1 ${
                      thread.unreadCount > 0 ? 'text-stone-900 font-medium' : 'text-stone-500'
                    }`}
                  >
                    {thread.subject}
                  </p>
                  <p className="text-xs text-stone-400 truncate mt-0.5">
                    {thread.lastMessage?.direction === 'OUTBOUND' && (
                      <span className="text-brand-600 mr-1">You:</span>
                    )}
                    {(thread.lastMessage?.body ?? '').slice(0, 60)}
                    {(thread.lastMessage?.body?.length ?? 0) > 60 ? '…' : ''}
                  </p>
                  {thread.unreadCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 mt-2 rounded-full text-xs font-medium bg-brand-100 text-brand-700">
                      {thread.unreadCount} new
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
        {/* Thread Detail */}
        <div className={`${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col flex-1 min-w-0`}>
          <AnimatePresence mode="wait">
            {selectedThread && threadDetail ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                {/* Thread Header */}
                <div className="p-4 sm:p-6 border-b border-stone-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-stone-900 truncate">
                          {threadDetail.subject}
                        </h2>
                        <p className="text-sm text-stone-600 mt-0.5">
                          {threadDetail.messages[0]?.fromName ?? '—'}{' '}
                          &lt;{threadDetail.messages[0]?.fromEmail ?? ''}&gt;
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-stone-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(
                              new Date(threadDetail.messages[0]?.sentAt || threadDetail.createdAt),
                              'MMM d, yyyy · h:mm a'
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {threadDetail.messages.length} messages
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete thread"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setSelectedId(null); setMobileView('list'); }}
                        className="lg:hidden p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                  {loadingDetail ? (
                    <div className="space-y-4 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-stone-100 rounded-xl w-full" />
                      ))}
                    </div>
                  ) : (
                    threadDetail.messages.map((m, idx) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`flex gap-4 ${m.direction === 'OUTBOUND' ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-semibold text-sm ${
                            m.direction === 'OUTBOUND'
                              ? 'bg-brand-100 text-brand-700'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {m.fromName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div className={`flex-1 min-w-0 ${m.direction === 'OUTBOUND' ? 'text-right' : ''}`}>
                          <div
                            className={`inline-block max-w-full rounded-2xl px-4 py-3 text-left ${
                              m.direction === 'OUTBOUND'
                                ? 'bg-brand-600 text-white rounded-br-md'
                                : 'bg-stone-100 text-stone-900 rounded-bl-md'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold opacity-80">{m.fromName}</span>
                              <span className="text-xs opacity-60">·</span>
                              <span className="text-xs opacity-60">
                                {format(new Date(m.sentAt), 'MMM d, h:mm a')}
                              </span>
                              {m.isRead && m.direction === 'OUTBOUND' && (
                                <Eye className="w-3 h-3 opacity-60" />
                              )}
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {m.attachments.map((att: any, i: number) => (
                                  <a
                                    key={i}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20 text-xs font-medium hover:bg-white/30 transition-colors"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    {att.filename}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Reply Area */}
                <div className="p-4 border-t border-stone-200 bg-stone-50">
                  <form onSubmit={handleReply} className="flex gap-3 items-end">
                    <textarea
                      rows={2}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply… (Shift+Enter for new line)"
                      className="flex-1 px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
                      disabled={sendingReply}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e as any); } }}
                    />
                    <motion.button
                      type="submit"
                      disabled={!replyMessage.trim() || sendingReply}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {sendingReply ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Reply
                    </motion.button>
                  </form>
                </div>
              </motion.div>
            ) : selectedThread && loadingDetail ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="space-y-3 w-full max-w-sm animate-pulse">
                  <div className="h-5 bg-stone-100 rounded w-2/3" />
                  <div className="h-4 bg-stone-50 rounded w-full" />
                  <div className="h-24 bg-stone-50 rounded-xl w-full" />
                </div>
              </div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center text-stone-500"
              >
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-10 h-10 text-brand-600" />
                  </div>
                  <p className="font-medium">{t('inbox.selectEmail') || 'Select an email to view'}</p>
                  <p className="text-sm text-stone-400 mt-1">
                    Choose from the list or compose a new message
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Compose Modal */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCompose(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-brand-600 to-teal-500">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  New Message
                </h3>
                <button
                  onClick={() => setShowCompose(false)}
                  className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCompose} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">To</label>
                  <input
                    type="email"
                    required
                    value={composeData.to}
                    onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={composeData.subject}
                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                    placeholder="Message subject..."
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={6}
                    value={composeData.message}
                    onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                    placeholder="Write your message..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Message
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
                <h3 className="text-lg font-bold text-stone-900">Delete Thread?</h3>
                <p className="text-sm text-stone-500 mt-2">
                  All messages in &ldquo;{selectedThread?.subject}&rdquo; will be permanently deleted.
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 font-semibold text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); handleDelete(); }}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
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
