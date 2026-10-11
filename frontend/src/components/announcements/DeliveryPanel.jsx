import React, { useState } from 'react';
import { CheckCircle2, Clock3, Mail, Megaphone, ShieldCheck, X } from 'lucide-react';
import { formatWhen } from './announcementsConstants';

const ROLE_LABEL = {
  owner: 'Owner',
  admin: 'Admin',
  hr_manager: 'HR manager',
  hr_recruiter: 'HR recruiter',
  recruiter: 'Recruiter',
  sales: 'Sales',
  freelancer: 'Freelancer',
  interviewer: 'Interviewer',
  readonly: 'Read only',
};

const EMAIL_TONE = {
  sent: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  partial: 'bg-amber-50 text-amber-800 border-amber-200',
  failed: 'bg-rose-50 text-rose-800 border-rose-200',
  queued: 'bg-sky-50 text-sky-800 border-sky-200',
  skipped: 'bg-stone-50 text-stone-600 border-stone-200',
};

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '•';
}

function PeopleList({ people, empty }) {
  if (!people?.length) {
    return <p className="px-4 py-8 text-center text-sm text-stone-400">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-stone-100">
      {people.map((person) => (
        <li key={person.id} className="px-4 py-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-100 to-teal-100 text-brand-800 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
            {initials(person.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-stone-900 truncate">{person.name}</span>
              {person.role ? (
                <span className="badge-neutral text-[10px] flex-shrink-0">{ROLE_LABEL[person.role] || person.role}</span>
              ) : null}
            </span>
            <span className="block text-[11px] text-stone-400 truncate">{person.email}</span>
          </span>
          <span className="text-[11px] text-stone-400 tabular-nums flex-shrink-0 hidden sm:block">
            {person.at ? formatWhen(person.at) : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function DeliveryPanel({ receipts, loading, notice }) {
  const [tab, setTab] = useState('read');
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 skeleton-ats rounded-xl" />
        <div className="h-40 skeleton-ats rounded-xl" />
      </div>
    );
  }
  if (!receipts) return <p className="text-sm text-stone-500">No delivery details yet.</p>;

  const email = receipts.emailDelivery || {};
  const tone = EMAIL_TONE[email.status] || EMAIL_TONE.skipped;
  const ends = receipts.endsAt || notice?.endsAt;
  const tabs = [
    { key: 'read', label: 'Read', count: receipts.read?.length || 0, icon: CheckCircle2 },
    { key: 'pending', label: 'Not yet', count: receipts.pending?.length || 0, icon: Clock3 },
    { key: 'dismissed', label: 'Dismissed', count: receipts.dismissed?.length || 0, icon: X },
    { key: 'ack', label: 'Acknowledged', count: receipts.acknowledged?.length || 0, icon: ShieldCheck },
  ];
  const lists = {
    read: receipts.read,
    pending: receipts.pending,
    dismissed: receipts.dismissed,
    ack: receipts.acknowledged,
  };
  const empty = {
    read: 'Nobody has opened this notice yet.',
    pending: receipts.audience === 'public' ? 'Careers-site notices are not tracked per person.' : 'Everyone in the audience has opened it.',
    dismissed: 'Nobody has dismissed the banner.',
    ack: receipts.requiresAck ? 'Nobody has acknowledged it yet.' : 'This notice does not require acknowledgment.',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-200/80 bg-gradient-to-br from-brand-50/80 via-white to-teal-50/50 px-4 py-3 text-[12px] text-stone-600 leading-relaxed">
        <p className="font-semibold text-stone-900 flex items-center gap-1.5">
          <Megaphone className="w-3.5 h-3.5 text-brand-700" />
          This notice stays up for the whole audience
        </p>
        <p className="mt-1">
          {ends
            ? `It stays live until ${formatWhen(ends)}, or until you deactivate it.`
            : 'No end date is set, so it stays live until you deactivate it.'}
          {' '}
          When someone reads it or dismisses the banner, that only changes their own view. Your feed and everyone else keep the notice.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Audience" value={receipts.audience === 'public' ? 'Public' : receipts.audienceSize || 0} />
        <Stat label="Read" value={receipts.read?.length || 0} />
        <Stat label="Still unread" value={receipts.pending?.length || 0} />
        <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1">
            <Mail className="w-3 h-3" /> Email
          </p>
          <p className="mt-1 text-sm font-bold capitalize">{email.status || 'skipped'}</p>
          {email.total ? (
            <p className="text-[10px] mt-0.5 opacity-80">{email.sent || 0} sent · {email.failed || 0} failed</p>
          ) : email.status === 'skipped' ? (
            <p className="text-[10px] mt-0.5 opacity-80">In-app only</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="flex gap-1 p-2 border-b border-stone-100 bg-stone-50/70 overflow-x-auto">
          {tabs.map((item) => {
            const Icon = item.icon;
            const on = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  on ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
                <span className={on ? 'opacity-70' : 'text-stone-400'}>{item.count}</span>
              </button>
            );
          })}
        </div>
        <div className="max-h-80 overflow-y-auto">
          <PeopleList people={lists[tab]} empty={empty[tab]} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-stone-900 tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
