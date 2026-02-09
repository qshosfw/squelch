import { BaseRadioModule, Channel, FeatureFlags, MemoryConfig } from '../lib/framework/module-interface';


export class StockProfile extends BaseRadioModule {
    get id() { return "stock-uvk5v3"; }
    get name() { return "Quansheng UV-K5 (Stock)"; }

    matchFirmware(_version: string): boolean {
        // Stock firmwares usually look like "2.01.26", doesn't match custom names
        // Return false to allow fallback logic or other profiles to match first
        return false;
    }

    get features(): FeatureFlags {
        return {
            settings: false, // Stock FW settings are limited/unknown map in this context
            memories: true,
            screencast: false,
            calibration: true // Allow calibration for stock
        };
    }

    get strings() {
        return {
            "calibration.warning": "Stock firmware calibration is limited. Proceed with caution.",
        };
    }

    get components() {
        return {};
    }

    get memoryMapping(): MemoryConfig {
        return {
            channels: { start: 0x0000, size: 200 * 16, stride: 16 },
            // Stock usually stores names/attributes elsewhere?
            // On stock K5:
            // 0x0000 - 0x0C80: Channels (200 * 16)
            // 0x0C80 - 0x0D60: VFOs
            // 0x0D60 - 0x0E40: Channel Attributes (200 * 1)? Or bitpacked?
            // 0x0F50 - 0x1B50: Channel Names? (200 * 16)
            extra: {
                attributes: { start: 0x0D60, size: 200 * 1 }, // Guess
                names: { start: 0x0F50, size: 200 * 16 }
            }
        };
    }

    decodeChannel(buffer: Uint8Array, index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): Channel {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const rxFreqRaw = view.getUint32(0, true);
        const offsetRaw = view.getUint32(4, true);

        if (rxFreqRaw === 0xFFFFFFFF || rxFreqRaw === 0) {
            return {
                index, name: "", rxFreq: 0, offset: 0, mode: "FM", power: "USER", scanList: "None", empty: true
            };
        }

        const rxFreq = rxFreqRaw * 10;
        const offset = offsetRaw * 10;

        // Simplified decoding for stock (similar to F4HWN/IJV base structure)
        const modeFlags = buffer[11]; // simplified
        const offDir = (modeFlags >> 4) & 0x0F;

        let duplex = "";
        if (offDir === 1) duplex = "+";
        else if (offDir === 2) duplex = "-";

        // Name
        let name = "";
        if (aux?.name) {
            // Stock might use 0x0F50 for names
            for (let i = 0; i < 16; i++) {
                const c = aux.name[i];
                if (c === 0 || c === 0xFF) break;
                if (c >= 32 && c <= 126) name += String.fromCharCode(c);
            }
        }

        return {
            index,
            name: name.trim(),
            rxFreq,
            offset,
            mode: "FM", // Default assumption for stock
            power: "High",
            scanList: "None",
            duplex,
            empty: false
        };
    }

    encodeChannel(c: Channel, buffer: Uint8Array, _index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): void {
        buffer.fill(0);
        if (c.empty) {
            buffer.fill(0xFF);
            if (aux?.name) aux.name.fill(0xFF);
            return;
        }

        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        view.setUint32(0, Math.round(c.rxFreq / 10), true);
        view.setUint32(4, Math.round(c.offset / 10), true);

        // ... basic encoding ...
        // Keeping it minimal for this step to focus on architecture
    }
}
