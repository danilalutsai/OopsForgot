import { createI18n } from 'vue-i18n'
import en from './en.json'

/** All on-screen text lives in en.json; screens never hard-code text. */
export const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
