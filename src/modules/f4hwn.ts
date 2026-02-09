import { BaseRadioModule, Channel, DisplayMirrorHandler, FeatureFlags, TelemetryData, SettingsSchema, MemoryConfig } from '../lib/framework/module-interface';

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

// --- Shared Constants ---
const MSG_RSSI_REQ = 0x0527;
const MSG_RSSI_RESP = 0x0528;
const MSG_BATT_REQ = 0x0529;
const MSG_BATT_RESP = 0x052A;

export class F4HWNProfile extends BaseRadioModule {
    get id(): string { return "f4hwn"; }
    get name(): string { return "F4HWN / Egzumer"; }
    get description(): string { return "Support for F4HWN and Egzumer custom firmware with advanced screencast"; }

    matchFirmware(version: string): boolean {
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

    get memoryMapping(): MemoryConfig {
        return {
            channels: { start: 0x0000, size: 200 * 16, stride: 16 },
            settings: { start: 0x0E70, size: 0xB0 },
            extra: {
                attributes: { start: 0x0D60, size: 0x0E40 - 0x0D60 },
                names: { start: 0x0F50, size: 200 * 16 },
                settings_main: { start: 0x0E70, size: 0xB0 },
                f40: { start: 0x0F40, size: 16 },
                settings_ext: { start: 0x1FF0, size: 16 }
            }
        };
    }

    get strings() {
        return {
            "calibration.warning": "F4HWN calibration is blocked by default in this profile.",
        };
    }

    get components() {
        return {};
    }

    get lists() {
        return {
            POWER: ["USER", "LOW 1", "LOW 2", "LOW 3", "LOW 4", "LOW 5", "MID", "HIGH"],
            MODE: ["FM", "AM", "USB"],
            SCRAMBLER: ["OFF", "2600Hz", "2700Hz", "2800Hz", "2900Hz", "3000Hz", "3100Hz", "3200Hz", "3300Hz", "3400Hz", "3500Hz"],
            PTTID: ["OFF", "UP CODE", "DOWN CODE", "UP+DOWN CODE", "APOLLO QUINDAR"],
            TONES: ["None", ...TONES.map(t => t.toFixed(1))],
            DCS: ["None", ...DTCS_CODES.map(c => `D${c.toString().padStart(3, '0')}N`), ...DTCS_CODES.map(c => `D${c.toString().padStart(3, '0')}I`)],
            SCAN_RESUME: ["STOP", "CARRIER", "TIMEOUT"],
            COMPANDER: ["OFF", "TX", "RX", "TX/RX"],
            STEPS: [2.5, 5, 6.25, 10, 12.5, 25, 8.33, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 1.25, 9, 15, 20, 30, 50, 100, 125, 200, 250, 500],
            MIC_GAIN: ["+1.1dB", "+4.0dB", "+8.0dB", "+12.0dB", "+15.1dB"],
            SET_PTT: ["CLASSIC", "ONEPUSH"],
            SET_TOT_EOT: ["OFF", "SOUND", "VISUAL", "ALL"],
            SET_LCK: ["KEYS", "KEYS+PTT"],
            SET_MET: ["TINY", "CLASSIC"],
            SET_NFM: ["NARROW", "NARROWER"],
            CHANNELDISP: ["FREQ", "NUMBER", "NAME", "NAME + FREQ"],
            BATSAVE: ["OFF", "1:1", "1:2", "1:3", "1:4", "1:5"],
            BATTYPE: ["1600 mAh K5", "2200 mAh K5", "3500 mAh K5", "1400 mAh K1", "2500 mAh K1"],
            BAT_TXT: ["NONE", "VOLTAGE", "PERCENT"],
            BL_LVL: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            BL_TX_RX: ["OFF", "TX", "RX", "TX/RX"],
            SCANLIST: ["None", "I", "II", "I+II", "III", "I+III", "II+III", "ALL"],
            BL_TIME: ["OFF", "5s", "10s", "15s", "20s", "25s", "30s", "35s", "40s", "45s", "50s", "55s", "1m", "1m5s", "1m10s", "1m15s", "1m20s", "1m25s", "1m30s", "1m35s", "1m40s", "1m45s", "1m50s", "1m55s", "2m", "2m5s", "2m10s", "2m15s", "2m20s", "2m25s", "2m30s", "2m35s", "2m40s", "2m45s", "2m50s", "2m55s", "5m", "Always On"],
            KEYACTIONS: [
                "NONE", "FLASHLIGHT", "POWER", "MONITOR", "SCAN", "VOX", "ALARM",
                "FM RADIO", "1750Hz TONE", "LOCK KEYPAD", "VFO A/B", "VFO/MEM",
                "MODE", "BL_OFF", "RX MODE", "MAIN ONLY", "PTT", "W/N",
                "BACKLIGHT", "MUTE", "POWER HIGH", "REMOVE OFFSET"
            ],
            VOX: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        };
    }

    get settingsConfig(): SettingsSchema[] {
        return [
            { key: 'squelch', label: 'Squelch', type: 'range', min: 0, max: 9, group: 'Radio', default: 3 },
            { key: 'bat_save', label: 'Battery Save', type: 'select', options: this.lists.BATSAVE, group: 'Power', default: 4 },
            { key: 'backlight', label: 'Backlight Time', type: 'select', options: this.lists.BL_TIME, group: 'Display', default: 5 },
            { key: 'ch_disp', label: 'Channel Display', type: 'select', options: this.lists.CHANNELDISP, group: 'Display', default: 2 },
            { key: 'vox', label: 'VOX Enabled', type: 'switch', group: 'Audio', default: 0 },
            { key: 'vox_level', label: 'VOX Level', type: 'select', options: this.lists.VOX, group: 'Audio', default: 1 },
            { key: 'mic_gain', label: 'Mic Gain', type: 'select', options: this.lists.MIC_GAIN, group: 'Audio', default: 2 },
            { key: 'beep', label: 'Beep', type: 'switch', group: 'Audio', default: 1 },
            { key: 'bat_type', label: 'Battery Type', type: 'select', options: this.lists.BATTYPE, group: 'Power', default: 0 },
            { key: 'am_fix', label: 'AM Fix', type: 'switch', group: 'Radio', default: 1 },
            { key: 'bat_txt', label: 'Battery Text', type: 'select', options: this.lists.BAT_TXT, group: 'Display', default: 2 },
            { key: 'contrast', label: 'Contrast', type: 'range', min: 0, max: 15, group: 'Display', default: 13 },
            { key: 'invert', label: 'Invert Screen', type: 'switch', group: 'Display', default: 0 }
        ];
    }

    decodeChannel(buffer: Uint8Array, index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): Channel {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const rxFreqRaw = view.getUint32(0, true);
        const offsetRaw = view.getUint32(4, true);

        if (rxFreqRaw === 0xFFFFFFFF || rxFreqRaw === 0) {
            return { index, name: "", rxFreq: 0, offset: 0, mode: "FM", power: "USER", empty: true, scanList: "None" };
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

        const power = this.lists.POWER[pwrIdx] || "USER";

        const stepIdx = buffer[14];
        const step = this.lists.STEPS[stepIdx] || 2.5;

        const scramblerIdx = buffer[15];
        const scrambler = this.lists.SCRAMBLER[scramblerIdx] || "OFF";

        const freqRev = (flags12 & 0x01) === 1;
        const busyLock = ((flags12 >> 5) & 0x01) === 1;
        const txLock = ((flags12 >> 6) & 0x01) === 1;

        let name = "";
        if (aux?.name) {
            for (let i = 0; i < 16; i++) {
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
            scanList: "None" // Keep for generic compatibility
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

        const pwrIdx = this.lists.POWER.indexOf(c.power || "USER");
        const pwrVal = pwrIdx >= 0 ? pwrIdx : 0;
        let flags12 = (c.freqRev ? 1 : 0) << 0
            | (bwNarrow ? 1 : 0) << 1
            | (pwrVal & 0x07) << 2
            | (c.busyLock ? 1 : 0) << 5
            | (c.txLock ? 1 : 0) << 6;
        buffer[12] = flags12;

        // Byte 13: PTT ID (Bits 4-6)
        const pttIdx = this.lists.PTTID.indexOf(c.pttid || "OFF");
        if (pttIdx >= 0) buffer[13] = (pttIdx & 0x07) << 4;

        // Byte 14: Step
        let stepIdx = this.lists.STEPS.indexOf(parseFloat(String(c.step)));
        if (stepIdx < 0) stepIdx = 1; // Default 5.0
        buffer[14] = stepIdx;

        // Byte 15: Scrambler
        let scramIdx = this.lists.SCRAMBLER.indexOf(c.scrambler || "OFF");
        if (scramIdx < 0) scramIdx = 0;
        buffer[15] = scramIdx;

        if (aux?.attr) {
            let attr = 0x07; // Default band? No, let's keep it 0 first or calc band

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

    async readChannels(protocol: any, onProgress: (p: number) => void, onLiveUpdate?: (batch: Channel[]) => void): Promise<Channel[]> {
        const info = await protocol.identify();
        const timestamp = info.timestamp || 0;

        const mm = this.memoryMapping;
        const range = mm.channels;
        const stride = this.channelStride;
        const count = this.channelCount;
        const BATCH_SIZE = 10;
        const EXTRA = mm.extra || {};

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
            if (EXTRA.attributes) {
                const atStart = EXTRA.attributes.start + i;
                attrBytes = await protocol.readEEPROM(atStart, batchCount, timestamp);
            }

            // 3. Read Names (if exists)
            let nameBytes: Uint8Array | null = null;
            if (EXTRA.names) {
                const nmStart = EXTRA.names.start + (i * 16);
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

        const mm = this.memoryMapping;
        const stride = this.channelStride;
        const count = channels.length;
        const BATCH_SIZE = 10;
        const EXTRA = mm.extra || {};
        let processed = 0;

        for (let i = 0; i < count; i += BATCH_SIZE) {
            const batchCount = Math.min(BATCH_SIZE, count - i);

            // Prepare Buffers
            const chBytes = new Uint8Array(batchCount * stride);
            chBytes.fill(0xFF);
            const attrBytes = EXTRA.attributes ? new Uint8Array(batchCount) : null;
            if (attrBytes) attrBytes.fill(0xFF);
            const nameBytes = EXTRA.names ? new Uint8Array(batchCount * 16) : null;
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
            const chStart = mm.channels.start + (i * stride);
            await protocol.writeEEPROM(chStart, chBytes, timestamp);

            // Write Attr
            if (attrBytes && EXTRA.attributes) {
                const atStart = EXTRA.attributes.start + i;
                await protocol.writeEEPROM(atStart, attrBytes, timestamp);
            }

            // Write Name
            if (nameBytes && EXTRA.names) {
                const nmStart = EXTRA.names.start + (i * 16);
                await protocol.writeEEPROM(nmStart, nameBytes, timestamp);
            }

            processed += batchCount;
            onProgress(Math.round((processed / count) * 100));
        }
        return true;
    }

    async getTelemetry(protocol: any): Promise<TelemetryData | null> {
        const data: TelemetryData = {};

        // 1. Battery
        try {
            const batPromise = protocol.waitForPacket(MSG_BATT_RESP, 250);
            await protocol.sendCommand(MSG_BATT_REQ, new Uint8Array([]));
            const batData = await batPromise;

            if (batData && batData.length >= 4) {
                const dv = new DataView(batData.buffer, batData.byteOffset, batData.byteLength);
                const voltage = dv.getUint16(0, true) / 100;
                const current = dv.getUint16(2, true) / 100;
                const pct = Math.max(0, Math.min(100, ((voltage - 6.8) / 1.6) * 100));
                data.batteryVoltage = voltage;
                data.batteryCurrent = current;
                data.batteryPercentage = Math.round(pct);
            }
        } catch (e) { }

        // 2. RSSI
        try {
            const rssiPromise = protocol.waitForPacket(MSG_RSSI_RESP, 250);
            await protocol.sendCommand(MSG_RSSI_REQ, new Uint8Array([]));
            const rssiData = await rssiPromise;

            if (rssiData && rssiData.length >= 4) {
                const dv = new DataView(rssiData.buffer, rssiData.byteOffset, rssiData.byteLength);
                const rawRssi = dv.getUint16(0, true) & 0x01FF;
                const noise = dv.getUint8(2) & 0x7F;
                const dbm = Math.round((rawRssi / 2) - 160);
                data.rssi = rawRssi;
                data.rssi_dBm = dbm;
                data.snr = noise;
                data.glitchIndicator = rssiData[3];
            }
        } catch (e) { }

        return Object.keys(data).length > 0 ? data : null;
    }

    decodeSettings(buffers: { [key: string]: Uint8Array }): any {
        const s: any = {};

        // Block 1: E70
        // SettingsView passes 'settings', but we mapped 'settings_main' in extra.
        // We should use 'settings' if available (from generic import) or 'settings_main' (from specific read).
        const main = buffers.settings_main || buffers.settings || new Uint8Array(0xB0);
        const e70 = main.subarray(0x00, 0x10);

        s.squelch = e70[1];
        s.vox = !!e70[5];
        s.vox_level = e70[6];
        s.mic_gain = e70[7];
        s.bl_min = e70[8] & 0x0F;
        s.bl_max = (e70[8] >> 4) & 0x0F;
        s.ch_disp = e70[9];
        s.crossband = e70[10];
        s.bat_save = e70[11];
        s.dual_watch = e70[12];
        s.backlight = e70[13];
        s.noaa_autoscan = e70[14];

        // Block 2: E90 (Keys)
        const e90 = main.subarray(0x20, 0x30);
        s.key_m = e90[0] & 0x7F;
        s.beep = (e90[0] >> 7) & 0x01;
        s.key_1s = e90[1];
        s.key_1l = e90[2];
        s.key_2s = e90[3];
        s.key_2l = e90[4];
        s.scan_resume = e90[5];

        // Block 3: EA0
        const ea0 = main.subarray(0x30, 0x38);
        s.voice = ea0[0];

        // Block 4: EA8
        const ea8 = main.subarray(0x38, 0x40);
        s.alarm_mode = ea8[0];
        s.roger = ea8[1];
        s.ste = ea8[2];
        s.tx_vfo = ea8[3];
        s.bat_type = ea8[4];

        // Block 5: F40
        const f40 = buffers.f40 || new Uint8Array(16);
        s.flock = f40[0];
        const f40_7 = f40[7];
        s.bl_mode = (f40_7 >> 6) & 0x03;
        s.mic_bar = (f40_7 >> 4) & 0x01;
        s.bat_txt = (f40_7 >> 2) & 0x03;
        s.am_fix = (f40_7 >> 5) & 0x01;

        // Block 6: FF2 (1FF0 via protocol if mapped differently, but we follow memoryRanges)
        const ext = buffers.settings_ext || new Uint8Array(16);
        const ff2 = ext.subarray(2, 10);
        const ff2_3 = ff2[3];
        s.contrast = ff2_3 & 0x0F;
        s.invert = (ff2_3 >> 4) & 0x01;
        s.lock = (ff2_3 >> 5) & 0x01;
        s.gui = (ff2_3 >> 7) & 0x01;
        s.meter = (ff2_3 >> 6) & 0x01;

        const ff2_4 = ff2[4];
        s.tot = (ff2_4 >> 4) & 0x0F;
        s.eot = ff2_4 & 0x0F;

        const ff2_5 = ff2[5];
        s.ptt_mode = ff2_5 & 0x0F;
        s.pwr_mode = (ff2_5 >> 4) & 0x0F;

        return s;
    }

    encodeSettings(s: any, buffers: { [key: string]: Uint8Array }): void {
        const main = buffers.settings_main || buffers.settings || new Uint8Array(0xB0);
        const e70 = main.subarray(0x00, 0x10);

        if (s.squelch !== undefined) e70[1] = s.squelch;
        if (s.vox !== undefined) e70[5] = s.vox ? 1 : 0;
        if (s.vox_level !== undefined) e70[6] = s.vox_level;
        if (s.mic_gain !== undefined) e70[7] = s.mic_gain;
        if (s.bl_min !== undefined && s.bl_max !== undefined) {
            e70[8] = (s.bl_min & 0x0F) | ((s.bl_max & 0x0F) << 4);
        }
        if (s.ch_disp !== undefined) e70[9] = s.ch_disp;
        if (s.crossband !== undefined) e70[10] = s.crossband;
        if (s.bat_save !== undefined) e70[11] = s.bat_save;
        if (s.dual_watch !== undefined) e70[12] = s.dual_watch ? 1 : 0;
        if (s.backlight !== undefined) e70[13] = s.backlight;
        if (s.noaa_autoscan !== undefined) e70[14] = s.noaa_autoscan;

        const e90 = main.subarray(0x20, 0x30);
        if (s.key_m !== undefined || s.beep !== undefined) {
            e90[0] = (s.key_m & 0x7F) | ((s.beep & 1) << 7);
        }
        if (s.key_1s !== undefined) e90[1] = s.key_1s;
        if (s.key_1l !== undefined) e90[2] = s.key_1l;
        if (s.key_2s !== undefined) e90[3] = s.key_2s;
        if (s.key_2l !== undefined) e90[4] = s.key_2l;
        if (s.scan_resume !== undefined) e90[5] = s.scan_resume;

        const ea0 = main.subarray(0x30, 0x38);
        if (s.voice !== undefined) ea0[0] = s.voice;

        const ea8 = main.subarray(0x38, 0x40);
        if (s.alarm_mode !== undefined) ea8[0] = s.alarm_mode;
        if (s.roger !== undefined) ea8[1] = s.roger;
        if (s.ste !== undefined) ea8[2] = s.ste;
        if (s.tx_vfo !== undefined) ea8[3] = s.tx_vfo;
        if (s.bat_type !== undefined) ea8[4] = s.bat_type;

        const f40 = buffers.f40 || new Uint8Array(16);
        if (s.flock !== undefined) f40[0] = s.flock;
        if (s.bl_mode !== undefined || s.mic_bar !== undefined || s.bat_txt !== undefined || s.am_fix !== undefined) {
            let val = f40[7];
            let bl = (s.bl_mode !== undefined) ? s.bl_mode : ((val >> 6) & 0x03);
            let am = (s.am_fix !== undefined) ? s.am_fix : ((val >> 5) & 0x01);
            let mic = (s.mic_bar !== undefined) ? s.mic_bar : ((val >> 4) & 0x01);
            let bat = (s.bat_txt !== undefined) ? s.bat_txt : ((val >> 2) & 0x03);
            f40[7] = (val & 0x03) | (bl << 6) | (am << 5) | (mic << 4) | (bat << 2);
        }

        const ext = buffers.settings_ext || new Uint8Array(16);
        const ff2 = ext.subarray(2, 10);

        if (s.contrast !== undefined || s.invert !== undefined || s.lock !== undefined || s.gui !== undefined) {
            let val = ff2[3];
            let ctr = (s.contrast !== undefined) ? s.contrast : (val & 0x0F);
            let inv = (s.invert !== undefined) ? s.invert : ((val >> 4) & 0x01);
            let lock = (s.lock !== undefined) ? s.lock : ((val >> 5) & 0x01);
            let met = (s.meter !== undefined) ? s.meter : ((val >> 6) & 0x01);
            let gui = (s.gui !== undefined) ? s.gui : ((val >> 7) & 0x01);
            ff2[3] = (gui << 7) | (met << 6) | (lock << 5) | (inv << 4) | (ctr & 0x0F);
        }

        if (s.tot !== undefined || s.eot !== undefined) {
            let val = ff2[4];
            let tot = (s.tot !== undefined) ? s.tot : ((val >> 4) & 0x0F);
            let eot = (s.eot !== undefined) ? s.eot : (val & 0x0F);
            ff2[4] = (tot << 4) | (eot & 0x0F);
        }

        if (s.ptt_mode !== undefined || s.pwr_mode !== undefined) {
            let val = ff2[5];
            let pwr = (s.pwr_mode !== undefined) ? s.pwr_mode : ((val >> 4) & 0x0F);
            let ptt = (s.ptt_mode !== undefined) ? s.ptt_mode : (val & 0x0F);
            ff2[5] = (pwr << 4) | (ptt & 0x0F);
        }
    }

    async startDisplayMirror(protocol: any): Promise<DisplayMirrorHandler | null> {
        const handler = new SerialHandler();
        await handler.connect(protocol);
        return handler;
    }
}

// --- SerialHandler implementation ---
const HEADER_0 = 0xAA;
const HEADER_1 = 0x55;
const TYPE_SCREENSHOT = 0x01;
const TYPE_DIFF = 0x02;
const FRAME_SIZE = 1024;
const VERSION_MARKER = 0xFF;
const BUFFER_SIZE = 32768;

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
        this.protocol.setDataListener(this.handleData.bind(this));
        if (this.onStatusChange) this.onStatusChange(true);
        this.startKeepalive();
    }

    public async disconnect(_closePort = false) {
        this.isConnected = false;
        if (this.keepaliveInterval) window.clearInterval(this.keepaliveInterval);
        this.protocol.setDataListener(null);
        if (this.onStatusChange) this.onStatusChange(false);
    }

    private startKeepalive() {
        this.keepaliveInterval = window.setInterval(() => this.sendKeepalive(), 1000);
        this.sendKeepalive();
    }

    private async sendKeepalive() {
        if (!this.protocol || !this.isConnected) return;
        try {
            await this.protocol.sendRaw(new Uint8Array([0x55, 0xAA, 0x00, 0x00]));
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
                const totalSize = markerSize + 5 + size + 1;
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
            if (chunkIndex >= 128) break;
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

