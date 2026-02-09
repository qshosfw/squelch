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
    type: 'range' | 'select' | 'switch';
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
    async getSerialNumber(_protocol: any): Promise<string | null> { return null; }

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

    async readChannels(_protocol: any, _onProgress: (p: number) => void, _onLiveUpdate?: (batch: Channel[]) => void): Promise<Channel[]> { return []; }
    async writeChannels(_protocol: any, _channels: Channel[], _onProgress: (p: number) => void): Promise<boolean> { return false; }

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
