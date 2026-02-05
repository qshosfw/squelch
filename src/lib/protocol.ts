// K5/K6/K1 Protocol Implementation
// Based on user provided flash.js (UV-K5 Web Flasher)

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface ParsedPacket {
    msgType: number;
    data: Uint8Array;
    rawData: Uint8Array;
    content?: Uint8Array; // Alias for backward compatibility
}

export const BAUDRATE = 38400;

export const PROTOCOL = {
    // Message types
    MSG: {
        NOTIFY_DEV_INFO: 0x0518,
        NOTIFY_BL_VER: 0x0530,
        PROG_FW: 0x0519,
        PROG_FW_RESP: 0x051A,
        DEV_INFO_REQ: 0x0514,
        DEV_INFO_RESP: 0x0515,
        READ_EEPROM: 0x051B,
        READ_EEPROM_RESP: 0x051C,
        WRITE_EEPROM: 0x051D,
        WRITE_EEPROM_RESP: 0x051E,
        REBOOT: 0x05DD,

        // Extended
        READ_RSSI: 0x0527,
        READ_RSSI_RESP: 0x0528,
        READ_BATTERY: 0x0529,
        READ_BATTERY_RESP: 0x052A,
        SESSION_INIT: 0x052F
    },
    // Calibration memory layout
    CALIB: {
        SIZE: 512, // bytes
        CHUNK_SIZE: 16,
        OFFSET_LEGACY: 0x1E00, // < v5.0.0
        OFFSET_NEW: 0xB000     // >= v5.0.0
    },
    // Aliases
    HEADER: 0xCDAB,
    FOOTER: 0xBADC
} as const;

// XOR obfuscation table
export const OBFUS_TBL = new Uint8Array([
    0x16, 0x6c, 0x14, 0xe6, 0x2e, 0x91, 0x0d, 0x40,
    0x21, 0x35, 0xd5, 0x40, 0x13, 0x03, 0xe9, 0x80
]);

export function createMessage(msgType: number, dataLen: number): Uint8Array {
    const msg = new Uint8Array(4 + dataLen);
    const view = new DataView(msg.buffer);
    view.setUint16(0, msgType, true);
    view.setUint16(2, dataLen, true);
    return msg;
}

export function makePacket(msg: Uint8Array): Uint8Array;
export function makePacket(msgType: number, payload: Uint8Array): Uint8Array;
export function makePacket(arg1: Uint8Array | number, arg2?: Uint8Array): Uint8Array {
    let msg: Uint8Array;

    if (arg1 instanceof Uint8Array) {
        msg = arg1;
    } else {
        const type = arg1 as number;
        const payload = arg2 || new Uint8Array(0);
        msg = new Uint8Array(4 + payload.length);
        const v = new DataView(msg.buffer);
        v.setUint16(0, type, true);
        v.setUint16(2, payload.length, true);
        msg.set(payload, 4);
    }

    let msgLen = msg.length;
    // flash.js: if (msgLen % 2 !== 0) msgLen++;
    if (msgLen % 2 !== 0) msgLen++;

    const buf = new Uint8Array(8 + msgLen);
    const view = new DataView(buf.buffer);

    view.setUint16(0, 0xCDAB, true);
    view.setUint16(2, msgLen, true);
    view.setUint16(6 + msgLen, 0xBADC, true);

    for (let i = 0; i < msg.length; i++) buf[4 + i] = msg[i];

    const crc = calcCRC(buf, 4, msgLen);
    view.setUint16(4 + msgLen, crc, true);

    obfuscate(buf, 4, 2 + msgLen);
    return buf;
}

export function tryParsePacket(buffer: number[]): ParsedPacket | null {
    if (buffer.length < 8) return null;

    let packBegin = -1;
    for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i] === 0xab && buffer[i + 1] === 0xcd) {
            packBegin = i;
            break;
        }
    }

    if (packBegin === -1) {
        if (buffer.length > 0 && buffer[buffer.length - 1] === 0xab) {
            buffer.splice(0, buffer.length - 1);
        } else {
            buffer.length = 0;
        }
        return null;
    }

    if (buffer.length - packBegin < 8) return null;

    const msgLen = (buffer[packBegin + 3] << 8) | buffer[packBegin + 2];
    const packEnd = packBegin + 6 + msgLen;

    if (buffer.length < packEnd + 2) return null;

    if (buffer[packEnd] !== 0xdc || buffer[packEnd + 1] !== 0xba) {
        buffer.splice(0, packBegin + 2);
        return null;
    }

    const msgBuf = new Uint8Array(msgLen + 2);
    for (let i = 0; i < msgLen + 2; i++) {
        msgBuf[i] = buffer[packBegin + 4 + i];
    }

    obfuscate(msgBuf, 0, msgLen + 2);

    const view = new DataView(msgBuf.buffer);
    const msgType = view.getUint16(0, true);
    const data = msgBuf.slice(4, msgLen); // Payload only

    buffer.splice(0, packEnd + 2);

    return {
        msgType,
        data,
        rawData: msgBuf,
        content: msgBuf // Compat
    };
}

function obfuscate(buf: Uint8Array, off: number, size: number) {
    for (let i = 0; i < size; i++) {
        buf[off + i] ^= OBFUS_TBL[i % OBFUS_TBL.length];
    }
}

function calcCRC(buf: Uint8Array, off: number, size: number): number {
    let CRC = 0;
    for (let i = 0; i < size; i++) {
        const b = buf[off + i] & 0xff;
        CRC ^= b << 8;
        for (let j = 0; j < 8; j++) {
            if (CRC & 0x8000) CRC = ((CRC << 1) ^ 0x1021) & 0xffff;
            else CRC = (CRC << 1) & 0xffff;
        }
    }
    return CRC;
}
