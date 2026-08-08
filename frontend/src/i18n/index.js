import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import { getAppLocale } from '../utils/appI18n';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: getAppLocale() || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
