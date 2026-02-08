// K5/K6/K1 Protocol Constants
// Based on armel/uvtools2 flash.js and spm81/Multi-UVTools

export const BAUDRATE = 38400;

// Message types
export const MSG_DEV_INFO_REQ = 0x0514;
export const MSG_DEV_INFO_RESP = 0x0515;
export const MSG_NOTIFY_DEV_INFO = 0x0518;
export const MSG_PROG_FW = 0x0519;
export const MSG_PROG_FW_RESP = 0x051A;
export const MSG_READ_EEPROM = 0x051B;
export const MSG_READ_EEPROM_RESP = 0x051C;
export const MSG_WRITE_EEPROM = 0x051D;
export const MSG_WRITE_EEPROM_RESP = 0x051E;
export const MSG_NOTIFY_BL_VER = 0x0530;
export const MSG_GET_CPU_ID = 0x0533;
export const MSG_GET_CPU_ID_RESP = 0x0534;
export const MSG_REBOOT = 0x05DD;

// Extended F4HWN / IJV Commands
export const MSG_RSSI_REQ = 0x0527;
export const MSG_RSSI_RESP = 0x0528;
export const MSG_BATT_REQ = 0x0529;
export const MSG_BATT_RESP = 0x052A;

// Calibration memory layout
export const CALIB_SIZE = 512;
export const CHUNK_SIZE = 16;
export const CALIB_OFFSET_LEGACY = 0x1E00;  // Firmware < v5.0.0
export const CALIB_OFFSET_NEW = 0xB000;     // Firmware >= v5.0.0
export const DEFAULT_CALIB_OFFSET = CALIB_OFFSET_LEGACY;

// XOR obfuscation table
export const OBFUS_TBL = new Uint8Array([
    0x16, 0x6c, 0x14, 0xe6, 0x2e, 0x91, 0x0d, 0x40,
    0x21, 0x35, 0xd5, 0x40, 0x13, 0x03, 0xe9, 0x80
]);
