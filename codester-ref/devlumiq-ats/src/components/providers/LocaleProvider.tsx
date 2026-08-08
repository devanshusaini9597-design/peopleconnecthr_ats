'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Locale, locales, isRtl, defaultLocale } from '@/lib/i18n';
import { translations } from '@/lib/translations';

const STORAGE_KEY = 'devlumiq-locale';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: 'ltr' | 'rtl';
  t: (key: string, vars?: Record<string, string>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && locales.includes(stored as Locale)) return stored as Locale;
  } catch (_) {}
  return defaultLocale;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getStoredLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch (_) {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l;
      document.documentElement.dir = isRtl(l) ? 'rtl' : 'ltr';
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
    }
  }, [locale, mounted]);
  const dir = useMemo<'ltr' | 'rtl'>(() => (isRtl(locale) ? 'rtl' : 'ltr'), [locale]);
  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      let text = translations[locale]?.[key] ?? translations.en[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([varKey, varValue]) => {
          text = text.replace(new RegExp(`\\{${varKey}\\}`, 'g'), varValue);
        });
      }
      return text;
    },
    [locale]
  );
  const value = useMemo(
    () => ({ locale, setLocale, dir, t }),
    [locale, setLocale, dir, t]
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) return { locale: defaultLocale, setLocale: () => {}, dir: 'ltr' as const, t: (k: string, _vars?: Record<string, string>) => k };
  return ctx;
}
