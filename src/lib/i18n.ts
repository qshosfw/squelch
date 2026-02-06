/**
 * Internationalization (i18n) system for Squelch
 */

export type SupportedLocale = 'en' | 'de' | 'es' | 'fr' | 'it' | 'pl' | 'pt' | 'ru' | 'zh';

export interface LocaleInfo {
    code: SupportedLocale;
    name: string;
    nativeName: string;
    flag: string;
}

export const LOCALES: LocaleInfo[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

// Translation keys type
export type TranslationKey =
    // Common
    | 'app.name'
    | 'common.save'
    | 'common.cancel'
    | 'common.close'
    | 'common.connect'
    | 'common.disconnect'
    | 'common.settings'
    | 'common.loading'
    // Preferences
    | 'prefs.title'
    | 'prefs.general'
    | 'prefs.appearance'
    | 'prefs.connection'
    | 'prefs.profiles'
    | 'prefs.developer'
    | 'prefs.theme'
    | 'prefs.theme.light'
    | 'prefs.theme.dark'
    | 'prefs.theme.system'
    | 'prefs.language'
    | 'prefs.autoConnect'
    | 'prefs.autoConnectDesc'
    | 'prefs.profileSwitching'
    | 'prefs.profileSwitchingDesc'
    | 'prefs.githubToken'
    | 'prefs.githubTokenDesc'
    | 'prefs.generateToken'
    // Flasher
    | 'flasher.title'
    | 'flasher.selectFirmware'
    | 'flasher.flash'
    | 'flasher.backup'
    | 'flasher.restore'
    // Remote
    | 'remote.title'
    | 'remote.screenshot'
    | 'remote.record'
    | 'remote.waitingDisplay'
    ;

// Translation dictionaries
const translations: Record<SupportedLocale, Partial<Record<TranslationKey, string>>> = {
    en: {
        'app.name': 'Squelch',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.close': 'Close',
        'common.connect': 'Connect',
        'common.disconnect': 'Disconnect',
        'common.settings': 'Settings',
        'common.loading': 'Loading...',
        'prefs.title': 'Preferences',
        'prefs.general': 'General',
        'prefs.appearance': 'Appearance',
        'prefs.connection': 'Connection',
        'prefs.profiles': 'Profiles',
        'prefs.developer': 'Developer',
        'prefs.theme': 'Theme',
        'prefs.theme.light': 'Light',
        'prefs.theme.dark': 'Dark',
        'prefs.theme.system': 'System',
        'prefs.language': 'Language',
        'prefs.autoConnect': 'Auto-Connect',
        'prefs.autoConnectDesc': 'Automatically connect to last used port on startup.',
        'prefs.profileSwitching': 'Profile Switching',
        'prefs.profileSwitchingDesc': 'How to handle different radio firmwares.',
        'prefs.githubToken': 'GitHub Personal Access Token',
        'prefs.githubTokenDesc': 'Required for higher rate limits when fetching releases.',
        'prefs.generateToken': 'Generate Token',
        'flasher.title': 'Firmware Flasher',
        'flasher.selectFirmware': 'Select Firmware',
        'flasher.flash': 'Flash',
        'flasher.backup': 'Backup',
        'flasher.restore': 'Restore',
        'remote.title': 'Remote Display',
        'remote.screenshot': 'Screenshot',
        'remote.record': 'Record',
        'remote.waitingDisplay': 'Waiting for Display',
    },
    de: {
        'app.name': 'Squelch',
        'common.save': 'Speichern',
        'common.cancel': 'Abbrechen',
        'common.close': 'Schließen',
        'common.connect': 'Verbinden',
        'common.disconnect': 'Trennen',
        'common.settings': 'Einstellungen',
        'common.loading': 'Laden...',
        'prefs.title': 'Einstellungen',
        'prefs.general': 'Allgemein',
        'prefs.appearance': 'Erscheinungsbild',
        'prefs.connection': 'Verbindung',
        'prefs.profiles': 'Profile',
        'prefs.developer': 'Entwickler',
        'prefs.theme': 'Design',
        'prefs.theme.light': 'Hell',
        'prefs.theme.dark': 'Dunkel',
        'prefs.theme.system': 'System',
        'prefs.language': 'Sprache',
        'prefs.autoConnect': 'Auto-Verbinden',
        'prefs.autoConnectDesc': 'Automatisch mit dem letzten Port beim Start verbinden.',
        'prefs.profileSwitching': 'Profil-Wechsel',
        'prefs.profileSwitchingDesc': 'Wie unterschiedliche Firmware behandelt wird.',
        'prefs.githubToken': 'GitHub Personal Access Token',
        'prefs.githubTokenDesc': 'Erforderlich für höhere Rate-Limits.',
        'prefs.generateToken': 'Token Generieren',
        'flasher.title': 'Firmware-Flasher',
        'remote.title': 'Fernbildschirm',
        'remote.screenshot': 'Screenshot',
        'remote.record': 'Aufnahme',
        'remote.waitingDisplay': 'Warte auf Anzeige',
    },
    es: {},
    fr: {},
    it: {},
    pl: {},
    pt: {},
    ru: {},
    zh: {},
};

/**
 * Get translated string
 */
export function t(key: TranslationKey, locale: SupportedLocale = 'en'): string {
    return translations[locale]?.[key] || translations.en[key] || key;
}

/**
 * Detect browser language
 */
export function detectBrowserLocale(): SupportedLocale {
    const browserLang = navigator.language.split('-')[0].toLowerCase();
    const supported = LOCALES.find(l => l.code === browserLang);
    return supported?.code || 'en';
}

/**
 * Get locale info by code
 */
export function getLocaleInfo(code: SupportedLocale): LocaleInfo {
    return LOCALES.find(l => l.code === code) || LOCALES[0];
}
