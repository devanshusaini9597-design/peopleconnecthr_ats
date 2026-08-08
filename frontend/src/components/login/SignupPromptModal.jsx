import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserPlus, Mail, AlertCircle } from 'lucide-react';

export default function SignupPromptModal({ open, unmatchedEmail, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-200"
          >
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
                    <AlertCircle size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-stone-900">Account not found</h3>
                    <p className="text-xs text-stone-500 mt-0.5">No account exists with this email</p>
                  </div>
                </div>
                <button
                  onClick={() => onClose()}
                  className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X size={18} className="text-stone-400" />
                </button>
              </div>
            </div>

            <div className="px-6 pb-4">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-stone-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-stone-800 truncate">{unmatchedEmail}</span>
                </div>
              </div>
              <p className="text-sm text-stone-500 mt-3">
                Want to create a new account with this email address?
              </p>
            </div>

            <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => onClose()}
                className="btn-secondary flex-1"
              >
                Try again
              </button>
              <Link
                to="/register"
                onClick={() => onClose()}
                className="btn-primary flex-1"
              >
                <UserPlus size={16} />
                Create account
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
