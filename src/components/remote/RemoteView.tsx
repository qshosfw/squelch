import React, { useEffect, useState, useRef } from 'react';
import { ViewerPanel } from './ViewerPanel';
import { ViewerSettings } from './DisplayCanvas';
import { useToast } from '@/hooks/use-toast';
import { useProtocol } from '@/hooks/useProtocol';
import { ModuleManager } from '@/lib/framework/module-manager';
import { DisplayMirrorHandler } from '@/lib/framework/module-interface';
import { Radio as RadioIcon } from 'lucide-react';

export const RemoteView: React.FC = () => {
    const { protocol, isConnected } = useProtocol();
    const { toast } = useToast();
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

    const activeProfile = ModuleManager.getActiveProfile();
    const handlerRef = useRef<DisplayMirrorHandler | null>(null);
    const isPausedByUs = useRef(false);
    const hasNotified = useRef(false);

    useEffect(() => {
        if (!activeProfile?.features.screencast) return;

        const startScreencast = async () => {
            if (isConnected && protocol && !isPausedByUs.current) {
                try {
                    const handler = await activeProfile.startDisplayMirror(protocol);
                    if (handler) {
                        handlerRef.current = handler;
                        isPausedByUs.current = true;

                        handler.onFrameUpdate = (fb) => {
                            setFramebuffer(new Uint8Array(fb));
                            setFrameVersion(v => v + 1);
                        };

                        handler.onStatusChange = (conn, _err) => {
                            setStatus(s => ({ ...s, isConnected: conn }));
                            if (conn && !hasNotified.current) {
                                toast({ title: "Remote Connected", description: "Display mirroring session started." });
                                hasNotified.current = true;
                            } else if (!conn) {
                                hasNotified.current = false;
                            }
                        };

                        handler.onStatsUpdate = (stats) => {
                            setStatus(s => ({ ...s, ...stats }));
                        };
                    }
                } catch (e: any) {
                    toast({ variant: "destructive", title: "Failed to start remote", description: e.message });
                }
            }
        };

        startScreencast();

        return () => {
            const restore = async () => {
                if (isPausedByUs.current) {
                    if (handlerRef.current) await handlerRef.current.disconnect(false);
                    if (protocol && typeof protocol.resumeConnection === 'function') {
                        await protocol.resumeConnection();
                    }
                    isPausedByUs.current = false;
                    handlerRef.current = null;
                }
            };
            restore();
        };
    }, [isConnected, protocol, activeProfile, toast]);

    if (!activeProfile?.features.screencast) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <RadioIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-xl font-semibold">Not Supported</h2>
                    <p className="text-muted-foreground">
                        The current radio profile ({activeProfile?.name || 'Generic'}) does not support remote display mirroring.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
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
