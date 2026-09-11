import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import API_URL from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { resolveOrgLogoSrc } from '../../utils/orgLogo';
import { PASSWORD_RULES } from '../profileSettings/profileConstants';

function strengthOf(password) {
  if (!password) return { level: 0, label: '', color: 'bg-stone-200' };
  const score = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { level: 2, label: 'Fair', color: 'bg-amber-500' };
  return { level: 3, label: 'Strong', color: 'bg-emerald-500' };
}

function orgInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ORG';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function OrgMark({ organization }) {
  const name = organization?.name || 'Your workspace';
  const src = resolveOrgLogoSrc(organization?.logo);
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(src) && !broken;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {showImg ? (
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain bg-white border border-stone-200/80 flex-shrink-0"
        />
      ) : (
        <span className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-brand-50 text-brand-800 border border-brand-100 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
          {orgInitials(name)}
        </span>
      )}
      <span className="text-[15px] font-bold text-stone-900 tracking-tight truncate">{name}</span>
    </div>
  );
}

function PasswordField({
  id, label, value, onChange, visible, onToggle, autoComplete, children,
}) {
  return (
    <div>
      <label className="label-ats" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className="input-ats !pr-11"
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {children}
    </div>
  );
}

export default function SetPasswordModal() {
  const { user, organization, updateUser, logout } = useAuth();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const failedRule = useMemo(
    () => PASSWORD_RULES.find((rule) => !rule.test(newPassword)),
    [newPassword]
  );
  const mismatch = Boolean(confirmPassword) && newPassword !== confirmPassword;
  const canSubmit = newPassword && confirmPassword && !failedRule && !mismatch;
  const strength = strengthOf(newPassword);

  if (!user?.mustChangePassword) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) {
      if (failedRule) setError(`Include ${failedRule.label.toLowerCase()}.`);
      else if (mismatch) setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/profile/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'The password could not be updated.');
      }
      updateUser({ mustChangePassword: false });
      toast.success('Password updated — welcome back');
    } catch (err) {
      setError(err.message || 'The password could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] auth-form-side overflow-y-auto overscroll-contain">
      <FocusLock>
        <div className="min-h-dvh flex items-stretch sm:items-center justify-center p-0 sm:p-6">
          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="set-password-title"
            className="auth-form-card w-full sm:max-w-[440px] min-h-dvh sm:min-h-0 rounded-none sm:rounded-3xl !p-0 flex flex-col"
          >
            <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:pt-7 sm:px-7">
              <OrgMark organization={organization} />
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                Account security
              </p>
              <h1 id="set-password-title" className="mt-1.5 text-xl sm:text-[1.35rem] font-bold text-stone-900 tracking-tight">
                Choose your password
              </h1>
              <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">
                You signed in with a temporary password. Choose a personal password to continue — you will not need the temporary one again.
              </p>
              {user?.email ? (
                <p className="mt-3 inline-flex max-w-full items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[12px] font-medium text-stone-700 truncate">
                  {user.email}
                </p>
              ) : null}
              <div className="mt-4 rounded-xl border border-brand-200/80 bg-brand-50/40 px-3.5 py-3 flex items-start gap-2.5">
                <KeyRound size={16} className="text-brand-700 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] leading-relaxed text-brand-950/90">
                  No need to re-enter the temporary password — you are already signed in.
                </p>
              </div>
            </div>

            <div className="flex-1 px-5 sm:px-7 py-5 space-y-3.5 sm:space-y-4">
              <PasswordField
                id="new-password-gate"
                label="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                visible={showNew}
                onToggle={() => setShowNew((v) => !v)}
                autoComplete="new-password"
              >
                {newPassword ? (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-stone-200'}`}
                        />
                      ))}
                    </div>
                    <p className={`mt-1.5 text-[11px] font-medium ${
                      strength.level === 1 ? 'text-red-600'
                        : strength.level === 2 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {strength.label}
                      <span className="ml-1.5 font-normal text-stone-400">
                        8+ characters, upper, lower, number, special
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-stone-400">
                    8+ characters, with uppercase, lowercase, a number, and a special character.
                  </p>
                )}
              </PasswordField>
              <PasswordField
                id="confirm-password-gate"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                visible={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
                autoComplete="new-password"
              />
              {error ? (
                <p className="text-sm text-red-700" role="alert">{error}</p>
              ) : null}
            </div>

            <div className="px-5 sm:px-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-7 pt-1">
              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="btn-primary w-full"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Saving…' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="mt-3 w-full text-sm font-medium text-stone-500 hover:text-stone-800 py-1"
              >
                Sign out
              </button>
            </div>
          </form>
        </div>
      </FocusLock>
    </div>,
    document.body
  );
}
