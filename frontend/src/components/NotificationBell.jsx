import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, CheckCheck, Trash2, RefreshCw, AtSign, Users, Megaphone, User, Inbox, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import EmptyState from './ui/EmptyState';
import { BASE_API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import NotificationDetail from './notificationBell/NotificationDetail';
import NotificationListItem from './notificationBell/NotificationListItem';
import { groupNotifications } from './notificationBell/notificationBellHelpers';
import { parseReportShareLink, reportShareMeta } from './notificationBell/reportShareUtils';
import { useToast } from './Toast';

const INBOX_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'me', label: 'Me', icon: User },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'mention', label: '@', icon: AtSign },
  { key: 'company', label: 'Org', icon: Megaphone },
];

const NotificationBell = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, me, team, mention, company
  const [sortOrder, setSortOrder] = useState('latest'); // latest | oldest
  const [selectedNotif, setSelectedNotif] = useState(null); // detail view
  const [placement, setPlacement] = useState(() => ({
    mobile: typeof window !== 'undefined' ? window.innerWidth < 640 : true,
    top: 0,
    right: 12,
    width: 440,
    maxHeight: 640,
  }));
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  // Fetch unread count (lightweight — runs every 30s)
  const fetchCount = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/notifications/count`);
      const data = await res.json();
      if (data.success) {
        setUnreadCount(data.unreadCount);
        setUrgentCount(data.urgentCount);
      }
    } catch {
      // Silent fail
    }
  }, []);

  // Fetch full notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '40', sort: sortOrder });
      if (filter === 'unread') params.set('status', 'unread');
      else if (filter !== 'all') params.set('channel', filter);
      const res = await authenticatedFetch(`${BASE_API_URL}/api/notifications?${params}`);
      const data = await res.json();
      if (data.success) {
        const rows = Array.isArray(data.notifications) ? [...data.notifications] : [];
        rows.sort((a, b) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          return sortOrder === 'oldest' ? ta - tb : tb - ta;
        });
        setNotifications(rows);
        setUnreadCount(data.unreadCount);
        window.dispatchEvent(new CustomEvent('report-shares:changed'));
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, sortOrder]);

  // Poll count every 30 seconds
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    const onRefresh = () => { fetchCount(); };
    window.addEventListener('jobs:changed', onRefresh);
    window.addEventListener('notifications:refresh', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('jobs:changed', onRefresh);
      window.removeEventListener('notifications:refresh', onRefresh);
    };
  }, [fetchCount]);

  // Fetch notifications when panel opens or filter changes
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, filter, sortOrder, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSelectedNotif(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark single as read
  const markAsRead = async (id) => {
    try {
      await authenticatedFetch(`${BASE_API_URL}/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('report-shares:changed'));
    } catch { /* silent */ }
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await authenticatedFetch(`${BASE_API_URL}/api/notifications/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('report-shares:changed'));
    } catch { /* silent */ }
  };

  // Dismiss single
  const dismiss = async (id) => {
    try {
      await authenticatedFetch(`${BASE_API_URL}/api/notifications/${id}/dismiss`, { method: 'PUT' });
      setNotifications(prev => prev.filter(n => n._id !== id));
      fetchCount();
      window.dispatchEvent(new CustomEvent('report-shares:changed'));
    } catch { /* silent */ }
  };

  // Clear all read
  const clearAll = async () => {
    try {
      await authenticatedFetch(`${BASE_API_URL}/api/notifications/clear-all`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => !n.isRead));
      fetchCount();
    } catch { /* silent */ }
  };

  // Accept/Decline invitation
  const [processingAction, setProcessingAction] = useState(null);
  
  const handleAcceptInvitation = async (notif) => {
    if (!notif.relatedMemberId) return;
    setProcessingAction(notif._id + '_accept');
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/team/accept-invitation/${notif.relatedMemberId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, status: 'accepted', actionRequired: false, isRead: true } : n));
        fetchCount();
      }
    } catch (err) {
      console.error('Failed to accept invitation:', err);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDeclineInvitation = async (notif) => {
    if (!notif.relatedMemberId) return;
    setProcessingAction(notif._id + '_decline');
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/team/decline-invitation/${notif.relatedMemberId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, status: 'declined', actionRequired: false, isRead: true } : n));
        fetchCount();
      }
    } catch (err) {
      console.error('Failed to decline invitation:', err);
    } finally {
      setProcessingAction(null);
    }
  };

  // Click a notification → mark read + open detail view
  const handleNotifClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    setSelectedNotif(notif);
  };

  const openFromNotification = (notif = selectedNotif) => {
    setIsOpen(false);
    setSelectedNotif(null);
    if (!notif) return;
    if (notif.type === 'freelancer_submission') {
      navigate(isFreelancer ? '/my-pipeline' : '/freelance-review');
      return;
    }
    if (notif.type === 'announcement') {
      navigate('/announcements');
      return;
    }
    if (notif.type === 'job_opening') {
      navigate('/jobs');
      return;
    }
    if (notif.type === 'share_request') {
      const query = notif.candidateName;
      navigate(query ? `/ats?q=${encodeURIComponent(query)}` : '/ats');
      return;
    }
    if (notif.type === 'report_shared') {
      const { href } = parseReportShareLink(notif.linkUrl);
      navigate(href || '/analytics?tab=export');
      window.dispatchEvent(new CustomEvent('report-shares:changed'));
      return;
    }
    const query = notif.candidateName;
    navigate(query ? `/ats?q=${encodeURIComponent(query)}` : '/ats');
  };

  const downloadSharedReport = async (notif) => {
    const meta = reportShareMeta(notif);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/api/export/shared-download`, {
        method: 'POST',
        body: JSON.stringify({ notificationId: notif._id }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Download failed');
      }
      const raw = await response.blob();
      const ext = meta.format === 'xlsx' ? 'xlsx' : 'pdf';
      const mime = meta.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const blob = new Blob([raw], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let filename = `${meta.reportType || 'report'}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      const disp = response.headers.get('Content-Disposition') || '';
      const quotedMatch = disp.match(/filename="([^"]+)"/i);
      if (quotedMatch?.[1]) filename = quotedMatch[1];
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      if (!notif.isRead) await markAsRead(notif._id);
      toast.success(`${meta.formatLabel} downloaded`);
    } catch (err) {
      console.error('Shared report download failed:', err);
      toast.error(err.message || 'Could not download report');
    }
  };

  const viewCandidate = () => openFromNotification(selectedNotif);

  // Navigate to team page
  const viewTeam = () => {
    setIsOpen(false);
    setSelectedNotif(null);
    navigate('/team');
  };

  // Copy phone number
  const copyPhone = (phone) => {
    navigator.clipboard.writeText(phone).catch(() => {});
  };

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setSelectedNotif(null);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const place = () => {
      const el = bellRef.current;
      const mobile = window.innerWidth < 640;
      if (!el) {
        setPlacement((prev) => ({ ...prev, mobile }));
        return;
      }
      const r = el.getBoundingClientRect();
      const gutter = 12;
          const width = Math.min(420, window.innerWidth - gutter * 2);
      let right = Math.max(gutter, window.innerWidth - r.right);
      const left = window.innerWidth - right - width;
      if (left < gutter) right = Math.max(gutter, window.innerWidth - gutter - width);
      setPlacement({
        mobile,
        top: r.bottom + 10,
        right,
        width,
        maxHeight: Math.max(280, window.innerHeight - r.bottom - 24),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedNotif) setSelectedNotif(null);
      else closePanel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, selectedNotif, closePanel]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => {
      document.body.style.overflow = mq.matches ? 'hidden' : '';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        type="button"
        onClick={() => (isOpen ? closePanel() : setIsOpen(true))}
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          isOpen
            ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200/70'
            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
        }`}
        title="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={20} strokeWidth={isOpen || unreadCount > 0 ? 2.25 : 2} />
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-white text-[10px] font-bold shadow-sm ring-2 ring-white ${urgentCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-brand-600'}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && createPortal(
        <>
          <div
            className={`fixed inset-0 z-[55] ${placement.mobile ? 'bg-stone-900/40 backdrop-blur-[1px]' : 'bg-transparent'}`}
            onClick={closePanel}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            className={`fixed z-[60] flex flex-col overflow-hidden bg-white animate-fade-in ${
              placement.mobile
                ? 'inset-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
                : 'rounded-2xl border border-stone-200/80 shadow-[0_16px_48px_-12px_rgba(28,25,23,0.22)]'
            }`}
            style={placement.mobile ? undefined : {
              top: placement.top,
              right: placement.right,
              width: placement.width,
              maxHeight: Math.min(620, placement.maxHeight),
            }}
            role="dialog"
            aria-label="Inbox"
            aria-modal="true"
          >
          <div className="h-px bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" />

          <div className={`px-3.5 sm:px-4 pt-3.5 bg-white flex-shrink-0 ${selectedNotif ? 'pb-3 border-b border-stone-100' : 'pb-0'}`}>
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="min-w-0 flex items-center gap-2.5">
                <span className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-sm shadow-brand-500/20 flex-shrink-0">
                  <Inbox size={14} strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-stone-900 tracking-tight leading-none">Inbox</h3>
                  <p className="text-[11px] text-stone-400 mt-1 font-medium tabular-nums">
                    {unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {unreadCount > 0 && !selectedNotif ? (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="h-8 px-2 rounded-lg hover:bg-brand-50 transition-colors text-brand-700 inline-flex items-center gap-1 text-[11px] font-semibold"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                    <span className="hidden sm:inline">Read all</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-700"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin text-brand-600' : ''} />
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-700"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {!selectedNotif && (
              <div className="mt-3 -mx-3.5 sm:-mx-4 px-3.5 sm:px-4 pb-3 border-b border-stone-100 space-y-2">
                <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide overscroll-x-contain">
                  {INBOX_TABS.map((tab) => {
                    const active = filter === tab.key;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setFilter(tab.key)}
                        title={tab.key === 'company' ? 'Company' : tab.label}
                        className={`h-8 px-2.5 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 flex-shrink-0 whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-stone-900 text-white shadow-sm'
                            : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                        }`}
                      >
                        {Icon ? <Icon size={12} strokeWidth={2.25} /> : null}
                        {tab.label}
                        {tab.key === 'unread' && unreadCount > 0 ? (
                          <span className={`min-w-[1.1rem] h-4 px-1 rounded-md text-[10px] font-bold tabular-nums leading-4 text-center ${
                            active ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700'
                          }`}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mr-1">Sort</span>
                  <button
                    type="button"
                    onClick={() => setSortOrder('latest')}
                    className={`h-7 px-2 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 transition-colors ${
                      sortOrder === 'latest'
                        ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-100'
                        : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowDownWideNarrow size={12} />
                    Latest
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('oldest')}
                    className={`h-7 px-2 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 transition-colors ${
                      sortOrder === 'oldest'
                        ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-100'
                        : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowUpWideNarrow size={12} />
                    Oldest
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain notif-inbox-scroll">
            {/* Detail View — when a notification is clicked */}
            {selectedNotif ? (
              <NotificationDetail
                selectedNotif={selectedNotif}
                processingAction={processingAction}
                onBack={() => setSelectedNotif(null)}
                onAccept={(n) => { handleAcceptInvitation(n); setSelectedNotif(null); }}
                onDecline={(n) => { handleDeclineInvitation(n); setSelectedNotif(null); }}
                onViewTeam={viewTeam}
                onViewCandidate={viewCandidate}
                onDownloadReport={downloadSharedReport}
                isFreelancer={isFreelancer}
                onDismiss={(id) => { dismiss(id); setSelectedNotif(null); }}
                copyPhone={copyPhone}
              />
            ) : (
            /* Normal list view */
            loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-xl bg-brand-100" />
                  <RefreshCw size={18} className="absolute inset-0 m-auto animate-spin text-brand-600" />
                </div>
                <p className="text-xs font-medium text-stone-500">Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                tone={filter === 'unread' || filter === 'me' ? 'emerald' : 'sky'}
                compact
                message={
                  filter === 'unread' ? 'You’re all caught up'
                    : filter === 'mention' ? 'No mentions'
                    : filter === 'team' ? 'No team updates'
                    : filter === 'company' ? 'No company posts'
                    : filter === 'me' ? 'Nothing assigned to you'
                    : 'Inbox is quiet'
                }
                subMessage={
                  filter === 'unread'
                    ? 'No unread items right now.'
                    : filter === 'mention'
                      ? 'When someone tags you on a candidate, it shows here.'
                      : filter === 'team'
                        ? 'Work from people who report to you lands here.'
                        : filter === 'company'
                          ? 'Org announcements for your audience show here.'
                          : 'Callback reminders, shares, mentions, and team invites will show up here.'
                }
              />
            ) : (
              <div>
                {groupNotifications(notifications, sortOrder).map((group) => (
                  <div key={group.key}>
                    <p className="sticky top-0 z-[1] px-3.5 sm:px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 bg-stone-50/95 border-b border-stone-100">
                      {group.label}
                    </p>
                    <div className="divide-y divide-stone-100/80">
                      {group.items.map((notif) => (
                        <NotificationListItem
                          key={notif._id}
                          notif={notif}
                          processingAction={processingAction}
                          onClick={() => handleNotifClick(notif)}
                          onAccept={handleAcceptInvitation}
                          onDecline={handleDeclineInvitation}
                          onDownloadReport={downloadSharedReport}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && !selectedNotif && (
            <div className="px-3.5 sm:px-4 py-2.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-semibold text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 size={12} />
                Clear read
              </button>
              <span className="text-[11px] font-medium text-stone-400 tabular-nums whitespace-nowrap">
                {notifications.length} item{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default NotificationBell;
