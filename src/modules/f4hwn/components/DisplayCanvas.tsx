import React, { useEffect, useRef } from 'react';

// Constants locally defined to avoid import issues
const WIDTH = 128;
const HEIGHT = 64;

export const COLOR_SETS: Record<string, { id: string, name: string, bg: string, fg: string }> = {
    'classic': { id: 'classic', name: 'Classic Green', bg: '#9ca988', fg: '#2a2a2a' },
    'orange': { id: 'orange', name: 'UV-K5', bg: '#ff9900', fg: '#0e0e0e' },
    'white': { id: 'white', name: 'UV-K1', bg: '#c9f7ec', fg: '#262083' },
    'blue': { id: 'blue', name: 'UV-5R', bg: '#39aef1', fg: '#101010' },
    'oled': { id: 'oled', name: 'OLED White', bg: '#101010', fg: '#f0f0f0' },
};

export interface ViewerSettings {
    pixelSize: number;
    pixelAspectRatio: number;
    pixelLcd: number; // 0 or 1
    invertLcd: number; // 0 or 1
    colorKey: string;
    customColors: { bg: string, fg: string };
    backlightLevel: number;
    contrast: number;
    backlightShadow: number;
    lcdGhosting: number;
}

interface DisplayCanvasProps {
    framebuffer: Uint8Array;
    settings: ViewerSettings;
    frameVersion: number; // Increment to trigger redraw
}

export const DisplayCanvas: React.FC<DisplayCanvasProps> = ({
    framebuffer,
    settings,
    frameVersion
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ghostBufferRef = useRef<Float32Array>(new Float32Array(WIDTH * HEIGHT));

    // Helper to hex to rgb
    const hexToRgb = (hex: string) => {
        const r = hex.replace('#', '');
        // Support 3, 6, 8 digit hex
        if (r.length === 3) {
            const [r1, g1, b1] = r.split('');
            return { r: parseInt(r1 + r1, 16), g: parseInt(g1 + g1, 16), b: parseInt(b1 + b1, 16) };
        }
        const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(r);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    const rgbToString = (r: number, g: number, b: number) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

    const blendRgbStrings = (c1Str: string, c2Str: string, ratio: number) => {
        const parse = (s: string) => s.match(/\d+/g)?.map(Number) || [0, 0, 0];
        const [r1, g1, b1] = parse(c1Str);
        const [r2, g2, b2] = parse(c2Str);
        const r = r1 + (r2 - r1) * ratio;
        const g = g1 + (g2 - g1) * ratio;
        const b = b1 + (b2 - b1) * ratio;
        return rgbToString(r, g, b);
    };

    const applyBrightness = (hex: string, brightness: number) => {
        const c = hexToRgb(hex);
        const r = Math.min(255, c.r * brightness);
        const g = Math.min(255, c.g * brightness);
        const b = Math.min(255, c.b * brightness);
        return rgbToString(r, g, b);
    };

    const getBit = (idx: number, buf: Uint8Array) => {
        const byteIdx = Math.floor(idx / 8);
        const bitPos = idx % 8;
        if (byteIdx < buf.length) {
            return (buf[byteIdx] >> bitPos) & 0x01;
        }
        return 0;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const {
            pixelSize,
            pixelAspectRatio,
            pixelLcd,
            invertLcd,
            colorKey,
            customColors,
            lcdGhosting,
            contrast = 15,
            backlightLevel = 10
        } = settings;

        // Backlight Logic
        let brightness = 1.0;
        if (backlightLevel <= 6) {
            brightness = 0.15 + (backlightLevel / 6) * 0.75;
        } else if (backlightLevel <= 8) {
            brightness = 1.0;
        } else {
            brightness = 1.0 + ((backlightLevel - 8) * 0.15);
        }

        // Determine the color set
        let colorSet;
        if (colorKey === 'custom') {
            colorSet = { id: 'custom', name: 'Custom', ...customColors };
        } else {
            colorSet = COLOR_SETS[colorKey] || COLOR_SETS.orange;
        }

        // Determine colors
        const originalFg = colorSet.fg;
        const originalBg = colorSet.bg;

        // Padding/Backlight color is always from the original background
        const paddingColor = applyBrightness(originalBg, brightness);

        // Interior colors (swapped if inverted)
        const interiorFg = invertLcd ? originalBg : originalFg;
        const interiorBg = invertLcd ? originalFg : originalBg;

        // Apply brightness to the interior colors
        const dimmedOriginalBg = applyBrightness(interiorBg, brightness);
        const dimmedOriginalFg = applyBrightness(interiorFg, brightness);

        // Characterize LCD Area
        const lcdBgColor = dimmedOriginalBg;
        const baseFgColor = dimmedOriginalFg;

        // Contrast Logic
        const contrastRatio = 0.15 + (contrast / 15) * 0.85;

        // Calculate Active Pixel Color (blended with BG based on contrast)
        const activeFgColor = blendRgbStrings(lcdBgColor, baseFgColor, contrastRatio);

        const fgRgb = activeFgColor.match(/\d+/g)?.map(Number) || [0, 0, 0];
        const bgRgb = lcdBgColor.match(/\d+/g)?.map(Number) || [0, 0, 0];

        // Dimensions
        const pixelW = pixelSize;
        const pixelH = pixelSize * pixelAspectRatio;
        const screenPaddingX = pixelSize * 2;
        const screenPaddingY = pixelSize * 2;
        const displayContentWidth = WIDTH * pixelW;
        const displayContentHeight = HEIGHT * pixelH;
        const finalCanvasWidth = displayContentWidth + (screenPaddingX * 2);
        const finalCanvasHeight = displayContentHeight + (screenPaddingY * 2);

        if (canvas.width !== finalCanvasWidth || canvas.height !== finalCanvasHeight) {
            canvas.width = finalCanvasWidth;
            canvas.height = finalCanvasHeight;
        }

        // 1. Fill entire background with padding color (backlight color)
        ctx.fillStyle = paddingColor;
        ctx.fillRect(0, 0, finalCanvasWidth, finalCanvasHeight);

        // Grid effect color logic
        let gridColor = lcdBgColor;
        if (!invertLcd) {
            // In normal mode, slightly darken grid to be visible against the light background
            gridColor = blendRgbStrings(lcdBgColor, dimmedOriginalFg, 0.08);
        }

        // 2. Fill LCD area
        if (pixelLcd) {
            ctx.fillStyle = gridColor;
            ctx.fillRect(screenPaddingX, screenPaddingY, displayContentWidth, displayContentHeight);
        } else {
            ctx.fillStyle = lcdBgColor;
            ctx.fillRect(screenPaddingX, screenPaddingY, displayContentWidth, displayContentHeight);
        }

        const gapX = pixelLcd ? Math.max(0.5, pixelW * 0.1) : 0;
        const gapY = pixelLcd ? Math.max(0.5, pixelH * 0.1) : 0;

        const ghostBuffer = ghostBufferRef.current;
        const decayFactor = lcdGhosting ? 0.6 : 1.0;

        let bitIndex = 0;

        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const px = screenPaddingX + (x * pixelW);
                const py = screenPaddingY + (y * pixelH);
                const drawW = pixelW - gapX;
                const drawH = pixelH - gapY;
                const drawX = px + (gapX / 2);
                const drawY = py + (gapY / 2);

                const isTargetOn = getBit(bitIndex, framebuffer);
                const targetVal = isTargetOn ? 1.0 : 0.0;

                let currentVal = ghostBuffer[bitIndex];

                if (lcdGhosting) {
                    const diff = targetVal - currentVal;
                    currentVal += diff * decayFactor;
                    if (Math.abs(targetVal - currentVal) < 0.01) {
                        currentVal = targetVal;
                    }
                } else {
                    currentVal = targetVal;
                }

                ghostBuffer[bitIndex] = currentVal;

                if (pixelLcd) {
                    let pColor = lcdBgColor;
                    if (currentVal > 0.01) {
                        if (currentVal >= 0.99) {
                            pColor = activeFgColor;
                        } else {
                            const r = Math.round(bgRgb[0] + (fgRgb[0] - bgRgb[0]) * currentVal);
                            const g = Math.round(bgRgb[1] + (fgRgb[1] - bgRgb[1]) * currentVal);
                            const b = Math.round(bgRgb[2] + (fgRgb[2] - bgRgb[2]) * currentVal);
                            pColor = `rgb(${r},${g},${b})`;
                        }
                        ctx.fillStyle = pColor;
                        ctx.fillRect(drawX, drawY, drawW, drawH);
                    }
                } else {
                    if (currentVal > 0.01) {
                        let pColor = activeFgColor;
                        if (currentVal < 0.99) {
                            const r = Math.round(bgRgb[0] + (fgRgb[0] - bgRgb[0]) * currentVal);
                            const g = Math.round(bgRgb[1] + (fgRgb[1] - bgRgb[1]) * currentVal);
                            const b = Math.round(bgRgb[2] + (fgRgb[2] - bgRgb[2]) * currentVal);
                            pColor = `rgb(${r},${g},${b})`;
                        }
                        ctx.fillStyle = pColor;
                        ctx.fillRect(drawX, drawY, drawW, drawH);
                    }
                }
                bitIndex++;
            }
        }
    }, [framebuffer, settings, frameVersion]);

    // Backlight Shadow Logic
    const { backlightLevel = 10, backlightShadow, colorKey, customColors } = settings;
    const rawBg = colorKey === 'custom' ? customColors.bg : COLOR_SETS[colorKey].bg;

    // Shadow color matches the display calculation
    let brightness = 1.0;
    if (backlightLevel <= 6) brightness = 0.15 + (backlightLevel / 6) * 0.75;
    else if (backlightLevel <= 8) brightness = 1.0;
    else brightness = 1.0 + ((backlightLevel - 8) * 0.15);

    const activeBg = applyBrightness(rawBg, brightness);

    let shadowStyle = {};

    if (backlightShadow && backlightLevel > 0) {
        // Base spread
        let spread1 = backlightLevel * 4;
        let spread2 = backlightLevel * 1.5;

        // If vibrant mode (9-10), intensify the shadow significantly
        if (backlightLevel > 8) {
            spread1 *= 1.5;
            spread2 *= 1.5;
        }

        shadowStyle = {
            boxShadow: `0 0 ${spread1}px -5px ${activeBg}, 0 0 ${spread2}px -2px ${activeBg}`
        };
    }

    return (
        <div
            className="relative rounded-lg overflow-hidden transition-all duration-300"
            style={{
                ...shadowStyle,
                backgroundColor: activeBg,
            }}
        >
            <canvas
                ref={canvasRef}
                className="block mx-auto max-w-full h-auto"
                style={{ imageRendering: settings.pixelSize < 4 ? 'pixelated' : 'auto' }}
            />
        </div>
    );
};
