/**
 * Color Utilities
 * Shared color manipulation functions for LCD display rendering
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Parse a hex color string to RGB values
 */
export function hexToRgb(hex: string): RGB {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const clean = hex.replace('#', '');

    try {
        if (clean.length === 3) {
            const [r, g, b] = clean.split('');
            return {
                r: parseInt(r + r, 16),
                g: parseInt(g + g, 16),
                b: parseInt(b + b, 16)
            };
        }
        if (clean.length >= 6) {
            const r = parseInt(clean.slice(0, 2), 16);
            const g = parseInt(clean.slice(2, 4), 16);
            const b = parseInt(clean.slice(4, 6), 16);
            return {
                r: isNaN(r) ? 0 : r,
                g: isNaN(g) ? 0 : g,
                b: isNaN(b) ? 0 : b
            };
        }
    } catch {
        console.warn("Color parsing failed", hex);
    }
    return { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB values to a hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB to CSS rgb() string
 */
export function rgbToString(r: number, g: number, b: number): string {
    return `rgb(${Math.max(0, Math.min(255, Math.round(r)))}, ${Math.max(0, Math.min(255, Math.round(g)))}, ${Math.max(0, Math.min(255, Math.round(b)))})`;
}

/**
 * Parse a CSS rgb() string to RGB values
 */
export function parseRgbString(str: string): RGB {
    const match = str.match(/\d+/g);
    if (!match || match.length < 3) return { r: 0, g: 0, b: 0 };
    return {
        r: parseInt(match[0], 10),
        g: parseInt(match[1], 10),
        b: parseInt(match[2], 10)
    };
}

/**
 * Blend two colors by a ratio (0 = color1, 1 = color2)
 */
export function blendRgb(c1: RGB, c2: RGB, ratio: number): RGB {
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * ratio),
        g: Math.round(c1.g + (c2.g - c1.g) * ratio),
        b: Math.round(c1.b + (c2.b - c1.b) * ratio)
    };
}

/**
 * Blend two CSS rgb() strings by a ratio
 */
export function blendRgbStrings(c1Str: string, c2Str: string, ratio: number): string {
    const c1 = parseRgbString(c1Str);
    const c2 = parseRgbString(c2Str);
    const blended = blendRgb(c1, c2, ratio);
    return rgbToString(blended.r, blended.g, blended.b);
}

/**
 * Apply brightness adjustment to a hex color
 */
export function applyBrightness(hex: string, brightness: number): string {
    const c = hexToRgb(hex);
    return rgbToString(
        Math.min(255, c.r * brightness),
        Math.min(255, c.g * brightness),
        Math.min(255, c.b * brightness)
    );
}

/**
 * Pre-compute RGB array from hex for fast canvas operations
 */
export function hexToRgbArray(hex: string): [number, number, number] {
    const c = hexToRgb(hex);
    return [c.r, c.g, c.b];
}
