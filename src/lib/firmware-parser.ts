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
    const text = await file.text();
    try {
        const json = JSON.parse(text);
        if (!json.payload || !json.metadata) {
            throw new Error("Invalid .qshfw file: missing payload or metadata");
        }

        // Decode base64 payload
        const binaryString = atob(json.payload);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return {
            type: 'qshfw',
            data: bytes,
            metadata: {
                name: json.metadata.name,
                version: json.metadata.version,
                author: json.metadata.author,
                description: json.metadata.description,
                changelog: json.metadata.changelog
            }
        };
    } catch (e: any) {
        throw new Error("Failed to parse .qshfw: " + e.message);
    }
}

function parseIntelHex(hex: string): Uint8Array {
    // Basic Intel HEX parser
    // We assume the firmware starts at address 0x0000 and is contiguous for simplicity appropriately sized
    // A full parser would handle offsets and gaps. UV-K5 FW is usually simple.

    // Allocate enough space (e.g. 64KB for K5)
    // We'll dynamic resize if needed but typical FW is < 64KB
    let buffer = new Uint8Array(65536);
    let maxAddr = 0;

    const lines = hex.split(/\r?\n/);
    let upperAddress = 0;

    for (const line of lines) {
        if (!line.startsWith(':')) continue;
        const len = parseInt(line.substring(1, 3), 16);
        const addr = parseInt(line.substring(3, 7), 16);
        const type = parseInt(line.substring(7, 9), 16);
        const dataStr = line.substring(9, 9 + len * 2);

        if (type === 0x00) { // Data
            const absoluteAddr = upperAddress + addr;
            if (absoluteAddr + len > buffer.length) {
                // Resize if needed
                const newBuf = new Uint8Array(absoluteAddr + len + 4096);
                newBuf.set(buffer);
                buffer = newBuf;
            }
            for (let i = 0; i < len; i++) {
                buffer[absoluteAddr + i] = parseInt(dataStr.substring(i * 2, i * 2 + 2), 16);
            }
            if (absoluteAddr + len > maxAddr) maxAddr = absoluteAddr + len;
        } else if (type === 0x01) { // End of File
            break;
        } else if (type === 0x02) { // Extended Segment Address
            upperAddress = parseInt(dataStr, 16) * 16;
        } else if (type === 0x04) { // Extended Linear Address
            upperAddress = parseInt(dataStr, 16) * 65536;
        }
    }

    // Return the used portion
    return buffer.slice(0, maxAddr);
}
