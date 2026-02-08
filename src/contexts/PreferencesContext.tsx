import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SupportedLocale, detectBrowserLocale } from "@/lib/i18n";

export type ThemeMode = 'light' | 'dark' | 'system';

interface Preferences {
    // Appearance
    theme: ThemeMode;
    locale: SupportedLocale;
    // Connection
    autoConnect: boolean;
    profileSwitchMode: 'auto' | 'prompt' | 'manual';
    // Developer
    githubToken: string;
    customRepos: string[];
    developerMode: boolean;
    // Internal
    bootloaderDetected: boolean;
    enableBackupCache: boolean;
    autoSwitchToFlasher: boolean;
    telemetryInterval: number;
}

interface PreferencesContextType extends Preferences {
    setTheme: (theme: ThemeMode) => void;
    setLocale: (locale: SupportedLocale) => void;
    setGithubToken: (token: string) => void;
    addCustomRepo: (repo: string) => void;
    removeCustomRepo: (repo: string) => void;
    setDeveloperMode: (enabled: boolean) => void;
    setBootloaderDetected: (detected: boolean) => void;
    setAutoConnect: (enabled: boolean) => void;
    setEnableBackupCache: (enabled: boolean) => void;
    setProfileSwitchMode: (mode: 'auto' | 'prompt' | 'manual') => void;
    setAutoSwitchToFlasher: (enabled: boolean) => void;
    setTelemetryInterval: (interval: number) => void;
}

const defaultPreferences: Preferences = {
    theme: 'system',
    locale: detectBrowserLocale(),
    githubToken: "",
    customRepos: [],
    developerMode: false,
    bootloaderDetected: false,
    autoConnect: false,
    enableBackupCache: true,
    profileSwitchMode: 'auto',
    autoSwitchToFlasher: true,
    telemetryInterval: 2000
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<Preferences>(() => {
        const stored = localStorage.getItem("squelch-preferences");
        return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
    });

    // Persist preferences
    useEffect(() => {
        localStorage.setItem("squelch-preferences", JSON.stringify(preferences));
    }, [preferences]);

    // Apply theme to document
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (preferences.theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(preferences.theme);
        }
    }, [preferences.theme]);

    // Apply locale to document
    useEffect(() => {
        document.documentElement.lang = preferences.locale;
    }, [preferences.locale]);

    const setTheme = (theme: ThemeMode) => {
        setPreferences(prev => ({ ...prev, theme }));
    };

    const setLocale = (locale: SupportedLocale) => {
        setPreferences(prev => ({ ...prev, locale }));
    };

    const setGithubToken = (token: string) => {
        setPreferences(prev => ({ ...prev, githubToken: token }));
    };

    const addCustomRepo = (repo: string) => {
        setPreferences(prev => {
            if (prev.customRepos.includes(repo)) return prev;
            return { ...prev, customRepos: [...prev.customRepos, repo] };
        });
    };

    const removeCustomRepo = (repo: string) => {
        setPreferences(prev => ({
            ...prev,
            customRepos: prev.customRepos.filter(r => r !== repo)
        }));
    };

    const setBootloaderDetected = (detected: boolean) => {
        setPreferences(prev => ({ ...prev, bootloaderDetected: detected }));
    };

    const setAutoConnect = (enabled: boolean) => {
        setPreferences(prev => ({ ...prev, autoConnect: enabled }));
    };

    const setEnableBackupCache = (enabled: boolean) => {
        setPreferences(prev => ({ ...prev, enableBackupCache: enabled }));
    };

    const setProfileSwitchMode = (mode: 'auto' | 'prompt' | 'manual') => {
        setPreferences(prev => ({ ...prev, profileSwitchMode: mode }));
    };

    const setAutoSwitchToFlasher = (enabled: boolean) => {
        setPreferences(prev => ({ ...prev, autoSwitchToFlasher: enabled }));
    };

    return (
        <PreferencesContext.Provider value={{
            ...preferences,
            setTheme,
            setLocale,
            setGithubToken,
            addCustomRepo,
            removeCustomRepo,
            setDeveloperMode: (enabled: boolean) => setPreferences(prev => ({ ...prev, developerMode: enabled })),
            setBootloaderDetected,
            setAutoConnect,
            setEnableBackupCache,
            setProfileSwitchMode,
            setAutoSwitchToFlasher,
            setTelemetryInterval: (interval: number) => setPreferences(prev => ({ ...prev, telemetryInterval: interval }))
        }}>
            {children}
        </PreferencesContext.Provider>
    );
}

export function usePreferences() {
    const context = useContext(PreferencesContext);
    if (context === undefined) {
        throw new Error("usePreferences must be used within a PreferencesProvider");
    }
    return context;
}
