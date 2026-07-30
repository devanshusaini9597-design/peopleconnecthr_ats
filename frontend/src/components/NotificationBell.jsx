import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, Clock, AlertTriangle, Calendar, Phone, ChevronRight, Trash2, RefreshCw, User, Mail, ExternalLink, Eye, Users, Share2, UserPlus, UserX, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';

import { BASE_API_URL } from '../config';

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

  // Get notification type icon
  const NotifTypeIcon = ({ type, priority }) => {
    if (type === 'invitation') return <UserPlus size={16} className="text-blue-500 flex-shrink-0" />;
    if (type === 'invitation_accepted') return <Check size={16} className="text-green-500 flex-shrink-0" />;
    if (type === 'invitation_declined') return <UserX size={16} className="text-red-500 flex-shrink-0" />;
    if (type === 'share_request') return <Share2 size={16} className="text-emerald-500 flex-shrink-0" />;
    if (priority === 'urgent') return <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />;
    if (priority === 'high') return <Clock size={16} className="text-orange-500 flex-shrink-0" />;
    return <Calendar size={16} className="text-blue-500 flex-shrink-0" />;
  };

  // Priority badge
  const PriorityBadge = ({ priority }) => {
    const styles = {
      urgent: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return (
      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${styles[priority] || styles.low}`}>
        {priority}
      </span>
    );
  };

  // Priority icon
  const PriorityIcon = ({ priority }) => {
    if (priority === 'urgent') return <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />;
    if (priority === 'high') return <Clock size={16} className="text-orange-500 flex-shrink-0" />;
    return <Calendar size={16} className="text-blue-500 flex-shrink-0" />;
  };

  // Time ago formatter
  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-gray-800' : 'text-gray-600'} />
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full text-white text-[11px] font-bold ${urgentCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-[420px] max-h-[580px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 flex flex-col"
          style={{ animation: 'fadeInDown 0.15s ease-out' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchNotifications}
                  className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-500"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-500"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-500"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'unread' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Unread {unreadCount > 0 && `(${unreadCount})`}
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {/* Detail View — when a notification is clicked */}
            {selectedNotif ? (
              <div className="p-4" style={{ animation: 'fadeInDown 0.15s ease-out' }}>
                {/* Back button */}
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mb-3"
                >
                  <ChevronRight size={12} className="rotate-180" />
                  Back to all notifications
                </button>

                {/* Type Header Bar */}
                <div className={`rounded-lg p-3 mb-4 ${
                  selectedNotif.type === 'invitation' ? 'bg-blue-50 border border-blue-200' :
                  selectedNotif.type === 'share_request' ? 'bg-emerald-50 border border-emerald-200' :
                  selectedNotif.type === 'invitation_accepted' ? 'bg-green-50 border border-green-200' :
                  selectedNotif.type === 'invitation_declined' ? 'bg-red-50 border border-red-200' :
                  selectedNotif.priority === 'urgent' ? 'bg-red-50 border border-red-200' :
                  selectedNotif.priority === 'high' ? 'bg-orange-50 border border-orange-200' :
                  selectedNotif.priority === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <NotifTypeIcon type={selectedNotif.type} priority={selectedNotif.priority} />
                    <span className={`text-xs font-bold uppercase ${
                      selectedNotif.type === 'invitation' ? 'text-blue-700' :
                      selectedNotif.type === 'share_request' ? 'text-emerald-700' :
                      selectedNotif.type === 'invitation_accepted' ? 'text-green-700' :
                      selectedNotif.type === 'invitation_declined' ? 'text-red-700' :
                      selectedNotif.priority === 'urgent' ? 'text-red-700' :
                      selectedNotif.priority === 'high' ? 'text-orange-700' :
                      'text-blue-700'
                    }`}>
                      {selectedNotif.type === 'invitation' ? (selectedNotif.status === 'accepted' ? 'Accepted' : selectedNotif.status === 'declined' ? 'Declined' : 'Team Invitation') :
                       selectedNotif.type === 'share_request' ? 'Shared Candidates' :
                       selectedNotif.type === 'invitation_accepted' ? 'Invitation Accepted' :
                       selectedNotif.type === 'invitation_declined' ? 'Invitation Declined' :
                       `${selectedNotif.priority} priority`}
                    </span>
                    {selectedNotif.daysRemaining !== undefined && (
                      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                        selectedNotif.daysRemaining <= 0 ? 'bg-red-200 text-red-800' :
                        selectedNotif.daysRemaining <= 2 ? 'bg-orange-200 text-orange-800' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {selectedNotif.daysRemaining < 0 ? `${Math.abs(selectedNotif.daysRemaining)} day(s) overdue` :
                         selectedNotif.daysRemaining === 0 ? 'DUE TODAY' :
                         `${selectedNotif.daysRemaining} day(s) remaining`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Card - Contextual based on type */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                  {/* Invitation / Team notifications */}
                  {(selectedNotif.type === 'invitation' || selectedNotif.type === 'invitation_accepted' || selectedNotif.type === 'invitation_declined') && (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                          <Users size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{selectedNotif.title}</p>
                          <p className="text-xs text-gray-500">From: {selectedNotif.senderName || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {selectedNotif.relatedEmail && (
                          <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                            <span className="flex items-center gap-2 text-gray-500"><Mail size={13} /> Inviter</span>
                            <span className="font-medium text-gray-900">{selectedNotif.relatedEmail}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between py-1.5">
                          <span className="flex items-center gap-2 text-gray-500"><Clock size={13} /> Received</span>
                          <span className="font-medium text-gray-500 text-xs">{timeAgo(selectedNotif.createdAt)}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Share request notification */}
                  {selectedNotif.type === 'share_request' && (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                          <Share2 size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{selectedNotif.title}</p>
                          <p className="text-xs text-gray-500">From: {selectedNotif.senderName || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between py-1.5">
                          <span className="flex items-center gap-2 text-gray-500"><Clock size={13} /> Shared</span>
                          <span className="font-medium text-gray-500 text-xs">{timeAgo(selectedNotif.createdAt)}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Callback-type notifications (original) */}
                  {(selectedNotif.type === 'callback_reminder' || selectedNotif.type === 'callback_today' || selectedNotif.type === 'callback_overdue') && (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {(selectedNotif.candidateName || 'N')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{selectedNotif.candidateName}</p>
                          <p className="text-xs text-gray-500">{selectedNotif.candidatePosition || 'No position'}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {selectedNotif.candidateContact && (
                          <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                            <span className="flex items-center gap-2 text-gray-500"><Phone size={13} /> Contact</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{selectedNotif.candidateContact}</span>
                              <button onClick={() => copyPhone(selectedNotif.candidateContact)} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium px-1.5 py-0.5 hover:bg-blue-50 rounded">Copy</button>
                            </div>
                          </div>
                        )}
                        {selectedNotif.callBackDate && (
                          <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                            <span className="flex items-center gap-2 text-gray-500"><Calendar size={13} /> Callback Date</span>
                            <span className="font-medium text-gray-900">{selectedNotif.callBackDate}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between py-1.5">
                          <span className="flex items-center gap-2 text-gray-500"><Clock size={13} /> Notified</span>
                          <span className="font-medium text-gray-500 text-xs">{timeAgo(selectedNotif.createdAt)}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Generic / System notifications */}
                  {!['invitation', 'invitation_accepted', 'invitation_declined', 'share_request', 'callback_reminder', 'callback_today', 'callback_overdue'].includes(selectedNotif.type) && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="flex items-center gap-2 text-gray-500"><Clock size={13} /> Notified</span>
                        <span className="font-medium text-gray-500 text-xs">{timeAgo(selectedNotif.createdAt)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-600 leading-relaxed">{selectedNotif.message}</p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Invitation-specific actions */}
                    {selectedNotif.type === 'invitation' && selectedNotif.status === 'pending' && selectedNotif.actionRequired && (
                      <>
                        <button
                          onClick={() => { handleAcceptInvitation(selectedNotif); setSelectedNotif(null); }}
                          disabled={!!processingAction}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 col-span-1"
                        >
                          <UserPlus size={13} />
                          Accept Invitation
                        </button>
                        <button
                          onClick={() => { handleDeclineInvitation(selectedNotif); setSelectedNotif(null); }}
                          disabled={!!processingAction}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 col-span-1"
                        >
                          <UserX size={13} />
                          Decline
                        </button>
                      </>
                    )}
                    
                    {/* Share / Invitation result - view team */}
                    {(selectedNotif.type === 'invitation_accepted' || selectedNotif.type === 'invitation_declined' || selectedNotif.type === 'invitation') && (
                      <button
                        onClick={viewTeam}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <Users size={13} />
                        View Team
                      </button>
                    )}
                    
                    {/* Share notification - view shared candidates in ATS */}
                    {selectedNotif.type === 'share_request' && (
                      <button
                        onClick={() => viewCandidate(true)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <Eye size={13} />
                        View Shared Candidates
                      </button>
                    )}
                    
                    {/* Callback reminder - view in ATS + call */}
                    {(selectedNotif.type === 'callback_reminder' || selectedNotif.type === 'callback_today' || selectedNotif.type === 'callback_overdue') && (
                      <>
                        <button
                          onClick={viewCandidate}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <Eye size={13} />
                          View in ATS
                        </button>
                        {selectedNotif.candidateContact && (
                          <a
                            href={`tel:${selectedNotif.candidateContact}`}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Phone size={13} />
                            Call Now
                          </a>
                        )}
                      </>
                    )}
                    
                    <button
                      onClick={() => { dismiss(selectedNotif._id); setSelectedNotif(null); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Check size={13} />
                      Dismiss
                    </button>
                    <button
                      onClick={() => { dismiss(selectedNotif._id); setSelectedNotif(null); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <X size={13} />
                      Done / Handled
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            /* Normal list view */
            loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={20} className="animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bell size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">
                  {filter === 'unread' ? 'All caught up!' : 'Callback reminders will appear here'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notif) => (
                  <div
                    key={notif._id}
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group ${!notif.isRead ? 'bg-blue-50/40 border-l-3 border-l-blue-500' : ''}`}
                    onClick={() => handleNotifClick(notif)}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className="mt-0.5">
                        <NotifTypeIcon type={notif.type} priority={notif.priority} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${!notif.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {notif.title}
                          </p>
                          {notif.type === 'invitation' && notif.status === 'pending' ? (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-blue-100 text-blue-700 border-blue-200">
                              Action Required
                            </span>
                          ) : notif.type === 'invitation' && notif.status === 'accepted' ? (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-green-100 text-green-700 border-green-200">
                              Accepted
                            </span>
                          ) : notif.type === 'invitation' && notif.status === 'declined' ? (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-200">
                              Declined
                            </span>
                          ) : (
                            <PriorityBadge priority={notif.priority} />
                          )}
                        </div>
                        
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                        
                        {/* Action buttons for invitations */}
                        {notif.type === 'invitation' && notif.actionRequired && notif.status === 'pending' && (
                          <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleAcceptInvitation(notif)}
                              disabled={processingAction === notif._id + '_accept' || processingAction === notif._id + '_decline'}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {processingAction === notif._id + '_accept' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineInvitation(notif)}
                              disabled={processingAction === notif._id + '_accept' || processingAction === notif._id + '_decline'}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {processingAction === notif._id + '_decline' ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                              Decline
                            </button>
                          </div>
                        )}
                        
                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2">
                          {notif.senderName && (notif.type === 'invitation' || notif.type === 'share_request') && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <User size={11} />
                              {notif.senderName}
                            </span>
                          )}
                          {notif.callBackDate && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <Calendar size={11} />
                              {notif.callBackDate}
                            </span>
                          )}
                          {notif.candidateContact && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <Phone size={11} />
                              {notif.candidateContact}
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400">{timeAgo(notif.createdAt)}</span>
                          
                          {/* Days badge */}
                          {notif.daysRemaining !== undefined && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              notif.daysRemaining <= 0 ? 'bg-red-100 text-red-700' :
                              notif.daysRemaining <= 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {notif.daysRemaining < 0 ? `${Math.abs(notif.daysRemaining)}d overdue` :
                               notif.daysRemaining === 0 ? 'TODAY' :
                               `${notif.daysRemaining}d left`}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Dismiss button */}
                      <div className="flex flex-col items-center gap-1 self-start">
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(notif._id); }}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-all text-gray-400 hover:text-gray-600"
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                        <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <button
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <Trash2 size={12} />
                Clear read
              </button>
              <span className="text-[11px] text-gray-400">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
