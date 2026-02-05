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

export abstract class RadioProfile {
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
    get version(): string { return "1.0.0"; }

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
     * Optional hook for custom handshake logic.
     * If defined, the ProtocolHandler will call this INSTEAD of its default handshake.
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
}
