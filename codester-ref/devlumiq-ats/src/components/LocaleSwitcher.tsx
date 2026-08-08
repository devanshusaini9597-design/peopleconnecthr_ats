'use client';

import { useLocale } from '@/components/providers/LocaleProvider';
import { locales, localeLabels, type Locale } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export default function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, width: 208 });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = Math.min(208, window.innerWidth - 24);
      const padding = 12;
      let left = rect.left;
      if (left + dropdownWidth > window.innerWidth - padding) {
        left = window.innerWidth - dropdownWidth - padding;
      }
      if (left < padding) left = padding;
      setDropdownStyle({
        top: rect.bottom + 8,
        left,
        width: dropdownWidth,
      });
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-shrink-0" ref={triggerRef}>
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors min-h-[44px] min-w-[44px] sm:min-w-0 justify-center sm:justify-start border border-stone-200/60 hover:border-stone-300/80 shadow-sm"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label="Change language"
      >
        <Globe className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium hidden sm:inline truncate max-w-[100px]">
          {localeLabels[locale]}
        </span>
      </motion.button>
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={dropdownRef}
                key="locale-dropdown"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{ top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width }}
                className="fixed max-h-[min(70vh,320px)] overflow-y-auto overflow-x-hidden py-1.5 rounded-2xl bg-white border border-stone-200/80 shadow-xl shadow-stone-200/50 z-[200]"
              >
                {locales.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setLocale(l as Locale);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-xl last:rounded-b-xl ${
                      locale === l
                        ? 'bg-brand-50 text-brand-700 border-l-2 border-brand-500 -ml-px pl-[15px]'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {localeLabels[l as Locale]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
