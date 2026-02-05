import { PROTOCOL, makePacket, tryParsePacket, ParsedPacket, createMessage } from "@/lib/protocol";
import { serialManager } from "@/lib/serial";

export type FlasherStatus =
    | "idle"
    | "connecting"
    | "handshaking"
    | "flashing"
    | "completed"
    | "error";

export type LogCallback = (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
export type ProgressCallback = (percent: number) => void;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class FlasherService {
    private isActive = false;
    private readBuffer: number[] = [];
    private shouldStop = false;

    constructor() { }

    private async startReadLoop() {
        this.isActive = true;
        this.readBuffer = [];
        this.shouldStop = false;

        // Background loop
        (async () => {
            while (this.isActive && !this.shouldStop) {
                try {
                    const chunk = await serialManager.read();
                    if (chunk) {
                        for (let i = 0; i < chunk.length; i++) this.readBuffer.push(chunk[i]);
                    } else {
                        // Port closed or no data?
                        await sleep(10);
                    }
                } catch (e) {
                    console.error("Read Error:", e);
                    this.isActive = false;
                }
                await sleep(5);
            }
        })();
    }

    private stopReadLoop() {
        this.shouldStop = true;
        this.isActive = false;
    }

    private fetchMessage(): ParsedPacket | null {
        return tryParsePacket(this.readBuffer);
    }

    private async sendMessage(msg: Uint8Array) {
        const packet = makePacket(msg); // Applies Obfuscation + CRC + Header/Footer
        await serialManager.write(packet);
    }

    // --- Flashing Logic Mirroring flash.js ---

    async flashFirmware(
        firmware: Uint8Array,
        onProgress: ProgressCallback,
        onLog: LogCallback
    ) {
        if (this.isActive) throw new Error("Busy");

        try {
            onLog("Starting serial listener...", "info");
            this.startReadLoop();

            // Allow buffer to settle? flash.js does `await sleep(1000)` and checks buffer.
            onLog("Clearing buffer...", "info");
            this.readBuffer = [];
            await sleep(500);

            // 1. Wait for Device Info (Handshake / DFU Beacon)
            onLog("Waiting for device DFU Beacon (Hold PTT + Turn On)...", "info");
            const devInfo = await this.waitForDeviceInfo();

            onLog(`Device Detected: UID [${Array.from(devInfo.uid).map(b => b.toString(16).padStart(2, '0')).join('')}]`, "success");
            onLog(`Bootloader Version: ${devInfo.blVersion}`, "success");

            // 2. Handshake
            onLog("Performing Handshake...", "info");
            await this.performHandshake(devInfo.blVersion, onLog);
            onLog("Handshake Complete.", "success");

            // 3. Program Firmware
            await this.programFirmware(firmware, onProgress, onLog);

            onLog("Flashing Complete! Device should reboot.", "success");

        } catch (e: any) {
            onLog(`Error: ${e.message}`, "error");
            throw e;
        } finally {
            this.stopReadLoop();
        }
    }

    private async waitForDeviceInfo(): Promise<{ uid: Uint8Array, blVersion: string }> {
        let lastTimestamp = 0;
        let acc = 0;
        let timeout = 0;

        while (timeout < 500) { // ~5 seconds? (500 * 10ms = 5000ms)
            await sleep(10);
            timeout++;

            const msg = this.fetchMessage();
            if (!msg) continue;

            // log(`RX Message: 0x${msg.msgType.toString(16)}`, 'info');

            if (msg.msgType === PROTOCOL.MSG.NOTIFY_DEV_INFO) {
                const now = Date.now();
                const dt = now - lastTimestamp;
                lastTimestamp = now;

                if (lastTimestamp > 0 && dt >= 5 && dt <= 1000) {
                    acc++;
                    // log(`Valid interval ${dt}ms, count ${acc}`, 'info');
                    if (acc >= 5) {
                        // Found stable signal
                        // msg.data contains payload?
                        // flash.js: msg.data.slice(0, 16) is UID.
                        // msg.data.slice(16...) is Version strings (null terminated?).

                        const uid = msg.data.slice(0, 16);

                        // Find version string null terminator or end
                        let blVersionEnd = -1;
                        for (let i = 16; i < 32 && i < msg.data.length; i++) {
                            if (msg.data[i] === 0) {
                                blVersionEnd = i;
                                break;
                            }
                        }
                        if (blVersionEnd === -1) blVersionEnd = 32;

                        const blVersion = new TextDecoder().decode(msg.data.slice(16, blVersionEnd));
                        return { uid, blVersion };
                    }
                } else {
                    acc = 0;
                }
            }
        }
        throw new Error("Timeout: No device DFU beacon detected.");
    }

    private async performHandshake(blVersion: string, log: LogCallback) {
        let acc = 0;

        // Send version back 3 times? flash.js: "while (acc < 3)"
        while (acc < 3) {
            await sleep(50);
            const msg = this.fetchMessage();

            // Checks if we are still receiving DEV_INFO
            if (msg && msg.msgType === PROTOCOL.MSG.NOTIFY_DEV_INFO) {
                if (acc === 0) log("Sending handshake response...", "info");

                const blMsg = createMessage(PROTOCOL.MSG.NOTIFY_BL_VER, 4);
                // Payload: first 4 chars of blVersion
                const blBytes = new TextEncoder().encode(blVersion.substring(0, 4));
                // Set payload at offset 4 of msg (msg has type(2)+len(2))
                for (let i = 0; i < Math.min(blBytes.length, 4); i++) {
                    blMsg[4 + i] = blBytes[i];
                }

                await this.sendMessage(blMsg);
                acc++;
                await sleep(50);
            }
        }

        log("Handshake loop done. Clearing buffer...", "info");
        await sleep(200);

        // Drain buffer
        while (this.readBuffer.length > 0) {
            const msg = this.fetchMessage();
            if (!msg) break;
            // if (msg.msgType !== PROTOCOL.MSG.NOTIFY_DEV_INFO) console.log("Ignored", msg.msgType);
        }
    }

    private async programFirmware(firmware: Uint8Array, progress: ProgressCallback, log: LogCallback) {
        const pageCount = Math.ceil(firmware.length / 256);
        const timestamp = Date.now() & 0xffffffff;

        log(`Programming ${firmware.length} bytes in ${pageCount} pages...`, "info");

        let pageIndex = 0;
        let retryCount = 0;
        const MAX_RETRIES = 3;

        while (pageIndex < pageCount) {
            progress((pageIndex / pageCount) * 100);

            // Create MSG_PROG_FW (268 bytes payload + 4 header)
            // flash.js: createMessage(MSG_PROG_FW, 268)
            const msg = createMessage(PROTOCOL.MSG.PROG_FW, 268);
            const view = new DataView(msg.buffer);

            // Payload offsets (relative to msg start? No, view is on msg buffer)
            // msg[0..3] is Header (Type, Len).
            // Payload starts at 4.
            // flash.js: view.setUint32(4, timestamp, true);
            view.setUint32(4, timestamp, true);
            view.setUint16(8, pageIndex, true);
            view.setUint16(10, pageCount, true);

            // Data copy at 16? 
            // flash.js: "for (let i = 0; i < len; i++) msg[16 + i] = ..."
            // Yes.

            const offset = pageIndex * 256;
            const len = Math.min(256, firmware.length - offset);

            for (let i = 0; i < len; i++) {
                msg[16 + i] = firmware[offset + i];
            }

            await this.sendMessage(msg);

            let gotResponse = false;
            // Wait for response loop
            for (let i = 0; i < 300 && !gotResponse; i++) {
                await sleep(10);
                const resp = this.fetchMessage();
                if (!resp) continue;

                if (resp.msgType === PROTOCOL.MSG.NOTIFY_DEV_INFO) continue;

                if (resp.msgType === PROTOCOL.MSG.PROG_FW_RESP) {
                    // flash.js: RESP Payload structure?
                    // "const dv = new DataView(resp.data.buffer)"
                    // "const respPageIndex = dv.getUint16(4, true);"
                    // "const err = dv.getUint16(6, true);"
                    // resp.data is PAYLOAD ONLY (Type/Len stripped).
                    // So offsets are relative to payload start.
                    // Payload format: [Seq(4)?][Idx(2)][Err(2)]?
                    // Wait, flash.js says `getUint16(4, true)` for index.
                    // Meaning 0..3 are skipped (Seq/Timestamp).
                    const rDv = new DataView(resp.data.buffer, resp.data.byteOffset, resp.data.byteLength);
                    const respPageIndex = rDv.getUint16(4, true);
                    const err = rDv.getUint16(6, true);

                    if (respPageIndex !== pageIndex) {
                        log(`Wrong Page Response: Exp ${pageIndex}, Got ${respPageIndex}`, "warning");
                        continue;
                    }
                    if (err !== 0) {
                        log(`Page ${pageIndex} Error Code: ${err}`, "error");
                        retryCount++;
                        if (retryCount > MAX_RETRIES) throw new Error(`Too many errors at page ${pageIndex}`);
                        break; // Break inner wait loop to retry sending
                    }

                    gotResponse = true;
                    retryCount = 0;
                    // if ((pageIndex + 1) % 10 === 0) log(`Page ${pageIndex + 1}/${pageCount} OK`, "info");
                }
            }

            if (gotResponse) {
                pageIndex++;
            } else {
                log(`Page ${pageIndex} Timeout`, "warning");
                retryCount++;
                if (retryCount > MAX_RETRIES) throw new Error(`Too many timeouts at page ${pageIndex}`);
            }
        }
        progress(100);
    }
}

export const flasherService = new FlasherService();

