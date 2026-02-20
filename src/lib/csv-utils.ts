import { Channel } from "@/lib/framework/module-interface";

export const CHIRP_HEADERS = [
    "Location", "Name", "Frequency", "Duplex", "Offset", "Tone", "rToneFreq", "cToneFreq", "DtcsCode", "DtcsPolarity", "Mode", "TStep", "Skip", "Comment", "URCALL", "RPT1CALL", "RPT2CALL", "DVCODE"
];

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                result.push(current);
                current = "";
            } else {
                current += char;
            }
        }
    }
    result.push(current);
    return result.map(s => s.trim());
}

function escapeCSV(str: string): string {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function exportToCSV(channels: Channel[]): string {
    const header = CHIRP_HEADERS.join(",");
    const rows = channels.filter(c => !c.empty).map(c => {
        let toneMode = "";
        let rTone = "88.5";
        let cTone = "88.5";
        let dcode = "023";
        let dpol = "NN";

        const hasRxCtcss = c.rxTone?.includes("(C)");
        const hasTxCtcss = c.txTone?.includes("(C)");
        const hasRxDcs = c.rxTone?.startsWith("D");
        const hasTxDcs = c.txTone?.startsWith("D");

        if (hasRxCtcss && hasTxCtcss) {
            toneMode = "TSQL";
            rTone = c.rxTone?.split(" ")[0] || "88.5";
            cTone = c.txTone?.split(" ")[0] || "88.5";
        } else if (hasTxCtcss) {
            toneMode = "Tone";
            cTone = c.txTone?.split(" ")[0] || "88.5";
        } else if (hasRxDcs || hasTxDcs) {
            toneMode = "DTCS";
            const rxCodeStr = c.rxTone?.match(/\d+/)?.[0] || "023";
            const txCodeStr = c.txTone?.match(/\d+/)?.[0] || "023";
            dcode = txCodeStr || rxCodeStr; // Usually same
            dpol = (c.rxTone?.endsWith("I") ? "R" : "N") + (c.txTone?.endsWith("I") ? "R" : "N");
        }

        return [
            c.index.toString(),
            escapeCSV(c.name || ""),
            (c.rxFreq / 1000000).toFixed(6),
            c.duplex || "",
            (c.offset / 1000000).toFixed(6),
            toneMode, rTone, cTone, dcode, dpol,
            c.mode || "FM",
            (c.step || 5).toFixed(2),
            c.scanList === "None" ? "S" : "",
            "", "", "", "", ""
        ].join(",");
    });
    return [header, ...rows].join("\n");
}

export function importFromCSV(csv: string): Partial<Channel>[] {
    const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);

    // Fallback indexes if headers don't match exactly but we know order
    const getIdx = (name: string, fallback: number) => {
        const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
        return idx !== -1 ? idx : fallback;
    };

    const locationIdx = getIdx("Location", 0);
    const nameIdx = getIdx("Name", 1);
    const freqIdx = getIdx("Frequency", 2);
    const duplexIdx = getIdx("Duplex", 3);
    const offsetIdx = getIdx("Offset", 4);
    const toneIdx = getIdx("Tone", 5);
    const rToneIdx = getIdx("rToneFreq", 6);
    const cToneIdx = getIdx("cToneFreq", 7);
    const dcodeIdx = getIdx("DtcsCode", 8);
    const dpolIdx = getIdx("DtcsPolarity", 9);
    const modeIdx = getIdx("Mode", 10);
    const stepIdx = getIdx("TStep", 11);
    const skipIdx = getIdx("Skip", 12);

    return lines.slice(1).map(line => {
        const cols = parseCSVLine(line);

        const freq = parseFloat(cols[freqIdx] || "0") * 1000000;
        const offset = parseFloat(cols[offsetIdx] || "0") * 1000000;

        const toneMode = cols[toneIdx] || "";
        let rxTone = "None";
        let txTone = "None";

        if (toneMode === "Tone") {
            txTone = `${cols[cToneIdx]} (C)`;
        } else if (toneMode === "TSQL") {
            rxTone = `${cols[rToneIdx]} (C)`;
            txTone = `${cols[cToneIdx]} (C)`;
        } else if (toneMode === "DTCS") {
            const code = cols[dcodeIdx] ? cols[dcodeIdx].toString().padStart(3, '0') : "023";
            const pol = cols[dpolIdx] || "NN";
            rxTone = `D${code}${pol[0] === 'R' ? 'I' : 'N'}`;
            txTone = `D${code}${pol[1] === 'R' ? 'I' : 'N'}`;
        } else if (toneMode === "Cross") {
            // Complex, fallback to reasonable defaults
        }

        return {
            index: parseInt(cols[locationIdx] || "0", 10),
            name: cols[nameIdx] || "",
            rxFreq: freq,
            offset: offset,
            duplex: cols[duplexIdx] || "",
            mode: cols[modeIdx] || "FM",
            power: "High", // Default to high
            step: parseFloat(cols[stepIdx] || "5.0"),
            scanList: cols[skipIdx] === "S" ? "None" : "All",
            rxTone,
            txTone,
            empty: false
        } as Partial<Channel>;
    }).filter(c => !isNaN(c.index!) && c.index! > 0 && !isNaN(c.rxFreq!) && c.rxFreq! > 0);
}
