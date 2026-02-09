/**
 * QSH Container Implementation for Squelch
 * Ported from Official Python Reference Implementation
 */



// Magic Bytes: \xe6QSH\r\n\x1a\n
export const MAGIC_BYTES = new Uint8Array([0xe6, 0x51, 0x53, 0x48, 0x0d, 0x0a, 0x1a, 0x0a]);
export const SPEC_REV = 1;

// --- TLV Tag Map ---

// Global Metadata Tags (0x01 - 0x0F)
export const TAG_G_TITLE = 0x01;
export const TAG_G_AUTHOR = 0x02;
export const TAG_G_DESC = 0x03;
export const TAG_G_DATE = 0x04;
export const TAG_G_TYPE = 0x05;
export const TAG_G_COMPRESSION = 0x06;
export const TAG_TERMINATOR = 0x00;

// Firmware Blob Tags (0x10 - 0x2F)
export const TAG_F_NAME = 0x11;
export const TAG_F_VERSION = 0x12;
export const TAG_F_DESC = 0x13;
export const TAG_F_AUTHOR = 0x14;
export const TAG_F_LICENSE = 0x15;
export const TAG_F_ARCH = 0x16;
export const TAG_F_TARGET = 0x17;
export const TAG_F_DATE = 0x18;
export const TAG_F_GIT = 0x19;
export const TAG_F_BOOT_MIN = 0x1A;
export const TAG_F_PAGE_SIZE = 0x1B;
export const TAG_F_BASE_ADDR = 0x1C;

// Resource Blob Tags (0x30 - 0x3F)
export const TAG_R_LABEL = 0x30;
export const TAG_R_TYPE = 0x31;

// Memory/Dump/Config Tags (0x40 - 0x5F)
export const TAG_D_LABEL = 0x40;
export const TAG_D_START_ADDR = 0x41;
export const TAG_D_END_ADDR = 0x42;
export const TAG_D_WRITABLE = 0x43;
export const TAG_D_CH_COUNT = 0x44;
export const TAG_D_CH_NAMES = 0x45;

// Radio Identity Tags (0x60 - 0x6F)
export const TAG_ID_FW_STR = 0x60;
export const TAG_ID_RADIO_UID = 0x61;
export const TAG_ID_LABEL = 0x62;

// Auxiliary/Extra Blob Tags (0x70 - 0x7F)
export const TAG_X_TYPE = 0x70;
export const TAG_X_LABEL = 0x71;
export const TAG_X_COMPILER = 0x72;

export const TAG_MAP: Record<number, string> = {
    [TAG_G_TITLE]: "Title", [TAG_G_AUTHOR]: "Author", [TAG_G_DESC]: "Description",
    [TAG_G_DATE]: "Date", [TAG_G_TYPE]: "Global Type", [TAG_G_COMPRESSION]: "Compression",
    [TAG_F_NAME]: "FW Name", [TAG_F_VERSION]: "FW Version", [TAG_F_DESC]: "FW Desc",
    [TAG_F_AUTHOR]: "FW Author", [TAG_F_LICENSE]: "License", [TAG_F_ARCH]: "Architecture",
    [TAG_F_TARGET]: "Target HW", [TAG_F_DATE]: "Build Date", [TAG_F_GIT]: "Git Commit",
    [TAG_F_BOOT_MIN]: "Min Bootloader", [TAG_F_PAGE_SIZE]: "Page Size", [TAG_F_BASE_ADDR]: "Flash Base Addr",
    [TAG_R_LABEL]: "Res Label", [TAG_R_TYPE]: "Res Type",
    [TAG_D_LABEL]: "Mem Label", [TAG_D_START_ADDR]: "Start Addr", [TAG_D_END_ADDR]: "End Addr",
    [TAG_D_WRITABLE]: "Writable", [TAG_D_CH_COUNT]: "Channel Count", [TAG_D_CH_NAMES]: "Channel Names",
    [TAG_ID_FW_STR]: "Source FW String", [TAG_ID_RADIO_UID]: "Radio UID", [TAG_ID_LABEL]: "Radio Label",
    [TAG_X_TYPE]: "Aux Type", [TAG_X_LABEL]: "Aux Label", [TAG_X_COMPILER]: "Compiler"
};

const UINT32_TAGS = [TAG_G_DATE, TAG_F_DATE, TAG_F_PAGE_SIZE, TAG_F_BASE_ADDR, TAG_D_START_ADDR, TAG_D_END_ADDR];
const UINT16_TAGS = [TAG_D_CH_COUNT];
const UINT64_TAGS = [TAG_ID_RADIO_UID];
const BOOL_TAGS = [TAG_D_WRITABLE];

export class QSHBlob {
    data: Uint8Array;
    metadata: Record<number, any>;

    constructor(data: Uint8Array = new Uint8Array(0), metadata: Record<number, any> = {}) {
        this.data = data;
        this.metadata = metadata;
    }

    toUint8Array(): Uint8Array {
        let tlvBlock = packTLVStream(this.metadata);
        let blobBody = new Uint8Array(tlvBlock.length + this.data.length);
        blobBody.set(tlvBlock);
        blobBody.set(this.data, tlvBlock.length);

        let result = new Uint8Array(4 + blobBody.length);
        let dv = new DataView(result.buffer);
        dv.setUint32(0, blobBody.length, true);
        result.set(blobBody, 4);
        return result;
    }
}

export class QSHFile {
    globalMeta: Record<number, any> = {};
    blobs: QSHBlob[] = [];

    setGlobal(meta: Record<number, any>) {
        this.globalMeta = { ...meta };
        if (!this.globalMeta[TAG_G_DATE]) {
            this.globalMeta[TAG_G_DATE] = Math.floor(Date.now() / 1000);
        }
    }

    addBlob(data: Uint8Array, meta: Record<number, any>) {
        this.blobs.push(new QSHBlob(data, meta));
    }

    async toUint8Array(): Promise<Uint8Array> {
        let outParts: Uint8Array[] = [];

        // 1. Header
        outParts.push(MAGIC_BYTES);
        let revBuf = new Uint8Array(2);
        new DataView(revBuf.buffer).setUint16(0, SPEC_REV, true);
        outParts.push(revBuf);

        // 2. Global TLVs
        outParts.push(packTLVStream(this.globalMeta));

        // 3. Blobs
        for (const blob of this.blobs) {
            outParts.push(blob.toUint8Array());
        }

        // Combine
        let totalLen = outParts.reduce((acc, p) => acc + p.length, 0);
        let combined = new Uint8Array(totalLen);
        let offset = 0;
        for (const p of outParts) {
            combined.set(p, offset);
            offset += p.length;
        }

        // 4. SHA-256
        const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
        const hashArray = new Uint8Array(hashBuffer);
        let final = new Uint8Array(combined.length + 32);
        final.set(combined);
        final.set(hashArray, combined.length);

        return final;
    }

    static async fromUint8Array(raw: Uint8Array): Promise<QSHFile | null> {
        if (raw.length < 42) return null;

        const body = raw.slice(0, -32);
        const fileHash = raw.slice(-32);
        const calcHashBuffer = await crypto.subtle.digest('SHA-256', body);
        const calcHash = new Uint8Array(calcHashBuffer);

        for (let i = 0; i < 32; i++) {
            if (fileHash[i] !== calcHash[i]) {
                console.error("QSH Integrity Check Failed");
                return null;
            }
        }

        if (!MAGIC_BYTES.every((b, i) => b === body[i])) return null;

        const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
        const rev = dv.getUint16(8, true);
        if (rev > SPEC_REV) {
            console.warn(`Future QSH spec version: ${rev}`);
        }

        const [gMeta, nextOffset] = parseTLVStream(body, 10);
        const container = new QSHFile();
        container.globalMeta = gMeta;

        let ptr = nextOffset;
        while (ptr < body.length) {
            if (ptr + 4 > body.length) break;
            const bSize = dv.getUint32(ptr, true);
            ptr += 4;

            if (ptr + bSize > body.length) break;
            const bContent = body.slice(ptr, ptr + bSize);
            const [bMeta, bHeadLen] = parseTLVStream(bContent, 0);
            const bData = bContent.slice(bHeadLen);

            container.blobs.push(new QSHBlob(bData, bMeta));
            ptr += bSize;
        }

        return container;
    }
}

function packTLVStream(meta: Record<number, any>): Uint8Array {
    let parts: Uint8Array[] = [];
    for (const [tag, val] of Object.entries(meta)) {
        parts.push(packTLV(Number(tag), val));
    }
    parts.push(packTLV(TAG_TERMINATOR, new Uint8Array(0)));

    let totalLen = parts.reduce((acc, p) => acc + p.length, 0);
    let combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
        combined.set(p, offset);
        offset += p.length;
    }
    return combined;
}

function packTLV(tag: number, value: any): Uint8Array {
    let payload: Uint8Array;

    if (UINT32_TAGS.includes(tag)) {
        payload = new Uint8Array(4);
        new DataView(payload.buffer).setUint32(0, Number(value), true);
    } else if (UINT16_TAGS.includes(tag)) {
        payload = new Uint8Array(2);
        new DataView(payload.buffer).setUint16(0, Number(value), true);
    } else if (UINT64_TAGS.includes(tag)) {
        payload = new Uint8Array(8);
        try {
            new DataView(payload.buffer).setBigUint64(0, BigInt(value), true);
        } catch (e) {
            console.error(`Failed to pack UINT64 tag ${tag}:`, e);
            payload = new Uint8Array(0);
        }
    } else if (BOOL_TAGS.includes(tag)) {
        payload = new Uint8Array([value ? 1 : 0]);
    } else if (typeof value === 'string') {
        payload = new TextEncoder().encode(value);
    } else if (value instanceof Uint8Array) {
        payload = value;
    } else {
        payload = new Uint8Array(0);
    }

    let result = new Uint8Array(4 + payload.length);
    let dv = new DataView(result.buffer);
    dv.setUint16(0, tag, true);
    dv.setUint16(2, payload.length, true);
    result.set(payload, 4);
    return result;
}

function parseTLVStream(data: Uint8Array, startOffset: number): [Record<number, any>, number] {
    let attributes: Record<number, any> = {};
    let ptr = startOffset;
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

    while (ptr < data.length) {
        if (ptr + 4 > data.length) break;

        const tag = dv.getUint16(ptr, true);
        const length = dv.getUint16(ptr + 2, true);
        ptr += 4;

        if (tag === TAG_TERMINATOR) break;

        if (ptr + length > data.length) break;

        const rawVal = data.slice(ptr, ptr + length);
        ptr += length;

        let val: any = rawVal;
        if (UINT32_TAGS.includes(tag)) {
            if (rawVal.length === 4) val = new DataView(rawVal.buffer, rawVal.byteOffset).getUint32(0, true);
        } else if (UINT16_TAGS.includes(tag)) {
            if (rawVal.length === 2) val = new DataView(rawVal.buffer, rawVal.byteOffset).getUint16(0, true);
        } else if (UINT64_TAGS.includes(tag)) {
            if (rawVal.length === 8) val = new DataView(rawVal.buffer, rawVal.byteOffset).getBigUint64(0, true);
        } else if (BOOL_TAGS.includes(tag)) {
            val = rawVal[0] !== 0;
        } else {
            try {
                val = new TextDecoder().decode(rawVal);
                // Basic check if it's really ASCII/UTF-8
                if (val.includes('\uFFFD')) val = rawVal;
            } catch {
                val = rawVal;
            }
        }
        attributes[tag] = val;
    }

    return [attributes, ptr];
}
