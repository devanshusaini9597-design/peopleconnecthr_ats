import React from 'react';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { PASSWORD_RULES } from './profileConstants';

export default function SecuritySection({
  accountEmail,
  passwordData,
  setPasswordData,
  showCurrentPassword,
  setShowCurrentPassword,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordStrength,
  isChangingPassword,
  handleChangePassword,
  onForgotPassword,
}) {
  const pwd = passwordData.newPassword || '';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)] gap-4">
      <div className="card-ats-bordered overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="px-5 sm:px-6 py-4 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-900">Change password</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Updates sign-in for <span className="font-semibold text-stone-700">{accountEmail || 'this account'}</span>
          </p>
        </div>

        <form
          className="p-5 sm:p-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}
        >
          <div>
            <label className="label-ats" htmlFor="current-password">Current password</label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                className="input-ats !pr-11"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats" htmlFor="new-password">New password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                  className="input-ats !pr-11"
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwd && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= passwordStrength.level ? passwordStrength.color : 'bg-stone-200'}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${
                    passwordStrength.level === 1 ? 'text-red-500'
                      : passwordStrength.level === 2 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="label-ats" htmlFor="confirm-password">Confirm password</label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="input-ats !pr-11"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordData.confirmPassword && (
                <p className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
                  passwordData.newPassword === passwordData.confirmPassword ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {passwordData.newPassword === passwordData.confirmPassword
                    ? <><CheckCircle2 size={12} /> Passwords match</>
                    : <><AlertCircle size={12} /> Passwords do not match</>}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-brand-700 hover:text-brand-900 font-semibold order-2 sm:order-1 inline-flex items-center gap-1.5"
            >
              <Mail size={14} /> Forgot password?
            </button>
            <button
              type="submit"
              disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className={`btn-primary order-1 sm:order-2 ${
                !(passwordData.currentPassword && passwordData.newPassword && passwordData.confirmPassword)
                  ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              {isChangingPassword ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {isChangingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>

      <aside className="card-ats-bordered overflow-hidden relative h-fit">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-900">Requirements</h3>
          <p className="text-xs text-stone-500 mt-0.5">Must pass before the password can be saved</p>
        </div>
        <ul className="px-5 py-4 space-y-2.5">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(pwd);
            return (
              <li key={rule.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={15} className={ok ? 'text-emerald-500' : 'text-stone-300'} />
                <span className={ok ? 'text-stone-800 font-medium' : 'text-stone-500'}>{rule.label}</span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
