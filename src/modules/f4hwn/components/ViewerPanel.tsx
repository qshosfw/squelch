import React, { useRef, useEffect, useState } from 'react';
import { DisplayCanvas, ViewerSettings, COLOR_SETS } from './DisplayCanvas';
import {
    Settings2,
    Camera,
    Activity,
    Unplug,
    Palette,
    Moon,
    Sun,
    Grid,
    Ghost,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from '@/components/ui/input';

interface SerialStatus {
    isConnected: boolean;
    fps: number;
    bps: number;
    totalFrames: number;
}

interface ViewerPanelProps {
    framebuffer: Uint8Array;
    frameVersion: number;
    settings: ViewerSettings;
    setSettings: React.Dispatch<React.SetStateAction<ViewerSettings>>;
    status: SerialStatus;
}

export const ViewerPanel: React.FC<ViewerPanelProps> = ({
    framebuffer,
    frameVersion,
    settings,
    setSettings,
    status
}) => {
    const startTimeRef = useRef<number>(0);
    const [duration, setDuration] = useState('00:00:00');

    useEffect(() => {
        if (status.isConnected && startTimeRef.current === 0) {
            startTimeRef.current = Date.now();
        } else if (!status.isConnected) {
            startTimeRef.current = 0;
            setDuration('00:00:00');
        }
    }, [status.isConnected]);

    useEffect(() => {
        if (!status.isConnected) return;
        const timer = setInterval(() => {
            const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            setDuration(`${h}:${m}:${s}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [status.isConnected]);

    const handleScreenshot = () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T');
            link.download = `k5-capture-${timestamp[0]}-${timestamp[1].slice(0, 8)}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 animate-in fade-in duration-300">
            {/* Sidebar Controls */}
            <aside className="w-full md:w-80 space-y-4 shrink-0 order-2 md:order-1">
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Settings2 className="w-4 h-4" />
                                Display Controls
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Tabs defaultValue="appearance" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="appearance">Style</TabsTrigger>
                                <TabsTrigger value="effects">Effects</TabsTrigger>
                                <TabsTrigger value="colors">Colors</TabsTrigger>
                            </TabsList>

                            {/* Appearance Tab */}
                            <TabsContent value="appearance" className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Pixel Scale</Label>
                                        <span className="text-xs font-mono">{settings.pixelSize.toFixed(1)}x</span>
                                    </div>
                                    <Slider
                                        min={2} max={12} step={0.5}
                                        value={[settings.pixelSize]}
                                        onValueChange={([val]: number[]) => setSettings(s => ({ ...s, pixelSize: val }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Pixel Aspect Ratio</Label>
                                        <span className="text-xs font-mono">{settings.pixelAspectRatio.toFixed(2)}</span>
                                    </div>
                                    <Slider
                                        min={0.5} max={2.0} step={0.05}
                                        value={[settings.pixelAspectRatio]}
                                        onValueChange={([val]: number[]) => setSettings(s => ({ ...s, pixelAspectRatio: val }))}
                                    />
                                </div>
                            </TabsContent>

                            {/* Effects Tab */}
                            <TabsContent value="effects" className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Backlight</Label>
                                        <span className="text-xs font-mono">{settings.backlightLevel}</span>
                                    </div>
                                    <Slider
                                        min={0} max={10} step={1}
                                        value={[settings.backlightLevel]}
                                        onValueChange={([val]: number[]) => setSettings(s => ({ ...s, backlightLevel: val }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Contrast</Label>
                                        <span className="text-xs font-mono">{settings.contrast}</span>
                                    </div>
                                    <Slider
                                        min={0} max={15} step={1}
                                        value={[settings.contrast]}
                                        onValueChange={([val]: number[]) => setSettings(s => ({ ...s, contrast: val }))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <div className="flex items-center space-x-2 border rounded-md p-2">
                                        <Grid className="w-4 h-4 text-muted-foreground" />
                                        <Label htmlFor="grid-toggle" className="flex-1 text-xs">LCD Grid</Label>
                                        <Switch id="grid-toggle" checked={settings.pixelLcd === 1} onCheckedChange={(c) => setSettings(s => ({ ...s, pixelLcd: c ? 1 : 0 }))} />
                                    </div>
                                    <div className="flex items-center space-x-2 border rounded-md p-2">
                                        <Ghost className="w-4 h-4 text-muted-foreground" />
                                        <Label htmlFor="ghost-toggle" className="flex-1 text-xs">Ghosting</Label>
                                        <Switch id="ghost-toggle" checked={settings.lcdGhosting === 1} onCheckedChange={(c) => setSettings(s => ({ ...s, lcdGhosting: c ? 1 : 0 }))} />
                                    </div>
                                    <div className="flex items-center space-x-2 border rounded-md p-2">
                                        <Moon className="w-4 h-4 text-muted-foreground" />
                                        <Label htmlFor="invert-toggle" className="flex-1 text-xs">Invert</Label>
                                        <Switch id="invert-toggle" checked={settings.invertLcd === 1} onCheckedChange={(c) => setSettings(s => ({ ...s, invertLcd: c ? 1 : 0 }))} />
                                    </div>
                                    <div className="flex items-center space-x-2 border rounded-md p-2">
                                        <Sun className="w-4 h-4 text-muted-foreground" />
                                        <Label htmlFor="glow-toggle" className="flex-1 text-xs">Glow</Label>
                                        <Switch id="glow-toggle" checked={settings.backlightShadow === 1} onCheckedChange={(c) => setSettings(s => ({ ...s, backlightShadow: c ? 1 : 0 }))} />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Colors Tab */}
                            <TabsContent value="colors" className="space-y-4 pt-4">
                                <div className="grid grid-cols-5 gap-2">
                                    {Object.values(COLOR_SETS).map((set) => (
                                        <button
                                            key={set.id}
                                            onClick={() => setSettings(s => ({ ...s, colorKey: set.id as any }))}
                                            className={`h-8 rounded-md border-2 transition-all relative ${settings.colorKey === set.id ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: set.bg }}
                                            title={set.name}
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: set.fg }} />
                                            </div>
                                        </button>
                                    ))}

                                    {/* Custom Color Popover */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button
                                                className={`h-8 rounded-md border-2 border-dashed flex items-center justify-center transition-all ${settings.colorKey === 'custom' ? 'ring-2 ring-primary ring-offset-2 border-solid' : 'hover:bg-accent'}`}
                                                title="Custom"
                                                onClick={() => setSettings(s => ({ ...s, colorKey: 'custom' }))}
                                            >
                                                <Palette className="w-4 h-4" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64">
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-sm">Custom Colors</h4>
                                                <div className="grid grid-cols-3 items-center gap-2">
                                                    <Label className="text-xs">Foreground</Label>
                                                    <Input
                                                        type="color"
                                                        className="h-8 w-full p-0 border-0 col-span-2"
                                                        value={settings.customColors.fg}
                                                        onChange={(e) => setSettings(s => ({ ...s, customColors: { ...s.customColors, fg: e.target.value } }))}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-3 items-center gap-2">
                                                    <Label className="text-xs">Background</Label>
                                                    <Input
                                                        type="color"
                                                        className="h-8 w-full p-0 border-0 col-span-2"
                                                        value={settings.customColors.bg}
                                                        onChange={(e) => setSettings(s => ({ ...s, customColors: { ...s.customColors, bg: e.target.value } }))}
                                                    />
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <Separator />

                        <Button variant="outline" className="w-full" onClick={handleScreenshot}>
                            <Camera className="w-4 h-4 mr-2" />
                            Screenshot
                        </Button>
                    </CardContent>
                </Card>

                {/* Connection Stats */}
                {status.isConnected && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Connection Stats
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">FPS</div>
                                    <div className="text-xl font-mono">{status.fps}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Bitrate</div>
                                    <div className="text-xl font-mono">{formatBytes(status.bps)}/s</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Duration</div>
                                    <div className="text-sm font-mono">{duration}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Frames</div>
                                    <div className="text-sm font-mono">{status.totalFrames.toLocaleString()}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </aside>

            {/* Main Display Area */}
            <section className="flex-1 flex flex-col items-center justify-center min-h-[500px] bg-secondary/10 rounded-xl border border-dashed relative overflow-hidden order-1 md:order-2">
                <div className="relative z-10 p-8">
                    <DisplayCanvas framebuffer={framebuffer} settings={settings} frameVersion={frameVersion} />
                </div>
                {/* Waiting State */}
                {!status.isConnected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-20">
                        <div className="text-center space-y-4 p-6 bg-card border rounded-xl shadow-lg max-w-sm">
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                                <Unplug className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold">Waiting for Display Stream</h3>
                                <p className="text-sm text-muted-foreground">
                                    Connect your device and enable "Screencast" mode in the F4HWN menu.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};
