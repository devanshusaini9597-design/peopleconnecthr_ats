import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import EmptyState from './ui/EmptyState';
import { BASE_API_URL } from '../config';
import NotificationDetail from './notificationBell/NotificationDetail';
import NotificationListItem from './notificationBell/NotificationListItem';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread
  const [selectedNotif, setSelectedNotif] = useState(null); // detail view
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
      const status = filter === 'unread' ? '&status=unread' : '';
      const res = await authenticatedFetch(`${BASE_API_URL}/api/notifications?limit=30${status}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Poll count every 30 seconds
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Fetch notifications when panel opens or filter changes
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, filter, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
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
    } catch { /* silent */ }
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await authenticatedFetch(`${BASE_API_URL}/api/notifications/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  // Dismiss single
  const dismiss = async (id) => {
    try {
      await authenticatedFetch(`${BASE_API_URL}/api/notifications/${id}/dismiss`, { method: 'PUT' });
      setNotifications(prev => prev.filter(n => n._id !== id));
      fetchCount();
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

  // Navigate to candidate in ATS (shared view for share notifications)
  const viewCandidate = (shared = false) => {
    setIsOpen(false);
    setSelectedNotif(null);
    navigate(shared ? '/ats?view=shared' : '/ats');
  };

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


  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2.5 w-[min(420px,calc(100vw-1.5rem))] max-h-[min(580px,70vh)] bg-white rounded-2xl shadow-2xl shadow-stone-300/40 border border-stone-200/80 overflow-hidden z-50 flex flex-col animate-fade-in"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 flex-shrink-0" />

          {/* Header */}
          <div className="px-4 pt-3.5 pb-3 border-b border-stone-100 bg-gradient-to-b from-stone-50/90 to-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center shadow-sm shadow-brand-500/20 flex-shrink-0">
                  <Bell size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-stone-900 tracking-tight">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 truncate">Callbacks, shares & team updates</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="p-2 rounded-xl hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-700"
                  title="Refresh"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin text-brand-600' : ''} />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="p-2 rounded-xl hover:bg-brand-50 transition-colors text-stone-400 hover:text-brand-700"
                    title="Mark all as read"
                  >
                    <CheckCheck size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-stone-100 transition-all text-stone-400 hover:text-stone-700 hover:rotate-90"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex p-1 mt-3 rounded-xl bg-stone-100/90 border border-stone-200/60">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  filter === 'all'
                    ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  filter === 'unread'
                    ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Unread{unreadCount > 0 ? ` · ${unreadCount}` : ''}
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
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
                tone={filter === 'unread' ? 'emerald' : 'sky'}
                compact
                message={filter === 'unread' ? 'You’re all caught up' : 'Inbox is quiet'}
                subMessage={
                  filter === 'unread'
                    ? 'No unread items right now.'
                    : 'Callback reminders, shares, and team invites will show up here.'
                }
              />
            ) : (
              <div className="divide-y divide-stone-100">
                {notifications.map((notif) => (
                  <NotificationListItem
                    key={notif._id}
                    notif={notif}
                    processingAction={processingAction}
                    onClick={() => handleNotifClick(notif)}
                    onAccept={handleAcceptInvitation}
                    onDecline={handleDeclineInvitation}
                    onDismiss={dismiss}
                  />
                ))}
              </div>
            )
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-stone-100 bg-stone-50/80 flex items-center justify-between">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-stone-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={12} />
                Clear read
              </button>
              <span className="text-[11px] font-medium text-stone-400 tabular-nums">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
