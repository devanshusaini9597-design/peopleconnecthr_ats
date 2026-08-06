import React from 'react';
import { Users, Plus, Edit2, Trash2, Mail, Phone, Building2, Loader2, Search } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { ROLE_COLORS } from './teamConstants';

export default function TeamMemberList({
  isLoading,
  members,
  filtered,
  searchQuery,
  setSearchQuery,
  setActiveTab,
  onAddFirst,
  onEdit,
  onDelete,
  deletingId,
}) {
  if (isLoading) {
    return (
      <div className="card-ats-bordered overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/80 flex items-center gap-3">
          <div className="h-4 w-32 skeleton-ats rounded-lg" />
        </div>
        <div className="divide-y divide-stone-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 sm:px-6 py-4">
              <div className="w-11 h-11 rounded-full skeleton-ats flex-shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 w-40 skeleton-ats rounded-lg" />
                <div className="h-3 w-56 max-w-full skeleton-ats rounded-lg" />
              </div>
              <div className="hidden sm:block h-8 w-16 skeleton-ats rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="card-ats-bordered">
        <EmptyState
          icon={Users}
          tone="brand"
          message="No contacts yet"
          subMessage="Add your team members, reporting managers, and stakeholders here. They'll appear as suggestions when you CC/BCC in emails — just like Gmail."
          action={
            <button type="button" onClick={onAddFirst} className="btn-primary">
              <Plus size={16} /> Add Your First Contact
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="card-ats-bordered overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/80 flex items-center justify-between gap-3 mt-1">
        <p className="text-sm font-semibold text-stone-700">
          {filtered.length} team member{filtered.length !== 1 ? 's' : ''}
        </p>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Clear search
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          tone="amber"
          message="No matching members"
          subMessage="Try adjusting your search or filter."
          action={
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveTab('all'); }}
              className="btn-secondary"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="divide-y divide-stone-100 stagger-children">
          {filtered.map((member) => (
            <div
              key={member._id}
              className="flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 hover:bg-brand-50/30 transition-colors duration-200 group"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 via-teal-600 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/20 ring-2 ring-white">
                <span className="text-white font-bold text-sm tracking-tight">
                  {member.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-stone-900 truncate tracking-tight">{member.name}</p>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg ${ROLE_COLORS[member.role] || 'bg-stone-100 text-stone-600'}`}>
                    {member.role === 'SPOC' ? 'SPOC' : member.role}
                  </span>
                  {member.invitedMe && (
                    <span className="badge-success text-[10px]" title="This person invited you to their team">
                      Invited you
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <p className="text-xs text-stone-500 flex items-center gap-1.5 min-w-0">
                    <Mail size={12} className="text-stone-400 flex-shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </p>
                  {member.phone && (
                    <p className="text-xs text-stone-400 flex items-center gap-1.5">
                      <Phone size={12} className="flex-shrink-0" /> {member.phone}
                    </p>
                  )}
                  {member.department && (
                    <p className="text-xs text-stone-400 flex items-center gap-1.5">
                      <Building2 size={12} className="flex-shrink-0" /> {member.department}
                    </p>
                  )}
                </div>
              </div>

              {!member.invitedMe && (
                <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onEdit(member)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
                    title="Edit"
                    aria-label={`Edit ${member.name}`}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(member)}
                    disabled={deletingId === member._id}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                    title="Remove"
                    aria-label={`Remove ${member.name}`}
                  >
                    {deletingId === member._id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
