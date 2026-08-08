/**
 * Lightweight app locale helpers (recruiter UI). Portal uses portalI18n.js.
 */
export const APP_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' }
];

const STRINGS = {
  en: {
    nav_dashboard: 'Dashboard',
    nav_candidates: 'Candidates',
    nav_inbox: 'Inbox',
    common_save: 'Save',
    common_cancel: 'Cancel',
    common_loading: 'Loading…'
  },
  es: {
    nav_dashboard: 'Panel',
    nav_candidates: 'Candidatos',
    nav_inbox: 'Bandeja',
    common_save: 'Guardar',
    common_cancel: 'Cancelar',
    common_loading: 'Cargando…'
  },
  hi: {
    nav_dashboard: 'डैशबोर्ड',
    nav_candidates: 'उम्मीदवार',
    nav_inbox: 'इनबॉक्स',
    common_save: 'सेव',
    common_cancel: 'रद्द',
    common_loading: 'लोड हो रहा है…'
  }
};

const KEY = 'skillnix_app_locale';

export const getAppLocale = () => {
  try {
    const v = localStorage.getItem(KEY);
    if (v && STRINGS[v]) return v;
  } catch { /* ignore */ }
  return 'en';
};

export const setAppLocale = (code) => {
  if (!STRINGS[code]) return;
  try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
  document.documentElement.lang = code;
};

export const ta = (key, locale = getAppLocale()) =>
  STRINGS[locale]?.[key] || STRINGS.en[key] || key;

export default STRINGS;
