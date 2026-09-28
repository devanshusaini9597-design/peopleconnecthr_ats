import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Settings2, Eye, EyeOff } from 'lucide-react';
import { relativeWhen } from './mailBody';

export default function InboxMailboxBar({
  mailbox,
  canEdit,
  saving,
  syncing,
  onSave,
  onSync,
}) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    host: mailbox?.host || 'imap.hostinger.com',
    port: mailbox?.port || 993,
    user: mailbox?.user || 'team@skillnixrecruitment.com',
    password: '',
  });

  useEffect(() => {
    if (!mailbox) return;
    setForm((f) => ({
      ...f,
      host: mailbox.host || f.host,
      port: mailbox.port || f.port,
      user: mailbox.user || f.user,
    }));
  }, [mailbox]);

  const connected = Boolean(mailbox?.connected);

  return (
    <section className="card-ats-bordered overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-500' : 'bg-stone-300'}`} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-stone-900">
              Shared mailbox
            </p>
            <p className="text-[12px] text-stone-500 mt-0.5 truncate">
              {connected
                ? `${mailbox.user} · synced ${relativeWhen(mailbox.lastSyncAt) || 'pending'}`
                : 'Connect team@ so campaign replies appear as formatted email.'}
            </p>
            {mailbox?.lastError ? (
              <p className="text-[12px] text-rose-600 mt-1">{mailbox.lastError}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {connected && canEdit && (
            <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs" onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setOpen((v) => !v)}>
              <Settings2 className="w-3.5 h-3.5" />
              {open ? 'Close' : 'Settings'}
            </button>
          )}
        </div>
      </div>
      {open && canEdit && (
        <form
          className="px-4 sm:px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-stone-100 pt-3 bg-stone-50/60"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <label className="text-[11px] font-medium text-stone-500">
            IMAP host
            <input
              className="input-ats mt-1"
              placeholder="imap.hostinger.com"
              value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
            />
          </label>
          <label className="text-[11px] font-medium text-stone-500">
            Port
            <input
              className="input-ats mt-1"
              placeholder="993"
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
            />
          </label>
          <label className="text-[11px] font-medium text-stone-500">
            Mailbox
            <input
              className="input-ats mt-1"
              type="email"
              placeholder="team@skillnixrecruitment.com"
              value={form.user}
              onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
            />
          </label>
          <label className="text-[11px] font-medium text-stone-500 sm:col-span-2">
            Password
            <span className="relative block mt-1">
              <input
                className="input-ats !pr-11 w-full"
                type={showPassword ? 'text' : 'password'}
                placeholder={connected ? 'Leave blank to keep current password' : 'Mailbox password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
            <span className="block mt-1 text-[11px] font-normal text-stone-400">
              Saved password is never displayed. Type a new one to replace it.
            </span>
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary !py-1.5 text-xs" disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save connection
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
