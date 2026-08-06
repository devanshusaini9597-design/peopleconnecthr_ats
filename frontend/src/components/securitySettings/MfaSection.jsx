import React from 'react';
import { Smartphone, Loader2, KeyRound, Copy, Check } from 'lucide-react';

export default function MfaSection({
  mfaStatus,
  setupData,
  verifyCode,
  setVerifyCode,
  backupCodes,
  enrolling,
  copiedSecret,
  onStartSetup,
  onConfirmSetup,
  onCopySecret,
}) {
  return (
    <section
      data-tour="sec-mfa"
      className="lg:col-span-5 card-ats-bordered relative overflow-hidden p-4 sm:p-5 space-y-4 min-w-0 lg:sticky lg:top-4"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative">
        <h2 className="text-[15px] font-bold text-stone-900 tracking-tight inline-flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-brand-600" /> Your authenticator (MFA)
        </h2>
        <p className="text-[11px] text-stone-400 mt-0.5">TOTP for your account</p>
      </div>

      {mfaStatus.mfaEnabled ? (
        <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
          MFA is enabled.
          <span className="block text-[11px] text-emerald-700/80 mt-1">
            {mfaStatus.backupCodesRemaining} backup code{mfaStatus.backupCodesRemaining === 1 ? '' : 's'} remaining.
          </span>
        </div>
      ) : (
        <div className="relative space-y-3">
          <p className="text-sm text-stone-600 leading-relaxed">
            Protect your account with Google Authenticator, Authy, or any TOTP app.
          </p>
          {!setupData ? (
            <button type="button" onClick={onStartSetup} disabled={enrolling} className="btn-primary w-full sm:w-auto">
              {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Set up MFA
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-3.5">
              <p className="text-sm text-stone-600">
                Enter this secret in your authenticator app:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs font-mono bg-white border border-stone-200 rounded-xl px-3 py-2.5 break-all min-w-0">
                  {setupData.secret}
                </code>
                <button type="button" onClick={onCopySecret} className="btn-secondary !px-3 flex-shrink-0" aria-label="Copy secret">
                  {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {setupData.otpauthUrl && (
                <p className="text-[10px] text-stone-400 break-all leading-relaxed">{setupData.otpauthUrl}</p>
              )}
              <div>
                <label className="label-ats">Verification code</label>
                <div className="relative max-w-xs">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-ats !pl-10 font-mono tracking-widest"
                    placeholder="000000"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <button type="button" onClick={onConfirmSetup} disabled={enrolling} className="btn-primary w-full sm:w-auto">
                {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Verify & enable
              </button>
            </div>
          )}
        </div>
      )}

      {backupCodes?.length > 0 && (
        <div className="relative rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Save these backup codes — shown once</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-xs text-amber-950">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}
