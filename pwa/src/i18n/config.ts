import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import translationFR from './locales/fr.json'
import translationEN from './locales/en.json'

const resources = {
  fr: {
    translation: translationFR
  },
  en: {
    translation: translationEN
  }
}

// Vérifier si une préférence de langue existe déjà dans localStorage
const storedLanguage = localStorage.getItem('i18nextLng')

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Utiliser la langue stockée si elle existe, sinon français par défaut
    lng: storedLanguage || 'fr',
    fallbackLng: 'fr',
    debug: false,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    }
  })

export default i18n
