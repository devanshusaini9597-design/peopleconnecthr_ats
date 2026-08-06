import React from 'react';
import {
  User, Mail, Phone, Lock, Shield, Save, Eye, EyeOff, AlertCircle, CheckCircle2,
  Loader2, Calendar, Database, Settings, ChevronRight, LogOut, Camera, Trash2,
  Pencil, BadgeCheck, Sparkles, Info,
} from 'lucide-react';
import FieldRow from './FieldRow';
import { formatNameForInput } from '../../utils/textFormatter';

export default function SecuritySection({ passwordData, setPasswordData, showCurrentPassword, setShowCurrentPassword, showNewPassword, setShowNewPassword, showConfirmPassword, setShowConfirmPassword, passwordStrength, isChangingPassword, handleChangePassword, setShowRecoveryModal }) {
  return (
        <div className="space-y-4">
          <div className="card-ats-bordered overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-5 sm:px-6 py-4 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900">Change password</h3>
              <p className="text-xs text-stone-500 mt-0.5">Keep your account secure with a strong password</p>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="label-ats">Current password</label>
                <div className="relative">
                  <input
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
                  <label className="label-ats">New password</label>
                  <div className="relative">
                    <input
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
                  {passwordData.newPassword && (
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
                  <label className="label-ats">Confirm password</label>
                  <div className="relative">
                    <input
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

              <p className="text-[11px] text-stone-400">Min 8 characters with uppercase, lowercase, number, and special character.</p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  className="text-sm text-brand-600 hover:text-brand-800 font-semibold order-2 sm:order-1"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
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
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">Password tips: </span>
            use a unique password, mix letters/numbers/symbols, and avoid names or birthdays.
          </div>
        </div>
  );
}
