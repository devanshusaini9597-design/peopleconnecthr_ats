'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Users, X } from 'lucide-react';

export type RejectKeepWarmChoice = {
  addToTalentPool: boolean;
  grantConsent: boolean;
};

interface Props {
  candidateName: string;
  onConfirm: (choice: RejectKeepWarmChoice) => void;
  onCancel: () => void;
}

export function RejectKeepWarmModal({ candidateName, onConfirm, onCancel }: Props) {
  const [addToTalentPool, setAddToTalentPool] = useState(true);
  const [grantConsent, setGrantConsent] = useState(false);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Reject candidate</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Move <span className="font-semibold text-stone-700">{candidateName}</span> to Rejected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50 cursor-pointer">
          <input
            type="checkbox"
            checked={addToTalentPool}
            onChange={(e) => setAddToTalentPool(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-semibold text-stone-800">Keep warm in talent pool</span>
            <span className="block text-xs text-stone-500 mt-0.5">
              Add to Silver medalists for future openings
            </span>
          </span>
        </label>

        {addToTalentPool && (
          <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60 cursor-pointer">
            <input
              type="checkbox"
              checked={grantConsent}
              onChange={(e) => setGrantConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-stone-800">
                Candidate consented to talent-pool retention
              </span>
              <span className="block text-xs text-stone-500 mt-0.5">
                Required for GDPR / retention. Without this, they stay Rejected but are not added to a pool.
              </span>
            </span>
          </label>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                addToTalentPool,
                grantConsent: addToTalentPool ? grantConsent : false,
              })
            }
            className="px-3.5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            Confirm reject
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
