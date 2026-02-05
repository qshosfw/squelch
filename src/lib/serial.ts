export class SerialManager {
    private port: SerialPort | null = null;
    private reader: ReadableStreamDefaultReader | null = null;
    private writer: WritableStreamDefaultWriter | null = null;

    async requestPort() {
        try {
            this.port = await navigator.serial.requestPort();
            return this.port;
        } catch (error) {
            console.error("Failed to request port:", error);
            throw error;
        }
    }

    async connect(baudRate: number = 115200) {
        if (!this.port) throw new Error("No port selected");

        await this.port.open({ baudRate });

        if (!this.port.writable || !this.port.readable) {
            throw new Error("Serial port not writable or readable");
        }

        this.writer = this.port.writable.getWriter();
        this.reader = this.port.readable.getReader();

        console.log("Connected to serial port");
    }

    async disconnect() {
        if (this.reader) {
            await this.reader.cancel();
            this.reader.releaseLock();
            this.reader = null;
        }

        if (this.writer) {
            this.writer.releaseLock();
            this.writer = null;
        }

        if (this.port) {
            await this.port.close();
            this.port = null;
        }
    }

    async write(data: Uint8Array) {
        if (!this.writer) throw new Error("Not connected");
        await this.writer.write(data);
    }

    async read() {
        if (!this.reader) throw new Error("Not connected");
        const { value, done } = await this.reader.read();
        if (done) return null;
        return value as Uint8Array;
    }
}

export const serialManager = new SerialManager();
