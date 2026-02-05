
import {
    BAUDRATE,
    OBFUS_TBL,
    PROTOCOL
} from "./protocol";

const {
    MSG: {
        DEV_INFO_REQ: MSG_DEV_INFO_REQ,
        DEV_INFO_RESP: MSG_DEV_INFO_RESP,
        NOTIFY_DEV_INFO: MSG_NOTIFY_DEV_INFO,
        NOTIFY_BL_VER: MSG_NOTIFY_BL_VER,
        PROG_FW: MSG_PROG_FW,
        PROG_FW_RESP: MSG_PROG_FW_RESP,
        READ_EEPROM: MSG_READ_EEPROM,
        READ_EEPROM_RESP: MSG_READ_EEPROM_RESP,
        WRITE_EEPROM: MSG_WRITE_EEPROM,
        WRITE_EEPROM_RESP: MSG_WRITE_EEPROM_RESP,
        REBOOT: MSG_REBOOT,
        READ_RSSI: MSG_RSSI_REQ,
        READ_RSSI_RESP: MSG_RSSI_RESP,
        READ_BATTERY: MSG_BATT_REQ,
        READ_BATTERY_RESP: MSG_BATT_RESP
    },
    CALIB: {
        SIZE: CALIB_SIZE,
        CHUNK_SIZE: CHUNK_SIZE,
        OFFSET_NEW: DEFAULT_CALIB_OFFSET
    }
} = PROTOCOL;

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

export class ProtocolHandler {
    private port: any = null;
    private reader: ReadableStreamDefaultReader | null = null;
    private writer: WritableStreamDefaultWriter | null = null;
    private isConnected = false;
    private readBuffer: number[] = [];

    // Callbacks
    public onLog: ((msg: string, type: 'info' | 'error' | 'success' | 'tx' | 'rx') => void) | null = null;
    public onProgress: ((percent: number) => void) | null = null;
    public onStatusChange: ((connected: boolean, error?: string) => void) | null = null;

    private log(msg: string, type: 'info' | 'error' | 'success' | 'tx' | 'rx' = 'info') {
        if (this.onLog) this.onLog(msg, type);
        else console.log(`[${type.toUpperCase()}] ${msg}`);
    }

    public async connect(existingPort?: any) {
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
                // throw new Error("Port locked. Retry.");
                // Sometimes it's locked by us from previous session?
            }

            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();
            this.isConnected = true;
            this.readBuffer = [];

            this.readLoop();

            return true;
        } catch (e: any) {
            this.log(`Connection failed: ${e.message}`, 'error');
            return false;
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
        this.reader = null;
        this.writer = null;
        if (closePort) this.log("Disconnected", 'info');
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
                if (value) {
                    for (let i = 0; i < value.length; i++) {
                        this.readBuffer.push(value[i]);
                    }
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

    // --- Low Level Packet Logic ---

    private calcCRC(buf: Uint8Array, off: number, size: number) {
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

    private makePacket(msgType: number, data: Uint8Array) {
        const msgLen = data.length;
        const paddedLen = msgLen + (msgLen % 2);

        const innerLen = 4 + paddedLen;
        const innerMsg = new Uint8Array(innerLen);
        const view = new DataView(innerMsg.buffer);
        view.setUint16(0, msgType, true);
        view.setUint16(2, innerLen, true);
        innerMsg.set(data, 4);

        const packetLen = 8 + innerLen;
        const packet = new Uint8Array(packetLen);
        const pView = new DataView(packet.buffer);

        pView.setUint16(0, 0xCDAB, true);
        pView.setUint16(2, innerLen, true);
        pView.setUint16(6 + innerLen, 0xBADC, true);

        packet.set(innerMsg, 4);

        const crc = this.calcCRC(packet, 4, innerLen);
        pView.setUint16(4 + innerLen, crc, true);

        this.obfuscate(packet, 4, 2 + innerLen);

        return packet;
    }

    // Robust sliding window fetch with CRC validation
    private fetchMessage() {
        const buf = this.readBuffer;
        let searchIndex = 0;

        while (searchIndex < buf.length - 1) {
            // 1. Find Header 0xAB 0xCD (Little Endian for 0xCDAB)
            if (buf[searchIndex] !== 0xAB || buf[searchIndex + 1] !== 0xCD) {
                searchIndex++;
                continue;
            }

            // 2. Check minimal length (Header(2) + Len(2) + CRC(2) + Footer(2) = 8)
            if (buf.length - searchIndex < 8) return null;

            // 3. Parse Packet Length (This is `innerLen` from makePacket)
            const innerLen = buf[searchIndex + 2] | (buf[searchIndex + 3] << 8);

            // 4. Check total expected length
            const packetLen = 8 + innerLen;
            if (buf.length - searchIndex < packetLen) return null; // Wait for more data

            // 5. Check Footer 0xDC 0xBA (Little Endian for 0xBADC)
            const footerIdx = searchIndex + packetLen - 2;
            if (buf[footerIdx] !== 0xDC || buf[footerIdx + 1] !== 0xBA) {
                // Footer mismatch - likely false positive header
                searchIndex++;
                continue;
            }

            // 6. Extract Encrypted Body + CRC
            // Body starts at offset 4. Size is `innerLen`. 
            // CRC is 2 bytes immediately following Body.
            // So we extract `innerLen + 2` bytes.
            const payloadSize = innerLen + 2;
            const msgBuf = new Uint8Array(payloadSize);
            for (let i = 0; i < payloadSize; i++) {
                msgBuf[i] = buf[searchIndex + 4 + i];
            }

            // 7. Deobfuscate (XOR)
            // This reveals the cleartext Body and CRC
            this.obfuscate(msgBuf, 0, payloadSize);

            // 8. Verify CRC
            // CRC is calculated over the cleartext Body (msgBuf[0...innerLen])
            // Received CRC is at the end (msgBuf[innerLen...])
            const calculatedCRC = this.calcCRC(msgBuf, 0, innerLen);
            const receivedCRC = msgBuf[innerLen] | (msgBuf[innerLen + 1] << 8);

            if (calculatedCRC !== receivedCRC) {
                // Bad packet, CRC failed. Skip this header.
                searchIndex++;
                continue;
            }

            // 9. Packet Valid! Remove from buffer
            this.readBuffer.splice(0, searchIndex + packetLen);

            // 10. Extract Data
            const view = new DataView(msgBuf.buffer);
            const msgType = view.getUint16(0, true);

            const data = msgBuf.slice(4, innerLen);

            return { msgType, data };
        }

        // Cleanup: If buffer gets too huge with no valid packets, trim it to prevent memory leak
        if (buf.length > 4096) {
            this.readBuffer.splice(0, buf.length - 1024);
        }

        return null;
    }

    private logPacketDetail(msgType: number, data: Uint8Array) {
        let desc = `CMD: 0x${msgType.toString(16).toUpperCase().padStart(4, '0')}`;
        const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

        try {
            if (msgType === MSG_WRITE_EEPROM && data.length >= 4) {
                const offset = dv.getUint16(0, true);
                const size = dv.getUint16(2, true);
                desc += ` [WriteEEPROM] Addr: 0x${offset.toString(16).toUpperCase().padStart(4, '0')} Size: ${size}`;
            } else if (msgType === MSG_READ_EEPROM && data.length >= 4) {
                const offset = dv.getUint16(0, true);
                const size = dv.getUint16(2, true);
                desc += ` [ReadEEPROM] Addr: 0x${offset.toString(16).toUpperCase().padStart(4, '0')} Size: ${size}`;
            } else if (msgType === MSG_PROG_FW && data.length >= 8) {
                const page = dv.getUint16(4, true);
                const total = dv.getUint16(6, true);
                desc += ` [ProgFW] Page: ${page + 1}/${total}`;
            } else if (msgType === MSG_NOTIFY_BL_VER) {
                desc += ` [NotifyBLVer] Handshake`;
            } else if (msgType === MSG_DEV_INFO_REQ) {
                desc += ` [DevInfoReq]`;
            } else if (msgType === MSG_REBOOT) {
                desc += ` [Reboot]`;
            }
        } catch (e) {
            // ignore decoding errors
        }

        this.log(desc, 'tx');
    }

    private async sendMessage(msgType: number, data: Uint8Array) {
        if (!this.writer) throw new Error("Not connected");

        this.logPacketDetail(msgType, data);

        const packet = this.makePacket(msgType, data);
        await this.writer.write(packet);
    }

    public async sendRaw(data: Uint8Array) {
        if (!this.writer) throw new Error("Not connected");
        this.log(`RAW TX: ${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}`, 'tx');
        await this.writer.write(data);
    }

    private async waitForMessage(expectedType: number, timeoutMs = 2000): Promise<any> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const msg = this.fetchMessage();
            if (msg) {
                // Log RX
                if (msg.msgType !== MSG_NOTIFY_DEV_INFO) { // Don't spam notify
                    this.log(`RESP: 0x${msg.msgType.toString(16).toUpperCase().padStart(4, '0')}`, 'rx');
                }

                if (msg.msgType === expectedType) return msg;
                if (msg.msgType === MSG_NOTIFY_DEV_INFO) continue; // Ignore notify if waiting for something else
            }
            await new Promise(r => setTimeout(r, 10));
        }
        throw new Error(`Timeout waiting for 0x${expectedType.toString(16)}`);
    }

    // Waits for ANY periodic notify info (used in bootloader detection)
    private async waitForNotifyInfo(timeoutMs = 5000): Promise<any> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const msg = this.fetchMessage();
            if (msg && msg.msgType === MSG_NOTIFY_DEV_INFO) {
                return msg;
            }
            await new Promise(r => setTimeout(r, 10));
        }
        throw new Error("Device not detected (timeout)");
    }

    private sleep(ms: number) {
        return new Promise(r => setTimeout(r, ms));
    }

    public async getDeviceInfo(): Promise<DeviceInfo> {
        this.readBuffer = [];
        const ts = Date.now() & 0xffffffff;
        const data = new Uint8Array(4);
        new DataView(data.buffer).setUint32(0, ts, true);

        await this.sendMessage(MSG_DEV_INFO_REQ, data);
        const resp = await this.waitForMessage(MSG_DEV_INFO_RESP, 3000);

        let str = "";
        for (let i = 0; i < resp.data.length; i++) {
            const c = resp.data[i];
            if (c === 0 || c === 0xFF) break;
            if (c >= 32 && c < 127) str += String.fromCharCode(c);
        }

        return { uid: "", blVersion: str, timestamp: ts };
    }

    // Improved device identification matching strict K5 protocol
    public async identifyDevice(timeoutMs = 5000): Promise<DeviceInfo> {
        this.readBuffer = []; // Clear buffer at start
        const ts = Date.now() & 0xffffffff;

        const data = new Uint8Array(4);
        new DataView(data.buffer).setUint32(0, ts, true);

        // Send request once
        await this.sendMessage(MSG_DEV_INFO_REQ, data);

        // Loop to wait for response, handling bootloader beacons that might interleave
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            // Poll message from buffer
            const msg = this.fetchMessage();

            if (msg) {
                if (msg.msgType === MSG_DEV_INFO_RESP) {
                    // Normal firmware
                    let str = "";
                    for (let i = 0; i < msg.data.length; i++) {
                        const c = msg.data[i];
                        if (c === 0 || c === 0xFF) break;
                        if (c >= 32 && c < 127) str += String.fromCharCode(c);
                    }
                    return { uid: "", blVersion: str, timestamp: ts };
                } else if (msg.msgType === MSG_NOTIFY_DEV_INFO) {
                    // Bootloader mode (detected unsolicited or as response)
                    const raw = msg.data;
                    let blVersion = "Bootloader";
                    if (raw.length >= 32) {
                        let str = "";
                        for (let i = 16; i < 32; i++) {
                            if (raw[i] === 0) break;
                            str += String.fromCharCode(raw[i]);
                        }
                        if (str && str.match(/^\d/)) blVersion = `Bootloader ${str}`;
                    }
                    return { uid: "", blVersion: blVersion, timestamp: ts };
                }
            }
            await this.sleep(10);
        }
        throw new Error("Device identification timed out");
    }

    public async getRadioStats(): Promise<RadioStats> {
        const stats: RadioStats = {};
        try {
            this.readBuffer = [];
            await this.sendMessage(MSG_RSSI_REQ, new Uint8Array(0));
            const rssiMsg = await this.waitForMessage(MSG_RSSI_RESP, 500);
            const rssiView = new DataView(rssiMsg.data.buffer);
            stats.rssi = rssiView.getUint16(0, true) & 0x01FF;
            stats.noise = rssiView.getUint8(2);
            stats.glitch = rssiView.getUint8(3);
        } catch (e) { /* Ignore */ }

        try {
            this.readBuffer = [];
            await this.sendMessage(MSG_BATT_REQ, new Uint8Array(0));
            const battMsg = await this.waitForMessage(MSG_BATT_RESP, 500);
            const battView = new DataView(battMsg.data.buffer);
            stats.voltage = battView.getUint16(0, true);
            stats.current = battView.getUint16(2, true);
        } catch (e) { /* Ignore */ }

        return stats;
    }

    public async backupEEPROM(offset?: number, size = CALIB_SIZE): Promise<Uint8Array> {
        let devInfo: DeviceInfo;
        try {
            devInfo = await this.getDeviceInfo();
        } catch {
            devInfo = { uid: '', blVersion: '', timestamp: Date.now() & 0xffffffff };
        }

        let currentOffset = offset;
        if (currentOffset === undefined) {
            // Auto-detect based on version
            // Example: "F4HWN v4.3.3" -> 4.3.3
            const versionMatch = devInfo.blVersion.match(/v(\d+\.\d+\.\d+)/);
            if (versionMatch) {
                const major = parseInt(versionMatch[1].split('.')[0], 10);
                currentOffset = (major >= 5) ? PROTOCOL.CALIB.OFFSET_NEW : PROTOCOL.CALIB.OFFSET_LEGACY;
                this.log(`Detected Firmware v${major}: Using offset 0x${currentOffset.toString(16)}`, 'info');
            } else {
                // Fallback to legacy
                currentOffset = PROTOCOL.CALIB.OFFSET_LEGACY;
                this.log(`Version not detected, defaulting to offset 0x${currentOffset.toString(16)}`, 'info');
            }
        }

        const result = new Uint8Array(size);

        this.log(`Reading EEPROM: 0x${currentOffset.toString(16)} (${size} bytes)`, 'info');

        for (let i = 0; i < size; i += CHUNK_SIZE) {
            if (this.onProgress) this.onProgress((i / size) * 100);

            const req = new Uint8Array(8);
            const view = new DataView(req.buffer);
            view.setUint16(0, currentOffset, true);
            view.setUint16(2, CHUNK_SIZE, true);
            view.setUint32(4, devInfo.timestamp || 0, true);

            await this.sendMessage(MSG_READ_EEPROM, req);

            let gotIt = false;
            let attempts = 0;
            while (!gotIt && attempts < 5) {
                try {
                    const resp = await this.waitForMessage(MSG_READ_EEPROM_RESP, 500);
                    const rView = new DataView(resp.data.buffer);
                    if (rView.getUint16(0, true) === currentOffset) {
                        for (let j = 0; j < CHUNK_SIZE; j++) {
                            result[i + j] = resp.data[4 + j];
                        }
                        gotIt = true;
                    }
                } catch (e) {
                    attempts++;
                }
            }

            if (!gotIt) throw new Error(`Failed to read at 0x${currentOffset.toString(16)}`);
            currentOffset += CHUNK_SIZE;
        }

        if (this.onProgress) this.onProgress(100);
        this.log("Read complete", 'success');
        return result;
    }

    public async writeEEPROM(data: Uint8Array, offset = DEFAULT_CALIB_OFFSET) {
        const size = data.length;
        let devInfo: DeviceInfo;
        try {
            devInfo = await this.getDeviceInfo();
        } catch {
            devInfo = { uid: '', blVersion: '', timestamp: Date.now() & 0xffffffff };
        }

        this.log(`Writing EEPROM: 0x${offset.toString(16)} (${size} bytes)`, 'info');

        let currentOffset = offset;

        for (let i = 0; i < size; i += CHUNK_SIZE) {
            if (this.onProgress) this.onProgress((i / size) * 100);

            const p = new Uint8Array(20);
            const v = new DataView(p.buffer);
            v.setUint16(0, currentOffset, true);
            v.setUint16(2, CHUNK_SIZE, true);
            p[3] = 1;
            v.setUint32(4, devInfo.timestamp || 0, true);

            for (let j = 0; j < CHUNK_SIZE; j++) {
                if (i + j < size) {
                    p[8 + j] = data[i + j];
                }
            }

            await this.sendMessage(MSG_WRITE_EEPROM, p);
            await this.waitForMessage(MSG_WRITE_EEPROM_RESP, 500);
            currentOffset += CHUNK_SIZE;
        }

        this.log("Write complete. Rebooting...", 'success');
        if (this.onProgress) this.onProgress(100);
        await this.sendMessage(MSG_REBOOT, new Uint8Array(0));
    }

    public async restoreEEPROM(calibData: Uint8Array) {
        return this.writeEEPROM(calibData, DEFAULT_CALIB_OFFSET);
    }

    public async flashFirmware(firmware: Uint8Array) {
        this.log("Starting Firmware Flash...", 'info');

        this.readBuffer = [];
        let blVersion = '';

        try {
            this.log("Waiting for bootloader...", 'info');
            const msg = await this.waitForNotifyInfo(10000);

            const raw = msg.data;
            if (raw.length >= 20) {
                let str = "";
                for (let i = 16; i < raw.length; i++) {
                    if (raw[i] === 0) break;
                    str += String.fromCharCode(raw[i]);
                }
                blVersion = str;
            }
            this.log(`Device found: ${blVersion}`, 'success');
        } catch (e) {
            throw new Error("Device not responding. Ensure it is in BOOTLOADER mode (PTT + ON).");
        }

        const blVerPrefix = blVersion.substring(0, 4);
        const blMsg = new Uint8Array(4);
        for (let i = 0; i < Math.min(4, blVerPrefix.length); i++) blMsg[i] = blVerPrefix.charCodeAt(i);

        this.log("Handshaking...", 'info');
        await this.sendMessage(MSG_NOTIFY_BL_VER, blMsg);
        await this.sleep(200);

        const pageCount = Math.ceil(firmware.length / 256);
        const timestamp = Date.now() & 0xffffffff;

        for (let page = 0; page < pageCount; page++) {
            if (this.onProgress) this.onProgress((page / pageCount) * 100);

            const offset = page * 256;
            const len = Math.min(256, firmware.length - offset);

            const payload = new Uint8Array(268);
            const view = new DataView(payload.buffer);
            view.setUint32(0, timestamp, true);
            view.setUint16(4, page, true);
            view.setUint16(6, pageCount, true);

            for (let i = 0; i < len; i++) {
                payload[12 + i] = firmware[offset + i];
            }

            await this.sendMessage(MSG_PROG_FW, payload);

            let acked = false;
            let retries = 0;
            while (!acked && retries < 10) {
                try {
                    const resp = await this.waitForMessage(MSG_PROG_FW_RESP, 500);
                    const rView = new DataView(resp.data.buffer);
                    const rPage = rView.getUint16(4, true);
                    const rErr = rView.getUint16(6, true);

                    if (rPage === page && rErr === 0) {
                        acked = true;
                    } else if (rErr !== 0) {
                        throw new Error(`Flash Error: ${rErr}`);
                    }
                } catch (e) {
                    retries++;
                    await this.sleep(10);
                }
            }
            if (!acked) throw new Error(`Timeout page ${page}`);
        }

        if (this.onProgress) this.onProgress(100);
        this.log("Flashing Complete!", 'success');
    }
}

export const protocolHandler = new ProtocolHandler();
