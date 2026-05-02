import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import aboutEn from './locales/en/about.json';
import commonEn from './locales/en/common.json';
import homeEn from './locales/en/home.json';
import aboutEs from './locales/es/about.json';
import commonEs from './locales/es/common.json';
import homeEs from './locales/es/home.json';
import aboutPtBr from './locales/pt-BR/about.json';
import commonPtBr from './locales/pt-BR/common.json';
import homePtBr from './locales/pt-BR/home.json';

export const languages = [
    { code: 'en', labelKey: 'language.en', flag: '🇺🇸' },
    { code: 'es', labelKey: 'language.es', flag: '🇪🇸' },
    { code: 'pt-BR', labelKey: 'language.pt-BR', flag: '🇧🇷' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: languages.map((language) => language.code),
        defaultNS: 'common',
        ns: ['common', 'home', 'about'],
        resources: {
            en: {
                common: commonEn,
                home: homeEn,
                about: aboutEn,
            },
            es: {
                common: commonEs,
                home: homeEs,
                about: aboutEs,
            },
            'pt-BR': {
                common: commonPtBr,
                home: homePtBr,
                about: aboutPtBr,
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
