import { BAUDRATE } from "@/lib/constants";
import { DisplayMirrorHandler } from "@/lib/framework/module-interface";

// Protocol Constants
const HEADER = new Uint8Array([0xAA, 0x55]);
const TYPE_SCREENSHOT = 0x01;
const TYPE_DIFF = 0x02;
// 128x64 pixels, 1 bit per pixel = 1024 bytes
const FRAME_SIZE = 1024;

export class SerialHandler implements DisplayMirrorHandler {
    private port: any = null;
    private reader: ReadableStreamDefaultReader | null = null;
    private writer: WritableStreamDefaultWriter | null = null;
    private keepaliveInterval: number | null = null;
    private isConnected = false;

    private framebuffer = new Uint8Array(FRAME_SIZE);

    // Callbacks
    public onFrameUpdate?: (framebuffer: Uint8Array) => void;
    public onStatusChange?: (connected: boolean, error?: string) => void;
    public onStatsUpdate?: (stats: { fps: number, bps: number, totalFrames: number }) => void;

    // Stats
    private frameCount = 0;
    private totalFrameCount = 0;
    private byteCount = 0;
    private lastTime = performance.now();

    constructor() {
        this.resetFramebuffer();
    }

    private resetFramebuffer() {
        this.framebuffer.fill(0);
    }

    public getFramebuffer(): Uint8Array {
        return this.framebuffer;
    }

    public async connect(existingPort?: any) {
        try {
            if (existingPort) {
                this.port = existingPort;
            } else {
                if (!('serial' in navigator)) {
                    throw new Error("Web Serial API not supported in this browser.");
                }
                // @ts-ignore
                this.port = await navigator.serial.requestPort();
                await this.port.open({ baudRate: BAUDRATE });
            }

            // Check if readable is locked
            if (this.port.readable.locked) {
                throw new Error("Port is locked. Wait and try again.");
            }

            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();

            this.isConnected = true;
            this.totalFrameCount = 0; // Reset session stats
            if (this.onStatusChange) this.onStatusChange(true);

            this.startKeepalive();
            // Send initial keepalive immediately to wake up stream
            this.sendKeepalive();

            this.readLoop();
        } catch (err: any) {
            console.error("Connection failed", err);
            this.disconnect(false);
            if (this.onStatusChange) this.onStatusChange(false, err.message || "Connection failed");
            throw err;
        }
    }

    public async disconnect(closePort = true) {
        this.isConnected = false;

        if (this.keepaliveInterval) {
            window.clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }

        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }
            if (this.writer) {
                await this.writer.close();
                this.writer.releaseLock();
                this.writer = null;
            }
            if (closePort && this.port) {
                await this.port.close();
                this.port = null;
            }
        } catch (e) {
            console.warn("Error during disconnect cleanup", e);
        }

        if (closePort && this.onStatusChange) this.onStatusChange(false);
    }

    private startKeepalive() {
        if (this.keepaliveInterval) clearInterval(this.keepaliveInterval);
        this.keepaliveInterval = window.setInterval(() => this.sendKeepalive(), 250);
    }

    private async sendKeepalive() {
        if (!this.writer || !this.isConnected) return;
        try {
            const keepalive = new Uint8Array([0x55, 0xAA, 0x00, 0x00]);
            await this.writer.write(keepalive);
        } catch (e) {
            console.error("Keepalive failed", e);
        }
    }

    private updateFPS() {
        this.frameCount++;
        this.totalFrameCount++;

        const now = performance.now();
        const elapsed = now - this.lastTime;

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
            this.lastTime = now;
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

    private async readLoop() {
        const buffer = new Uint8Array(16384);
        let bufferPos = 0;

        while (this.isConnected && this.reader) {
            try {
                const { value, done } = await this.reader.read();
                if (done) break;

                this.byteCount += value.length;

                if (bufferPos + value.length > buffer.length) {
                    buffer.copyWithin(0, bufferPos);
                    bufferPos = 0;
                }
                buffer.set(value, bufferPos);
                bufferPos += value.length;

                let processed = 0;

                while (processed < bufferPos - 4) {
                    let isNewFormat = false;
                    let headerStart = processed;

                    if (buffer[processed] === 0xFF) {
                        isNewFormat = true;
                        headerStart = processed + 1;
                    }

                    if (headerStart + 4 < bufferPos &&
                        buffer[headerStart] === HEADER[0] &&
                        buffer[headerStart + 1] === HEADER[1]) {

                        const type = buffer[headerStart + 2];
                        const size = (buffer[headerStart + 3] << 8) | buffer[headerStart + 4];

                        const markerSize = isNewFormat ? 1 : 0;
                        const totalSize = markerSize + 5 + size + 1;

                        if (processed + totalSize <= bufferPos) {
                            const payloadStart = headerStart + 5;
                            const payload = buffer.slice(payloadStart, payloadStart + size);

                            if (type === TYPE_SCREENSHOT && size === FRAME_SIZE) {
                                this.framebuffer.set(payload);
                                if (this.onFrameUpdate) this.onFrameUpdate(this.getFramebuffer());
                                this.updateFPS();
                            } else if (type === TYPE_DIFF && size % 9 === 0) {
                                this.applyDiff(payload, isNewFormat);
                                if (this.onFrameUpdate) this.onFrameUpdate(this.getFramebuffer());
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
                    buffer.copyWithin(0, processed);
                    bufferPos -= processed;
                }

            } catch (err) {
                if (this.isConnected) {
                    console.error("Read Error", err);
                    this.disconnect(false);
                    if (this.onStatusChange) this.onStatusChange(false, "Read Error");
                }
                break;
            }
        }
    }
}
