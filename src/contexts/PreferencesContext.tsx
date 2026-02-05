import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Preferences {
    githubToken: string;
    customRepos: string[];
    bootloaderDetected: boolean;
    autoConnect: boolean;
    enableBackupCache: boolean;
    profileSwitchMode: 'auto' | 'prompt' | 'manual';
    calibrationOffsetLegacy: boolean; // Optional: future proofing
}

interface PreferencesContextType extends Preferences {
    setGithubToken: (token: string) => void;
    addCustomRepo: (repo: string) => void;
    removeCustomRepo: (repo: string) => void;
    setBootloaderDetected: (detected: boolean) => void;
    setAutoConnect: (enabled: boolean) => void;
    setEnableBackupCache: (enabled: boolean) => void;
    setProfileSwitchMode: (mode: 'auto' | 'prompt' | 'manual') => void;
}

const defaultPreferences: Preferences = {
    githubToken: "",
    customRepos: [],
    bootloaderDetected: false,
    autoConnect: false,
    enableBackupCache: true,
    profileSwitchMode: 'auto',
    calibrationOffsetLegacy: false
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<Preferences>(() => {
        const stored = localStorage.getItem("squelch-preferences");
        return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
    });

    useEffect(() => {
        localStorage.setItem("squelch-preferences", JSON.stringify(preferences));
    }, [preferences]);

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

    return (
        <PreferencesContext.Provider value={{
            ...preferences,
            setGithubToken,
            addCustomRepo,
            removeCustomRepo,
            setBootloaderDetected,
            setAutoConnect,
            setEnableBackupCache,
            setProfileSwitchMode
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
