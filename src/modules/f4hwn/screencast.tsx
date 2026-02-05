import React, { useEffect, useState, useRef } from 'react';
import { ViewerPanel } from './components/ViewerPanel';
import { SerialHandler } from './serial-handler';
import { ViewerSettings } from './components/DisplayCanvas';
import { useToast } from '@/hooks/use-toast';
import { useProtocol } from '@/hooks/useProtocol';

export const ScreencastPage: React.FC = () => {
    const { protocol, isConnected } = useProtocol();
    const { toast } = useToast();
    const handlerRef = useRef<SerialHandler | null>(null);
    const [framebuffer, setFramebuffer] = useState<Uint8Array>(new Uint8Array(1024));
    const [frameVersion, setFrameVersion] = useState(0);
    const [status, setStatus] = useState({ isConnected: false, fps: 0, bps: 0, totalFrames: 0 });
    const [settings, setSettings] = useState<ViewerSettings>({
        pixelSize: 4,
        pixelAspectRatio: 1.3,
        pixelLcd: 1,
        invertLcd: 0,
        colorKey: 'orange',
        customColors: { bg: '#000000', fg: '#ffffff' },
        backlightLevel: 8,
        contrast: 13,
        backlightShadow: 1,
        lcdGhosting: 1
    });

    const isPausedByUs = useRef(false);
    const hasNotified = useRef(false);

    useEffect(() => {
        const handler = new SerialHandler();
        handlerRef.current = handler;

        handler.onFrameUpdate = () => {
            setFramebuffer(new Uint8Array(handler.getFramebuffer())); // copy
            setFrameVersion(v => v + 1);
        };

        handler.onStatusChange = (conn, _err) => {
            setStatus(s => ({ ...s, isConnected: conn }));
            if (conn && !hasNotified.current) {
                toast({ title: "Screencast Connected", description: "Remote display session started." });
                hasNotified.current = true;
            } else if (!conn) {
                hasNotified.current = false;
            }
        };

        handler.onStatsUpdate = (stats) => {
            setStatus(s => ({ ...s, ...stats }));
        };

        return () => {
            handler.disconnect(false);
        };
    }, [toast]);

    useEffect(() => {
        // If the protocol is connected and we haven't paused it yet, do it.
        // If isConnected becomes false because we paused it, ignore.
        if (isConnected && protocol && handlerRef.current && !isPausedByUs.current) {
            const startScreencast = async () => {
                try {
                    isPausedByUs.current = true;
                    // Temporarily pause protocol to grab the port
                    const sharedPort = await protocol.pauseConnection();
                    if (sharedPort && handlerRef.current) {
                        await handlerRef.current.connect(sharedPort);
                    } else if (!sharedPort) {
                        isPausedByUs.current = false;
                        toast({ variant: "destructive", title: "Connection Error", description: "Could not access serial port." });
                    }
                } catch (e: any) {
                    isPausedByUs.current = false;
                    toast({ variant: "destructive", title: "Failed to start screencast", description: e.message });
                }
            };
            startScreencast();
        }

        // If isConnected is false and it WASN'T us who paused it, it means the radio was physically disconnected.
        if (!isConnected && isPausedByUs.current) {
            // Check if protocol really disconnected or if it's just paused.
            // Ideally Protocol should have a state we can check.
            // Assuming for now if it's false, it's a real disconnect if it happens outside our control.
        }

        return () => {
            // Restore connection only if we were actually the ones who paused it
            const restore = async () => {
                if (isPausedByUs.current) {
                    if (handlerRef.current) await handlerRef.current.disconnect(false);
                    if (protocol && typeof protocol.resumeConnection === 'function') {
                        await protocol.resumeConnection();
                    }
                    isPausedByUs.current = false;
                }
            };
            restore();
        };
    }, [isConnected, protocol, toast]);

    return (
        <div className="container mx-auto p-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Remote Display</h1>
                <div className="flex gap-2">
                    {/* Toolbar actions if needed */}
                </div>
            </div>

            <ViewerPanel
                framebuffer={framebuffer}
                frameVersion={frameVersion}
                settings={settings}
                setSettings={setSettings}
                status={status}
            />
        </div>
    );
};
