/**
 * Simple Intel HEX parser for Squelch
 */

export function parseIntelHex(hexString: string): Uint8Array {
    const lines = hexString.split(/\r?\n/);
    const dataBlocks: { address: number, data: Uint8Array }[] = [];
    let upperAddress = 0;
    let minAddress = Infinity;
    let maxAddress = 0;

    for (const line of lines) {
        if (!line.startsWith(':')) continue;

        const record = line.substring(1);
        const byteCount = parseInt(record.substring(0, 2), 16);
        const address = parseInt(record.substring(2, 6), 16);
        const recordType = parseInt(record.substring(6, 8), 16);
        const data = record.substring(8, 8 + byteCount * 2);
        const checksum = parseInt(record.substring(8 + byteCount * 2, 10 + byteCount * 2), 16);

        // TODO: Verify checksum if needed

        if (recordType === 0) { // Data Record
            const fullAddress = upperAddress + address;
            const bytesSource = new Uint8Array(byteCount);
            for (let i = 0; i < byteCount; i++) {
                bytesSource[i] = parseInt(data.substring(i * 2, i * 2 + 2), 16);
            }
            dataBlocks.push({ address: fullAddress, data: bytesSource });
            minAddress = Math.min(minAddress, fullAddress);
            maxAddress = Math.max(maxAddress, fullAddress + byteCount);
        } else if (recordType === 1) { // End of File
            break;
        } else if (recordType === 4) { // Extended Linear Address Record
            upperAddress = parseInt(data, 16) << 16;
        }
    }

    if (dataBlocks.length === 0) return new Uint8Array(0);

    // Usually firmware starts at some base address (e.g. 0x08000000)
    // We want the binary blob starting from the first address encountered
    const result = new Uint8Array(maxAddress - minAddress);
    for (const block of dataBlocks) {
        result.set(block.data, block.address - minAddress);
    }

    return result;
}
