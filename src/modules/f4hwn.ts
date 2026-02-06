import { RadioProfile, Channel, DisplayMirrorHandler, FeatureFlags } from '../lib/framework/module-interface';

// --- Protocol Constants ---
const HEADER_0 = 0xAA;
const HEADER_1 = 0x55;
const TYPE_SCREENSHOT = 0x01;
const TYPE_DIFF = 0x02;
const FRAME_SIZE = 1024; // 128x64 pixels, 1 bit per pixel
const VERSION_MARKER = 0xFF;
const BUFFER_SIZE = 32768; // 32KB ring buffer

/**
 * High-performance serial handler for F4HWN/Egzumer screencast protocol.
 * Optimized for minimal latency and maximum throughput.
 * Uses existing ProtocolHandler connection via setDataListener.
 */
class SerialHandler implements DisplayMirrorHandler {
    private protocol: any = null;
    private keepaliveInterval: number | null = null;
    private isConnected = false;

    // Pre-allocated framebuffer
    private readonly framebuffer = new Uint8Array(FRAME_SIZE);

    // Buffer for assembling packets
    private buffer = new Uint8Array(BUFFER_SIZE);
    private bufferPos = 0;

    // Callbacks
    public onFrameUpdate?: (framebuffer: Uint8Array) => void;
    public onStatusChange?: (connected: boolean, error?: string) => void;
    public onStatsUpdate?: (stats: { fps: number, bps: number, totalFrames: number }) => void;

    // Stats
    private frameCount = 0;
    private totalFrameCount = 0;
    private byteCount = 0;
    private lastStatsTime = 0;

    constructor() {
        this.resetFramebuffer();
        this.lastStatsTime = performance.now();
    }

    private resetFramebuffer() {
        this.framebuffer.fill(0);
    }

    public getFramebuffer(): Uint8Array {
        return this.framebuffer;
    }

    public async connect(protocol: any) {
        this.protocol = protocol;
        this.isConnected = true;
        this.bufferPos = 0;
        this.byteCount = 0;
        this.totalFrameCount = 0;

        // Hijack data stream from main protocol
        if (this.protocol && typeof this.protocol.setDataListener === 'function') {
            this.protocol.setDataListener(this.handleData.bind(this));
        } else {
            console.error("Protocol handler does not support setDataListener");
            throw new Error("Incompatible protocol handler");
        }

        if (this.onStatusChange) this.onStatusChange(true);

        this.startKeepalive();
        // Send initial keepalive immediately
        this.sendKeepalive();
    }

    public async disconnect(_closePort = false) {
        this.isConnected = false;

        if (this.keepaliveInterval) {
            window.clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }

        // Release data hook
        if (this.protocol && typeof this.protocol.setDataListener === 'function') {
            this.protocol.setDataListener(null);
        }
        this.protocol = null;

        if (this.onStatusChange) this.onStatusChange(false);
    }

    private startKeepalive() {
        if (this.keepaliveInterval) clearInterval(this.keepaliveInterval);
        // 1000ms keepalive matches k5viewer reference
        this.keepaliveInterval = window.setInterval(() => this.sendKeepalive(), 1000);
    }

    private async sendKeepalive() {
        if (!this.protocol || !this.isConnected) return;
        try {
            const keepalive = new Uint8Array([0x55, 0xAA, 0x00, 0x00]);
            if (typeof this.protocol.sendRaw === 'function') {
                await this.protocol.sendRaw(keepalive);
            }
        } catch (e: any) {
            console.error("Keepalive failed", e);
            if (this.isConnected) {
                this.disconnect(false);
                if (this.onStatusChange) this.onStatusChange(false, e.message || "Network Error");
            }
        }
    }

    private updateFPS() {
        this.frameCount++;
        this.totalFrameCount++;

        const now = performance.now();
        const elapsed = now - this.lastStatsTime;

        if (elapsed >= 1000) {
            const fps = Math.ceil(this.frameCount / (elapsed / 1000));
            const bps = Math.ceil(this.byteCount / (elapsed / 1000));

            if (this.onStatsUpdate) {
                this.onStatsUpdate({
                    fps,
                    bps,
                    totalFrames: this.totalFrameCount
                });
            }

            this.frameCount = 0;
            this.byteCount = 0;
            this.lastStatsTime = now;
        }
    }

    private applyDiff(diffPayload: Uint8Array, isNewFormat: boolean) {
        let i = 0;
        const len = diffPayload.length;

        if (isNewFormat) {
            while (i + 9 <= len) {
                const chunkIndex = diffPayload[i];
                i++;
                if (chunkIndex >= 128) break;

                const startPos = chunkIndex * 8;
                for (let j = 0; j < 8; j++) {
                    if (startPos + j < this.framebuffer.length) {
                        this.framebuffer[startPos + j] = diffPayload[i + j];
                    }
                }
                i += 8;
            }
        } else {
            // Old format
            while (i + 9 <= len) {
                const blockIndex = diffPayload[i];
                i++;
                if (blockIndex >= 128) break;

                const startPos = blockIndex * 8;
                for (let j = 0; j < 8; j++) {
                    if (startPos + j < this.framebuffer.length) {
                        this.framebuffer[startPos + j] = diffPayload[i + j];
                    }
                }
                i += 8;
            }
        }
    }

    private handleData(value: Uint8Array) {
        if (!this.isConnected) return;

        try {
            this.byteCount += value.length;

            // Simple buffer management
            if (this.bufferPos + value.length > this.buffer.length) {
                this.buffer.copyWithin(0, this.bufferPos);
                this.bufferPos = 0;
            }

            this.buffer.set(value, this.bufferPos);
            this.bufferPos += value.length;

            let processed = 0;

            while (processed < this.bufferPos - 4) {
                let isNewFormat = false;
                let headerStart = processed;

                if (this.buffer[processed] === VERSION_MARKER) {
                    isNewFormat = true;
                    headerStart = processed + 1;
                }

                if (headerStart + 4 < this.bufferPos &&
                    this.buffer[headerStart] === HEADER_0 &&
                    this.buffer[headerStart + 1] === HEADER_1) {

                    const type = this.buffer[headerStart + 2];
                    const size = (this.buffer[headerStart + 3] << 8) | this.buffer[headerStart + 4];

                    const markerSize = isNewFormat ? 1 : 0;
                    const totalSize = markerSize + 5 + size + 1;

                    if (processed + totalSize <= this.bufferPos) {
                        const payloadStart = headerStart + 5;
                        const payload = this.buffer.slice(payloadStart, payloadStart + size);

                        if (type === TYPE_SCREENSHOT && size === FRAME_SIZE) {
                            this.framebuffer.set(payload);
                            if (this.onFrameUpdate) this.onFrameUpdate(this.framebuffer);
                            this.updateFPS();
                        } else if (type === TYPE_DIFF && size % 9 === 0) {
                            this.applyDiff(payload, isNewFormat);
                            if (this.onFrameUpdate) this.onFrameUpdate(this.framebuffer);
                            this.updateFPS();
                        }

                        processed += totalSize;
                    } else {
                        break;
                    }
                } else {
                    processed++;
                }
            }

            if (processed > 0) {
                this.buffer.copyWithin(0, processed);
                this.bufferPos -= processed;
            }

        } catch (err: any) {
            console.error("Read Error", err);
            // Don't disconnect on parse error, just log? 
            // Or if critical?
            // User requested critical errors disconnect.
            // Parse error might be temporary garbage.
        }
    }
}

export class F4HWNProfile extends RadioProfile {
    get id(): string { return "f4hwn"; }
    get name(): string { return "F4HWN / Egzumer"; }
    get description(): string { return "Support for F4HWN and Egzumer custom firmware with advanced screencast"; }

    matchFirmware(version: string): boolean {
        // Broad matching for now
        return version.toLowerCase().includes("f4hwn") || version.toLowerCase().includes("egzumer");
    }

    get features(): FeatureFlags {
        return {
            settings: true,
            memories: true,
            screencast: true,
            calibration: false
        };
    }

    decodeChannel(_buffer: Uint8Array, index: number): Channel {
        // Placeholder
        return {
            index,
            name: `CH-${index}`,
            rxFreq: 14500000,
            offset: 0,
            mode: 'NFM',
            power: 'H',
            scanList: 'Off',
            empty: true
        };
    }

    encodeChannel(_c: Channel, _buffer: Uint8Array): void {
        // Placeholder
    }

    async startDisplayMirror(protocol: any): Promise<DisplayMirrorHandler | null> {
        // Reuse the main protocol connection via data hijacking
        const handler = new SerialHandler();
        await handler.connect(protocol);
        return handler;
    }
}
