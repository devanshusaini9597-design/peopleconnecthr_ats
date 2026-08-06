import React from 'react';
import {
  Mail, Save, Eye, EyeOff, Loader2, Server, Send,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { SMTP_PRESETS, PROVIDER_GROUPS, presetById } from './emailSettingsConstants';

export default function SmtpConnectModal({
  open,
  onClose,
  hasPersonalSmtp,
  draft,
  setDraft,
  isCustom,
  showPassword,
  saving,
  testing,
  onSelectProvider,
  onRevealPassword,
  onTest,
  onSave,
}) {
  const draftPreset = presetById(draft.smtpProvider);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={hasPersonalSmtp ? 'Edit mailbox' : 'Connect mailbox'}
      description="Choose your email provider. We verify the connection before saving."
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={onTest} disabled={testing || !draft.smtpEmail} className="btn-secondary">
            {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {testing ? 'Testing…' : 'Test'}
          </button>
          <button type="button" onClick={onSave} disabled={saving || !draft.smtpEmail} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Verifying…' : 'Save & verify'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {PROVIDER_GROUPS.map((group) => {
          const items = SMTP_PRESETS.filter((p) => p.group === group.key);
          if (!items.length) return null;
          return (
            <div key={group.key}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((preset) => {
                  const active = draft.smtpProvider === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectProvider(preset.id)}
                      className={`px-3.5 py-3 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-400'
                          : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          active ? 'bg-brand-100 text-brand-600' : 'bg-stone-100 text-stone-500'
                        }`}>
                          {preset.id === 'custom' ? <Server className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold tracking-tight ${active ? 'text-brand-700' : 'text-stone-800'}`}>
                            {preset.label}
                          </p>
                          <p className="text-[11px] text-stone-400 truncate">{preset.hint}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {isCustom ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label-ats">Server address</label>
              <input
                type="text"
                value={draft.smtpHost}
                onChange={(e) => setDraft((prev) => ({ ...prev, smtpHost: e.target.value }))}
                placeholder="smtp.yourdomain.com"
                className="input-ats"
              />
            </div>
            <div>
              <label className="label-ats">Port</label>
              <input
                type="number"
                value={draft.smtpPort}
                onChange={(e) => setDraft((prev) => ({ ...prev, smtpPort: parseInt(e.target.value, 10) || 587 }))}
                placeholder="587"
                className="input-ats"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-500">
            <Server size={13} className="text-stone-400 shrink-0" />
            <span>Connection details filled in for you</span>
            <span className="ml-auto font-mono font-semibold text-stone-600 truncate">
              {draftPreset.host}:{draftPreset.port}
            </span>
          </div>
        )}

        <div>
          <label className="label-ats">Email address</label>
          <input
            type="email"
            value={draft.smtpEmail}
            onChange={(e) => setDraft((prev) => ({ ...prev, smtpEmail: e.target.value }))}
            placeholder="you@company.com"
            className="input-ats"
            autoFocus
          />
        </div>

        <div>
          <label className="label-ats">
            {['gmail', 'yahoo', 'outlook'].includes(draft.smtpProvider) ? 'App password' : 'Password'}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={draft.smtpAppPassword}
              onChange={(e) => setDraft((prev) => ({ ...prev, smtpAppPassword: e.target.value }))}
              placeholder={draft.hasPassword ? 'Leave blank to keep current' : 'Password or app password'}
              className="input-ats !pr-12 font-mono"
            />
            <button
              type="button"
              onClick={onRevealPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-stone-400 mt-1.5">{draftPreset.hint}. We verify before saving.</p>
        </div>
      </div>
    </Modal>
  );
}
