import { QSHFile } from "./qsh";
import { parseIntelHex } from "./intel-hex";

export type FileType = "firmware" | "calibration" | "qsh" | "csv" | "json" | "unknown";


export interface ProcessedFile {
    file: File;
    type: FileType;
    name: string;
    data: Uint8Array;
    qsh?: QSHFile;
}

export async function processFile(file: File): Promise<ProcessedFile> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const name = file.name.toLowerCase();

    // Check for QSH first (Magic Bytes)
    if (bytes.length >= 8 && bytes[0] === 0xe6 && bytes[1] === 0x51 && bytes[2] === 0x53 && bytes[3] === 0x48) {
        const qsh = await QSHFile.fromUint8Array(bytes);
        if (qsh) {
            return {
                file,
                type: "qsh",
                name: file.name,
                data: bytes,
                qsh
            };
        }
    }

    if (name.endsWith(".qsh")) {
        const qsh = await QSHFile.fromUint8Array(bytes);
        if (qsh) {
            return { file, type: "qsh", name: file.name, data: bytes, qsh };
        }
    }

    if (name.endsWith(".csv")) {
        return {
            file,
            type: "csv",
            name: file.name,
            data: bytes
        };
    }

    if (name.endsWith(".json")) {
        return {
            file,
            type: "json",
            name: file.name,
            data: bytes
        };
    }

    if (name.endsWith(".hex")) {
        const text = new TextDecoder().decode(bytes);
        const binData = parseIntelHex(text);
        return {
            file,
            type: "firmware",
            name: file.name,
            data: binData
        };
    }

    if (name.endsWith(".dat")) {
        // Assume calibration if .dat and 512 bytes
        if (bytes.length === 512) {
            return { file, type: "calibration", name: file.name, data: bytes };
        }
        // Could be other data, but for now we treat .dat as calib candidate
        return { file, type: "calibration", name: file.name, data: bytes };
    }

    if (name.endsWith(".bin")) {
        // If 512 bytes exactly, it might be calibration too
        if (bytes.length === 512) {
            return { file, type: "calibration", name: file.name, data: bytes };
        }
        return { file, type: "firmware", name: file.name, data: bytes };
    }

    return {
        file,
        type: "unknown",
        name: file.name,
        data: bytes
    };
}
