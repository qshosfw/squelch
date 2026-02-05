/**
 * K5/K6/K1 Protocol Implementation
 * 
 * Based on:
 * - armel/uvtools2 flash.js
 * - spm81/Multi-UVTools protocol.js
 * 
 * Packet Structure:
 * ┌─────────┬──────────┬─────────────────────────────────┬─────────┬─────────┐
 * │ Header  │ Length   │ Body (XOR obfuscated)           │ CRC16   │ Footer  │
 * │ 0xABCD  │ 2 bytes  │ [Type:2][Len:2][Payload:N]      │ 2 bytes │ 0xDCBA  │
 * └─────────┴──────────┴─────────────────────────────────┴─────────┴─────────┘
 */

import { ModuleManager } from './framework/module-manager';
import { initializeModules } from '../modules';
import { StockProfile } from '../modules/stock-module';

// Initialize modules on load
initializeModules();

import {
    BAUDRATE,
    OBFUS_TBL,
    MSG_DEV_INFO_REQ,
    MSG_DEV_INFO_RESP,
    MSG_NOTIFY_DEV_INFO,
    MSG_NOTIFY_BL_VER,
    MSG_PROG_FW,
    MSG_PROG_FW_RESP,
    MSG_READ_EEPROM,
    MSG_READ_EEPROM_RESP,
    MSG_WRITE_EEPROM,
    MSG_WRITE_EEPROM_RESP,
    MSG_REBOOT,
    MSG_RSSI_REQ,
    MSG_RSSI_RESP,
    MSG_BATT_REQ,
    MSG_BATT_RESP,
    CALIB_SIZE,
    CHUNK_SIZE,
    CALIB_OFFSET_LEGACY,
    CALIB_OFFSET_NEW,
    DEFAULT_CALIB_OFFSET
} from "./constants";

// Re-export constants for consumers
export * from "./constants";

export interface DeviceInfo {
    uid: string;
    blVersion: string;
    timestamp?: number;
}

export interface RadioStats {
    rssi?: number;
    noise?: number;
    glitch?: number;
    voltage?: number;
    current?: number;
}

export interface PortInfo {
    label: string;
    type: string;
    vidPid: string;
}

const USB_VENDORS: Record<string, string> = {
    "1a86:7523": "WCH CH340",
    "10c4:ea60": "Silicon Labs CP210x",
    "067b:2303": "Prolific PL2303",
    "0403:6001": "FTDI FT232R",
    "36b7:0001": "Quansheng K1 CPS",
    "36b7:ffff": "Puya Puya CDC Demo"
};

// ============================================================================
// Utility Functions
// ============================================================================

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function arrayToHex(arr: Uint8Array | number[]): string {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// ============================================================================
// Serial Stats Interface
// ============================================================================

export interface SerialStats {
    connectedAt: number | null;
    bytesSent: number;
    bytesReceived: number;
    packetsSent: number;
    packetsReceived: number;
    lastTxTime: number | null;
    lastRxTime: number | null;
    avgLatencyMs: number;
    latencySamples: number[];
}

// ============================================================================
// Protocol Class
// ============================================================================

export class Protocol {
    private port: any = null;
    private reader: ReadableStreamDefaultReader | null = null;
    private writer: WritableStreamDefaultWriter | null = null;
    private _isConnected = false;
    public get isConnected() { return this._isConnected; }
    private set isConnected(val: boolean) { this._isConnected = val; }
    private readBuffer: number[] = [];
    private _skipDfuWait = false;

    // Serial Stats
    private _stats: SerialStats = {
        connectedAt: null,
        bytesSent: 0,
        bytesReceived: 0,
        packetsSent: 0,
        packetsReceived: 0,
        lastTxTime: null,
        lastRxTime: null,
        avgLatencyMs: 0,
        latencySamples: []
    };

    // Callbacks
    public onLog: ((msg: string, type: 'info' | 'error' | 'success' | 'tx' | 'rx') => void) | null = null;
    public onProgress: ((percent: number) => void) | null = null;
    public onStepChange: ((step: string) => void) | null = null;
    public onStatusChange: ((connected: boolean, error?: string) => void) | null = null;
    public onStatsUpdate: ((stats: SerialStats) => void) | null = null;

    private log(msg: string, type: 'info' | 'error' | 'success' | 'tx' | 'rx' = 'info') {
        if (this.onLog) this.onLog(msg, type);
    }

    public skipWaiting() {
        this._skipDfuWait = true;
    }

    public get stats(): SerialStats {
        return { ...this._stats };
    }

    public get connectionDuration(): number {
        if (!this._stats.connectedAt) return 0;
        return Date.now() - this._stats.connectedAt;
    }

    private resetStats() {
        this._stats = {
            connectedAt: Date.now(),
            bytesSent: 0,
            bytesReceived: 0,
            packetsSent: 0,
            packetsReceived: 0,
            lastTxTime: null,
            lastRxTime: null,
            avgLatencyMs: 0,
            latencySamples: []
        };
    }

    private recordTx(bytes: number) {
        this._stats.bytesSent += bytes;
        this._stats.packetsSent++;
        this._stats.lastTxTime = Date.now();
        if (this.onStatsUpdate) this.onStatsUpdate(this.stats);
    }

    private recordRx(bytes: number) {
        this._stats.bytesReceived += bytes;
        this._stats.packetsReceived++;
        const now = Date.now();

        // Calculate latency if we have a recent TX
        if (this._stats.lastTxTime && (now - this._stats.lastTxTime) < 5000) {
            const latency = now - this._stats.lastTxTime;
            this._stats.latencySamples.push(latency);
            // Keep only last 20 samples
            if (this._stats.latencySamples.length > 20) {
                this._stats.latencySamples.shift();
            }
            // Calculate average
            this._stats.avgLatencyMs = Math.round(
                this._stats.latencySamples.reduce((a, b) => a + b, 0) / this._stats.latencySamples.length
            );
        }

        this._stats.lastRxTime = now;
        if (this.onStatsUpdate) this.onStatsUpdate(this.stats);
    }

    // ========================================================================
    // Connection Management
    // ========================================================================

    public async connect(existingPort?: any): Promise<{ success: boolean; portInfo?: PortInfo }> {
        try {
            if (existingPort) {
                this.port = existingPort;
            } else {
                if (!('serial' in navigator)) throw new Error("Web Serial not supported");
                // @ts-ignore
                this.port = await navigator.serial.requestPort();
                await this.port.open({ baudRate: BAUDRATE });
            }

            if (this.port.readable.locked) {
                throw new Error("Port locked. Please retry.");
            }

            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();
            this.isConnected = true;
            this.readBuffer = [];
            this.resetStats();

            this.readLoop();

            const portInfo = this.getPortInfo();
            this.log(`Connected to ${portInfo.label}`, 'success');

            return { success: true, portInfo };
        } catch (e: any) {
            this.log(`Connection failed: ${e.message}`, 'error');
            return { success: false };
        }
    }

    public async disconnect(closePort = true) {
        this.isConnected = false;
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
            }
            if (this.writer) {
                await this.writer.close();
                this.writer.releaseLock();
            }
            if (closePort && this.port) {
                await this.port.close();
                this.port = null;
            }
        } catch (e) {
            console.warn("Disconnect cleanup error", e);
        }
    }

    /**
     * Pauses the read loop and releases locks, but keeps the port open.
     * Used by modules (e.g. Screencast) that need exclusive access.
     */
    public async pauseConnection() {
        if (!this.isConnected) return;
        this.isConnected = false; // Stop loop

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
        } catch (e) {
            console.warn("Pause connection error", e);
        }
        this.log("Protocol paused (Resource yielded)", "info");
        return this.port;
    }

    /**
     * Resumes the read loop using the existing port.
     */
    public async resumeConnection() {
        if (!this.port) return;
        if (this.port.readable.locked || this.port.writable.locked) {
            this.log("Cannot resume: Port is still locked.", "error");
            return;
        }

        try {
            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();
            this.isConnected = true;
            this.log("Protocol resumed", "success");
            this.readLoop();
        } catch (e: any) {
            this.log("Resume failed: " + e.message, "error");
        }
    }

    public getPortInfo(): PortInfo {
        if (!this.port) return { label: "Unknown", type: "Unknown", vidPid: "????" };

        const info = this.port.getInfo?.();
        const vid = (info?.usbVendorId ?? 0).toString(16).padStart(4, '0');
        const pid = (info?.usbProductId ?? 0).toString(16).padStart(4, '0');
        const vidPid = `${vid}:${pid}`;

        return {
            label: USB_VENDORS[vidPid] || "USB Serial",
            type: "USB",
            vidPid
        };
    }

    private async readLoop() {
        while (this.isConnected && this.reader) {
            try {
                const { value, done } = await this.reader.read();
                if (done) {
                    if (this.isConnected) {
                        this.isConnected = false;
                        if (this.onStatusChange) this.onStatusChange(false, "Serial stream closed");
                    }
                    break;
                }
                if (value && value.length > 0) {
                    for (let i = 0; i < value.length; i++) {
                        this.readBuffer.push(value[i]);
                    }
                    this._stats.bytesReceived += value.length;
                }
            } catch (e: any) {
                if (this.isConnected) {
                    console.error("Read loop error", e);
                    this.isConnected = false;
                    if (this.onStatusChange) this.onStatusChange(false, e.message || "Device disconnected");
                }
                break;
            }
        }
    }

    // ========================================================================
    // Low-Level Packet Logic
    // ========================================================================

    private calcCRC(buf: Uint8Array, off: number, size: number): number {
        let crc = 0;
        for (let i = 0; i < size; i++) {
            const b = buf[off + i] & 0xff;
            crc ^= b << 8;
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
                else crc = (crc << 1) & 0xffff;
            }
        }
        return crc;
    }

    private obfuscate(buf: Uint8Array, off: number, size: number) {
        for (let i = 0; i < size; i++) {
            buf[off + i] ^= OBFUS_TBL[i % OBFUS_TBL.length];
        }
    }

    /**
     * Create inner message: [msgType:2][dataLen:2][data:N]
     * This matches flash.js createMessage()
     */
    private createMessage(msgType: number, dataLen: number): Uint8Array {
        const msg = new Uint8Array(4 + dataLen);
        const view = new DataView(msg.buffer);
        view.setUint16(0, msgType, true);
        view.setUint16(2, dataLen, true);
        return msg;
    }

    /**
     * Wrap inner message into packet: [header:2][len:2][msg (obfuscated)][crc:2][footer:2]
     * This matches flash.js makePacket()
     */
    private makePacket(msg: Uint8Array): Uint8Array {
        let msgLen = msg.length;
        if (msgLen % 2 !== 0) msgLen++;

        const buf = new Uint8Array(8 + msgLen);
        const view = new DataView(buf.buffer);

        view.setUint16(0, 0xCDAB, true);            // Header
        view.setUint16(2, msgLen, true);             // Length
        view.setUint16(6 + msgLen, 0xBADC, true);    // Footer

        for (let i = 0; i < msg.length; i++) buf[4 + i] = msg[i];

        const crc = this.calcCRC(buf, 4, msgLen);
        view.setUint16(4 + msgLen, crc, true);

        this.obfuscate(buf, 4, 2 + msgLen);

        return buf;
    }

    private fetchMessage(): { msgType: number; data: Uint8Array } | null {
        const buf = this.readBuffer;
        if (buf.length < 8) return null;

        let packBegin = -1;
        for (let i = 0; i < buf.length - 1; i++) {
            if (buf[i] === 0xab && buf[i + 1] === 0xcd) {
                packBegin = i;
                break;
            }
        }
        if (packBegin === -1) {
            if (buf.length > 0 && buf[buf.length - 1] === 0xab) {
                buf.splice(0, buf.length - 1);
            } else {
                buf.length = 0;
            }
            return null;
        }
        if (buf.length - packBegin < 8) return null;

        const msgLen = (buf[packBegin + 3] << 8) | buf[packBegin + 2];
        const packEnd = packBegin + 6 + msgLen;
        if (buf.length < packEnd + 2) return null;

        if (buf[packEnd] !== 0xdc || buf[packEnd + 1] !== 0xba) {
            buf.splice(0, packBegin + 2);
            return null;
        }

        const msgBuf = new Uint8Array(msgLen + 2);
        for (let i = 0; i < msgLen + 2; i++) {
            msgBuf[i] = buf[packBegin + 4 + i];
        }
        this.obfuscate(msgBuf, 0, msgLen + 2);

        const view = new DataView(msgBuf.buffer);
        const msgType = view.getUint16(0, true);
        const data = msgBuf.slice(4);

        buf.splice(0, packEnd + 2);
        this.recordRx(packEnd + 2 - packBegin);
        return { msgType, data };
    }

    private async sendMessage(msg: Uint8Array) {
        if (!this.writer) throw new Error("Not connected");

        const packet = this.makePacket(msg);
        this.log(`TX: ${arrayToHex(packet)}`, 'tx');
        await this.writer.write(packet);
        this.recordTx(packet.length);
    }

    public async sendRaw(data: Uint8Array) {
        if (!this.writer) throw new Error("Not connected");
        this.log(`RAW TX: ${arrayToHex(data)}`, 'tx');
        await this.writer.write(data);
    }

    // ========================================================================
    // Device Identification
    // ========================================================================

    public async identify(timeoutMs = 5000): Promise<DeviceInfo> {
        this.readBuffer = [];
        const ts = Date.now() & 0xffffffff;

        // Create message: [msgType:2][dataLen:2][timestamp:4]
        const msg = this.createMessage(MSG_DEV_INFO_REQ, 4);
        new DataView(msg.buffer).setUint32(4, ts, true);
        await this.sendMessage(msg);

        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            await sleep(10);
            const resp = this.fetchMessage();
            if (!resp) continue;

            this.log(`RX: msgType=0x${resp.msgType.toString(16).padStart(4, '0')}`, 'rx');

            if (resp.msgType === MSG_DEV_INFO_RESP) {
                // Extract ASCII string from device info
                let deviceInfoStr = '';
                for (let i = 0; i < resp.data.length; i++) {
                    const c = resp.data[i];
                    if (c === 0x00 || c === 0xFF) break;
                    if (c >= 32 && c < 127) {
                        deviceInfoStr += String.fromCharCode(c);
                    }
                }
                this.log(`Device: ${deviceInfoStr}`, 'success');

                // Detect Module
                const profile = ModuleManager.detectProfile(deviceInfoStr);
                if (profile) {
                    ModuleManager.setActiveProfile(profile);
                    this.log(`Active Profile: ${profile.name}`, 'info');
                } else {
                    // Fallback to stock
                    console.log("No specific profile matched, using Stock.");
                    ModuleManager.setActiveProfile(new StockProfile());
                }

                return { uid: "", blVersion: deviceInfoStr, timestamp: ts };
            }
        }

        throw new Error("Device identification timed out");
    }

    // ========================================================================
    // DFU / Bootloader Operations
    // ========================================================================

    public async waitForBootloader(timeoutMs = 10000): Promise<{ uid: Uint8Array; blVersion: string }> {
        if (this.onStepChange) this.onStepChange("Waiting for bootloader...");
        this.log('Waiting for bootloader...', 'info');

        let lastTimestamp = 0;
        let acc = 0;
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            if (this._skipDfuWait) {
                this._skipDfuWait = false;
                this.log("Skipping DFU wait (User Action)", 'info');
                return { uid: new Uint8Array(16), blVersion: "Skipped" };
            }

            await sleep(10);
            const msg = this.fetchMessage();
            if (!msg) continue;

            if (msg.msgType === MSG_NOTIFY_DEV_INFO) {
                const now = Date.now();
                const dt = now - lastTimestamp;
                lastTimestamp = now;

                // Valid interval: 5-1000ms
                if (lastTimestamp > 0 && dt >= 5 && dt <= 1000) {
                    acc++;
                    if (acc >= 5) {
                        const uid = new Uint8Array(msg.data.slice(0, 16));
                        let blVersionEnd = -1;
                        for (let i = 16; i < 32; i++) {
                            if (msg.data[i] === 0) {
                                blVersionEnd = i;
                                break;
                            }
                        }
                        if (blVersionEnd === -1) blVersionEnd = 32;
                        const blVersion = new TextDecoder().decode(msg.data.slice(16, blVersionEnd));

                        this.log(`Bootloader: ${blVersion} (UID: ${arrayToHex(uid)})`, 'success');
                        return { uid, blVersion };
                    }
                } else {
                    acc = 0;
                }
            }
        }
        throw new Error('Timeout waiting for bootloader. Ensure radio is in DFU mode (PTT + Power On)');
    }

    private async performHandshake(blVersion: string) {
        if (this.onStepChange) this.onStepChange("Performing handshake...");

        let acc = 0;
        while (acc < 3) {
            await sleep(50);
            const msg = this.fetchMessage();

            if (msg && msg.msgType === MSG_NOTIFY_DEV_INFO) {
                if (acc === 0) this.log('Sending bootloader handshake...', 'info');

                const blMsg = this.createMessage(MSG_NOTIFY_BL_VER, 4);
                const blBytes = new TextEncoder().encode(blVersion.substring(0, 4));
                for (let i = 0; i < Math.min(blBytes.length, 4); i++) blMsg[4 + i] = blBytes[i];

                await this.sendMessage(blMsg);
                acc++;
                await sleep(50);
            }
        }

        this.log('Waiting for bootloader to stabilize...', 'info');
        await sleep(200);
        this.readBuffer = [];
        this.log('Handshake complete', 'success');
    }

    // ========================================================================
    // EEPROM Operations
    // ========================================================================

    public async readEEPROM(offset: number, size = CHUNK_SIZE, timestamp = 0): Promise<Uint8Array> {
        await sleep(50);

        // Create message: [msgType:2][dataLen:2][offset:2][size:2][timestamp:4]
        const msg = this.createMessage(MSG_READ_EEPROM, 8);
        const view = new DataView(msg.buffer);
        view.setUint16(4, offset, true);
        view.setUint16(6, size, true);
        view.setUint32(8, timestamp || (Date.now() & 0xffffffff), true);

        for (let retry = 0; retry < 3; retry++) {
            if (retry > 0) await sleep(100);
            await this.sendMessage(msg);

            const start = Date.now();
            while (Date.now() - start < 3000) {
                await sleep(10);
                const resp = this.fetchMessage();
                if (!resp) continue;

                if (resp.msgType === MSG_READ_EEPROM_RESP) {
                    const dv = new DataView(resp.data.buffer, resp.data.byteOffset, resp.data.byteLength);
                    const respOffset = dv.getUint16(0, true);
                    const respSize = resp.data[2];

                    if (respOffset === offset && respSize === size) {
                        return new Uint8Array(resp.data.slice(4, 4 + size));
                    }
                }
            }
        }

        throw new Error(`EEPROM read timeout at 0x${offset.toString(16)}`);
    }

    public async writeEEPROM(offset: number, data: Uint8Array, timestamp = 0): Promise<boolean> {
        const size = data.length;

        // Create message: [msgType:2][dataLen:2][offset:2][size:2][writeEnable][pad][timestamp:4][data:16]
        const msg = this.createMessage(MSG_WRITE_EEPROM, 8 + size);
        const view = new DataView(msg.buffer);
        view.setUint16(4, offset, true);
        view.setUint16(6, size, true);
        msg[7] = 1;  // Write enable flag
        view.setUint32(8, timestamp || (Date.now() & 0xffffffff), true);
        for (let i = 0; i < size; i++) {
            msg[12 + i] = data[i];
        }

        for (let retry = 0; retry < 3; retry++) {
            if (retry > 0) await sleep(100);
            await this.sendMessage(msg);

            const start = Date.now();
            while (Date.now() - start < 3000) {
                await sleep(10);
                const resp = this.fetchMessage();
                if (!resp) continue;

                if (resp.msgType === MSG_WRITE_EEPROM_RESP) {
                    const dv = new DataView(resp.data.buffer, resp.data.byteOffset, resp.data.byteLength);
                    if (dv.getUint16(0, true) === offset) {
                        return true;
                    }
                }
            }
        }

        throw new Error(`EEPROM write timeout at 0x${offset.toString(16)}`);
    }

    public async backupCalibration(offset?: number): Promise<Uint8Array> {
        if (this.onStepChange) this.onStepChange("Reading calibration...");

        let devInfo: DeviceInfo;
        try {
            devInfo = await this.identify();
        } catch {
            devInfo = { uid: '', blVersion: '', timestamp: Date.now() & 0xffffffff };
        }

        // Auto-detect offset based on firmware version
        let currentOffset = offset;
        if (currentOffset === undefined) {
            const versionMatch = devInfo.blVersion.match(/v?(\d+)\.(\d+)\.(\d+)/);
            if (versionMatch) {
                const major = parseInt(versionMatch[1], 10);
                if (major >= 5) {
                    currentOffset = CALIB_OFFSET_NEW;
                    this.log(`Firmware v${major}.x: Using new offset (0xB000)`, 'info');
                } else {
                    currentOffset = CALIB_OFFSET_LEGACY;
                    this.log(`Firmware v${major}.x: Using legacy offset (0x1E00)`, 'info');
                }
            } else {
                if (devInfo.blVersion.startsWith("Bootloader")) {
                    throw new Error("Cannot read EEPROM in Bootloader mode. Restart radio normally.");
                }
                currentOffset = DEFAULT_CALIB_OFFSET;
            }
        }

        const result = new Uint8Array(CALIB_SIZE);
        this.log(`Reading EEPROM: 0x${currentOffset.toString(16)} (${CALIB_SIZE} bytes)`, 'info');

        for (let i = 0; i < CALIB_SIZE; i += CHUNK_SIZE) {
            if (this.onProgress) this.onProgress((i / CALIB_SIZE) * 100);

            const chunk = await this.readEEPROM(currentOffset, CHUNK_SIZE, devInfo.timestamp);
            for (let j = 0; j < CHUNK_SIZE; j++) {
                result[i + j] = chunk[j];
            }
            currentOffset += CHUNK_SIZE;
        }

        if (this.onProgress) this.onProgress(100);
        this.log("Backup complete", 'success');
        return result;
    }

    public async restoreCalibration(data: Uint8Array, offset?: number): Promise<void> {
        if (data.length !== CALIB_SIZE) {
            throw new Error(`Invalid calibration size: ${data.length} (expected ${CALIB_SIZE})`);
        }

        if (this.onStepChange) this.onStepChange("Writing calibration...");

        let devInfo: DeviceInfo;
        try {
            devInfo = await this.identify();
        } catch {
            devInfo = { uid: '', blVersion: '', timestamp: Date.now() & 0xffffffff };
        }

        let currentOffset = offset;
        if (currentOffset === undefined) {
            const versionMatch = devInfo.blVersion.match(/v?(\d+)\.(\d+)\.(\d+)/);
            if (versionMatch && parseInt(versionMatch[1], 10) >= 5) {
                currentOffset = CALIB_OFFSET_NEW;
            } else {
                currentOffset = CALIB_OFFSET_LEGACY;
            }
        }

        this.log(`Writing EEPROM: 0x${currentOffset.toString(16)} (${CALIB_SIZE} bytes)`, 'info');

        for (let i = 0; i < CALIB_SIZE; i += CHUNK_SIZE) {
            if (this.onProgress) this.onProgress((i / CALIB_SIZE) * 100);

            const chunk = data.slice(i, i + CHUNK_SIZE);
            await this.writeEEPROM(currentOffset, chunk, devInfo.timestamp);
            currentOffset += CHUNK_SIZE;
        }

        if (this.onProgress) this.onProgress(100);
        this.log("Restore complete. Rebooting...", 'success');

        const rebootMsg = this.createMessage(MSG_REBOOT, 0);
        await this.sendMessage(rebootMsg);
    }

    // ========================================================================
    // Telemetry
    // ========================================================================

    public async getRadioStats(): Promise<RadioStats> {
        const profile = ModuleManager.getActiveProfile();
        if (profile) {
            try {
                const customStats = await profile.getTelemetry(this);
                if (customStats) return customStats;
            } catch (e) {
                console.warn("Module telemetry failed", e);
            }
        }

        const stats: RadioStats = {};

        try {
            this.readBuffer = [];
            const msg = this.createMessage(MSG_RSSI_REQ, 0);
            await this.sendMessage(msg);

            const start = Date.now();
            while (Date.now() - start < 500) {
                await sleep(10);
                const resp = this.fetchMessage();
                if (resp && resp.msgType === MSG_RSSI_RESP) {
                    const dv = new DataView(resp.data.buffer, resp.data.byteOffset, resp.data.byteLength);
                    stats.rssi = dv.getUint16(0, true) & 0x01FF;
                    stats.noise = resp.data[2];
                    stats.glitch = resp.data[3];
                    break;
                }
            }
        } catch { /* Ignore */ }

        try {
            this.readBuffer = [];
            const msg = this.createMessage(MSG_BATT_REQ, 0);
            await this.sendMessage(msg);

            const start = Date.now();
            while (Date.now() - start < 500) {
                await sleep(10);
                const resp = this.fetchMessage();
                if (resp && resp.msgType === MSG_BATT_RESP) {
                    const dv = new DataView(resp.data.buffer, resp.data.byteOffset, resp.data.byteLength);
                    stats.voltage = dv.getUint16(0, true);
                    stats.current = dv.getUint16(2, true);
                    break;
                }
            }
        } catch { /* Ignore */ }

        return stats;
    }

    // ========================================================================
    // Firmware Flashing
    // ========================================================================

    public async flashFirmware(firmware: Uint8Array) {
        this.log("Starting Firmware Flash...", 'info');
        if (this.onStepChange) this.onStepChange("Initializing...");

        this.readBuffer = [];
        await sleep(1000);

        // Step 1: Wait for Bootloader
        let blVersion = '';
        try {
            const info = await this.waitForBootloader(10000);
            blVersion = info.blVersion;
        } catch (e) {
            this.log("Could not detect bootloader. Ensure radio is in DFU mode.", 'error');
            throw e;
        }

        // Step 2: Handshake
        this.log(`Handshake with BL v${blVersion}...`, 'info');
        await this.performHandshake(blVersion);

        // Step 3: Flash Pages
        if (this.onStepChange) this.onStepChange("Flashing...");
        const pageCount = Math.ceil(firmware.length / 256);
        const timestamp = Date.now() & 0xffffffff;
        this.log(`Flashing ${pageCount} pages...`, 'info');

        for (let page = 0; page < pageCount; page++) {
            if (this.onProgress) this.onProgress((page / pageCount) * 100);

            const offset = page * 256;
            const len = Math.min(256, firmware.length - offset);

            // Create message: [msgType:2][dataLen:2][timestamp:4][page:2][pageCount:2][reserved:4][data:256]
            const msg = this.createMessage(MSG_PROG_FW, 268);
            const view = new DataView(msg.buffer);
            view.setUint32(4, timestamp, true);
            view.setUint16(8, page, true);
            view.setUint16(10, pageCount, true);

            for (let i = 0; i < len; i++) msg[16 + i] = firmware[offset + i];

            await this.sendMessage(msg);

            // Wait for Ack
            let acked = false;
            const start = Date.now();
            while (Date.now() - start < 3000 && !acked) {
                await sleep(10);
                const resp = this.fetchMessage();
                if (!resp) continue;
                if (resp.msgType === MSG_NOTIFY_DEV_INFO) continue;

                if (resp.msgType === MSG_PROG_FW_RESP) {
                    const dv = new DataView(resp.data.buffer, resp.data.byteOffset, resp.data.byteLength);
                    const rPage = dv.getUint16(4, true);
                    const rErr = dv.getUint16(6, true);

                    if (rPage !== page) continue;
                    if (rErr !== 0) {
                        this.log(`Page ${page} error: ${rErr}`, 'error');
                        throw new Error(`Flash Error on page ${page}: Code ${rErr}`);
                    }
                    acked = true;
                    if ((page + 1) % 10 === 0) this.log(`Page ${page + 1}/${pageCount} OK`, 'info');
                }
            }

            if (!acked) throw new Error(`Timeout waiting for Ack on page ${page}`);
        }

        if (this.onProgress) this.onProgress(100);
        if (this.onStepChange) this.onStepChange("Complete");
        this.log("Flashing Complete!", 'success');
    }

    // ========================================================================
    // Legacy Method Aliases (Backwards Compatibility)
    // ========================================================================

    public async identifyDevice(timeoutMs = 5000): Promise<DeviceInfo> {
        return this.identify(timeoutMs);
    }

    public async getDeviceInfo(timeoutMs = 5000): Promise<DeviceInfo> {
        return this.identify(timeoutMs);
    }

    public async backupEEPROM(offset?: number, _size = CALIB_SIZE): Promise<Uint8Array> {
        return this.backupCalibration(offset);
    }

    public async restoreEEPROM(data: Uint8Array): Promise<void> {
        return this.restoreCalibration(data);
    }
}

// Export singleton instance
export const protocol = new Protocol();

// Legacy export alias for backwards compatibility
export { protocol as protocolHandler };
