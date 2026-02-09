/**
 * Shared utilities for radio profiles.
 */

/**
 * Calculates a Crockford Base32 serial number from a numeric UID.
 * Used in DeltaFW and as a platform-agnostic standard for squelch.
 */
export function calculateCrockford(serial: bigint): string {
    const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const CHECKSUM = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";
    let val = serial;
    let res = "";
    for (let i = 0; i < 13; i++) {
        res = ALPHABET[Number(val & 0x1Fn)] + res;
        val >>= 5n;
    }

    const mod37 = Number(serial % 37n);
    const check = CHECKSUM[mod37];

    // Standard format: XXXXXXXXXXXXXC (14 chars)
    // We return it as a single block as defined in the firmware.
    return res + check;
}

/**
 * Helper to convert Uint8Array UID (8 bytes) to BigInt
 */
export function uidToBigInt(uid: Uint8Array): bigint | null {
    if (uid.length !== 8) return null;
    const dv = new DataView(uid.buffer, uid.byteOffset, uid.byteLength);
    return dv.getBigUint64(0, true);
}
