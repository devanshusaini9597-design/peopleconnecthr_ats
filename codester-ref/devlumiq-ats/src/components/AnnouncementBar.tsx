'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="overflow-hidden"
        >
          <div className="relative bg-gradient-to-r from-brand-700 via-teal-700 to-brand-800 text-white text-xs sm:text-sm">
            {/* shimmer line */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="max-w-7xl mx-auto px-4 pr-10 py-2.5 flex items-center justify-center gap-2.5 text-center">
              <Sparkles className="w-3.5 h-3.5 text-teal-300 flex-shrink-0 hidden sm:block" />
              <span className="font-medium text-white/90">
                <span className="font-bold text-white">New:</span> Smart resume screening is live.{' '}
                <Link
                  href="/features"
                  className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2 hover:text-teal-200 transition-colors"
                >
                  See what&apos;s new <ArrowRight className="w-3 h-3" />
                </Link>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-white/15 text-white/90 text-[11px] font-semibold border border-white/20">
                Self-hosted
              </span>
            </div>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss announcement"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
