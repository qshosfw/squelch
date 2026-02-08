import { RadioProfile, Channel, FeatureFlags, TelemetryData } from '../lib/framework/module-interface';

// --- Radio Constants ---
const TONES = [
    67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100.0, 103.5, 107.2, 110.9,
    114.8, 118.8, 123.0, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9,
    171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5, 203.5, 206.5, 210.7, 218.1,
    225.7, 229.1, 233.6, 241.8, 250.3, 254.1
];

const DTCS_CODES = [
    23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74,
    114, 115, 116, 122, 125, 131, 132, 134, 143, 145, 152, 155, 156, 162, 165, 172,
    174, 205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252, 255, 261, 263, 265,
    266, 271, 274, 306, 311, 315, 325, 331, 332, 343, 346, 351, 356, 364, 365, 371,
    411, 412, 413, 423, 431, 432, 445, 446, 452, 454, 455, 462, 464, 465, 466, 503,
    506, 516, 523, 526, 532, 546, 565, 606, 612, 624, 627, 631, 632, 654, 662, 664,
    703, 712, 723, 731, 732, 734, 743, 754
];

// --- DeltaFW Telemetry Structures ---
// Based on REPLY_0528 (Signal) and REPLY_052A (Battery)
const MSG_RSSI_REQ = 0x0527;
const MSG_RSSI_RESP = 0x0528;
const MSG_BATT_REQ = 0x0529;
const MSG_BATT_RESP = 0x052A;
const MSG_GET_ID = 0x0533;
const MSG_GET_ID_RESP = 0x0534;

interface DeviceInfo {
    serial: bigint;
    version: string;
    commit: string;
    date: string;
}

// Battery Discharge Curves removed - using firmware reported percentage


/**
 * DeltaFW Profile
 * Supports enhanced telemetry and custom device identification.
 */
export class DeltaFWProfile extends RadioProfile {
    private isMirroring = false;
    get id() { return "deltafw"; }
    get name() { return "deltafw"; }

    matchFirmware(version: string): boolean {
        return /deltafw/i.test(version);
    }

    get features(): FeatureFlags {
        return {
            settings: true,
            memories: true,
            screencast: true,
            calibration: true
        };
    }

    get memoryRanges() {
        return {
            channels: { start: 0x0000, size: 200 * 16 },
            attributes: { start: 0x0D60, size: 0x0E40 - 0x0D60 },
            names: { start: 0x0F50, size: 200 * 16 },
            settings: { start: 0x0E70, size: 0xB0 }
        };
    }

    async fetchIdentification(protocol: any, timestamp: number): Promise<DeviceInfo | null> {
        try {
            const payload = protocol.createMessage(MSG_GET_ID, 4);
            new DataView(payload.buffer).setUint32(4, timestamp, true);

            await protocol.sendMessage(payload);
            const start = Date.now();
            while (Date.now() - start < 3000) {
                await new Promise(r => setTimeout(r, 10)); // Use local sleep
                const resp = protocol.fetchMessage();
                if (resp && resp.msgType === MSG_GET_ID_RESP) {
                    // resp.data contains: Header(4) + Padding(4)? + DeviceInfo(48)
                    // DeviceInfo: Serial(8), Version(16), Commit(8), Date(16)
                    // Total payload size expected: 4 + 4 + 48 = 56 bytes (if aligned)
                    // Or 4 + 48 = 52 bytes (if packed)

                    const dv = new DataView(resp.data.buffer, resp.data.byteOffset, resp.data.byteLength);
                    const len = resp.data.byteLength;

                    let dataOffset = 4;
                    // Heuristic: Check if enough bytes for aligned
                    if (len >= 56) {
                        dataOffset = 8; // Skip Header(4) + Padding(4)
                    }

                    const serial = dv.getBigUint64(dataOffset, true);

                    // Helper to read fixed strings
                    const readString = (offset: number, maxLen: number) => {
                        let s = "";
                        for (let i = 0; i < maxLen; i++) {
                            const c = dv.getUint8(offset + i);
                            if (c === 0) break;
                            s += String.fromCharCode(c);
                        }
                        return s;
                    };

                    const version = readString(dataOffset + 8, 16);
                    const commit = readString(dataOffset + 8 + 16, 8);
                    const date = readString(dataOffset + 8 + 16 + 8, 16);

                    return { serial, version, commit, date };
                }
            }
            return null;
        } catch (e) {
            console.warn("[DeltaFW] fetchIdentification failed", e);
            return null;
        }
    }

    async getExtendedInfo(protocol: any): Promise<Record<string, string> | null> {
        try {
            const timestamp = protocol.getSessionTimestamp();
            const info = await this.fetchIdentification(protocol, timestamp);

            if (!info) {
                // Fallback to old method if command fails? 
                // Or just fail since this is a specific profile?
                console.warn("[DeltaFW] Identification failed");
                return null;
            }

            console.log("[DeltaFW] Identified:", info);

            const mac = this.calculateMac(info.serial);
            const crockford = this.calculateCrockford(info.serial);

            return {
                serial: crockford,
                mac: mac,
                version: info.version,
                commit: info.commit,
                buildDate: info.date
            };
        } catch (e) {
            console.error("Failed to fetch extended info", e);
            return null;
        }
    }

    async getTelemetry(session: any): Promise<TelemetryData | null> {
        if (this.isMirroring) return null;

        let tele: TelemetryData = {};
        let success = false;

        // Battery
        try {
            const batPromise = session.waitForPacket(MSG_BATT_RESP);
            await session.sendCommand(MSG_BATT_REQ, new Uint8Array([]));
            const batResp = await batPromise;

            if (batResp && batResp.length >= 4) {
                const dv = new DataView(batResp.buffer, batResp.byteOffset, batResp.byteLength);
                const voltage = dv.getUint16(0, true) / 100;
                const current = dv.getUint16(2, true) / 100;
                // Simple logic for percent
                const pct = Math.max(0, Math.min(100, ((voltage - 6.8) / 1.6) * 100));

                tele = {
                    ...tele,
                    batteryVoltage: voltage,
                    batteryCurrent: current,
                    batteryPercentage: Math.round(pct),
                    isCharging: voltage > 8.45
                };
                success = true;
            }
        } catch (e) { }

        // RSSI
        try {
            const rssiPromise = session.waitForPacket(MSG_RSSI_RESP);
            await session.sendCommand(MSG_RSSI_REQ, new Uint8Array([]));
            const rssiResp = await rssiPromise;

            if (rssiResp && rssiResp.length >= 4) {
                const dv = new DataView(rssiResp.buffer, rssiResp.byteOffset, rssiResp.byteLength);
                const rawRssi = dv.getUint16(0, true) & 0x01FF;
                const noise = dv.getUint8(2) & 0x7F;
                // const glitch = dv.getUint8(3);
                const dbm = Math.round((rawRssi / 2) - 160);

                tele = {
                    ...tele,
                    rssi: dbm,
                    snr: noise
                };
                success = true;
            }
        } catch (e) { }

        return success ? tele : null;
    }

    private calculateMac(serial: bigint): string {
        const bytes = new Uint8Array(6);
        bytes[0] = Number((serial >> 40n) & 0xffn) | 0x02; // Locally Administered
        bytes[0] &= ~0x01; // Unicast
        bytes[1] = Number((serial >> 32n) & 0xffn);
        bytes[2] = Number((serial >> 24n) & 0xffn);
        bytes[3] = Number((serial >> 16n) & 0xffn);
        bytes[4] = Number((serial >> 8n) & 0xffn);
        bytes[5] = Number(serial & 0xffn);

        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    }

    private calculateCrockford(serial: bigint): string {
        const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        const CHECKSUM = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";
        let val = serial;
        let res = "";
        for (let i = 0; i < 13; i++) {
            res = ALPHABET[Number(val & 0x1Fn)] + res;
            val >>= 5n;
        }

        const mod37 = Number(serial % 37n);
        const check = CHECKSUM[mod37];

        // Format: XXXXXXXXXXXXX
        return res.substring(0, 4) + res.substring(4, 8) + res.substring(8, 12) + res[12] + check;
    }

    decodeChannel(buffer: Uint8Array, index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): Channel {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const rxFreqRaw = view.getUint32(0, true);
        const offsetRaw = view.getUint32(4, true);

        if (rxFreqRaw === 0xFFFFFFFF || rxFreqRaw === 0) {
            return {
                index,
                name: "",
                rxFreq: 0,
                offset: 0,
                mode: "FM",
                power: "5W",
                scanList: "None",
                empty: true
            };
        }

        const rxFreq = rxFreqRaw * 10;
        const offset = offsetRaw * 10;

        const rxCodeIdx = buffer[8];
        const txCodeIdx = buffer[9];
        const flagsCode = buffer[10];
        const rxCodeFlag = flagsCode & 0x0F;
        const txCodeFlag = (flagsCode >> 4) & 0x0F;

        const rxTone = this._decodeTone(rxCodeFlag, rxCodeIdx);
        const txTone = this._decodeTone(txCodeFlag, txCodeIdx);

        const modeFlags = buffer[11];
        const modIdx = modeFlags & 0x0F;
        const offDir = (modeFlags >> 4) & 0x0F;

        const flags12 = buffer[12];
        const bwNarrow = (flags12 >> 1) & 0x01;
        const pwrIdx = (flags12 >> 2) & 0x07;

        let mode = "FM";
        if (modIdx === 0) mode = bwNarrow ? "NFM" : "FM";
        else if (modIdx === 1) mode = bwNarrow ? "NAM" : "AM";
        else if (modIdx === 2) mode = "USB";

        const POWER_LIST = ["USER", "LOW 1", "LOW 2", "LOW 3", "LOW 4", "LOW 5", "MID", "HIGH"];
        const power = POWER_LIST[pwrIdx] || "USER";

        const freqRev = (flags12 & 0x01) === 1;
        const busyLock = ((flags12 >> 5) & 0x01) === 1;
        const txLock = ((flags12 >> 6) & 0x01) === 1;

        const stepIdx = buffer[14];
        const step = [2.5, 5, 6.25, 10, 12.5, 25, 50, 100, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50][stepIdx] || 2.5;

        const scramblerIdx = buffer[15];
        const SCRAMBLER_LIST = ["OFF", "2600Hz", "2700Hz", "2800Hz", "2900Hz", "3000Hz", "3100Hz", "3200Hz", "3300Hz", "3400Hz", "3500Hz"];
        const scrambler = SCRAMBLER_LIST[scramblerIdx] || "OFF";

        let name = "";
        if (aux?.name) {
            for (let i = 0; i < 16 && i < aux.name.length; i++) {
                const c = aux.name[i];
                if (c === 0 || c === 0xFF) break;
                if (c >= 32 && c <= 126) name += String.fromCharCode(c);
            }
        }
        name = name.trim();

        const attrByte = aux?.attr ? aux.attr[0] : 0;
        const scanList1 = ((attrByte >> 4) & 0x01) === 1;
        const scanList2 = ((attrByte >> 5) & 0x01) === 1;
        const scanList3 = ((attrByte >> 6) & 0x01) === 1;
        const compander = ((attrByte >> 3) & 0x01) === 1 ? "ON" : "OFF";

        return {
            index, name, rxFreq, offset, mode, power,
            compander, step, scrambler,
            rxTone, txTone,
            busyLock, txLock, freqRev,
            scanList1, scanList2, scanList3,
            duplex: offDir === 1 ? "+" : (offDir === 2 ? "-" : ""),
            bandwidth: bwNarrow ? "Narrow" : "Wide",
            empty: false,
            scanList: "None"
        };
    }

    encodeChannel(c: Channel, buffer: Uint8Array, _index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): void {
        if (c.empty) {
            buffer.fill(0xFF);
            if (aux?.name) aux.name.fill(0xFF);
            if (aux?.attr) aux.attr[0] = 0xFF;
            return;
        }

        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        view.setUint32(0, Math.round(c.rxFreq / 10), true);
        view.setUint32(4, Math.round(c.offset / 10), true);

        const rxT = this._encodeTone(c.rxTone || "None");
        const txT = this._encodeTone(c.txTone || "None");
        buffer[8] = rxT.idx;
        buffer[9] = txT.idx;
        buffer[10] = (rxT.flag & 0x0F) | ((txT.flag & 0x0F) << 4);

        let modIdx = 0;
        let bwNarrow = 0;
        if (c.mode === "NFM") { modIdx = 0; bwNarrow = 1; }
        else if (c.mode === "AM") { modIdx = 1; bwNarrow = 0; }
        else if (c.mode === "NAM") { modIdx = 1; bwNarrow = 1; }
        else if (c.mode === "USB") { modIdx = 2; }
        if (c.bandwidth === "Narrow") bwNarrow = 1;

        let offDir = 0;
        if (c.duplex === "+") offDir = 1;
        else if (c.duplex === "-") offDir = 2;
        buffer[11] = (modIdx & 0x0F) | ((offDir & 0x0F) << 4);

        const POWER_LIST = ["USER", "LOW 1", "LOW 2", "LOW 3", "LOW 4", "LOW 5", "MID", "HIGH"];
        const pwrIdx = POWER_LIST.indexOf(c.power || "USER");
        const pwrVal = pwrIdx >= 0 ? pwrIdx : 0;
        let flags12 = (c.freqRev ? 1 : 0) << 0
            | (bwNarrow ? 1 : 0) << 1
            | (pwrVal & 0x07) << 2
            | (c.busyLock ? 1 : 0) << 5
            | (c.txLock ? 1 : 0) << 6;
        buffer[12] = flags12;

        const steps = [2.5, 5, 6.25, 10, 12.5, 25, 50, 100, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50];
        let stepIdx = steps.indexOf(parseFloat(String(c.step)));
        buffer[14] = stepIdx >= 0 ? stepIdx : 0;
        const SCRAMBLER_LIST = ["OFF", "2600Hz", "2700Hz", "2800Hz", "2900Hz", "3000Hz", "3100Hz", "3200Hz", "3300Hz", "3400Hz", "3500Hz"];
        let scramIdx = SCRAMBLER_LIST.indexOf(c.scrambler || "OFF");
        buffer[15] = scramIdx >= 0 ? scramIdx : 0;

        if (aux?.attr) {
            let attr = 0x07; // Default band?

            attr |= (c.scanList1 ? 1 : 0) << 4;
            attr |= (c.scanList2 ? 1 : 0) << 5;
            attr |= (c.scanList3 ? 1 : 0) << 6;
            attr |= (c.compander === "ON" ? 1 : 0) << 3;

            // Band calculation
            const freqM = c.rxFreq / 1000000;
            let band = 2;
            if (freqM >= 50 && freqM < 76) band = 0;
            else if (freqM >= 108 && freqM < 136) band = 1;
            else if (freqM >= 136 && freqM < 174) band = 2;
            else if (freqM >= 174 && freqM < 350) band = 3;
            else if (freqM >= 350 && freqM < 400) band = 4;
            else if (freqM >= 400 && freqM < 470) band = 5;
            else if (freqM >= 470) band = 6;
            attr |= (band & 0x07) << 5;
            aux.attr[0] = attr;
        }

        if (aux?.name) {
            aux.name.fill(0);
            const name = c.name || "";
            for (let i = 0; i < 16 && i < name.length; i++) {
                aux.name[i] = name.charCodeAt(i);
            }
        }
    }

    private _decodeTone(flag: number, idx: number): string {
        if (flag === 0) return "None";
        if (flag === 1 && idx < TONES.length) return TONES[idx] + " (C)";
        if (flag === 2 && idx < DTCS_CODES.length) return "D" + DTCS_CODES[idx] + "N";
        if (flag === 3 && idx < DTCS_CODES.length) return "D" + DTCS_CODES[idx] + "I";
        return "None";
    }
    async readChannels(protocol: any, onProgress: (p: number) => void, onLiveUpdate?: (batch: Channel[]) => void): Promise<Channel[]> {
        const info = await protocol.identify();
        const timestamp = info.timestamp || 0;

        const mr = this.memoryRanges;
        const range = mr.channels;
        const stride = this.channelStride;
        const count = this.channelCount;
        const BATCH_SIZE = 10;

        const allChannels: Channel[] = [];
        let processed = 0;

        for (let i = 0; i < count; i += BATCH_SIZE) {
            const batchCount = Math.min(BATCH_SIZE, count - i);

            // 1. Read Channel Data
            const chStart = range.start + (i * stride);
            const chSize = batchCount * stride;
            const chBytes = await protocol.readEEPROM(chStart, chSize, timestamp);

            // 2. Read Attributes (if exists)
            let attrBytes: Uint8Array | null = null;
            if (mr.attributes) {
                const atStart = mr.attributes.start + i;
                attrBytes = await protocol.readEEPROM(atStart, batchCount, timestamp);
            }

            // 3. Read Names (if exists)
            let nameBytes: Uint8Array | null = null;
            if (mr.names) {
                const nmStart = mr.names.start + (i * 16);
                nameBytes = await protocol.readEEPROM(nmStart, batchCount * 16, timestamp);
            }

            // 4. Decode Batch
            const batchItems: Channel[] = [];
            for (let k = 0; k < batchCount; k++) {
                const totalIdx = i + k;
                const cBuf = chBytes.slice(k * stride, (k + 1) * stride);
                const auxData = {
                    attr: attrBytes ? attrBytes.slice(k, k + 1) : undefined,
                    name: nameBytes ? nameBytes.slice(k * 16, (k + 1) * 16) : undefined
                };
                const ch = this.decodeChannel(cBuf, totalIdx + 1, auxData);
                batchItems.push(ch);

                processed++;
                onProgress(Math.round((processed / count) * 100));
            }

            allChannels.push(...batchItems);
            if (onLiveUpdate) onLiveUpdate(batchItems);
        }

        return allChannels;
    }

    async writeChannels(protocol: any, channels: Channel[], onProgress: (p: number) => void): Promise<boolean> {
        const info = await protocol.identify();
        const timestamp = info.timestamp || 0;

        const mr = this.memoryRanges;
        const stride = this.channelStride;
        const count = channels.length;
        const BATCH_SIZE = 10;
        let processed = 0;

        for (let i = 0; i < count; i += BATCH_SIZE) {
            const batchCount = Math.min(BATCH_SIZE, count - i);

            // Prepare Buffers
            const chBytes = new Uint8Array(batchCount * stride);
            chBytes.fill(0xFF);
            const attrBytes = mr.attributes ? new Uint8Array(batchCount) : null;
            if (attrBytes) attrBytes.fill(0xFF);
            const nameBytes = mr.names ? new Uint8Array(batchCount * 16) : null;
            if (nameBytes) nameBytes.fill(0xFF);

            // Encode
            for (let k = 0; k < batchCount; k++) {
                const idx = i + k;
                if (idx >= channels.length) break;
                const ch = channels[idx];
                const cBuf = chBytes.subarray(k * stride, (k + 1) * stride);
                const aux = {
                    attr: attrBytes ? attrBytes.subarray(k, k + 1) : new Uint8Array(1),
                    name: nameBytes ? nameBytes.subarray(k * 16, (k + 1) * 16) : new Uint8Array(16)
                };
                this.encodeChannel(ch, cBuf, idx + 1, aux);
            }

            // Write Ch
            const chStart = mr.channels.start + (i * stride);
            await protocol.writeEEPROM(chStart, chBytes, timestamp);

            // Write Attr
            if (attrBytes && mr.attributes) {
                const atStart = mr.attributes.start + i;
                await protocol.writeEEPROM(atStart, attrBytes, timestamp);
            }

            // Write Name
            if (nameBytes && mr.names) {
                const nmStart = mr.names.start + (i * 16);
                await protocol.writeEEPROM(nmStart, nameBytes, timestamp);
            }

            processed += batchCount;
            onProgress(Math.round((processed / count) * 100));
        }
        return true;
    }

    private _encodeTone(toneStr: string): { flag: number, idx: number } {
        if (!toneStr || toneStr === "None") return { flag: 0, idx: 0 };
        if (toneStr.endsWith("(C)") || /^\d+\.?\d*$/.test(toneStr)) {
            const f = parseFloat(toneStr);
            const idx = TONES.indexOf(f);
            return { flag: 1, idx: idx >= 0 ? idx : 0 };
        }
        if (toneStr.startsWith("D")) {
            const isInv = toneStr.endsWith("I");
            const numStr = toneStr.substring(1, toneStr.length - 1);
            const code = parseInt(numStr);
            const idx = DTCS_CODES.indexOf(code);
            return { flag: isInv ? 3 : 2, idx: idx >= 0 ? idx : 0 };
        }
        return { flag: 0, idx: 0 };
    }

    async startDisplayMirror(protocol: any) {
        this.isMirroring = true;
        const handler = new SerialHandler();

        // Hook disconnect to restore telemetry polling
        const originalDisconnect = handler.disconnect.bind(handler);
        handler.disconnect = async (closePort?: boolean) => {
            this.isMirroring = false;
            return originalDisconnect(closePort);
        };

        await handler.connect(protocol);
        return handler;
    }
}

// --- SerialHandler implementation (Reverted shared module) ---
const HEADER_0 = 0xAA;
const HEADER_1 = 0x55;
const TYPE_SCREENSHOT = 0x01;
const TYPE_DIFF = 0x02;
const FRAME_SIZE = 1024;
const VERSION_MARKER = 0xFF;
const BUFFER_SIZE = 32768;

interface DisplayMirrorHandler {
    onFrameUpdate?: (framebuffer: Uint8Array) => void;
    onStatusChange?: (connected: boolean, error?: string) => void;
    onStatsUpdate?: (stats: { fps: number, bps: number, totalFrames: number }) => void;
    getFramebuffer(): Uint8Array;
    connect(protocol: any): Promise<void>;
    disconnect(closePort?: boolean): Promise<void>;
}

class SerialHandler implements DisplayMirrorHandler {
    private protocol: any = null;
    private keepaliveInterval: number | null = null;
    private isConnected = false;
    private readonly framebuffer = new Uint8Array(FRAME_SIZE);
    private buffer = new Uint8Array(BUFFER_SIZE);
    private bufferPos = 0;

    public onFrameUpdate?: (framebuffer: Uint8Array) => void;
    public onStatusChange?: (connected: boolean, error?: string) => void;
    public onStatsUpdate?: (stats: { fps: number, bps: number, totalFrames: number }) => void;

    private frameCount = 0;
    private totalFrameCount = 0;
    private byteCount = 0;
    private lastStatsTime = 0;

    constructor() {
        this.framebuffer.fill(0);
        this.lastStatsTime = performance.now();
    }

    public getFramebuffer(): Uint8Array { return this.framebuffer; }

    public async connect(protocol: any) {
        this.protocol = protocol;
        this.isConnected = true;
        this.bufferPos = 0;
        this.byteCount = 0;
        this.totalFrameCount = 0;
        if (this.protocol && typeof this.protocol.setDataListener === 'function') {
            this.protocol.setDataListener(this.handleData.bind(this));
        }
        if (this.onStatusChange) this.onStatusChange(true);
        this.startKeepalive();
    }

    public async disconnect(_closePort = false) {
        this.isConnected = false;
        if (this.keepaliveInterval) window.clearInterval(this.keepaliveInterval);
        if (this.protocol && typeof this.protocol.setDataListener === 'function') {
            this.protocol.setDataListener(null);
        }
        this.protocol = null;
        if (this.onStatusChange) this.onStatusChange(false);
    }

    private startKeepalive() {
        this.keepaliveInterval = window.setInterval(() => this.sendKeepalive(), 1000);
        this.sendKeepalive();
    }

    private async sendKeepalive() {
        if (!this.protocol || !this.isConnected) return;
        try {
            const keepalive = new Uint8Array([0x55, 0xAA, 0x00, 0x00]);
            if (typeof this.protocol.sendRaw === 'function') {
                await this.protocol.sendRaw(keepalive);
            }
        } catch (e: any) { this.disconnect(); }
    }

    private handleData(value: Uint8Array) {
        if (!this.isConnected) return;
        this.byteCount += value.length;
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
                const totalSize = markerSize + 5 + size + 1; // +1 for checksum
                if (processed + totalSize <= this.bufferPos) {
                    const payloadStart = headerStart + 5;
                    const payload = this.buffer.slice(payloadStart, payloadStart + size);
                    if (type === TYPE_SCREENSHOT && size === FRAME_SIZE) {
                        this.framebuffer.set(payload);
                        if (this.onFrameUpdate) this.onFrameUpdate(this.framebuffer);
                        this.updateFPS();
                    } else if (type === TYPE_DIFF && size % 9 === 0) {
                        this.applyDiff(payload);
                        if (this.onFrameUpdate) this.onFrameUpdate(this.framebuffer);
                        this.updateFPS();
                    }
                    processed += totalSize;
                } else break;
            } else processed++;
        }
        if (processed > 0) {
            this.buffer.copyWithin(0, processed);
            this.bufferPos -= processed;
        }
    }

    private applyDiff(diffPayload: Uint8Array) {
        for (let i = 0; i + 9 <= diffPayload.length; i += 9) {
            const chunkIndex = diffPayload[i];
            if (chunkIndex >= 128) break; // Stop if chunkIndex indicates end or invalid
            const startPos = chunkIndex * 8;
            for (let j = 0; j < 8; j++) {
                if (startPos + j < this.framebuffer.length) {
                    this.framebuffer[startPos + j] = diffPayload[i + 1 + j];
                }
            }
        }
    }

    private updateFPS() {
        this.frameCount++;
        this.totalFrameCount++;
        const now = performance.now();
        const elapsed = now - this.lastStatsTime;
        if (elapsed >= 1000) {
            if (this.onStatsUpdate) {
                this.onStatsUpdate({
                    fps: Math.ceil(this.frameCount / (elapsed / 1000)),
                    bps: Math.ceil(this.byteCount / (elapsed / 1000)),
                    totalFrames: this.totalFrameCount
                });
            }
            this.frameCount = 0;
            this.byteCount = 0;
            this.lastStatsTime = now;
        }
    }
}
