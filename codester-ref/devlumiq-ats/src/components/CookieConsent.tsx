'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Cookie, Check } from 'lucide-react';

const STORAGE_KEY = 'cookie-consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const timer = setTimeout(() => setVisible(true), 1800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable (e.g. iOS private mode) — silently skip
    }
  }, []);

  const save = (value: 'accepted' | 'declined') => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 pointer-events-none"
        >
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5 rounded-2xl bg-stone-900/95 backdrop-blur-lg border border-stone-700/80 shadow-2xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">We use cookies</p>
                <p className="text-stone-400 text-xs mt-0.5 leading-relaxed">
                  We use cookies to improve your experience and analyze site usage.{' '}
                  <Link href="/privacy" className="text-brand-400 hover:text-brand-300 underline underline-offset-2">
                    Privacy Policy
                  </Link>
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                <button
                  onClick={() => save('declined')}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => save('accepted')}
                  className="flex-1 sm:flex-none px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
