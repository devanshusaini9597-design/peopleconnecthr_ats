import React from 'react';
import { Mail, Save, Loader2, CheckCircle2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ConfirmationModal';

export default function ProfileModals({
  showSaveConfirmModal,
  setShowSaveConfirmModal,
  isSavingProfile,
  handleSaveProfile,
  showRecoveryModal,
  setShowRecoveryModal,
  recoverySuccess,
  setRecoverySuccess,
  recoveryEmail,
  setRecoveryEmail,
  isRecovering,
  handlePasswordRecovery,
  showLogoutConfirm,
  setShowLogoutConfirm,
  handleLogoutAllDevices,
}) {
  return (
    <>
      <Modal
        open={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        title="Save changes?"
        description="Your name and phone number will be updated."
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setShowSaveConfirmModal(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSaveProfile} disabled={isSavingProfile} className="btn-primary">
              {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save changes
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-500 leading-relaxed">Confirm to apply your profile updates.</p>
      </Modal>

      <Modal
        open={showRecoveryModal}
        onClose={() => { setShowRecoveryModal(false); setRecoverySuccess(false); }}
        title="Reset password"
        description="Recover your account without your current password."
        size="sm"
        footer={
          <button
            type="button"
            onClick={() => { setShowRecoveryModal(false); setRecoverySuccess(false); }}
            className="btn-secondary w-full sm:w-auto"
          >
            {recoverySuccess ? 'Close' : 'Cancel'}
          </button>
        }
      >
        {recoverySuccess ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h4 className="text-base font-bold text-stone-900 mb-1">Email sent</h4>
            <p className="text-sm text-stone-500">Check your inbox for reset instructions</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3">
              <p className="text-sm text-stone-600 leading-relaxed">
                Enter your email and we&apos;ll send a reset link — even if you&apos;ve forgotten your password.
              </p>
            </div>
            <div>
              <label className="label-ats">Email address</label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="Enter your registered email"
                className="input-ats"
              />
            </div>
            <button
              type="button"
              onClick={handlePasswordRecovery}
              disabled={isRecovering || !recoveryEmail}
              className={`btn-primary w-full ${!recoveryEmail ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isRecovering ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Mail size={16} /> Send reset link</>}
            </button>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogoutAllDevices}
        title="Log out?"
        message="End your session on this device? You’ll need to sign in again to continue."
        confirmText="Log out"
        type="danger"
      />
    </>
  );
}
