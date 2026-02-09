export interface ParsedFirmware {
    type: 'bin' | 'hex' | 'qshfw';
    data: Uint8Array;
    metadata?: FirmwareMetadata;
}

export interface FirmwareMetadata {
    name?: string;
    version?: string;
    author?: string;
    description?: string;
    changelog?: string;
}

export async function parseFirmwareFile(file: File): Promise<ParsedFirmware> {
    const filename = file.name.toLowerCase();

    if (filename.endsWith('.qshfw')) {
        return parseQshfw(file);
    } else if (filename.endsWith('.hex')) {
        return parseHex(file);
    } else {
        // Treat as bin
        return parseBin(file);
    }
}

async function parseBin(file: File): Promise<ParsedFirmware> {
    const buffer = await file.arrayBuffer();
    return {
        type: 'bin',
        data: new Uint8Array(buffer),
        metadata: {
            name: file.name
        }
    };
}

async function parseHex(file: File): Promise<ParsedFirmware> {
    const text = await file.text();
    const data = parseIntelHex(text);
    return {
        type: 'hex',
        data: data,
        metadata: {
            name: file.name,
            description: "Converted from Intel HEX"
        }
    };
}

async function parseQshfw(file: File): Promise<ParsedFirmware> {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const magic = new TextDecoder().decode(buffer.slice(0, 5));

    if (magic !== 'qshfw') {
        // Fallback for JSON-based QSHFW (legacy/dev)
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            if (json.payload && json.metadata) {
                const binaryString = atob(json.payload);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return {
                    type: 'qshfw',
                    data: bytes,
                    metadata: json.metadata
                };
            }
        } catch (e) {
            // Not JSON
        }
        throw new Error("Invalid QSHFW file: Bad Magic");
    }

    // Binary QSHFW Parsing based on qshfw_packer.py
    // Header (64 bytes)
    // 0: MAGIC (8)
    // 8: VERSION (4)
    // 12: ADDR (4)
    // 16: P_SIZE (4)
    // 20: M_SIZE (4)
    // 24: FLAGS (4)
    // 28: HASH (32)
    // 60: CRC (4)

    const pSize = view.getUint32(16, true); // Little endian
    const mSize = view.getUint32(20, true);

    const payloadOffset = 64;
    const metaOffset = 64 + pSize;

    if (buffer.byteLength < metaOffset + mSize) {
        throw new Error("Invalid QSHFW file: Unexpected EOF");
    }

    const payload = new Uint8Array(buffer.slice(payloadOffset, payloadOffset + pSize));
    const metaBuffer = buffer.slice(metaOffset, metaOffset + mSize);
    const metaView = new DataView(metaBuffer);

    // Parse TLVs
    const metadata: FirmwareMetadata = {};
    let offset = 0;

    // TAGS reference for future use:
    // 0x0001: type, 0x0002: algo, 0x0003: version, 0x0004: target
    // 0x0005: author, 0x0006: arch, 0x0007: license, 0x0008: date
    // 0x0009: description, 0x000A: elf, 0x000B: map, 0x000C: name
    // 0x0010: git, 0x00FF: signature

    while (offset < mSize) {
        if (offset + 6 > mSize) break;
        const tag = metaView.getUint16(offset, true);
        const len = metaView.getUint32(offset + 2, true);
        offset += 6;

        if (offset + len > mSize) break;

        const valBuffer = metaBuffer.slice(offset, offset + len);
        const decoder = new TextDecoder();

        switch (tag) {
            case 0x0003: metadata.version = decoder.decode(valBuffer).replace(/\0/g, ''); break;
            case 0x0005: metadata.author = decoder.decode(valBuffer).replace(/\0/g, ''); break;
            case 0x0009: metadata.description = decoder.decode(valBuffer).replace(/\0/g, ''); break;
            case 0x000C: metadata.name = decoder.decode(valBuffer).replace(/\0/g, ''); break;
            case 0x0010: metadata.changelog = decoder.decode(valBuffer).replace(/\0/g, ''); break; // Git hash as changelog for now
            // Add other tags as needed
        }

        offset += len;
    }

    return {
        type: 'qshfw',
        data: payload,
        metadata
    };
}

function parseIntelHex(hex: string): Uint8Array {
    // Basic Intel HEX parser
    // We assume the firmware starts at address 0x0000 or 0x08000000
    // We will normalize to 0x0000 for the output buffer.

    // First pass: Calculate min/max address and total size
    let minAddr = Infinity;
    let maxAddr = 0;

    // We'll parse into a temporary map first to avoid allocating 128MB+ buffers
    const chunks: { addr: number, data: Uint8Array }[] = [];
    let upperAddress = 0;

    const lines = hex.split(/\r?\n/);
    for (const line of lines) {
        if (!line.startsWith(':')) continue;
        const len = parseInt(line.substring(1, 3), 16);
        const addr = parseInt(line.substring(3, 7), 16);
        const type = parseInt(line.substring(7, 9), 16);
        const dataStr = line.substring(9, 9 + len * 2);

        if (type === 0x00) { // Data
            const absoluteAddr = upperAddress + addr;
            if (absoluteAddr < minAddr) minAddr = absoluteAddr;
            if (absoluteAddr + len > maxAddr) maxAddr = absoluteAddr + len;

            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = parseInt(dataStr.substring(i * 2, i * 2 + 2), 16);
            }
            chunks.push({ addr: absoluteAddr, data: bytes });
        } else if (type === 0x01) { // End of File
            break;
        } else if (type === 0x02) { // Extended Segment Address
            upperAddress = parseInt(dataStr, 16) * 16;
        } else if (type === 0x04) { // Extended Linear Address
            upperAddress = parseInt(dataStr, 16) * 65536;
        }
    }

    if (chunks.length === 0) return new Uint8Array(0);

    // Normalize base address
    // Common bases: 0x00000000, 0x08000000
    let baseOffset = 0;
    if (minAddr >= 0x08000000) {
        baseOffset = 0x08000000;
    }

    // Allocate final buffer
    // Typical firmware is < 64KB
    const totalSize = maxAddr - baseOffset;
    const buffer = new Uint8Array(totalSize);

    // Fill buffer
    for (const chunk of chunks) {
        const offset = chunk.addr - baseOffset;
        if (offset >= 0 && offset + chunk.data.length <= buffer.length) {
            buffer.set(chunk.data, offset);
        }
    }

    return buffer;
}
