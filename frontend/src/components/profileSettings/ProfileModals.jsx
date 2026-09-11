import React from 'react';
import { Mail, Save, Loader2, CheckCircle2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ConfirmationModal';

export default function ProfileModals({
  showRecoveryModal,
  setShowRecoveryModal,
  recoverySuccess,
  setRecoverySuccess,
  recoveryEmail,
  isRecovering,
  handlePasswordRecovery,
  showLogoutConfirm,
  setShowLogoutConfirm,
  handleLogoutAllDevices,
}) {
  return (
    <>
      <Modal
        open={showRecoveryModal}
        onClose={() => { setShowRecoveryModal(false); setRecoverySuccess(false); }}
        title="Reset password"
        description="A reset link is sent to this account’s email."
        size="sm"
        footer={
          recoverySuccess ? (
            <button
              type="button"
              onClick={() => { setShowRecoveryModal(false); setRecoverySuccess(false); }}
              className="btn-primary w-full sm:w-auto"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setShowRecoveryModal(false); setRecoverySuccess(false); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordRecovery}
                disabled={isRecovering || !recoveryEmail}
                className="btn-primary"
              >
                {isRecovering ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {isRecovering ? 'Sending…' : 'Send reset link'}
              </button>
            </>
          )
        }
      >
        {recoverySuccess ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h4 className="text-base font-bold text-stone-900 mb-1">Email sent</h4>
            <p className="text-sm text-stone-500 leading-relaxed">
              Check <span className="font-semibold text-stone-700">{recoveryEmail}</span> for reset instructions.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Send to</p>
            <p className="text-sm font-semibold text-stone-800 mt-1 break-all">{recoveryEmail || '—'}</p>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed">
              The link expires in 15 minutes. If you didn’t request this, you can ignore the email.
            </p>
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
