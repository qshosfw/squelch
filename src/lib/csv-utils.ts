import { Channel } from "@/lib/framework/module-interface";

export const CHIRP_HEADERS = [
    "Location", "Name", "Frequency", "Duplex", "Offset", "Tone", "rToneFreq", "cToneFreq", "DtcsCode", "DtcsPolarity", "Mode", "TStep", "Skip", "Comment", "URCALL", "RPT1CALL", "RPT2CALL", "DVCODE"
];

// Simple CSV Generator
export function exportToCSV(channels: Channel[]): string {
    const header = CHIRP_HEADERS.join(",");
    const rows = channels.filter(c => !c.empty).map(c => {
        return [
            c.index,
            `"${c.name}"`, // Quote strings
            (c.rxFreq / 1000000).toFixed(6),
            c.duplex || "",
            (c.offset / 1000000).toFixed(6),
            "", "", "", // Tones
            "", "", // DTCS
            c.mode,
            "5.00",
            c.scanList === "None" ? "S" : "",
            "", "", "", "", "" // Extras
        ].join(",");
    });
    return [header, ...rows].join("\n");
}

// Simple CSV Parser (Naive)
export function importFromCSV(csv: string): Partial<Channel>[] {
    const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const locationIdx = headers.indexOf("Location");
    const nameIdx = headers.indexOf("Name");
    const freqIdx = headers.indexOf("Frequency");
    const offsetIdx = headers.indexOf("Offset");
    const modeIdx = headers.indexOf("Mode");
    const skipIdx = headers.indexOf("Skip");

    return lines.slice(1).map(line => {
        // Use regex to split by comma but respect quotes? Simple split for now.
        // If names contain commas this breaks, but fallback mode.
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

        const freq = parseFloat(cols[freqIdx] || "0") * 1000000;
        const offset = parseFloat(cols[offsetIdx] || "0") * 1000000;

        return {
            index: parseInt(cols[locationIdx] || "0"),
            name: cols[nameIdx] || "",
            rxFreq: freq,
            offset: offset,
            mode: cols[modeIdx] || "FM",
            power: "High",
            scanList: cols[skipIdx] === "S" ? "None" : "All",
            empty: false
        } as Partial<Channel>;
    });
}
