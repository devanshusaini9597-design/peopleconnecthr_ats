'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import Logo from '@/components/Logo';
import { useLocale } from '@/components/providers/LocaleProvider';

const DEFAULT_DURATION_MS = 1800;

interface PreloaderProps {
  minDuration?: number;
  onComplete?: () => void;
}

const SPARKLE_POSITIONS = [
  { x: 43.301, y: 25 },
  { x: 25, y: 43.301 },
  { x: -25, y: 43.301 },
  { x: -43.301, y: 25 },
  { x: -43.301, y: -25 },
  { x: 25, y: -43.301 },
];

export function Preloader({ minDuration = DEFAULT_DURATION_MS, onComplete }: PreloaderProps) {
  const [visible, setVisible] = useState(true);
  const { t } = useLocale();

  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, minDuration);
    return () => clearTimeout(timerId);
  }, [minDuration, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-stone-50"
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(13, 148, 136, 0.12) 0%, rgba(13, 148, 136, 0) 70%)',
              }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.8, 0.6] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(20, 184, 166, 0.1) 0%, rgba(20, 184, 166, 0) 70%)',
              }}
              animate={{ scale: [1.1, 1, 1.1], opacity: [0.8, 0.6, 0.8] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="absolute inset-0 opacity-[0.03]">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-stone-900" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>
            <motion.div
              className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-500/30 to-transparent"
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          <div className="relative flex flex-col items-center gap-10 z-10">
            <motion.div
              className="relative"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <motion.div
                className="absolute inset-[-16px] rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0%, rgba(13, 148, 136, 0.4) 25%, rgba(20, 184, 166, 0.6) 50%, rgba(13, 148, 136, 0.4) 75%, transparent 100%)',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-[-12px] rounded-full border border-brand-300/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-[-6px] rounded-full border-2 border-brand-400/30"
                animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-2xl"
                animate={{
                  boxShadow: [
                    '0 0 60px -15px rgba(13, 148, 136, 0.4)',
                    '0 0 80px -10px rgba(13, 148, 136, 0.6)',
                    '0 0 60px -15px rgba(13, 148, 136, 0.4)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden ring-2 ring-brand-200/50"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Logo className="w-full h-full text-white" />
              </motion.div>
              {SPARKLE_POSITIONS.map((pos, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-brand-400"
                  initial={{ x: pos.x, y: pos.y, opacity: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                  style={{ left: '50%', top: '50%', marginLeft: '-3px', marginTop: '-3px' }}
                />
              ))}
            </motion.div>

            <div className="flex items-center gap-2.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-brand-500"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <p className="text-base font-bold text-stone-700 tracking-wide">
                {t('preloader.brand')}
              </p>
              <motion.p
                className="text-sm font-medium text-stone-500 mt-1"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {t('preloader.preparing')}
              </motion.p>
            </motion.div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-stone-200/50 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand-500 via-teal-500 to-brand-500"
              initial={{ scaleX: 0, transformOrigin: 'left' }}
              animate={{ scaleX: 1 }}
              transition={{ duration: minDuration / 1000, ease: [0.4, 0, 0.2, 1] }}
            />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '30%' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useAppPreloader() {
  const [show, setShow] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const key = 'ats-preloader-seen';
    const seen = sessionStorage.getItem(key);
    if (seen) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => {
      setShow(false);
      sessionStorage.setItem(key, '1');
    }, DEFAULT_DURATION_MS);
    return () => clearTimeout(t);
  }, [mounted]);

  return show;
}

