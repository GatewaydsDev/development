import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import aboutEn from './locales/en/about.json';
import commonEn from './locales/en/common.json';
import homeEn from './locales/en/home.json';
import servicesEn from './locales/en/services.json';
import aboutEs from './locales/es/about.json';
import commonEs from './locales/es/common.json';
import homeEs from './locales/es/home.json';
import servicesEs from './locales/es/services.json';

export const languages = [
    { code: 'en', labelKey: 'language.en', flag: '🇺🇸' },
    { code: 'es', labelKey: 'language.es', flag: '🇪🇸' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: languages.map((language) => language.code),
        defaultNS: 'common',
        ns: ['common', 'home', 'about', 'services'],
        resources: {
            en: {
                common: commonEn,
                home: homeEn,
                about: aboutEn,
                services: servicesEn,
            },
            es: {
                common: commonEs,
                home: homeEs,
                about: aboutEs,
                services: servicesEs,
            },
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
