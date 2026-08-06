import React from 'react';
import {
  AlertTriangle, Calendar, Clock, UserPlus, Check, UserX, Share2,
} from 'lucide-react';

export const NotifTypeIcon = ({ type, priority }) => {
  if (type === 'invitation') return <UserPlus size={16} className="text-blue-500 flex-shrink-0" />;
  if (type === 'invitation_accepted') return <Check size={16} className="text-green-500 flex-shrink-0" />;
  if (type === 'invitation_declined') return <UserX size={16} className="text-red-500 flex-shrink-0" />;
  if (type === 'share_request') return <Share2 size={16} className="text-emerald-500 flex-shrink-0" />;
  if (priority === 'urgent') return <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />;
  if (priority === 'high') return <Clock size={16} className="text-orange-500 flex-shrink-0" />;
  return <Calendar size={16} className="text-blue-500 flex-shrink-0" />;
};

export const PriorityBadge = ({ priority }) => {
  const styles = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${styles[priority] || styles.low}`}>
      {priority}
    </span>
  );
};

export const PriorityIcon = ({ priority }) => {
  if (priority === 'urgent') return <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />;
  if (priority === 'high') return <Clock size={16} className="text-orange-500 flex-shrink-0" />;
  return <Calendar size={16} className="text-blue-500 flex-shrink-0" />;
};

export const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};
