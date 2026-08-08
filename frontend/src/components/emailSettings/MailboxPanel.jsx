import React from 'react';
import { Mail, Pencil, Trash2, Building2, Zap } from 'lucide-react';

export default function MailboxPanel({
  hasPersonalSmtp,
  settings,
  savedPreset,
  campaignsActive,
  onEdit,
  onRemove,
}) {
  return (
    <>
      <section
        data-tour="email-smtp"
        className="card-ats-bordered relative overflow-hidden flex flex-col"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative px-4 sm:px-5 py-3.5 border-b border-stone-100">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
            <Building2 className="w-4 h-4 text-brand-600 shrink-0" />
            Your mailbox
          </h2>
          <p className="text-[12px] text-stone-500 mt-1 leading-relaxed">
            Optional. Connect Gmail, Outlook, Zoho, Hostinger, or another provider as a sending mailbox.
          </p>
        </div>

        <div className="relative p-4 sm:p-5">
          {hasPersonalSmtp ? (
            <div className="rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white to-stone-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-900 truncate">{settings.smtpEmail}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {savedPreset.label}
                    {settings.smtpHost ? ` · ${settings.smtpHost}:${settings.smtpPort || 587}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={onEdit} className="btn-secondary !text-sm !px-3">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-semibold text-stone-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-800">No mailbox connected</p>
                <p className="text-[12px] text-stone-500 mt-1 leading-relaxed">
                  Connect in a few clicks — we verify the connection before saving.
                </p>
              </div>
              <button type="button" onClick={onEdit} className="btn-primary w-full sm:w-auto shrink-0">
                Connect mailbox
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
              campaignsActive
                ? 'bg-violet-50 text-violet-600 border-violet-100'
                : 'bg-stone-100 text-stone-400 border-stone-200'
            }`}>
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-stone-900">Marketing email</p>
              <p className="text-[12px] text-stone-500 mt-0.5 leading-relaxed">
                {campaignsActive
                  ? 'Zoho Campaigns is connected for tracked bulk sends.'
                  : 'Ask an admin to add the Campaigns API key on the server if you need bulk marketing email.'}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
            campaignsActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-stone-100 text-stone-500 border-stone-200'
          }`}>
            {campaignsActive ? 'Active' : 'Not set'}
          </span>
        </div>
      </section>
    </>
  );
}
