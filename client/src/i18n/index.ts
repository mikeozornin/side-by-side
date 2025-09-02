import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ru from './locales/ru.json'

const resources = {
  ru: {
    translation: ru
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    debug: false,
    
    interpolation: {
      escapeValue: false
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },
    
    // Настройки для русской локализации
    lng: 'ru',
    supportedLngs: ['ru'],
    
    // Настройки для правильного склонения
    pluralSeparator: '_',
    contextSeparator: '_'
  })

export default i18n
