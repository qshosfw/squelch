import { RadioProfile } from './module-interface';

class ModuleManagerService {
    private profiles: RadioProfile[] = [];
    private activeProfile: RadioProfile | null = null;
    private listeners: ((profile: RadioProfile | null) => void)[] = [];

    /**
     * Register a new profile provider.
     */
    registerProfile(profile: RadioProfile) {
        if (this.profiles.some(p => p.id === profile.id)) {
            console.warn(`Profile ${profile.id} already registered. Skipping.`);
            return;
        }
        this.profiles.push(profile);
        console.log(`[ModuleManager] Registered profile: ${profile.name} (${profile.id})`);
    }

    /**
     * Detect the best matching profile for a given firmware version.
     */
    detectProfile(version: string): RadioProfile | null {
        console.log(`[ModuleManager] Detecting profile for version: ${version}`);

        // Try to find a match
        const match = this.profiles.find(p => p.matchFirmware(version));

        if (match) {
            console.log(`[ModuleManager] Matched profile: ${match.name}`);
            return match;
        }

        console.log(`[ModuleManager] No specific profile matched.`);
        return null;
    }

    /**
     * Set the currently active profile.
     */
    setActiveProfile(profile: RadioProfile | null) {
        this.activeProfile = profile;
        this.notifyListeners();
    }

    /**
     * Get the currently active profile.
     */
    getActiveProfile(): RadioProfile | null {
        return this.activeProfile;
    }

    /**
     * Get all registered profiles.
     */
    getProfiles(): RadioProfile[] {
        return [...this.profiles];
    }

    /**
     * Subscribe to profile changes.
     */
    subscribe(callback: (profile: RadioProfile | null) => void) {
        this.listeners.push(callback);
        // Immediate callback
        callback(this.activeProfile);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.activeProfile));
    }
}

export const ModuleManager = new ModuleManagerService();
