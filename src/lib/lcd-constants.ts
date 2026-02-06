/**
 * LCD Display Constants
 * Shared constants and types for remote display rendering
 */

// Display dimensions (matches UV-K5 LCD)
export const LCD_WIDTH = 128;
export const LCD_HEIGHT = 64;
export const FRAME_SIZE = (LCD_WIDTH * LCD_HEIGHT) / 8; // 1024 bytes for 1-bit pixels

// Protocol constants
export const HEADER = new Uint8Array([0xAA, 0x55]);
export const TYPE_SCREENSHOT = 0x01;
export const TYPE_DIFF = 0x02;

// Color theme definition
export interface ColorSet {
    id: string;
    name: string;
    bg: string;
    fg: string;
}

// Predefined color themes matching various radio LCD displays
export const COLOR_SETS: Record<string, ColorSet> = {
    'classic': { id: 'classic', name: 'Classic Green', bg: '#9ca988', fg: '#2a2a2a' },
    'orange': { id: 'orange', name: 'UV-K5', bg: '#ff9900', fg: '#0e0e0e' },
    'white': { id: 'white', name: 'UV-K1', bg: '#c9f7ec', fg: '#262083' },
    'blue': { id: 'blue', name: 'UV-5R', bg: '#39aef1', fg: '#101010' },
    'oled': { id: 'oled', name: 'OLED White', bg: '#101010', fg: '#f0f0f0' },
};

// Viewer settings interface
export interface ViewerSettings {
    pixelSize: number;
    pixelAspectRatio: number;
    pixelLcd: number; // 0 or 1 - show LCD grid
    invertLcd: number; // 0 or 1 - invert display
    colorKey: string;
    customColors: { bg: string; fg: string };
    backlightLevel: number; // 0-10
    contrast: number; // 0-15
    backlightShadow: number; // 0 or 1 - glow effect
    lcdGhosting: number; // 0 or 1 - LCD ghosting simulation
}

// Default settings factory
export function createDefaultSettings(): ViewerSettings {
    return {
        pixelSize: 4,
        pixelAspectRatio: 1.3,
        pixelLcd: 1,
        invertLcd: 0,
        colorKey: 'orange',
        customColors: { bg: '#000000', fg: '#ffffff' },
        backlightLevel: 8,
        contrast: 13,
        backlightShadow: 1,
        lcdGhosting: 1
    };
}

// LCD Ghosting parameters (realistic LCD response times)
export const GHOSTING = {
    // Pixels turn ON faster than OFF (typical LCD behavior)
    ATTACK_FACTOR: 0.7,  // Fast response when activating
    DECAY_FACTOR: 0.18,  // Slow fade when deactivating
    THRESHOLD: 0.001     // Accuracy threshold for settling
};

// Settings storage key
export const SETTINGS_STORAGE_KEY = 'squelch-viewer-settings';

/**
 * Load settings from localStorage
 */
export function loadSettings(): ViewerSettings {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
            return { ...createDefaultSettings(), ...JSON.parse(stored) };
        }
    } catch {
        console.warn('Failed to load viewer settings');
    }
    return createDefaultSettings();
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: ViewerSettings): void {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        console.warn('Failed to save viewer settings');
    }
}
