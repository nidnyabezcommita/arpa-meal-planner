import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './translations/en.json';
import tr from './translations/tr.json';

export const UI_LANGUAGES = ['en', 'tr'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];
export const defaultNS = 'translation';

export const resources = {
  en: { translation: en },
  tr: { translation: tr },
} as const;

function updateDocumentLanguage(language: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language.startsWith('tr') ? 'tr' : 'en';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: UI_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    fallbackLng: 'en',
    defaultNS,
    initAsync: false,
    returnNull: false,
    interpolation: {
      escapeValue: false,
    },
  });

updateDocumentLanguage(i18n.resolvedLanguage ?? i18n.language ?? 'en');
i18n.on('languageChanged', updateDocumentLanguage);

export default i18n;
