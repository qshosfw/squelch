/**
 * Abstract Base Class for Radio Firmware Profiles.
 * Defines the contract that all profiles (Stock, IJV, F4HWN, etc.) must implement.
 */
import React from 'react';
import { calculateCrockford, uidToBigInt } from './radio-utils';

export interface Channel {
    index: number;
    name: string;
    rxFreq: number;
    offset: number;
    mode: string;
    power: string;
    scanList: string;
    empty: boolean;

    // Extended fields
    bandwidth?: string;
    rxTone?: string;
    txTone?: string;
    step?: number;
    scrambler?: string;
    pttid?: string;
    compander?: string;
    duplex?: string;
    busyLock?: boolean;
    txLock?: boolean;
    freqRev?: boolean;
    scanList1?: boolean;
    scanList2?: boolean;
    scanList3?: boolean;
    [key: string]: any;
}

export type SettingsSchema = {
    key: string;
    label: string;
    type: 'range' | 'select' | 'switch' | 'string';
    group: string;
    options?: string[] | number[];
    min?: number;
    max?: number;
    default?: any;
    description?: string; // Markdown supported tooltip/subtitle
};

export type SettingsSection = {
    id: string;
    label: string;
    description?: string;
    icon?: any; // Lucide icon
};

export type FeatureFlags = {
    settings: boolean;
    memories: boolean;
    screencast: boolean;
    calibration: boolean;
    [key: string]: boolean;

};

export interface CustomPageProps {
    connected: boolean;
    activeProfile: RadioProfile | null;
    protocol: any;
}

export type CustomPage = {
    id: string;
    label: string;
    icon?: any; // Lucide icon or similar
    component: React.ComponentType<CustomPageProps>;
};

export interface ModuleAPI {
    toast: (title: string, description?: string, type?: 'default' | 'destructive' | 'success') => void;
    navigate: (path: string) => void;
    // Add more hooks here as needed
}

export interface TelemetryData {
    batteryVoltage?: number;
    batteryPercentage?: number;
    batteryCurrent?: number;
    isCharging?: boolean;
    isLowBattery?: boolean;
    rssi?: number;
    rssi_dBm?: number;
    snr?: number;
    noiseIndicator?: number;
    glitchIndicator?: number;
    gain_dB?: number;
    afAmplitude?: number;
}

export interface MemoryConfig {
    channels: { start: number; size: number; stride: number; };
    settings?: { start: number; size: number; };
    extra?: Record<string, { start: number; size: number; }>;
}

export interface RadioProfile {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    icon: any;

    features: FeatureFlags;
    lists: Record<string, (string | number)[]>;
    strings: Record<string, string>;
    components: Record<string, React.ComponentType<any>>;
    settingsConfig: SettingsSchema[];
    settingsSections: Record<string, SettingsSection>;
    customPages: CustomPage[];
    memoryMapping: MemoryConfig;

    matchFirmware(version: string): boolean;
    getExtendedInfo(protocol: any): Promise<Record<string, string> | null>;
    getNumericUID(protocol: any): Promise<bigint | Uint8Array | null>;
    getSerialNumber(protocol: any): Promise<string | null>;
    formatUID(uid: bigint | Uint8Array | any): string | null;

    // Settings
    decodeSettings(buffers: Record<string, Uint8Array>): Record<string, any>;
    encodeSettings(settings: Record<string, any>, buffers: Record<string, Uint8Array>): void;

    // Channels
    get channelCount(): number;
    get channelStride(): number;
    decodeChannel(buffer: Uint8Array, index: number, auxBuffer?: { attr?: Uint8Array, name?: Uint8Array }): Channel;
    encodeChannel(c: Channel, buffer: Uint8Array, index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): void;

    // I/O
    readChannels(protocol: any, onProgress: (p: number) => void, onLiveUpdate?: (batch: Channel[]) => void): Promise<Channel[]>;
    writeChannels(protocol: any, channels: Channel[], onProgress: (p: number) => void): Promise<boolean>;

    // Telemetry & Protocol
    getTelemetry(protocol: any): Promise<any | null>;
    startDisplayMirror(protocol: any): Promise<DisplayMirrorHandler | null>;
    sendKey(protocol: any, key: number): Promise<void>;
    onHandshake(protocol: any): Promise<void>;

    // Helpers
    onActivate(api: ModuleAPI): void;
    onDeactivate(): void;

    // Commands
    reboot(protocol: any): Promise<boolean>;
    readEEPROM(protocol: any, offset: number, size: number): Promise<Uint8Array | null>;
    writeEEPROM(protocol: any, offset: number, data: Uint8Array): Promise<boolean>;

}

// module-interface.ts modification is needed. Actually I just did a view_file in step 7, so I have the full file in context.

// Let's replace the `BaseRadioModule` class definition starting at line 158.
export abstract class BaseRadioModule implements RadioProfile {
    abstract get id(): string;
    abstract get name(): string;
    get version(): string { return "1.0.0"; }
    get author(): string { return "Unknown"; }
    get description(): string { return ""; }
    get icon(): any { return null; }

    abstract matchFirmware(version: string): boolean;

    get features(): FeatureFlags {
        return {
            settings: true,
            memories: true,
            screencast: false,
            calibration: false
        };
    }

    get lists(): Record<string, (string | number)[]> { return {}; }
    get strings(): Record<string, string> { return {}; }
    get components(): Record<string, React.ComponentType<any>> { return {}; }
    get settingsConfig(): SettingsSchema[] { return []; }
    get settingsSections(): Record<string, SettingsSection> { return {}; }
    get customPages(): CustomPage[] { return []; }

    abstract get memoryMapping(): MemoryConfig;

    async getExtendedInfo(_protocol: any): Promise<Record<string, string> | null> { return null; }
    async getNumericUID(_protocol: any): Promise<bigint | Uint8Array | null> { return null; }
    async getSerialNumber(protocol: any): Promise<string | null> {
        const uid = await this.getNumericUID(protocol);
        return this.formatUID(uid);
    }

    formatUID(uid: bigint | Uint8Array | any): string | null {
        if (!uid) return null;
        try {
            const bigVal = (uid instanceof Uint8Array) ? uidToBigInt(uid) : BigInt(uid);
            if (bigVal === null) return null;
            return calculateCrockford(bigVal);
        } catch (e) {
            return null;
        }
    }

    decodeSettings(_buffers: Record<string, Uint8Array>): Record<string, any> { return {}; }
    encodeSettings(_settings: Record<string, any>, _buffers: Record<string, Uint8Array>): void { }

    get channelCount(): number {
        return Math.floor(this.memoryMapping.channels.size / this.memoryMapping.channels.stride);
    }

    get channelStride(): number {
        return this.memoryMapping.channels.stride;
    }

    abstract decodeChannel(buffer: Uint8Array, index: number, auxBuffer?: { attr?: Uint8Array, name?: Uint8Array }): Channel;
    abstract encodeChannel(c: Channel, buffer: Uint8Array, index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): void;

    // Default implementations that modules can inherit
    async readChannels(protocol: any, onProgress: (p: number) => void, onLiveUpdate?: (batch: Channel[]) => void): Promise<Channel[]> {
        const info = await protocol.identify();
        const timestamp = info.timestamp || 0;

        const mm = this.memoryMapping;
        const range = mm.channels;
        const stride = this.channelStride;
        const count = this.channelCount;
        const BATCH_SIZE = 10;
        const EXTRA = mm.extra || {};

        const allChannels: Channel[] = [];
        let processed = 0;

        for (let i = 0; i < count; i += BATCH_SIZE) {
            const batchCount = Math.min(BATCH_SIZE, count - i);
            const chStart = range.start + (i * stride);
            const chSize = batchCount * stride;
            const chBytes = await protocol.readEEPROM(chStart, chSize, timestamp);

            let attrBytes: Uint8Array | null = null;
            if (EXTRA.attributes) {
                const atStart = EXTRA.attributes.start + i;
                attrBytes = await protocol.readEEPROM(atStart, batchCount, timestamp);
            }

            let nameBytes: Uint8Array | null = null;
            if (EXTRA.names) {
                const nmStart = EXTRA.names.start + (i * 16);
                nameBytes = await protocol.readEEPROM(nmStart, batchCount * 16, timestamp);
            }

            const batchItems: Channel[] = [];
            for (let k = 0; k < batchCount; k++) {
                const totalIdx = i + k;
                const cBuf = chBytes.slice(k * stride, (k + 1) * stride);
                const auxData = {
                    attr: attrBytes ? attrBytes.slice(k, k + 1) : undefined,
                    name: nameBytes ? nameBytes.slice(k * 16, (k + 1) * 16) : undefined
                };
                const ch = this.decodeChannel(cBuf, totalIdx + 1, auxData);
                batchItems.push(ch);

                processed++;
                onProgress(Math.round((processed / count) * 100));
            }

            allChannels.push(...batchItems);
            if (onLiveUpdate) onLiveUpdate(batchItems);
        }
        return allChannels;
    }

    async writeChannels(protocol: any, channels: Channel[], onProgress: (p: number) => void): Promise<boolean> {
        const info = await protocol.identify();
        const timestamp = info.timestamp || 0;

        const mm = this.memoryMapping;
        const stride = this.channelStride;
        const count = channels.length;
        const BATCH_SIZE = 10;
        const EXTRA = mm.extra || {};
        let processed = 0;

        for (let i = 0; i < count; i += BATCH_SIZE) {
            const batchCount = Math.min(BATCH_SIZE, count - i);
            const chBytes = new Uint8Array(batchCount * stride);
            chBytes.fill(0xFF);

            const attrBytes = EXTRA.attributes ? new Uint8Array(batchCount) : null;
            if (attrBytes) attrBytes.fill(0xFF);

            const nameBytes = EXTRA.names ? new Uint8Array(batchCount * 16) : null;
            if (nameBytes) nameBytes.fill(0xFF);

            for (let k = 0; k < batchCount; k++) {
                const idx = i + k;
                if (idx >= channels.length) break;
                const ch = channels[idx];
                const cBuf = chBytes.subarray(k * stride, (k + 1) * stride);
                const aux = {
                    attr: attrBytes ? attrBytes.subarray(k, k + 1) : new Uint8Array(1),
                    name: nameBytes ? nameBytes.subarray(k * 16, (k + 1) * 16) : new Uint8Array(16)
                };
                this.encodeChannel(ch, cBuf, idx + 1, aux);
            }

            const chStart = mm.channels.start + (i * stride);
            await protocol.writeEEPROM(chStart, chBytes, timestamp);

            if (attrBytes && EXTRA.attributes) {
                const atStart = EXTRA.attributes.start + i;
                await protocol.writeEEPROM(atStart, attrBytes, timestamp);
            }

            if (nameBytes && EXTRA.names) {
                const nmStart = EXTRA.names.start + (i * 16);
                await protocol.writeEEPROM(nmStart, nameBytes, timestamp);
            }

            processed += batchCount;
            onProgress(Math.round((processed / count) * 100));
        }
        return true;
    }

    async getTelemetry(_protocol: any): Promise<any | null> { return null; }
    async startDisplayMirror(_protocol: any): Promise<DisplayMirrorHandler | null> { return null; }
    async sendKey(_protocol: any, _key: number): Promise<void> { }
    async onHandshake(_protocol: any): Promise<void> { }

    onActivate(_api: ModuleAPI): void { }
    onDeactivate(): void { }

    async reboot(_protocol: any): Promise<boolean> { return false; }
    async readEEPROM(_protocol: any, _offset: number, _size: number): Promise<Uint8Array | null> { return null; }
    async writeEEPROM(_protocol: any, _offset: number, _data: Uint8Array): Promise<boolean> { return false; }

}

export interface DisplayMirrorHandler {
    onFrameUpdate?: (framebuffer: Uint8Array) => void;
    onStatusChange?: (connected: boolean, error?: string) => void;
    onStatsUpdate?: (stats: { fps: number, bps: number, totalFrames: number }) => void;
    getFramebuffer: () => Uint8Array;
    disconnect: (closePort?: boolean) => Promise<void>;
}
