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

const LIST_POWER = ["ULOW", "LOW", "MID", "HIGH"];
const LIST_MODE = ["FM", "NFM", "AM", "NAM", "USB", "BYP", "RAW", "DSB", "CW"];
const LIST_SCRAMBLER = ["OFF", "2600Hz", "2700Hz", "2800Hz", "2900Hz", "3000Hz", "3100Hz", "3200Hz", "3300Hz", "3400Hz", "3500Hz"];
const LIST_PTTID = ["OFF", "UP CODE", "DOWN CODE", "UP+DOWN CODE", "APOLLO QUINDAR"];
const LIST_TONES = ["None", ...TONES.map(t => t.toFixed(1))];
const LIST_DCS = ["None", ...DTCS_CODES.map(c => `D${c.toString().padStart(3, '0')}N`), ...DTCS_CODES.map(c => `D${c.toString().padStart(3, '0')}I`)];
const LIST_SCAN_RESUME = ["STOP", "CARRIER", "TIMEOUT"];
const LIST_COMPANDER = ["OFF", "ON"];
const LIST_STEPS = [2.5, 5, 6.25, 10, 12.5, 25, 50, 100, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50];
const LIST_MIC_GAIN = ["+1.1dB", "+4.0dB", "+8.0dB", "+12.0dB", "+15.1dB"];
const LIST_SET_PTT = ["CLASSIC", "ONEPUSH"];
const LIST_SET_TOT_EOT = ["OFF", "SOUND", "VISUAL", "ALL"];
const LIST_SET_LCK = ["KEYS", "KEYS+PTT"];
const LIST_SET_MET = ["TINY", "CLASSIC"];
const LIST_SET_NFM = ["NARROW", "NARROWER"];
const LIST_CHANNELDISP = ["FREQ", "NUMBER", "NAME", "NAME + FREQ"];
const LIST_BATSAVE = ["OFF", "1:1", "1:2", "1:3", "1:4", "1:5"];
const LIST_BATTYPE = ["1600 mAh K5", "2200 mAh K5", "3500 mAh K5", "1400 mAh K1", "2500 mAh K1"];
const LIST_BAT_TXT = ["NONE", "VOLTAGE", "PERCENT"];
const LIST_BL_LVL = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const LIST_BL_TX_RX = ["OFF", "TX", "RX", "TX/RX"];
const LIST_SCANLIST = ["None", "I", "II", "I+II", "III", "I+III", "II+III", "ALL"];
const LIST_BL_TIME = ["OFF", "5s", "10s", "15s", "20s", "25s", "30s", "35s", "40s", "45s", "50s", "55s", "1m", "1m5s", "1m10s", "1m15s", "1m20s", "1m25s", "1m30s", "1m35s", "1m40s", "1m45s", "1m50s", "1m55s", "2m", "2m5s", "2m10s", "2m15s", "2m20s", "2m25s", "2m30s", "2m35s", "2m40s", "2m45s", "2m50s", "2m55s", "5m", "Always On"];
const LIST_KEYACTIONS = [
    "NONE", "FLASHLIGHT", "POWER", "MONITOR", "SCAN", "VOX", "ALARM",
    "FM RADIO", "1750Hz TONE", "LOCK KEYPAD", "VFO A/B", "VFO/MEM",
    "MODE", "BL_OFF", "RX MODE", "MAIN ONLY", "PTT", "W/N",
    "BACKLIGHT", "MUTE", "POWER HIGH", "REMOVE OFFSET"
];
const LIST_VOX = ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
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
            channels: { start: 0x0000, size: 200 * 16, stride: 16 },
            settings: { start: 0x0E70, size: 0xB0 },
            extra: {
                attributes: { start: 0x0D60, size: 0x0E40 - 0x0D60 },
                names: { start: 0x0F50, size: 200 * 16 },
                settings_ext1: { start: 0x0F40, size: 0x10 },
                settings_ext2: { start: 0x1FF0, size: 0x10 }
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
            POWER: LIST_POWER,
            MODE: LIST_MODE,
            SCRAMBLER: LIST_SCRAMBLER,
            PTTID: LIST_PTTID,
            TONES: LIST_TONES,
            DCS: LIST_DCS,
            SCAN_RESUME: LIST_SCAN_RESUME,
            COMPANDER: LIST_COMPANDER,
            STEPS: LIST_STEPS,
            MIC_GAIN: LIST_MIC_GAIN,
            SET_PTT: LIST_SET_PTT,
            SET_TOT_EOT: LIST_SET_TOT_EOT,
            SET_LCK: LIST_SET_LCK,
            SET_MET: LIST_SET_MET,
            SET_NFM: LIST_SET_NFM,
            CHANNELDISP: LIST_CHANNELDISP,
            BATSAVE: LIST_BATSAVE,
            BATTYPE: LIST_BATTYPE,
            BAT_TXT: LIST_BAT_TXT,
            BL_LVL: LIST_BL_LVL,
            BL_TX_RX: LIST_BL_TX_RX,
            SCANLIST: LIST_SCANLIST,
            BL_TIME: LIST_BL_TIME,
            KEYACTIONS: LIST_KEYACTIONS,
            VOX: LIST_VOX,
        }
    }



    get settingsConfig(): SettingsSchema[] {
        return [
            // Radio
            { key: 'squelch', label: 'Squelch Level', type: 'range', min: 0, max: 9, group: 'Radio', default: 3, description: 'Adjusts the signal strength threshold to unmute the audio.' },
            { key: 'tx_timeout_timer', label: 'TOT (Time Out Timer)', type: 'select', options: ["OFF", ...Array.from({ length: 10 }, (_, i) => `${(i + 1) * 30}s`)], group: 'Radio', default: 3, description: 'Limits maximum transmission duration.' },
            { key: 'noaa_auto_scan', label: 'NOAA Auto Scan', type: 'switch', group: 'Radio', default: 0, description: 'Automatically scan NOAA weather channels.' },
            { key: 'f_lock', label: 'Frequency Lock', type: 'select', options: ["OFF", "FCC", "CE", "GB", "LPD", "PMR"], group: 'Radio', default: 5, description: 'Restrict frequency ranges based on region.' },

            // Audio
            { key: 'vox_switch', label: 'VOX Enabled', type: 'switch', group: 'Audio', default: 0, description: 'Voice Operated Transmit.' },
            { key: 'vox_level', label: 'VOX Level', type: 'select', options: this.lists.VOX, group: 'Audio', default: 1, description: 'Sensitivity of VOX activation.' },
            { key: 'mic_sensitivity', label: 'Microphone Gain', type: 'select', options: this.lists.MIC_GAIN, group: 'Audio', default: 2, description: 'Adjust microphone input level.' },
            { key: 'beep_control', label: 'Key Beep', type: 'switch', group: 'Audio', default: 1, description: ' audible beep on key press.' },
            { key: 'voice_prompt', label: 'Voice Prompt', type: 'select', options: ["OFF", "CHINESE", "ENGLISH"], group: 'Audio', default: 2, description: 'Spoken feedback for menu and channel changes.' },
            { key: 'roger', label: 'Roger Beep', type: 'select', options: ["OFF", "ROGER", "MDC"], group: 'Audio', default: 0, description: 'End-of-transmission tone.' },
            { key: 'alarm_mode', label: 'Alarm Mode', type: 'select', options: ["SITE", "TONE"], group: 'Audio', default: 0, description: 'Behavior when alarm is triggered.' },

            // Display
            { key: 'backlight_time', label: 'Backlight Timeout', type: 'select', options: this.lists.BL_TIME, group: 'Display', default: 5, description: 'Duration before backlight turns off.' },
            { key: 'backlight_max', label: 'Backlight Max Brightness', type: 'select', options: this.lists.BL_LVL, group: 'Display', default: 10, description: 'Maximum brightness level.' },
            { key: 'backlight_min', label: 'Backlight Min Brightness', type: 'select', options: this.lists.BL_LVL, group: 'Display', default: 0, description: 'Minimum brightness (dimmed state).' },
            { key: 'channel_display_mode', label: 'Display Mode', type: 'select', options: this.lists.CHANNELDISP, group: 'Display', default: 2, description: 'Information shown on the main screen.' },
            { key: 'power_on_display_mode', label: 'Power On Display', type: 'select', options: ["FULL SCREEN", "MESSAGE", "VOLTAGE"], group: 'Display', default: 0, description: 'Content shown during boot.' },

            // Function
            { key: 'repeater_tail', label: 'Repeater Tail', type: 'switch', group: 'Function', default: 0 },



            // Keys
            { key: 'key_1_short', label: 'Side 1 Short', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 0 },
            { key: 'key_1_long', label: 'Side 1 Long', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 0 },
            { key: 'key_2_short', label: 'Side 2 Short', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 0 },
            { key: 'key_2_long', label: 'Side 2 Long', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 0 },
            { key: 'key_m_long_press', label: 'M Long Press', type: 'select', options: this.lists.KEYACTIONS, group: 'Keys', default: 0 },
            { key: 'auto_keypad_lock', label: 'Auto Key Lock', type: 'switch', group: 'Keys', default: 0 },
            { key: 'key_lock', label: 'Key Lock (Manual)', type: 'switch', group: 'Keys', default: 0 },
            { key: 'menu_lock', label: 'Menu Lock', type: 'switch', group: 'Keys', default: 0 }, // Often handled by PTT+Side1 on boot, but setting exists?

            // Power
            { key: 'battery_type', label: 'Battery Type', type: 'select', options: this.lists.BATTYPE, group: 'Power', default: 0 },
            { key: 'battery_save', label: 'Battery Save', type: 'select', options: this.lists.BATSAVE, group: 'Power', default: 4 },

            // Extended Settings (0F40)
            { key: 'tx_350', label: 'TX 350MHz', type: 'switch', group: 'Radio', default: 0 },
            { key: 'tx_200', label: 'TX 200MHz', type: 'switch', group: 'Radio', default: 0 },
            { key: 'tx_500', label: 'TX 500MHz', type: 'switch', group: 'Radio', default: 0 },
            { key: 'en_350', label: 'Enable 350MHz', type: 'switch', group: 'Radio', default: 1 },
            { key: 'scramble_enable', label: 'Scrambler Enable', type: 'switch', group: 'Radio', default: 1 },
            { key: 'live_dtmf_decoder', label: 'Live DTMF Decoder', type: 'switch', group: 'Function', default: 1 },
            { key: 'battery_text', label: 'Battery Text', type: 'select', options: this.lists.BAT_TXT, group: 'Display', default: 0 },
            { key: 'mic_bar', label: 'Mic Bar', type: 'switch', group: 'Display', default: 1 },
            { key: 'am_fix', label: 'AM Fix', type: 'switch', group: 'Radio', default: 1 },
            { key: 'backlight_tx_rx', label: 'Backlight TX/RX', type: 'select', options: this.lists.BL_TX_RX, group: 'Display', default: 0 },

            // Custom Mods (1FF0)
            { key: 'set_inv', label: 'Inverted LCD', type: 'switch', group: 'Display', default: 0 },
            { key: 'set_lck', label: 'Lock PTT', type: 'switch', group: 'Keys', default: 0 },
            { key: 'set_met', label: 'Meter Style', type: 'select', options: this.lists.SET_MET, group: 'Display', default: 0 },
            { key: 'set_gui', label: 'GUI Style', type: 'switch', group: 'Display', default: 0 },
            { key: 'set_ctr', label: 'Contrast', type: 'range', min: 0, max: 15, group: 'Display', default: 10 },
            { key: 'set_tot', label: 'TOT Warning', type: 'select', options: this.lists.SET_TOT_EOT, group: 'Audio', default: 0 },
            { key: 'set_eot', label: 'EOT Warning', type: 'select', options: this.lists.SET_TOT_EOT, group: 'Audio', default: 0 },
            { key: 'set_pwr', label: 'Power Msg', type: 'range', min: 0, max: 7, group: 'Display', default: 0 },
            { key: 'set_ptt', label: 'PTT Mode', type: 'select', options: this.lists.SET_PTT, group: 'Keys', default: 0 },

            // DTMF (0ED0)
            { key: 'dtmf_side_tone', label: 'DTMF Side Tone', type: 'switch', group: 'Audio', default: 1 },
            { key: 'dtmf_separate_code', label: 'DTMF Separate', type: 'select', options: ['*', '#'], group: 'Function', default: 0 }, // Simplified
            { key: 'dtmf_group_call_code', label: 'DTMF Group Call', type: 'select', options: ['*', '#'], group: 'Function', default: 1 },
            { key: 'dtmf_decode_response', label: 'DTMF Response', type: 'select', options: ['None', 'Ring', 'Reply', 'Both'], group: 'Function', default: 0 },
            { key: 'dtmf_auto_reset_time', label: 'DTMF Auto Reset', type: 'range', min: 5, max: 60, group: 'Function', default: 10 },
            { key: 'permit_remote_kill', label: 'Remote Kill', type: 'switch', group: 'Function', default: 1 },
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

        const power = LIST_POWER[pwrIdx] || "USER";

        const freqRev = (flags12 & 0x01) === 1;
        const busyLock = ((flags12 >> 5) & 0x01) === 1;
        const txLock = ((flags12 >> 6) & 0x01) === 1;

        const stepIdx = buffer[14];
        const step = LIST_STEPS[stepIdx] || 2.5;

        const scramblerIdx = buffer[15];
        const scrambler = LIST_SCRAMBLER[scramblerIdx] || "OFF";

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

        const pwrIdx = LIST_POWER.indexOf(c.power || "USER");
        const pwrVal = pwrIdx >= 0 ? pwrIdx : 0;
        let flags12 = (c.freqRev ? 1 : 0) << 0
            | (bwNarrow ? 1 : 0) << 1
            | (pwrVal & 0x07) << 2
            | (c.busyLock ? 1 : 0) << 5
            | (c.txLock ? 1 : 0) << 6;
        buffer[12] = flags12;

        const steps = LIST_STEPS;
        let stepIdx = steps.indexOf(parseFloat(String(c.step)));
        buffer[14] = stepIdx >= 0 ? stepIdx : 0;
        let scramIdx = LIST_SCRAMBLER.indexOf(c.scrambler || "OFF");
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
        const main = buffers.settings || new Uint8Array(0xB0);

        // 0E70
        s.chan_1_call = main[0];
        s.squelch = main[1];
        s.tx_timeout_timer = main[2];
        s.noaa_auto_scan = main[3];
        s.key_lock = !!(main[4] & 0x01);
        s.menu_lock = !!(main[4] & 0x02);
        s.set_key = (main[4] >> 2) & 0x0F;
        s.set_nav = !!(main[4] & 0x40);
        s.vox_switch = !!main[5];
        s.vox_level = main[6];
        s.mic_sensitivity = main[7];

        const off78 = 0x08;
        s.backlight_max = main[off78 + 0] & 0x0F;
        s.backlight_min = (main[off78 + 0] >> 4) & 0x0F;
        s.channel_display_mode = main[off78 + 1];
        s.cross_band_rx_tx = main[off78 + 2];
        s.battery_save = main[off78 + 3];
        s.dual_watch = main[off78 + 4];
        s.backlight_time = main[off78 + 5];
        s.tail_tone_elimination = main[off78 + 6] & 0x01;
        s.set_nfm = (main[off78 + 6] >> 1) & 0x01; // Example NFM flag
        s.vfo_open = main[off78 + 7] & 0x01;

        // 0E90
        const off90 = 0x20;
        s.beep_control = main[off90 + 0] & 0x01;
        s.key_m_long_press = (main[off90 + 0] >> 1) & 0x7F;
        s.key_1_short = main[off90 + 1];
        s.key_1_long = main[off90 + 2];
        s.key_2_short = main[off90 + 3];
        s.key_2_long = main[off90 + 4];
        s.scan_resume_mode = main[off90 + 5];
        s.auto_keypad_lock = main[off90 + 6];
        s.power_on_display_mode = main[off90 + 7];

        // 0EA0
        const offA0 = 0x30;
        s.voice_prompt = main[offA0 + 0];
        // RSSI levels at +1, +2

        // 0EA8
        const offA8 = 0x38;
        s.alarm_mode = main[offA8 + 0];
        s.roger = main[offA8 + 1];
        s.repeater_tail = main[offA8 + 2];
        s.tx_vfo = main[offA8 + 3];
        s.battery_type = main[offA8 + 4];

        // 0ED0
        const offD0 = 0x60;
        s.dtmf_side_tone = main[offD0 + 0] & 0x01;
        s.dtmf_separate_code = String.fromCharCode(main[offD0 + 1]);
        s.dtmf_group_call_code = String.fromCharCode(main[offD0 + 2]);
        s.dtmf_decode_response = main[offD0 + 3];
        s.dtmf_auto_reset_time = main[offD0 + 4];
        // Timers at 5,6,7...

        // 0ED8
        const offD8 = 0x68;
        s.permit_remote_kill = main[offD8 + 2] & 0x01;

        // 0F40 - Extended
        const ext1 = buffers.settings_ext1 || new Uint8Array(0x10);
        s.f_lock = ext1[0];
        s.tx_350 = ext1[1] & 0x01; // gSetting_350TX
        s.killed = ext1[2] & 0x01;
        s.tx_200 = ext1[3] & 0x01;
        s.tx_500 = ext1[4] & 0x01;
        s.en_350 = ext1[5] & 0x01;
        s.scramble_enable = ext1[6] & 0x01;

        s.live_dtmf_decoder = !!(ext1[7] & (1 << 0));
        s.battery_text = (ext1[7] >> 1) & 0x07;
        s.mic_bar = !!(ext1[7] & (1 << 4));
        s.am_fix = !!(ext1[7] & (1 << 5));
        s.backlight_tx_rx = (ext1[7] >> 6) & 0x03;

        // 1FF0 - Custom Mods
        const ext2 = buffers.settings_ext2 || new Uint8Array(0x10);
        // Byte 4: tmr? off?
        // Byte 5: inv, lck, met, gui, ctr
        const b5 = ext2[5];
        s.set_inv = (b5 >> 4) & 0x01; // bit 4? No, settings.c: tmp = (Data[5] & 0xF0) >> 4; inv = tmp&1. So bit 4 of byte 5.
        s.set_lck = (b5 >> 5) & 0x01;
        s.set_met = (b5 >> 6) & 0x01;
        s.set_gui = (b5 >> 7) & 0x01;
        s.set_ctr = b5 & 0x0F;

        // Byte 6: tot, eot
        const b6 = ext2[6];
        s.set_tot = (b6 >> 4) & 0x0F;
        s.set_eot = b6 & 0x0F;

        // Byte 7: pwr, ptt
        const b7 = ext2[7];
        s.set_pwr = (b7 >> 4) & 0x0F;
        s.set_ptt = b7 & 0x0F;

        return s;
    }

    encodeSettings(s: any, buffers: { [key: string]: Uint8Array }): void {
        const main = buffers.settings || new Uint8Array(0xB0);
        const ext1 = buffers.settings_ext1 || new Uint8Array(0x10);
        const ext2 = buffers.settings_ext2 || new Uint8Array(0x10);

        // 0E70
        // chan_1_call 0
        if (s.squelch !== undefined) main[1] = s.squelch;
        if (s.tx_timeout_timer !== undefined) main[2] = s.tx_timeout_timer;
        if (s.noaa_auto_scan !== undefined) main[3] = s.noaa_auto_scan ? 1 : 0;

        // main[4] is packed flags
        let v4 = main[4];
        if (s.key_lock !== undefined) v4 = (v4 & ~0x01) | (s.key_lock ? 0x01 : 0);
        if (s.menu_lock !== undefined) v4 = (v4 & ~0x02) | (s.menu_lock ? 0x02 : 0);
        // set_key >> 2 & 0x0F
        // set_nav & 0x40
        main[4] = v4;

        if (s.vox_switch !== undefined) main[5] = s.vox_switch ? 1 : 0;
        if (s.vox_level !== undefined) main[6] = s.vox_level;
        if (s.mic_sensitivity !== undefined) main[7] = s.mic_sensitivity;

        const off78 = 0x08;
        // main[off78+0] packed backlight
        let vBL = main[off78 + 0];
        if (s.backlight_max !== undefined) vBL = (vBL & 0xF0) | (s.backlight_max & 0x0F);
        if (s.backlight_min !== undefined) vBL = (vBL & 0x0F) | ((s.backlight_min & 0x0F) << 4);
        main[off78 + 0] = vBL;

        if (s.channel_display_mode !== undefined) main[off78 + 1] = s.channel_display_mode;
        if (s.cross_band_rx_tx !== undefined) main[off78 + 2] = s.cross_band_rx_tx;
        if (s.battery_save !== undefined) main[off78 + 3] = s.battery_save;
        if (s.dual_watch !== undefined) main[off78 + 4] = s.dual_watch;
        if (s.backlight_time !== undefined) main[off78 + 5] = s.backlight_time;

        // main[off78+6] packed tail tone / nfm
        let vTT = main[off78 + 6];
        if (s.tail_tone_elimination !== undefined) vTT = (vTT & ~0x01) | (s.tail_tone_elimination ? 1 : 0);
        // if (s.set_nfm !== undefined) ...
        main[off78 + 6] = vTT;

        if (s.vfo_open !== undefined) main[off78 + 7] = s.vfo_open ? 1 : 0;

        const off90 = 0x20;
        // main[off90+0] packed beep / long press m
        let vBP = main[off90 + 0];
        if (s.beep_control !== undefined) vBP = (vBP & ~0x01) | (s.beep_control ? 1 : 0);
        if (s.key_m_long_press !== undefined) vBP = (vBP & 0x01) | ((s.key_m_long_press & 0x7F) << 1);
        main[off90 + 0] = vBP;

        if (s.key_1_long !== undefined) main[off90 + 2] = s.key_1_long;
        if (s.key_2_long !== undefined) main[off90 + 4] = s.key_2_long;
        if (s.scan_resume_mode !== undefined) main[off90 + 5] = s.scan_resume_mode;
        if (s.auto_keypad_lock !== undefined) main[off90 + 6] = s.auto_keypad_lock ? 1 : 0;
        if (s.power_on_display_mode !== undefined) main[off90 + 7] = s.power_on_display_mode;

        // 0EA8
        const offA8 = 0x38;
        if (s.alarm_mode !== undefined) main[offA8 + 0] = s.alarm_mode;
        if (s.roger !== undefined) main[offA8 + 1] = s.roger;
        if (s.repeater_tail !== undefined) main[offA8 + 2] = s.repeater_tail ? 1 : 0;
        if (s.tx_vfo !== undefined) main[offA8 + 3] = s.tx_vfo;
        if (s.battery_type !== undefined) main[offA8 + 4] = s.battery_type;

        // 0ED0
        const offD0 = 0x60;
        if (s.dtmf_side_tone !== undefined) main[offD0 + 0] = (main[offD0 + 0] & ~0x01) | (s.dtmf_side_tone ? 1 : 0);
        if (s.dtmf_separate_code !== undefined) main[offD0 + 1] = String(s.dtmf_separate_code).charCodeAt(0);
        if (s.dtmf_group_call_code !== undefined) main[offD0 + 2] = String(s.dtmf_group_call_code).charCodeAt(0);
        if (s.dtmf_decode_response !== undefined) main[offD0 + 3] = s.dtmf_decode_response;
        if (s.dtmf_auto_reset_time !== undefined) main[offD0 + 4] = s.dtmf_auto_reset_time;

        // 0ED8
        const offD8 = 0x68;
        if (s.permit_remote_kill !== undefined) main[offD8 + 2] = (main[offD8 + 2] & ~0x01) | (s.permit_remote_kill ? 1 : 0);

        // 0F40
        if (s.f_lock !== undefined) ext1[0] = s.f_lock;
        if (s.tx_350 !== undefined) ext1[1] = s.tx_350 ? 1 : 0;
        if (s.killed !== undefined) ext1[2] = s.killed ? 1 : 0;
        if (s.tx_200 !== undefined) ext1[3] = s.tx_200 ? 1 : 0;
        if (s.tx_500 !== undefined) ext1[4] = s.tx_500 ? 1 : 0;
        if (s.en_350 !== undefined) ext1[5] = s.en_350 ? 1 : 0;
        if (s.scramble_enable !== undefined) ext1[6] = s.scramble_enable ? 1 : 0;

        let b7_ext1 = ext1[7];
        if (s.live_dtmf_decoder !== undefined) b7_ext1 = (b7_ext1 & ~(1 << 0)) | (s.live_dtmf_decoder ? (1 << 0) : 0);
        if (s.battery_text !== undefined) b7_ext1 = (b7_ext1 & ~(7 << 1)) | ((s.battery_text & 7) << 1);
        if (s.mic_bar !== undefined) b7_ext1 = (b7_ext1 & ~(1 << 4)) | (s.mic_bar ? (1 << 4) : 0);
        if (s.am_fix !== undefined) b7_ext1 = (b7_ext1 & ~(1 << 5)) | (s.am_fix ? (1 << 5) : 0);
        if (s.backlight_tx_rx !== undefined) b7_ext1 = (b7_ext1 & ~(3 << 6)) | ((s.backlight_tx_rx & 3) << 6);
        ext1[7] = b7_ext1;

        // 1FF0
        let b5_ext2 = ext2[5];
        if (s.set_inv !== undefined) b5_ext2 = (b5_ext2 & ~(1 << 4)) | (s.set_inv ? (1 << 4) : 0);
        if (s.set_lck !== undefined) b5_ext2 = (b5_ext2 & ~(1 << 5)) | (s.set_lck ? (1 << 5) : 0);
        if (s.set_met !== undefined) b5_ext2 = (b5_ext2 & ~(1 << 6)) | (s.set_met ? (1 << 6) : 0);
        if (s.set_gui !== undefined) b5_ext2 = (b5_ext2 & ~(1 << 7)) | (s.set_gui ? (1 << 7) : 0);
        if (s.set_ctr !== undefined) b5_ext2 = (b5_ext2 & 0xF0) | (s.set_ctr & 0x0F);
        ext2[5] = b5_ext2;

        let b6_ext2 = ext2[6];
        if (s.set_tot !== undefined) b6_ext2 = (b6_ext2 & 0x0F) | ((s.set_tot & 0x0F) << 4);
        if (s.set_eot !== undefined) b6_ext2 = (b6_ext2 & 0xF0) | (s.set_eot & 0x0F);
        ext2[6] = b6_ext2;

        let b7_ext2 = ext2[7];
        if (s.set_pwr !== undefined) b7_ext2 = (b7_ext2 & 0x0F) | ((s.set_pwr & 0x0F) << 4);
        if (s.set_ptt !== undefined) b7_ext2 = (b7_ext2 & 0xF0) | (s.set_ptt & 0x0F);
        ext2[7] = b7_ext2;

        // To be safe, assign back if the buffer reference was somehow broken (though usually modify in place works)
        if (!buffers.settings) buffers.settings = main;
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
