import { PROTOCOL, makePacket, tryParsePacket, ParsedPacket, createMessage } from "@/lib/protocol";
import { serialManager } from "@/lib/serial";
import { ProgressCallback, LogCallback } from "./flasher";

export class CalibrationService {
    private readBuffer: number[] = [];
    private isActive = false;
    private shouldStop = false;

    constructor() { }

    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async startReadLoop() {
        this.isActive = true;
        this.readBuffer = [];
        this.shouldStop = false;

        (async () => {
            while (this.isActive && !this.shouldStop) {
                try {
                    const chunk = await serialManager.read();
                    if (chunk) {
                        for (let i = 0; i < chunk.length; i++) this.readBuffer.push(chunk[i]);
                    } else await this.sleep(10);
                } catch { this.isActive = false; }
                await this.sleep(5);
            }
        })();
    }

    private stopReadLoop() {
        this.shouldStop = true;
        this.isActive = false;
    }

    private async sendMessage(msg: Uint8Array) {
        const packet = makePacket(msg);
        await serialManager.write(packet);
    }

    private fetchMessage(): ParsedPacket | null {
        return tryParsePacket(this.readBuffer);
    }

    private async connectAndDetect(log: LogCallback, progress: ProgressCallback): Promise<number> {
        log("Connecting to device...", "info");
        progress(0);

        // Request Device Info
        const infoMsg = createMessage(PROTOCOL.MSG.DEV_INFO_REQ, 4);
        const dv = new DataView(infoMsg.buffer);
        dv.setUint32(4, Date.now() & 0xFFFFFFFF, true);

        await this.sendMessage(infoMsg);

        let version = "";
        const startWait = Date.now();
        while (Date.now() - startWait < 3000) {
            await this.sleep(10);
            const r = this.fetchMessage();
            if (r && r.msgType === PROTOCOL.MSG.DEV_INFO_RESP) {
                const data = r.data;
                for (let i = 0; i < data.length; i++) {
                    if (data[i] === 0 || data[i] === 0xFF) break;
                    if (data[i] >= 32 && data[i] < 127) version += String.fromCharCode(data[i]);
                }
                break;
            }
        }

        let offset: number = PROTOCOL.CALIB.OFFSET_LEGACY;
        const match = version.match(/v?(\d+)\.(\d+)\.(\d+)/i);
        if (match) {
            const major = parseInt(match[1], 10);
            if (major >= 5) {
                offset = PROTOCOL.CALIB.OFFSET_NEW;
            }
        }

        log(`Device: ${version || "Unknown"} (Offset: 0x${offset.toString(16)})`, "success");
        return offset;
    }

    async backupCalibration(
        onProgress: ProgressCallback,
        onLog: LogCallback
    ): Promise<Uint8Array> {
        this.shouldStop = false;
        this.startReadLoop();

        try {
            const offset = await this.connectAndDetect(onLog, onProgress);

            const totalSize = PROTOCOL.CALIB.SIZE;
            const chunk = PROTOCOL.CALIB.CHUNK_SIZE;
            const buffer = new Uint8Array(totalSize);

            let currentAddr = offset;
            const endAddr = offset + totalSize;
            let written = 0;
            const ts = Date.now() & 0xFFFFFFFF;

            while (currentAddr < endAddr) {
                if (this.shouldStop) throw new Error("Cancelled");

                const pct = (written / totalSize) * 100;
                onProgress(pct);

                const reqMsg = createMessage(PROTOCOL.MSG.READ_EEPROM, 8);
                const reqView = new DataView(reqMsg.buffer);
                reqView.setUint16(4, currentAddr, true);
                reqView.setUint16(6, chunk, true);
                reqView.setUint32(8, ts, true);

                await this.sendMessage(reqMsg);

                let gotResp = false;
                const wStart = Date.now();
                while (Date.now() - wStart < 1000) {
                    await this.sleep(5);
                    const r = this.fetchMessage();
                    if (r && r.msgType === PROTOCOL.MSG.READ_EEPROM_RESP) {
                        if (r.data.length >= 4) {
                            const rd = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
                            const rAddr = rd.getUint16(0, true);
                            if (rAddr === currentAddr) {
                                const dataPart = r.data.slice(4, 4 + chunk);
                                buffer.set(dataPart, written);
                                gotResp = true;
                                break;
                            }
                        }
                    }
                }

                if (!gotResp) throw new Error(`Read timeout at 0x${currentAddr.toString(16)}`);

                currentAddr += chunk;
                written += chunk;
            }

            onProgress(100);
            onLog("Calibration Dump Complete!", "success");
            return buffer;
        } finally {
            this.stopReadLoop();
        }
    }

    async restoreCalibration(
        data: Uint8Array,
        onProgress: ProgressCallback,
        onLog: LogCallback
    ) {
        if (data.length !== PROTOCOL.CALIB.SIZE) {
            throw new Error(`Invalid calibration data size. Expected ${PROTOCOL.CALIB.SIZE}, got ${data.length}`);
        }

        this.shouldStop = false;
        this.startReadLoop();

        try {
            const offset = await this.connectAndDetect(onLog, onProgress);

            const chunk = PROTOCOL.CALIB.CHUNK_SIZE;
            let currentAddr = offset;
            const endAddr = offset + PROTOCOL.CALIB.SIZE;
            let written = 0;
            const ts = Date.now() & 0xFFFFFFFF;

            onLog("Starting Calibration Restore...", "info");

            while (currentAddr < endAddr) {
                if (this.shouldStop) throw new Error("Cancelled");

                const pct = (written / PROTOCOL.CALIB.SIZE) * 100;
                onProgress(pct);

                // WRITE_EEPROM: Addr(2) + Size(2) + Time(4) + Data(16)
                // Payload size: 2+2+4+16 = 24.
                const msg = createMessage(PROTOCOL.MSG.WRITE_EEPROM, 24);
                const view = new DataView(msg.buffer);

                // Payload at 4
                view.setUint16(4, currentAddr, true);
                view.setUint16(6, chunk, true);
                view.setUint32(8, ts, true);

                // Copy data
                for (let i = 0; i < chunk; i++) {
                    msg[12 + i] = data[written + i];
                }

                await this.sendMessage(msg);

                // Wait Response
                let gotResp = false;
                const wStart = Date.now();
                while (Date.now() - wStart < 1000) {
                    await this.sleep(5);
                    const r = this.fetchMessage();
                    if (r && r.msgType === PROTOCOL.MSG.WRITE_EEPROM_RESP) {
                        // Response payload: likely Addr(2) + Result(1)?
                        const rd = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
                        const rAddr = rd.getUint16(0, true);
                        if (rAddr === currentAddr) {
                            gotResp = true;
                            break;
                        }
                    }
                }

                if (!gotResp) throw new Error(`Write timeout at 0x${currentAddr.toString(16)}`);

                currentAddr += chunk;
                written += chunk;
            }

            onProgress(100);
            onLog("Calibration Restore Complete! Please reboot.", "success");

        } finally {
            this.stopReadLoop();
        }
    }
}

export const calibrationService = new CalibrationService();
