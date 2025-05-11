import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enCommon from './locales/en/common.json';
import heCommon from './locales/he/common.json';

const resources = {
  en: {
    translation: enCommon,
  },
  he: {
    translation: heCommon,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'he',
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    react: {
      useSuspense: true,
    },
    parseMissingKeyHandler: (key) => key,
  });

export default i18n;
