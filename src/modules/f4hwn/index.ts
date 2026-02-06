import { RadioProfile, CustomPage, ModuleAPI, Channel, DisplayMirrorHandler } from '../../lib/framework/module-interface';
import { SerialHandler } from './serial-handler';

export class F4HWNProfile extends RadioProfile {
    private handler: SerialHandler | null = null;

    get id() { return "f4hwn"; }
    get name() { return "F4HWN / Egzumer"; }
    override get version() { return "1.0.0"; }
    override get author() { return "F4HWN Community"; }
    override get description() { return "Supports F4HWN, Egzumer, and compatible firmwares with advanced features like spectral analysis and screencasting."; }
    override get icon() { return "Activity"; }

    override get features() {
        return {
            settings: true,
            memories: true,
            screencast: true,
            calibration: true
        };
    }

    matchFirmware(version: string): boolean {
        const v = version.toLowerCase();
        return v.includes("f4hwn") || v.includes("egzumer") || v.includes("iics");
    }

    override async startDisplayMirror(protocol: any): Promise<DisplayMirrorHandler | null> {
        if (!this.handler) {
            this.handler = new SerialHandler();
        }

        const sharedPort = await protocol.pauseConnection();
        if (sharedPort) {
            await this.handler.connect(sharedPort);
            return this.handler;
        }
        return null;
    }

    override async sendKey(_protocol: any, key: number): Promise<void> {
        // F4HWN Key Protocol: [0x55, 0xAA, 0x03, 0x00, 0x01, key, checksum]? 
        // For now, let's just use the SerialHandler if it has a way, 
        // or protocol.sendPacket if we implement it there.
        // Actually SerialHandler mostly handles READ loop for display data.
        // Key input typically goes through the same writer.
        console.log("Send Key:", key);
    }

    override get customPages(): CustomPage[] {
        return [];
    }

    // --- Channels ---
    get channelCount() { return 200; }
    get channelStride() { return 16; }

    decodeChannel(_buffer: Uint8Array, index: number, _aux?: { attr?: Uint8Array, name?: Uint8Array }): Channel {
        // Basic stock decoding for now (stub)
        // TODO: Implement actual F4HWN specific decoding if different
        return {
            index,
            name: `CH - ${index + 1} `,
            rxFreq: 0,
            offset: 0,
            mode: 'FM',
            power: 'H',
            scanList: 'I',
            empty: true
        };
    }

    encodeChannel(_c: Channel, buffer: Uint8Array, _index: number, _aux?: { attr?: Uint8Array, name?: Uint8Array }): void {
        // Stub
        buffer.fill(0xFF);
    }

    async onActivate(api: ModuleAPI) {
        super.onActivate(api);
    }
}

