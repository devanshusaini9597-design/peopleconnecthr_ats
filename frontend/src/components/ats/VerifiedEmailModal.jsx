import React from 'react';
import { Mail } from 'lucide-react';

export default function VerifiedEmailModal({ open, message, onClose }) {
  if (!open) return null;
  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/55 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Mail className="text-amber-600" size={20} />
                </div>
                <h3 className="text-base font-bold text-stone-900">Use company email to send</h3>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-stone-600 leading-relaxed">
                {message}
              </p>
              <p className="mt-3 text-xs text-stone-500">
                Emails can only be sent from verified company addresses (e.g. yourname@yourcompany.com). Log in with that account to send emails to candidates.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
  );
}
