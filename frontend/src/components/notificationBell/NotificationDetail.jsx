import React from 'react';
import { X, Check, Clock, Calendar, Phone, ChevronRight, Mail, Eye, Users, Share2, UserPlus, UserX } from 'lucide-react';
import { NotifTypeIcon, timeAgo } from './notificationBellHelpers';

export default function NotificationDetail({
  selectedNotif,
  processingAction,
  onBack,
  onAccept,
  onDecline,
  onViewTeam,
  onViewCandidate,
  onDismiss,
  copyPhone,
}) {
  return (
              <div className="p-4" style={{ animation: 'fadeInDown 0.15s ease-out' }}>
                {/* Back button */}
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold mb-3"
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
                          onClick={() => onAccept(selectedNotif)}
                          disabled={!!processingAction}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 col-span-1"
                        >
                          <UserPlus size={13} />
                          Accept Invitation
                        </button>
                        <button
                          onClick={() => onDecline(selectedNotif)}
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
                        onClick={onViewTeam}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <Users size={13} />
                        View Team
                      </button>
                    )}
                    
                    {/* Share notification - view shared candidates in ATS */}
                    {selectedNotif.type === 'share_request' && (
                      <button
                        onClick={() => onViewCandidate(true)}
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
                          onClick={onViewCandidate}
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
                      onClick={() => onDismiss(selectedNotif._id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Check size={13} />
                      Dismiss
                    </button>
                    <button
                      onClick={() => onDismiss(selectedNotif._id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <X size={13} />
                      Done / Handled
                    </button>
                  </div>
                </div>
              </div>
  );
}
