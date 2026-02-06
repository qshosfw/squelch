import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DisplayCanvas } from './DisplayCanvas';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { COLOR_SETS, type ViewerSettings, createDefaultSettings } from '@/lib/lcd-constants';
import {
    Camera,
    Circle,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Settings,
    Palette,
    Grid,
    Ghost,
    Moon,
    Sun,
    Activity,
    Square,
    Download,
    Lightbulb,
    Play,
    Pause,
    Loader2
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

// Recording state
interface RecordingState {
    isRecording: boolean;
    frames: string[];
    startTime: number;
}

const saveBlob = async (blob: Blob, suggestedName: string, types: { description: string, accept: Record<string, string[]> }[]) => {
    try {
        if ('showSaveFilePicker' in window) {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName,
                types
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = suggestedName;
            link.click();
            URL.revokeObjectURL(link.href);
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error('Save failed', err);
        }
    }
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 2);
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const RecordingPreview: React.FC<{
    frames: string[];
    onSave: (start: number, end: number) => void;
    onDiscard: () => void;
    isSaving: boolean;
    progress: number | null;
}> = ({ frames, onSave, onDiscard, isSaving, progress }) => {
    const [range, setRange] = useState([0, Math.max(0, frames.length - 1)]);
    const [current, setCurrent] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        setRange([0, Math.max(0, frames.length - 1)]);
    }, [frames.length]);

    useEffect(() => {
        if (!playing) return;
        const timer = setInterval(() => {
            setCurrent(c => {
                const next = c + 1;
                if (next > range[1]) return range[0];
                return next;
            });
        }, 100);
        return () => clearInterval(timer);
    }, [playing, range]);

    useEffect(() => {
        if (current < range[0]) setCurrent(range[0]);
        if (current > range[1]) setCurrent(range[1]);
    }, [range]);

    const estimatedSize = dimensions.width > 0
        ? formatBytes((range[1] - range[0] + 1) * dimensions.width * dimensions.height / 2)
        : '~';

    return (
        <div className="flex flex-col gap-4">
            <div className="relative aspect-[2/1] bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
                {frames.length > 0 && (
                    <img
                        src={frames[current] || frames[0]}
                        className="h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                        onLoad={(e) => {
                            if (dimensions.width === 0) {
                                setDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                            }
                        }}
                    />
                )}
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-mono backdrop-blur-sm">
                    Frame {current + 1} / {frames.length}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setPlaying(!playing)}>
                        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Slider
                        value={range}
                        min={0}
                        max={Math.max(0, frames.length - 1)}
                        step={1}
                        minStepsBetweenThumbs={1}
                        onValueChange={setRange}
                        className="flex-1"
                    />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>Start: {range[0]}</span>
                    <span>End: {range[1]}</span>
                    <span>Est. Size: {estimatedSize}</span>
                </div>
            </div>

            {isSaving && progress !== null && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress >= 100 ? "Finalizing..." : "Encoding GIF..."}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" onClick={onDiscard} disabled={isSaving}>Discard</Button>
                <Button onClick={() => onSave(range[0], range[1])} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    {progress && progress >= 100 ? "Finalizing..." : "Save GIF"}
                </Button>
            </DialogFooter>
        </div>
    );
};

export const ViewerPanel: React.FC<ViewerPanelProps> = ({
    framebuffer,
    frameVersion,
    settings,
    setSettings,
    status
}) => {
    const startTimeRef = useRef<number>(0);
    const [duration, setDuration] = useState('00:00');
    const [recording, setRecording] = useState<RecordingState>({ isRecording: false, frames: [], startTime: 0 });
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState('00:00');
    const recordingIntervalRef = useRef<number | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [encodingProgress, setEncodingProgress] = useState<number | null>(null);

    // Connection duration timer
    useEffect(() => {
        if (status.isConnected && startTimeRef.current === 0) {
            startTimeRef.current = Date.now();
        } else if (!status.isConnected) {
            startTimeRef.current = 0;
            setDuration('00:00');
        }
    }, [status.isConnected]);

    useEffect(() => {
        if (!status.isConnected) return;
        const timer = setInterval(() => {
            const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            setDuration(`${m}:${s}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [status.isConnected]);

    // Recording frame capture
    useEffect(() => {
        if (recording.isRecording) {
            recordingIntervalRef.current = window.setInterval(() => {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    setRecording(r => ({
                        ...r,
                        frames: [...r.frames, canvas.toDataURL('image/png')]
                    }));
                }
            }, 100); // 10 FPS capture
        } else if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        return () => {
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        };
    }, [recording.isRecording]);

    // Update recording duration
    useEffect(() => {
        if (!recording.isRecording) return;
        const timer = setInterval(() => {
            const diff = Math.floor((Date.now() - recording.startTime) / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            setRecordingDuration(`${m}:${s}`);
        }, 100);
        return () => clearInterval(timer);
    }, [recording.isRecording, recording.startTime]);

    const handleScreenshot = useCallback(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            const filename = `capture-${timestamp}.png`;

            canvas.toBlob(async (blob) => {
                if (blob) {
                    await saveBlob(blob, filename, [{
                        description: 'PNG Image',
                        accept: { 'image/png': ['.png'] }
                    }]);
                }
            }, 'image/png');
        }
    }, []);

    const toggleRecording = useCallback(() => {
        if (recording.isRecording) {
            // Stop recording - show save dialog
            setRecording(r => ({ ...r, isRecording: false }));
            if (recording.frames.length > 0) {
                setShowSaveDialog(true);
            }
        } else {
            // Start recording
            setRecording({ isRecording: true, frames: [], startTime: Date.now() });
            setRecordingDuration('00:00');
        }
    }, [recording.isRecording, recording.frames.length]);

    const saveRecording = useCallback(async (startFrame: number, endFrame: number) => {
        if (recording.frames.length === 0) {
            setShowSaveDialog(false);
            return;
        }

        setEncodingProgress(0);
        await new Promise(r => setTimeout(r, 50));

        try {
            const encoder = new GIFEncoder();

            const firstImg = await new Promise<HTMLImageElement>((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = recording.frames[0];
            });

            const { width, height } = firstImg;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (!ctx) return;

            const framesToSave = recording.frames.slice(startFrame, endFrame + 1);

            for (let i = 0; i < framesToSave.length; i++) {
                const frameUrl = framesToSave[i];
                const img = await new Promise<HTMLImageElement>((resolve) => {
                    const im = new Image();
                    im.onload = () => resolve(im);
                    im.src = frameUrl;
                });

                ctx.drawImage(img, 0, 0);
                const { data } = ctx.getImageData(0, 0, width, height);

                const palette = quantize(data, 256);
                const index = applyPalette(data, palette);

                encoder.writeFrame(index, width, height, { palette, delay: 100 });

                if (i % 2 === 0 || i === framesToSave.length - 1) {
                    setEncodingProgress(Math.round(((i + 1) / framesToSave.length) * 100));
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            encoder.finish();

            const blob = new Blob([encoder.bytes()], { type: 'image/gif' });
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            const filename = `recording-${timestamp}.gif`;

            await saveBlob(blob, filename, [{
                description: 'GIF Image',
                accept: { 'image/gif': ['.gif'] }
            }]);
        } catch (error) {
            console.error("GIF Encoding failed", error);
        } finally {
            setEncodingProgress(null);
            setRecording({ isRecording: false, frames: [], startTime: 0 });
            setShowSaveDialog(false);
        }
    }, [recording.frames]);



    const discardRecording = useCallback(() => {
        setRecording({ isRecording: false, frames: [], startTime: 0 });
        setShowSaveDialog(false);
    }, []);

    const updateSetting = useCallback(<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, [setSettings]);

    const resetSettings = useCallback(() => {
        setSettings(createDefaultSettings());
    }, [setSettings]);

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Left: Status */}
                    <div className="flex items-center gap-2">
                        <Badge variant={status.isConnected ? "default" : "secondary"} className="gap-1.5">
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                status.isConnected ? "bg-green-400 animate-pulse" : "bg-muted-foreground"
                            )} />
                            {status.isConnected ? `${status.fps} FPS` : 'Disconnected'}
                        </Badge>
                        {status.isConnected && (
                            <>
                                <Badge variant="outline" className="font-mono text-xs">
                                    {formatBytes(status.bps)}/s
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                    {duration}
                                </Badge>
                            </>
                        )}
                    </div>

                    {/* Center: Zoom */}
                    <div className="flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateSetting('pixelSize', Math.max(2, settings.pixelSize - 0.5))}
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zoom Out</TooltipContent>
                        </Tooltip>
                        <span className="text-xs font-mono w-10 text-center">{settings.pixelSize}x</span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateSetting('pixelSize', Math.min(12, settings.pixelSize + 0.5))}
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zoom In</TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1">
                        {/* Quick toggles */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={settings.invertLcd ? "default" : "ghost"}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateSetting('invertLcd', settings.invertLcd ? 0 : 1)}
                                >
                                    {settings.invertLcd ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Invert Colors (I)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={settings.pixelLcd ? "default" : "ghost"}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateSetting('pixelLcd', settings.pixelLcd ? 0 : 1)}
                                >
                                    <Grid className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>LCD Grid (P)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={settings.lcdGhosting ? "default" : "ghost"}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateSetting('lcdGhosting', settings.lcdGhosting ? 0 : 1)}
                                >
                                    <Ghost className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>LCD Ghosting</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={settings.backlightShadow ? "default" : "ghost"}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateSetting('backlightShadow', settings.backlightShadow ? 0 : 1)}
                                >
                                    <Lightbulb className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Backlight Glow</TooltipContent>
                        </Tooltip>

                        <Separator orientation="vertical" className="h-6 mx-1" />

                        {/* Color picker */}
                        <Popover>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Palette className="w-4 h-4" />
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Color Theme</TooltipContent>
                            </Tooltip>
                            <PopoverContent className="w-48 p-2" align="end">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Display Color</Label>
                                    <ToggleGroup
                                        type="single"
                                        value={settings.colorKey}
                                        onValueChange={(val) => val && updateSetting('colorKey', val)}
                                        className="grid grid-cols-4 gap-1"
                                    >
                                        {Object.entries(COLOR_SETS).map(([key, set]) => (
                                            <Tooltip key={key}>
                                                <TooltipTrigger asChild>
                                                    <ToggleGroupItem
                                                        value={key}
                                                        className="h-8 w-8 p-0 rounded-md"
                                                        style={{ backgroundColor: set.bg }}
                                                    >
                                                        <div
                                                            className="w-3 h-3 rounded-sm"
                                                            style={{ backgroundColor: set.fg }}
                                                        />
                                                    </ToggleGroupItem>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">{set.name}</TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </ToggleGroup>
                                    <div className="flex gap-1 pt-1">
                                        <Input
                                            type="color"
                                            className="h-8 flex-1 p-1"
                                            value={settings.customColors.bg}
                                            onChange={(e) => {
                                                updateSetting('customColors', { ...settings.customColors, bg: e.target.value });
                                                updateSetting('colorKey', 'custom');
                                            }}
                                        />
                                        <Input
                                            type="color"
                                            className="h-8 flex-1 p-1"
                                            value={settings.customColors.fg}
                                            onChange={(e) => {
                                                updateSetting('customColors', { ...settings.customColors, fg: e.target.value });
                                                updateSetting('colorKey', 'custom');
                                            }}
                                        />
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Settings */}
                        <Popover open={showSettings} onOpenChange={setShowSettings}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Settings className="w-4 h-4" />
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Settings</TooltipContent>
                            </Tooltip>
                            <PopoverContent className="w-56 p-3" align="end">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <Label>Backlight</Label>
                                            <span className="font-mono text-muted-foreground">{settings.backlightLevel}</span>
                                        </div>
                                        <Slider
                                            min={0} max={10} step={1}
                                            value={[settings.backlightLevel]}
                                            onValueChange={([val]) => updateSetting('backlightLevel', val)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <Label>Contrast</Label>
                                            <span className="font-mono text-muted-foreground">{settings.contrast}</span>
                                        </div>
                                        <Slider
                                            min={0} max={15} step={1}
                                            value={[settings.contrast]}
                                            onValueChange={([val]) => updateSetting('contrast', val)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <Label>Aspect Ratio</Label>
                                            <span className="font-mono text-muted-foreground">{settings.pixelAspectRatio.toFixed(2)}</span>
                                        </div>
                                        <Slider
                                            min={0.5} max={2.0} step={0.05}
                                            value={[settings.pixelAspectRatio]}
                                            onValueChange={([val]) => updateSetting('pixelAspectRatio', val)}
                                        />
                                    </div>
                                    <Separator />
                                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetSettings}>
                                        <RotateCcw className="w-3 h-3 mr-1.5" />
                                        Reset Settings
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Separator orientation="vertical" className="h-6 mx-1" />

                        {/* Capture */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleScreenshot}>
                                    <Camera className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Screenshot (Space)</TooltipContent>
                        </Tooltip>

                        {/* Record */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={recording.isRecording ? "ghost" : "ghost"}
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 transition-all duration-300",
                                        recording.isRecording && "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.7)] animate-pulse scale-110"
                                    )}
                                    onClick={toggleRecording}
                                >
                                    {recording.isRecording ? (
                                        <Square className="w-3 h-3 fill-current" />
                                    ) : (
                                        <Circle className="w-4 h-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {recording.isRecording ? `Stop (${recordingDuration})` : 'Record'}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Recording indicator */}
                {recording.isRecording && (
                    <div className="flex items-center justify-center gap-2 py-1 px-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                        <span className="text-xs font-medium text-destructive">
                            Recording {recordingDuration} • {recording.frames.length} frames
                        </span>
                    </div>
                )}

                {/* Display */}
                <div className="flex justify-center">
                    <DisplayCanvas
                        framebuffer={framebuffer}
                        settings={settings}
                        frameVersion={frameVersion}
                    />
                </div>

                {/* Stats footer */}
                {status.isConnected && (
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {status.totalFrames.toLocaleString()} frames
                        </span>
                    </div>
                )}
            </div>

            {/* Save Recording Dialog */}
            <Dialog open={showSaveDialog} onOpenChange={(open) => {
                if (!open && !encodingProgress) setShowSaveDialog(false);
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Save Recording</DialogTitle>
                        <DialogDescription>
                            Trim and save your capture.
                        </DialogDescription>
                    </DialogHeader>

                    <RecordingPreview
                        frames={recording.frames}
                        onSave={saveRecording}
                        onDiscard={discardRecording}
                        isSaving={encodingProgress !== null}
                        progress={encodingProgress}
                    />
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
};
