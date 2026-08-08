export type Locale = 'en' | 'ar' | 'es' | 'fr' | 'de' | 'pt' | 'hi' | 'zh' | 'ja' | 'ru';

export const locales: Locale[] = ['en', 'ar', 'es', 'fr', 'de', 'pt', 'hi', 'zh', 'ja', 'ru'];

export const isRtl = (locale: Locale) => locale === 'ar';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  hi: 'हिन्दी',
  zh: '中文',
  ja: '日本語',
  ru: 'Русский',
};

export const defaultLocale: Locale = 'en';
