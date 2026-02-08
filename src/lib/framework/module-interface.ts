/**
 * Abstract Base Class for Radio Firmware Profiles.
 * Defines the contract that all profiles (Stock, IJV, F4HWN, etc.) must implement.
 */
import React from 'react';

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
};

export type FeatureFlags = {
    settings: boolean;
    memories: boolean;
    screencast: boolean;
    calibration: boolean;
    [key: string]: boolean;

};

export type CustomPage = {
    id: string;
    label: string;
    icon?: any; // Lucide icon or similar
    component: React.ComponentType;
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

export abstract class RadioProfile {
    /**
     * Common lists for UI selection (Mode, Power, ScanList, etc.)
     */
    get lists(): Record<string, (string | number)[]> {
        return {};
    }

    /**
     * Unique ID for this profile (e.g. 'stock-uvk5v3')
     */
    abstract get id(): string;

    /**
     * Human readable name
     */
    abstract get name(): string;

    /**
     * Module Version (semver)
     */
    get version(): string { return "0.0.0"; }

    /**
     * Author / Maintainer
     */
    get author(): string { return "Unknown"; }

    /**
     * Brief description
     */
    get description(): string { return ""; }

    /**
     * Icon (Lucide icon component or string)
     */
    get icon(): any { return null; }

    /**
     * Detect if this profile matches the given firmware version string.
     */
    abstract matchFirmware(_version: string): boolean;

    /**
     * Feature flags for the UI to enable/disable columns or actions.
     */
    get features(): FeatureFlags {
        return {
            settings: true,
            memories: true,
            screencast: false,
            calibration: false
        };
    }

    /**
     * Fetch extended device information (e.g., Serial, MAC).
     */
    async getExtendedInfo(_protocol: any): Promise<Record<string, string> | null> {
        return null;
    }

    // --- Memory Layouts ---

    get channelCount() { return 200; }
    get channelStride() { return 16; }

    /**
     * Returns the memory map layout.
     */
    get memoryRanges(): Record<string, { start: number, size: number }> {
        return {};
    }

    /**
     * Memory ranges for global settings.
     */
    get settingsRanges(): Record<string, { start: number, size: number }> {
        return {};
    }

    // --- Settings Framework ---

    /**
     * Configuration for generating the Settings UI.
     */
    get settingsConfig(): SettingsSchema[] {
        return [];
    }

    /**
     * Decode global settings from raw buffers.
     */
    decodeSettings(_buffers: Record<string, Uint8Array>): Record<string, any> {
        return {};
    }

    /**
     * Encode global settings into raw buffers.
     */
    encodeSettings(_settings: Record<string, any>, _buffers: Record<string, Uint8Array>): void {
        // override
    }

    // --- Channel Logic ---

    abstract decodeChannel(buffer: Uint8Array, index: number, auxBuffer?: { attr?: Uint8Array, name?: Uint8Array }): Channel;

    abstract encodeChannel(c: Channel, buffer: Uint8Array, _index: number, aux?: { attr?: Uint8Array, name?: Uint8Array }): void;

    /**
     * Bulk read channels from the radio.
     * Profiles should implement this to optimize reading based on their memory layout.
     */
    async readChannels(_protocol: any, _onProgress: (p: number) => void, _onLiveUpdate?: (batch: Channel[]) => void): Promise<Channel[]> {
        return [];
    }

    /**
     * Bulk write channels to the radio.
     * Profiles should implement this to optimize writing based on their memory layout.
     */
    async writeChannels(_protocol: any, _channels: Channel[], _onProgress: (p: number) => void): Promise<boolean> {
        return false;
    }

    // --- Telemetry & Protocol Hooks ---

    /**
     * Get current telemetry data from the radio.
     * Can return null if not supported or not connected.
     * @param protocol The active ProtocolHandler instance
     */
    async getTelemetry(_protocol: any): Promise<any | null> {
        return null;
    }

    /**
     * Request the radio to start a display mirroring session.
     * Returns a handler if successful, or null if not supported or failed.
     * @param _protocol The active ProtocolHandler instance
     */
    async startDisplayMirror(_protocol: any): Promise<DisplayMirrorHandler | null> {
        return null;
    }

    /**
     * Send a key event to the radio.
     * @param _protocol The active ProtocolHandler instance
     * @param _key The key code (firmware specific)
     */
    async sendKey(_protocol: any, _key: number): Promise<void> {
        // override
    }

    /**
     * Optional hook for custom handshake logic.
     */
    async onHandshake(_protocol: any): Promise<void> {
        // Default: do nothing (let protocol use default)
        // Throw or return false if you want complex logic
    }

    /**
     * Optional custom pages/views provided by this module.
     */
    get customPages(): CustomPage[] {
        return [];
    }

    /**
     * Called when the module is activated.
     * Can be used to store the API reference.
     */
    onActivate(_api: ModuleAPI): void {
        // store api if needed for alerts/toasts
    }

    /**
     * Called when the module is deactivated.
     * Can be used to clean up resources or state.
     */
    onDeactivate(): void {
        // override if needed
    }

    // --- Command Overrides ---

    /**
     * Override reboot command. Return true if handled.
     */
    async reboot(_protocol: any): Promise<boolean> {
        return false;
    }

    /**
     * Override EEPROM read. Return Uint8Array if handled, null otherwise.
     */
    async readEEPROM(_protocol: any, _offset: number, _size: number): Promise<Uint8Array | null> {
        return null;
    }

    /**
     * Override EEPROM write. Return true if handled.
     */
    async writeEEPROM(_protocol: any, _offset: number, _data: Uint8Array): Promise<boolean> {
        return false;
    }
}

export interface DisplayMirrorHandler {
    onFrameUpdate?: (framebuffer: Uint8Array) => void;
    onStatusChange?: (connected: boolean, error?: string) => void;
    onStatsUpdate?: (stats: { fps: number, bps: number, totalFrames: number }) => void;
    getFramebuffer: () => Uint8Array;
    disconnect: (closePort?: boolean) => Promise<void>;
}

