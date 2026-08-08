import React from 'react';
import { X, Check, Calendar, Phone, ChevronRight, User, Loader2 } from 'lucide-react';
import { NotifTypeIcon, PriorityBadge, timeAgo } from './notificationBellHelpers';

export default function NotificationListItem({
  notif,
  processingAction,
  onClick,
  onAccept,
  onDecline,
  onDismiss,
}) {
  return (
                  <div
                    className={`px-4 py-3.5 hover:bg-brand-50/40 transition-colors cursor-pointer group relative ${
                      !notif.isRead ? 'bg-brand-50/30' : ''
                    }`}
                    onClick={onClick}
                  >
                    {!notif.isRead && (
                      <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-brand-500" />
                    )}
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className="mt-0.5">
                        <NotifTypeIcon type={notif.type} priority={notif.priority} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${!notif.isRead ? 'font-semibold text-stone-900' : 'font-medium text-stone-700'}`}>
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
                        
                        <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                        
                        {/* Action buttons for invitations */}
                        {notif.type === 'invitation' && notif.actionRequired && notif.status === 'pending' && (
                          <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onAccept(notif)}
                              disabled={processingAction === notif._id + '_accept' || processingAction === notif._id + '_decline'}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {processingAction === notif._id + '_accept' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Accept
                            </button>
                            <button
                              onClick={() => onDecline(notif)}
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
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDismiss(notif._id); }}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-stone-200/80 rounded-lg transition-all text-stone-400 hover:text-stone-700"
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                        <ChevronRight size={14} className="text-stone-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
  );
}
