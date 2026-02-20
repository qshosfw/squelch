import { BaseRadioModule, Channel, FeatureFlags, TelemetryData, SettingsSchema, SettingsSection, MemoryConfig } from '../lib/framework/module-interface';
import { Wrench } from "lucide-react";
import { DeltaTools } from "./components/DeltaTools";

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
export class DeltaFWProfile extends BaseRadioModule {
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

    get memoryMapping(): MemoryConfig {
        return {
            channels: { start: 0x0000, size: 200 * 16, stride: 16 }, // 0x0000 - 0x0C80
            settings: { start: 0x0E70, size: 0xB0 }, // E70-EB0 + E90 Key config
            extra: {
                attributes: { start: 0x0D60, size: 0x0E40 - 0x0D60 },
                names: { start: 0x0F50, size: 200 * 16 },
                f40: { start: 0x0F40, size: 16 },
                settings_ext: { start: 0x1FF0, size: 16 }
            }
        };
    }

    get strings() {
        return {
            "calibration.warning": "DeltaFW calibration is standard. Use with caution.",
        };
    }

    get components() {
        return {};
    }

    get customPages() {
        return [
            {
                id: 'delta-tools',
                label: 'Delta Tools',
                icon: Wrench,
                component: DeltaTools
            }
        ];
    }

    get settingsSections(): Record<string, SettingsSection> {
        return {
            "Radio": { id: "radio", label: "Radio Settings", icon: "Radio", description: "Frequency, Squelch, and transmit options" },
            "Audio": { id: "audio", label: "Audio & Sound", icon: "Audio", description: "Volume, Beeps, and Voice Prompts" },
            "Display": { id: "display", label: "Display & Interface", icon: "Display", description: "Backlight, Contrast, and UI options" },
            "Function": { id: "function", label: "Functions", icon: "Function", description: "Repeater, DTMF, and other features" },
            "Keys": { id: "keys", label: "Key Assignments", icon: "Keys", description: "Side key customization and locks" },
            "Power": { id: "power", label: "Power Management", icon: "Power", description: "Battery saver and type settings" },
            "System": { id: "system", label: "System", icon: "System", description: "System-wide configuration" },
        };
    }

    get lists() {
        return {
            POWER: ["USER", "LOW 1", "LOW 2", "LOW 3", "LOW 4", "1W", "2W", "5W"],
            MODE: ["FM", "NFM", "AM", "NAM", "USB", "BYP", "RAW", "DSB", "CW"],
            SCRAMBLER: ["OFF", "2600Hz", "2700Hz", "2800Hz", "2900Hz", "3000Hz", "3100Hz", "3200Hz", "3300Hz", "3400Hz", "3500Hz"],
            PTTID: ["OFF", "UP CODE", "DOWN CODE", "UP+DOWN CODE", "APOLLO QUINDAR"],
            SCAN_RESUME: ["TO", "CO", "SE"],
            COMPANDER: ["OFF", "TX", "RX", "TX/RX"],
            STEPS: [2.5, 5, 6.25, 10, 12.5, 25, 8.33, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 1.25, 9, 15, 20, 30, 50, 100, 125, 200, 250, 500],
            MIC_GAIN: ["+1.1dB", "+4.0dB", "+8.0dB", "+12.0dB", "+15.1dB"],
            SET_PTT: ["CLASSIC", "ONEPUSH"],
            SET_TOT_EOT: ["OFF", "SOUND", "VISUAL", "ALL"],
            SET_LCK: ["KEYS", "KEYS+PTT"],
            SET_MET: ["TINY", "CLASSIC"],
            SET_NFM: ["NARROW", "NARROWER"],
            SET_KEY: ["MENU", "KEY_UP", "KEY_DOWN", "KEY_EXIT", "KEY_STAR"],
            RXMODE: ["MAIN ONLY", "DUAL RX RESPOND", "CROSS BAND", "MAIN TX DUAL RX"],
            CHANNELDISP: ["Frequency", "Channel Number", "Name", "Name + Frequency"],
            BATSAVE: ["OFF", "1:1", "1:2", "1:3", "1:4", "1:5"],
            BATTYPE: ["1600 mAh K5", "2200 mAh K5", "3500 mAh K5", "1400 mAh K1", "2500 mAh K1"],
            BAT_TXT: ["NONE", "VOLTAGE", "PERCENT"],
            BL_LVL: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            BL_TX_RX: ["OFF", "TX", "RX", "TX/RX"],
            FLOCK: [
                "DEFAULT+ (137-174, 400-470)", "FCC HAM (144-148, 420-450)", "CA HAM (144-148, 430-450)",
                "CE HAM (144-146, 430-440)", "GB HAM (144-148, 430-440)", "137-174, 400-430",
                "137-174, 400-438", "PMR 446", "GMRS FRS MURS", "DISABLE ALL", "UNLOCK ALL"
            ],
            BL_TIME: [
                "OFF", "5s", "10s", "15s", "20s", "25s", "30s", "35s", "40s", "45s", "50s", "55s",
                "1m", "1m5s", "1m10s", "1m15s", "1m20s", "1m25s", "1m30s", "1m35s", "1m40s", "1m45s", "1m50s", "1m55s",
                "2m", "2m5s", "2m10s", "2m15s", "2m20s", "2m25s", "2m30s", "2m35s", "2m40s", "2m45s", "2m50s", "2m55s",
                "5m", "Always On"
            ],
            VOICE: ["OFF", "Chinese", "English"],
            TX_VFO: ["A", "B"],
            ALARMMODE: ["SITE", "TONE"],
            ROGER: ["OFF", "ROGER", "MDC"],
            RTE: ["OFF", "100ms", "200ms", "300ms", "400ms", "500ms", "600ms", "700ms", "800ms", "900ms", "1000ms"],
            VOX: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            KEYACTIONS: [
                "NONE", "FLASHLIGHT", "POWER", "MONITOR", "SCAN", "VOX", "ALARM", "FM RADIO", "1750Hz TONE",
                "LOCK KEYPAD", "VFO A / VFO B", "VFO / MEM", "MODE", "BL_MIN_TMP_OFF", "RX MODE", "MAIN ONLY",
                "PTT", "WIDE / NARROW", "BACKLIGHT", "MUTE", "POWER HIGH", "REMOVE OFFSET"
            ],
            SCANLIST: ["None", "I", "II", "I+II", "III", "I+III", "II+III", "ALL"]
        };
    }



    get settingsConfig(): SettingsSchema[] {
        return [
            // E70
            { key: 'squelch', label: 'Squelch', type: 'range', min: 0, max: 9, group: 'Radio', default: 3 },
            { key: 'bat_save', label: 'Battery Save', type: 'select', options: this.lists.BATSAVE, group: 'Power', default: 4 },
            { key: 'dual_watch', label: 'Dual Watch', type: 'switch', group: 'Radio', default: 0 },
            { key: 'backlight', label: 'Backlight Time', type: 'select', options: this.lists.BL_TIME, group: 'Display', default: 5 },
            { key: 'bl_min', label: 'Backlight Min', type: 'select', options: this.lists.BL_LVL, group: 'Display', default: 0 },
            { key: 'bl_max', label: 'Backlight Max', type: 'select', options: this.lists.BL_LVL, group: 'Display', default: 9 },
            { key: 'ch_disp', label: 'Channel Display', type: 'select', options: this.lists.CHANNELDISP, group: 'Display', default: 2 },
            { key: 'crossband', label: 'Crossband', type: 'select', options: this.lists.RXMODE, group: 'Radio', default: 0 },
            { key: 'vox', label: 'VOX Enabled', type: 'switch', group: 'Audio', default: 0 },
            { key: 'vox_level', label: 'VOX Level', type: 'select', options: this.lists.VOX, group: 'Audio', default: 1 },
            { key: 'mic_gain', label: 'Mic Gain', type: 'select', options: this.lists.MIC_GAIN, group: 'Audio', default: 2 },

            // E90
            { key: 'beep', label: 'Beep', type: 'switch', group: 'Audio', default: 1 },
            { key: 'key_m', label: 'Key M Long', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 0 },
            { key: 'key_1s', label: 'Side 1 Short', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 3 },
            { key: 'key_1l', label: 'Side 1 Long', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 1 },
            { key: 'key_2s', label: 'Side 2 Short', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 1 },
            { key: 'key_2l', label: 'Side 2 Long', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 6 },
            { key: 'scan_resume', label: 'Scan Resume', type: 'select', options: ["Time", "Carrier", "Search"], group: 'Radio', default: 1 }, // Simplification

            // EA0
            { key: 'voice', label: 'Voice Prompt', type: 'select', options: this.lists.VOICE, group: 'Audio', default: 2 },

            // EA8
            { key: 'roger', label: 'Roger Beep', type: 'select', options: this.lists.ROGER, group: 'Audio', default: 0 },
            { key: 'ste', label: 'Repeater STE', type: 'select', options: this.lists.RTE, group: 'Audio', default: 5 },
            { key: 'tx_vfo', label: 'TX VFO', type: 'select', options: this.lists.TX_VFO, group: 'Radio', default: 0 },
            { key: 'bat_type', label: 'Battery Type', type: 'select', options: this.lists.BATTYPE, group: 'Power', default: 0 },

            // F40
            { key: 'flock', label: 'Freq Lock', type: 'select', options: this.lists.FLOCK, group: 'Radio', default: 0 },
            { key: 'bl_mode', label: 'Backlight Activation', type: 'select', options: this.lists.BL_TX_RX, group: 'Display', default: 3 },
            { key: 'am_fix', label: 'AM Fix', type: 'switch', group: 'Radio', default: 1 },
            { key: 'mic_bar', label: 'Mic Bar', type: 'switch', group: 'Display', default: 1 },
            { key: 'bat_txt', label: 'Battery Text', type: 'select', options: this.lists.BAT_TXT, group: 'Display', default: 2 },

            // FF2
            { key: 'contrast', label: 'Contrast', type: 'range', min: 0, max: 15, group: 'Display', default: 13 },
            { key: 'invert', label: 'Invert Screen', type: 'switch', group: 'Display', default: 0 },
            { key: 'gui', label: 'GUI Style', type: 'select', options: this.lists.SET_MET, group: 'Display', default: 1 },
            { key: 'lock', label: 'Lock Mode', type: 'select', options: this.lists.SET_LCK, group: 'Keys', default: 0 },
            { key: 'tot', label: 'TOT', type: 'select', options: this.lists.SET_TOT_EOT, group: 'Radio', default: 0 },
            { key: 'eot', label: 'EOT', type: 'select', options: this.lists.SET_TOT_EOT, group: 'Radio', default: 0 },
            { key: 'ptt_mode', label: 'PTT Mode', type: 'select', options: this.lists.SET_PTT, group: 'Keys', default: 0 },
            { key: 'noaa_autoscan', label: 'NOAA Auto Scan', type: 'switch', group: 'Radio', default: 0 },
            { key: 'alarm_mode', label: 'Alarm Mode', type: 'select', options: this.lists.ALARMMODE, group: 'Audio', default: 0 },

            // Build Options (1FF0) - Features
            { key: 'feat_dtmf', label: 'Enable DTMF Calling', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_pwd', label: 'Enable Password', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_1750', label: 'Enable 1750Hz', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_alarm', label: 'Enable Alarm', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_vox', label: 'Enable VOX', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_voice', label: 'Enable Voice', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_noaa', label: 'Enable NOAA', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_fm', label: 'Enable FM Radio', type: 'switch', group: 'Features', default: 1 },

            // Build Options (1FF1)
            { key: 'feat_rescue', label: 'Enable Rescue Ops', type: 'switch', group: 'Features', default: 0 },
            { key: 'feat_scope', label: 'Enable Bandscope', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_am_fix', label: 'Enable AM Fix', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_game', label: 'Enable Game', type: 'switch', group: 'Features', default: 0 },
            { key: 'feat_raw', label: 'Enable Raw Demod', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_wide', label: 'Enable Wide RX', type: 'switch', group: 'Features', default: 1 },
            { key: 'feat_flash', label: 'Enable Flashlight', type: 'switch', group: 'Features', default: 1 },
        ];
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
            const crockford = this.formatUID(info.serial);

            return {
                serial: crockford || "Unknown",
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

    async getNumericUID(protocol: any): Promise<bigint | null> {
        const timestamp = protocol.getSessionTimestamp();
        const info = await this.fetchIdentification(protocol, timestamp);
        return info ? info.serial : null;
    }

    async getSerialNumber(protocol: any): Promise<string | null> {
        const timestamp = protocol.getSessionTimestamp();
        const info = await this.fetchIdentification(protocol, timestamp);
        return info ? this.formatUID(info.serial) : null;
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

            if (batResp && batResp.length >= 12) {
                // Buffer does not include the 4-byte header in the payload sometimes,
                // Assuming it's the raw data payload from the response body.
                // data size is 12 bytes
                const dv = new DataView(batResp.buffer, batResp.byteOffset, batResp.byteLength);
                // If it starts with ID (0x52A = 1322), maybe we need to skip 4 bytes header, but driver usually returns payload.
                // Assuming driver strips the 4-byte Header_t.

                const rawADC = dv.getUint16(0, true);
                const current = dv.getUint16(2, true); // not really used by k5 but included struct
                const percent = dv.getUint8(4);
                // 5 is BatteryType
                const flags = dv.getUint16(6, true);
                const tempRaw = dv.getUint16(8, true);

                // approximate temperature decoding for K5
                const tempC = (tempRaw - 1800) / -8.5; // very rough heuristic, better than nothing

                // The UV-K5 Custom FW UART payload sends gBatteryVoltageAverage * 10.
                // 820 = 8.20V, thus 8200 is sent over UART for 8.2V.
                const voltage = rawADC / 1000;

                tele = {
                    ...tele,
                    batteryVoltage: voltage,
                    batteryCurrent: current,
                    batteryPercentage: percent,
                    isCharging: !!(flags & 1),
                    isLowBattery: !!(flags & 2),
                    temperature: tempC
                } as any;
                success = true;
            }
        } catch (e) {
            console.warn("[DeltaFW] Battery telemetry error", e);
        }

        // RSSI
        try {
            const rssiPromise = session.waitForPacket(MSG_RSSI_RESP);
            await session.sendCommand(MSG_RSSI_REQ, new Uint8Array([]));
            const rssiResp = await rssiPromise;

            if (rssiResp && rssiResp.length >= 10) {
                const dv = new DataView(rssiResp.buffer, rssiResp.byteOffset, rssiResp.byteLength);

                const rawRssi = dv.getUint16(0, true);
                const exNoise = dv.getUint8(2);
                const glitch = dv.getUint8(3);
                const rssi_dBm = dv.getInt16(4, true);
                const gain_dB = dv.getInt8(6);
                const afAmp = dv.getUint8(7);

                tele = {
                    ...tele,
                    rssi: rawRssi,
                    rssi_dBm: rssi_dBm,
                    snr: exNoise, // using ExNoiseIndicator as analogous to "snr" or noise in general
                    noiseIndicator: exNoise,
                    glitchIndicator: glitch,
                    gain_dB: gain_dB,
                    afAmplitude: afAmp
                };
                success = true;
            }
        } catch (e) {
            console.warn("[DeltaFW] RSSI telemetry error", e);
        }

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
        else if (modIdx === 3) mode = "BYP";
        else if (modIdx === 4) mode = "RAW";
        else if (modIdx === 5) mode = "DSB";
        else if (modIdx === 6) mode = "CW";

        const power = this.lists.POWER[pwrIdx] || "USER";

        const freqRev = (flags12 & 0x01) === 1;
        const busyLock = ((flags12 >> 5) & 0x01) === 1;
        const txLock = ((flags12 >> 6) & 0x01) === 1;

        const stepIdx = buffer[14];
        const step = this.lists.STEPS[stepIdx] || 2.5;

        const scramblerIdx = buffer[15];
        const scrambler = this.lists.SCRAMBLER[scramblerIdx] || "OFF";

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
        else if (c.mode === "BYP") { modIdx = 3; }
        else if (c.mode === "RAW") { modIdx = 4; }
        else if (c.mode === "DSB") { modIdx = 5; }
        else if (c.mode === "CW") { modIdx = 6; }
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

        const steps = this.lists.STEPS;
        let stepIdx = steps.indexOf(parseFloat(String(c.step)));
        buffer[14] = stepIdx >= 0 ? stepIdx : 0;
        let scramIdx = this.lists.SCRAMBLER.indexOf(c.scrambler || "OFF");
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
    // readChannels and writeChannels are now handled by BaseRadioModule



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

    decodeSettings(buffers: { [key: string]: Uint8Array }): any {
        const s: any = {};

        // Block 1: E70 (SETTINGS_MAIN 0x4000)
        const main = buffers.settings || new Uint8Array(0xB0);
        const e70 = main.subarray(0x00, 0x10);

        s.squelch = e70[1];
        s.tot = e70[2];
        s.noaa_autoscan = e70[3];
        // e70[4] is KEY_LOCK, MENU_LOCK, SET_KEY, SET_NAV
        s.vox = !!e70[5];
        s.vox_level = e70[6];
        s.mic_gain = e70[7];

        // BACKLIGHT_MAX is bits 0-3, BACKLIGHT_MIN is bits 4-7
        s.bl_max = e70[8] & 0x0F;
        s.bl_min = (e70[8] >> 4) & 0x0F;

        s.ch_disp = e70[9];
        s.crossband = e70[10];
        s.bat_save = e70[11];
        s.dual_watch = e70[12];
        s.backlight = e70[13];

        // e70[14] is TAIL_TONE_ELIMINATION (bit 0), NFM (bit 1)
        s.tail_tone = e70[14] & 0x01;

        // Block 2: E90 (SETTINGS_EXTRA 0x7000)
        const e90 = main.subarray(0x20, 0x30);

        // BEEP_CONTROL is bit 0, KEY_M_LONG_PRESS is bits 1-7
        s.beep = e90[0] & 0x01;
        s.key_m = (e90[0] >> 1) & 0x7F;

        s.key_1s = e90[1];
        s.key_1l = e90[2];
        s.key_2s = e90[3];
        s.key_2l = e90[4];
        s.scan_resume = e90[5];

        s.power_on_pwd = main.subarray(0x28, 0x2C); // 4 bytes

        // Block 3: EA0
        const ea0 = main.subarray(0x30, 0x38);
        s.voice = ea0[0];
        // EA0[1] = S0_LEVEL
        // EA0[2] = S9_LEVEL
        s.mic_agc = ea0[3];

        // Block 4: EA8
        const ea8 = main.subarray(0x38, 0x40);
        s.alarm_mode = ea8[0];
        s.roger = ea8[1];
        s.ste = ea8[2];
        s.tx_vfo = ea8[3];
        s.bat_type = ea8[4];

        // Block 5: F40 (F_LOCK 0xB000)
        const f40 = buffers.f40 || new Uint8Array(16);
        s.flock = f40[0];

        // Bitpacked byte 7
        const f40_7 = f40[7];
        // LIVE_DTMF_DECODER: bit 0
        // BATTERY_TEXT: bits 1-3
        s.bat_txt = (f40_7 >> 1) & 0x07;
        // MIC_BAR: bit 4
        s.mic_bar = (f40_7 >> 4) & 0x01;
        // AM_FIX: bit 5
        s.am_fix = (f40_7 >> 5) & 0x01;
        // BACKLIGHT_ON_TX_RX: bits 6-7
        s.bl_mode = (f40_7 >> 6) & 0x03;

        // Block 6: FF2 (1FF0)
        const ext = buffers.settings_ext || new Uint8Array(16);

        // 1FF0 - Build Options
        const bOpt0 = ext[0];
        s.feat_dtmf = bOpt0 & 0x01;
        s.feat_pwd = (bOpt0 >> 1) & 0x01;
        s.feat_1750 = (bOpt0 >> 2) & 0x01;
        s.feat_alarm = (bOpt0 >> 3) & 0x01;
        s.feat_vox = (bOpt0 >> 4) & 0x01;
        s.feat_voice = (bOpt0 >> 5) & 0x01;
        s.feat_noaa = (bOpt0 >> 6) & 0x01;
        s.feat_fm = (bOpt0 >> 7) & 0x01;

        // 1FF1 - Build Options 2
        const bOpt1 = ext[1];
        s.feat_rescue = (bOpt1 >> 1) & 0x01;
        s.feat_scope = (bOpt1 >> 2) & 0x01;
        s.feat_am_fix = (bOpt1 >> 3) & 0x01;
        s.feat_game = (bOpt1 >> 4) & 0x01;
        s.feat_raw = (bOpt1 >> 5) & 0x01;
        s.feat_wide = (bOpt1 >> 6) & 0x01;
        s.feat_flash = (bOpt1 >> 7) & 0x01;

        const ff2 = ext.subarray(2, 10);

        // Byte 2 (Index 2 in FF2, 1FF4 in Map) -> State[4]
        const ff2_2 = ff2[2];
        s.set_tmr = ff2_2 & 0x01;
        s.set_off_tmr = (ff2_2 >> 1) & 0x7F; // 7 bits

        // Byte 3 (Index 3, 1FF5) -> State[5]
        const ff2_3 = ff2[3];
        s.contrast = ff2_3 & 0x0F;
        s.invert = (ff2_3 >> 4) & 0x01;
        s.lock = (ff2_3 >> 5) & 0x01;
        s.gui = (ff2_3 >> 7) & 0x01;
        s.meter = (ff2_3 >> 6) & 0x01; // Assuming met maps to meter/gui style variant

        // Byte 4 (Index 4, 1FF6) -> State[6]
        const ff2_4 = ff2[4];
        s.tot = (ff2_4 >> 4) & 0x0F;
        s.eot = ff2_4 & 0x0F;

        // Byte 5 (Index 5, 1FF7) -> State[7]
        const ff2_5 = ff2[5];
        s.ptt_mode = ff2_5 & 0x0F;
        s.pwr_mode = (ff2_5 >> 4) & 0x0F;

        return s;
    }

    encodeSettings(s: any, buffers: { [key: string]: Uint8Array }): void {
        const main = buffers.settings || new Uint8Array(0xB0);
        const f40 = buffers.f40 || new Uint8Array(16);
        const ext = buffers.settings_ext || new Uint8Array(16);

        // Block 1: E70 (SETTINGS_MAIN 0x4000)
        const e70 = main.subarray(0x00, 0x10);
        if (s.squelch !== undefined) e70[1] = s.squelch;
        if (s.tot !== undefined) e70[2] = s.tot;
        if (s.noaa_autoscan !== undefined) e70[3] = s.noaa_autoscan;
        if (s.vox !== undefined) e70[5] = s.vox ? 1 : 0;
        if (s.vox_level !== undefined) e70[6] = s.vox_level;
        if (s.mic_gain !== undefined) e70[7] = s.mic_gain;

        // BACKLIGHT_MAX is bits 0-3, BACKLIGHT_MIN is bits 4-7
        if (s.bl_max !== undefined || s.bl_min !== undefined) {
            let temp8 = e70[8];
            if (s.bl_max !== undefined) temp8 = (temp8 & 0xF0) | (s.bl_max & 0x0F);
            if (s.bl_min !== undefined) temp8 = (temp8 & 0x0F) | ((s.bl_min & 0x0F) << 4);
            e70[8] = temp8;
        }

        if (s.ch_disp !== undefined) e70[9] = s.ch_disp;
        if (s.crossband !== undefined) e70[10] = s.crossband;
        if (s.bat_save !== undefined) e70[11] = s.bat_save;
        if (s.dual_watch !== undefined) e70[12] = s.dual_watch;
        if (s.backlight !== undefined) e70[13] = s.backlight;

        // TAIL_TONE_ELIMINATION
        if (s.tail_tone !== undefined) {
            e70[14] = (e70[14] & 0xFE) | (s.tail_tone & 0x01);
        }

        // Block 2: E90
        const e90 = main.subarray(0x20, 0x30);
        if (s.key_m !== undefined || s.beep !== undefined) {
            let temp0 = e90[0];
            if (s.key_m !== undefined) temp0 = (temp0 & 0x80) | (s.key_m & 0x7F);
            if (s.beep !== undefined) temp0 = (temp0 & 0x7F) | ((s.beep & 0x01) << 7);
            e90[0] = temp0;
        }

        if (s.key_1s !== undefined) e90[1] = s.key_1s;
        if (s.key_1l !== undefined) e90[2] = s.key_1l;
        if (s.key_2s !== undefined) e90[3] = s.key_2s;
        if (s.key_2l !== undefined) e90[4] = s.key_2l;
        if (s.scan_resume !== undefined) e90[5] = s.scan_resume;

        // Block 3: EA0
        const ea0 = main.subarray(0x30, 0x38);
        if (s.voice !== undefined) ea0[0] = s.voice;

        // Block 4: EA8
        const ea8 = main.subarray(0x38, 0x40);
        if (s.alarm_mode !== undefined) ea8[0] = s.alarm_mode;
        if (s.roger !== undefined) ea8[1] = s.roger;
        if (s.ste !== undefined) ea8[2] = s.ste;
        if (s.tx_vfo !== undefined) ea8[3] = s.tx_vfo;
        if (s.bat_type !== undefined) ea8[4] = s.bat_type;

        // Block 5: F40
        if (s.flock !== undefined) f40[0] = s.flock;
        if (s.bl_mode !== undefined || s.mic_bar !== undefined || s.bat_txt !== undefined || s.am_fix !== undefined) {
            let f40_7 = f40[7];
            if (s.bl_mode !== undefined) f40_7 = (f40_7 & ~(0x03 << 6)) | ((s.bl_mode & 0x03) << 6);
            if (s.mic_bar !== undefined) f40_7 = (f40_7 & ~(0x01 << 4)) | ((s.mic_bar & 0x01) << 4);
            if (s.bat_txt !== undefined) f40_7 = (f40_7 & ~(0x03 << 2)) | ((s.bat_txt & 0x03) << 2);
            if (s.am_fix !== undefined) f40_7 = (f40_7 & ~(0x01 << 5)) | ((s.am_fix & 0x01) << 5);
            f40[7] = f40_7;
        }

        // Block 6: FF2 (1FF0)
        let bOpt0 = ext[0];
        if (s.feat_dtmf !== undefined) bOpt0 = (bOpt0 & ~0x01) | (s.feat_dtmf & 0x01);
        if (s.feat_pwd !== undefined) bOpt0 = (bOpt0 & ~(0x01 << 1)) | ((s.feat_pwd & 0x01) << 1);
        if (s.feat_1750 !== undefined) bOpt0 = (bOpt0 & ~(0x01 << 2)) | ((s.feat_1750 & 0x01) << 2);
        if (s.feat_alarm !== undefined) bOpt0 = (bOpt0 & ~(0x01 << 3)) | ((s.feat_alarm & 0x01) << 3);
        if (s.feat_vox !== undefined) bOpt0 = (bOpt0 & ~(0x01 << 4)) | ((s.feat_vox & 0x01) << 4);
        if (s.feat_voice !== undefined) bOpt0 = (bOpt0 & ~(0x01 << 5)) | ((s.feat_voice & 0x01) << 5);
        if (s.feat_noaa !== undefined) bOpt0 = (bOpt0 & ~(0x01 << 6)) | ((s.feat_noaa & 0x01) << 6);
        if (s.feat_fm !== undefined) bOpt0 = (bOpt0 & ~(0x01 << 7)) | ((s.feat_fm & 0x01) << 7);
        ext[0] = bOpt0;

        let bOpt1 = ext[1];
        if (s.feat_rescue !== undefined) bOpt1 = (bOpt1 & ~(0x01 << 1)) | ((s.feat_rescue & 0x01) << 1);
        if (s.feat_scope !== undefined) bOpt1 = (bOpt1 & ~(0x01 << 2)) | ((s.feat_scope & 0x01) << 2);
        if (s.feat_am_fix !== undefined) bOpt1 = (bOpt1 & ~(0x01 << 3)) | ((s.feat_am_fix & 0x01) << 3);
        if (s.feat_game !== undefined) bOpt1 = (bOpt1 & ~(0x01 << 4)) | ((s.feat_game & 0x01) << 4);
        if (s.feat_raw !== undefined) bOpt1 = (bOpt1 & ~(0x01 << 5)) | ((s.feat_raw & 0x01) << 5);
        if (s.feat_wide !== undefined) bOpt1 = (bOpt1 & ~(0x01 << 6)) | ((s.feat_wide & 0x01) << 6);
        if (s.feat_flash !== undefined) bOpt1 = (bOpt1 & ~(0x01 << 7)) | ((s.feat_flash & 0x01) << 7);
        ext[1] = bOpt1;

        const ff2 = ext.subarray(2, 10);

        if (s.set_tmr !== undefined || s.set_off_tmr !== undefined) {
            let temp2 = ff2[2];
            if (s.set_tmr !== undefined) temp2 = (temp2 & ~0x01) | (s.set_tmr & 0x01);
            if (s.set_off_tmr !== undefined) temp2 = (temp2 & 0x01) | ((s.set_off_tmr & 0x7F) << 1);
            ff2[2] = temp2;
        }

        if (s.contrast !== undefined || s.invert !== undefined || s.lock !== undefined || s.gui !== undefined || s.meter !== undefined) {
            let temp3 = ff2[3];
            if (s.contrast !== undefined) temp3 = (temp3 & 0xF0) | (s.contrast & 0x0F);
            if (s.invert !== undefined) temp3 = (temp3 & ~(0x01 << 4)) | ((s.invert & 0x01) << 4);
            if (s.lock !== undefined) temp3 = (temp3 & ~(0x01 << 5)) | ((s.lock & 0x01) << 5);
            if (s.gui !== undefined) temp3 = (temp3 & ~(0x01 << 7)) | ((s.gui & 0x01) << 7);
            if (s.meter !== undefined) temp3 = (temp3 & ~(0x01 << 6)) | ((s.meter & 0x01) << 6);
            ff2[3] = temp3;
        }

        if (s.tot !== undefined || s.eot !== undefined) {
            let temp4 = ff2[4];
            if (s.tot !== undefined) temp4 = (temp4 & 0x0F) | ((s.tot & 0x0F) << 4);
            if (s.eot !== undefined) temp4 = (temp4 & 0xF0) | (s.eot & 0x0F);
            ff2[4] = temp4;
        }

        if (s.ptt_mode !== undefined || s.pwr_mode !== undefined) {
            let temp5 = ff2[5];
            if (s.ptt_mode !== undefined) temp5 = (temp5 & 0xF0) | (s.ptt_mode & 0x0F);
            if (s.pwr_mode !== undefined) temp5 = (temp5 & 0x0F) | ((s.pwr_mode & 0x0F) << 4);
            ff2[5] = temp5;
        }

        buffers.settings = main;
        buffers.f40 = f40;
        buffers.settings_ext = ext;
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
