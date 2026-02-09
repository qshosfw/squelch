"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Check,
    Clock,
    Calendar,
    Download,
    HardDrive,
    Loader2,
    Trash2,
    Upload,
    AlertTriangle
} from "lucide-react"
import { protocol, SerialStats } from "@/lib/protocol"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FlashProgressDialog, type LogEntry } from "./flash-progress-dialog"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePreferences } from "@/contexts/PreferencesContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import { QSHFile, TAG_G_TITLE, TAG_G_AUTHOR, TAG_G_TYPE, TAG_D_LABEL, TAG_D_START_ADDR, TAG_ID_RADIO_UID, TAG_ID_LABEL } from "../lib/qsh"
import { FileJson, FileArchive, ChevronDown } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CachedBackup {
    id: string;
    model: string;
    serial: string;
    date: string;
    data: string;
    offset: number;
}

import { RadioProfile } from "@/lib/framework/module-interface"

export function CalibrationView({ connected, onConnect, onBusyChange, deviceInfo, activeProfile, initialFile, initialParsedData }: {
    connected: boolean,
    onConnect: () => Promise<boolean>,
    onBusyChange?: (isBusy: boolean) => void,
    deviceInfo?: {
        version?: string;
        portInfo?: any;
        extended?: Record<string, string>;
        telemetry?: any;
    },
    activeProfile?: RadioProfile | null,
    initialFile?: File | null,
    initialParsedData?: Uint8Array | null
}) {
    const { toast } = useToast()
    const { enableBackupCache, bootloaderDetected } = usePreferences()
    const [file, setFile] = useState<File | null>(null)

    // Sync with preloaded data
    useEffect(() => {
        if (initialFile) setFile(initialFile);
        if (initialParsedData) {
            // Already parsed in App.tsx? We can use it if we want.
        }
    }, [initialFile, initialParsedData]);
    const [isWorking, setIsWorking] = useState(false)
    const [progress, setProgress] = useState(0)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
    const [operationResult, setOperationResult] = useState<'success' | 'error' | null>(null)
    const [stats, setStats] = useState<SerialStats | null>(null)
    const [endTime, setEndTime] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState("dump")
    const [statusMessage, setStatusMessage] = useState("")
    const [selectedOffset, setSelectedOffset] = useState<number>(0x1E00)
    const [isDetecting, setIsDetecting] = useState(false)
    const [selectedCacheId, setSelectedCacheId] = useState<string | null>(null)

    const [radioModel, setRadioModel] = useState<string>(() => localStorage.getItem("calib-radio-model") || "uvk5")
    const [customModelName, setCustomModelName] = useState<string>(() => localStorage.getItem("calib-custom-model") || "")
    const [serialNumber, setSerialNumber] = useState<string>(() => localStorage.getItem("calib-serial-number") || "")

    useEffect(() => { localStorage.setItem("calib-custom-model", customModelName); }, [customModelName])
    const [cachedBackups, setCachedBackups] = useState<CachedBackup[]>(() => {
        const stored = localStorage.getItem("calib-backups");
        return stored ? JSON.parse(stored) : [];
    })

    useEffect(() => { localStorage.setItem("calib-radio-model", radioModel); }, [radioModel])
    useEffect(() => { localStorage.setItem("calib-serial-number", serialNumber); }, [serialNumber])
    useEffect(() => { localStorage.setItem("calib-backups", JSON.stringify(cachedBackups)); }, [cachedBackups])

    // Autofill Serial from Device Info or Profile computation
    useEffect(() => {
        if (!connected) return;

        const fetchSerial = async () => {
            // Priority 1: Profile-computed serial (e.g. Crockford/Base32)
            if (activeProfile) {
                try {
                    const sn = await activeProfile.getSerialNumber(protocol);
                    if (sn && sn !== serialNumber) {
                        setSerialNumber(sn);
                        return;
                    }
                } catch (e) {
                    console.warn("Failed to fetch computed serial", e);
                }
            }

            // Priority 2: Standard extended info serial
            const deviceSerial = deviceInfo?.extended?.serial || deviceInfo?.extended?.Serial;
            if (deviceSerial && deviceSerial !== serialNumber) {
                setSerialNumber(deviceSerial);
            }
        };

        fetchSerial();
    }, [deviceInfo, connected, activeProfile]);

    const logEndRef = useRef<HTMLDivElement>(null)
    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

    const detectOffset = async () => {
        if (isWorking) return;
        setIsDetecting(true);
        try {
            const info = await protocol.identify(1500);
            const versionMatch = info.firmwareVersion.match(/v?(\d+)\.(\d+)\.(\d+)/);
            if (versionMatch) {
                const major = parseInt(versionMatch[1], 10);
                setSelectedOffset(major >= 5 ? 0xB000 : 0x1E00);
            }
        } catch (e) {
            console.warn("Offset detection skipped/failed", e);
        } finally {
            setIsDetecting(false);
        }
    };

    useEffect(() => {
        if (activeTab === "dump") detectOffset();
    }, [activeTab]);

    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, message: msg, type }]);
    }

    const startWork = (msg: string) => {
        setIsWorking(true);
        setIsDialogOpen(true);
        setProgress(0);
        setLogs([]);
        setOperationResult(null);
        setStatusMessage(msg);
        onBusyChange?.(true);
        protocol.resetStats();
        setEndTime(null);
    }

    const finishWork = (success: boolean) => {
        setIsWorking(false);
        setOperationResult(success ? 'success' : 'error');
        onBusyChange?.(false);
        setEndTime(Date.now());
        protocol.onProgress = null;
        protocol.onLog = null;
        protocol.onStatsUpdate = null;
    }

    const downloadBlob = (data: Uint8Array, filename: string) => {
        const blob = new Blob([data as any], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const handleBackup = async (asQsh: boolean = false) => {
        if (!connected) {
            toast({ title: "Connection Required", description: "Please connect to your radio first." })
            const success = await onConnect();
            if (!success) return;
        }
        startWork("Preparing backup...");
        addLog(asQsh ? "Starting QSH Calibration Backup..." : "Starting Calibration Backup...", "info");

        protocol.onProgress = (p) => setProgress(p);
        protocol.onLog = (msg, type) => {
            addLog(msg, type as any);
            if (type !== 'tx' && type !== 'rx') setStatusMessage(msg);
        };
        protocol.onStatsUpdate = (s) => setStats(s);

        try {
            const data = await protocol.backupCalibration(selectedOffset);

            if (enableBackupCache && serialNumber) {
                const base64Data = btoa(String.fromCharCode(...Array.from(data)));
                const newBackup: CachedBackup = {
                    id: crypto.randomUUID(),
                    model: radioModel,
                    serial: serialNumber,
                    date: new Date().toISOString(),
                    data: base64Data,
                    offset: selectedOffset
                };
                setCachedBackups(prev => [newBackup, ...prev].slice(0, 10));
            }

            const modelName = radioModel === "custom" ? customModelName : radioModel;
            const modelClean = (modelName || 'radio').toLowerCase().replace(/[^a-z0-9]/g, '');
            const serialClean = serialNumber.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
            const now = new Date();
            const dateStr = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear().toString().slice(-2)}`;

            if (asQsh) {
                const qsh = new QSHFile();
                qsh.setGlobal({
                    [TAG_G_TITLE]: `Calibration Backup (${modelName})`,
                    [TAG_G_AUTHOR]: "Squelch User",
                    [TAG_G_TYPE]: "calibration"
                });

                // Fetch numeric UID if possible
                let numericUid: bigint | Uint8Array | null = null;
                if (activeProfile) {
                    try {
                        numericUid = await activeProfile.getNumericUID(protocol);
                    } catch (err) {
                        console.warn("Failed to fetch numeric UID", err);
                    }
                }

                qsh.addBlob(data, {
                    [TAG_D_LABEL]: "Calibration Data",
                    [TAG_D_START_ADDR]: selectedOffset,
                    [TAG_ID_RADIO_UID]: numericUid || "",
                    [TAG_ID_LABEL]: `${deviceInfo?.version || "Unknown FW"}, ${modelName}`
                });
                const qshBytes = await qsh.toUint8Array();
                downloadBlob(qshBytes, `calib_${modelClean}_${serialClean}_${dateStr}.qsh`);
            } else {
                downloadBlob(data, `calib_${modelClean}_${serialClean}_${dateStr}.dat`);
            }

            addLog("Backup downloaded successfully.", "success");
            setStatusMessage("Backup saved to file");
            toast({ title: "Backup Complete", description: "Calibration data saved." });
            finishWork(true);
        } catch (e: any) {
            addLog(`Error: ${e.message}`, "error");
            setStatusMessage("Operation Failed");
            toast({ variant: "destructive", title: "Backup Failed", description: e.message });
            finishWork(false);
        }
    };

    const handleRestore = async () => {
        setIsRestoreConfirmOpen(false);
        const activeCache = cachedBackups.find(b => b.id === selectedCacheId);
        if (!file && !activeCache) return;

        if (!connected) {
            toast({ title: "Connection Required", description: "Please connect to your radio first." })
            const success = await onConnect();
            if (!success) return;
        }

        startWork("Restoring to device...");
        addLog("Starting Calibration Restore...", "info");

        protocol.onProgress = (p) => setProgress(p);
        protocol.onLog = (msg, type) => {
            addLog(msg, type as any);
            if (type !== 'tx' && type !== 'rx') setStatusMessage(msg);
        };
        protocol.onStatsUpdate = (s) => setStats(s);

        try {
            let data: Uint8Array;
            let offset = selectedOffset;

            if (activeCache) {
                const binaryString = atob(activeCache.data);
                data = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    data[i] = binaryString.charCodeAt(i);
                }
                offset = activeCache.offset;
                addLog(`Using cached backup from ${new Date(activeCache.date).toLocaleDateString()}`, "info");
            } else {
                const buffer = await file!.arrayBuffer();
                data = new Uint8Array(buffer);

                // Handle QSH container
                if (file!.name.toLowerCase().endsWith('.qsh')) {
                    const qsh = await QSHFile.fromUint8Array(data);
                    if (!qsh) throw new Error("Invalid QSH file");

                    const calBlob = qsh.blobs.find(b =>
                        b.metadata[TAG_G_TYPE] === 'calibration' ||
                        b.metadata[TAG_D_LABEL]?.toLowerCase().includes('calib')
                    );

                    if (!calBlob) throw new Error("No calibration data found in QSH file");
                    if (calBlob.data.length !== 512) throw new Error(`Calibration data in QSH is invalid size (${calBlob.data.length} bytes)`);

                    data = calBlob.data;

                    // Optional: Update offset from QSH if present
                    if (calBlob.metadata[TAG_D_START_ADDR]) {
                        const qshOffset = Number(calBlob.metadata[TAG_D_START_ADDR]);
                        if (!isNaN(qshOffset)) {
                            offset = qshOffset;
                            addLog(`Using offset 0x${offset.toString(16).toUpperCase()} from QSH`, "info");
                        }
                    }
                }
            }

            await protocol.restoreCalibration(data, offset);

            addLog("Restore complete. Radio will reboot.", "success");
            setStatusMessage("Restore successful");
            toast({ title: "Restore Complete", description: "Calibration written. Radio rebooting." });
            finishWork(true);
        } catch (e: any) {
            addLog(`Error: ${e.message}`, "error");
            setStatusMessage("Operation Failed");
            toast({ variant: "destructive", title: "Restore Failed", description: e.message });
            finishWork(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        setFile(selectedFile);
        if (selectedFile) setSelectedCacheId(null);
    }

    const removeCacheEntry = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setCachedBackups(prev => prev.filter(b => b.id !== id));
        if (selectedCacheId === id) setSelectedCacheId(null);
    }

    return (
        <div className="flex flex-col h-full bg-transparent">

            <ScrollArea className="flex-1 bg-muted/5">
                {bootloaderDetected ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                            <AlertTriangle className="h-10 w-10 text-amber-500" />
                        </div>
                        <div className="max-w-md space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">DFU Mode Detected</h2>
                            <p className="text-muted-foreground">
                                Calibration tools are only available in <strong>Normal Mode</strong>.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Please restart your radio normally (without holding PTT) to access calibration features.
                            </p>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={() => onConnect()}>
                                Check Connection
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 lg:max-w-3xl lg:mx-auto">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="dump" className="gap-2">
                                    <Download className="h-4 w-4" />
                                    Backup
                                </TabsTrigger>
                                <TabsTrigger value="restore" className="gap-2">
                                    <Upload className="h-4 w-4" />
                                    Restore
                                </TabsTrigger>
                            </TabsList>

                            {activeProfile?.strings?.["calibration.warning"] && (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center gap-3 text-sm text-amber-600 dark:text-amber-500">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>{activeProfile.strings["calibration.warning"]}</span>
                                </div>
                            )}

                            <TabsContent value="dump" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-primary/10">
                                                <HardDrive className="h-5 w-5 text-primary" />
                                            </div>
                                            Backup Calibration
                                        </CardTitle>
                                        <CardDescription>
                                            Save the 512-byte calibration block from EEPROM to a file.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid gap-6 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Radio Model</Label>
                                                <Select value={radioModel} onValueChange={setRadioModel}>
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="uvk5">UV-K5</SelectItem>
                                                        <SelectItem value="uvk5v3">UV-K5 (v3)</SelectItem>
                                                        <SelectItem value="uvk5plus">UV-K5 Plus</SelectItem>
                                                        <SelectItem value="uvk6">UV-K6 / UV-5R Plus</SelectItem>
                                                        <SelectItem value="uvk1">UV-K1 / K8</SelectItem>
                                                        <SelectItem value="custom">Custom...</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {radioModel === "custom" && (
                                                    <Input
                                                        placeholder="Model name"
                                                        value={customModelName}
                                                        onChange={(e) => setCustomModelName(e.target.value)}
                                                        className="h-9"
                                                    />
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Serial Number</Label>
                                                <Input
                                                    placeholder="Optional"
                                                    value={serialNumber}
                                                    onChange={(e) => setSerialNumber(e.target.value)}
                                                    className="h-9 font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-sm font-medium">EEPROM Offset</Label>
                                                    {isDetecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant={selectedOffset === 0x1E00 ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-7 font-mono text-xs"
                                                        onClick={() => setSelectedOffset(0x1E00)}
                                                    >
                                                        0x1E00
                                                    </Button>
                                                    <Button
                                                        variant={selectedOffset === 0xB000 ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-7 font-mono text-xs"
                                                        onClick={() => setSelectedOffset(0xB000)}
                                                    >
                                                        0xB000
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Most UV-K5 radios use 0x1E00. Some newer firmware versions use 0xB000.
                                                We attempt to auto-detect this based on firmware version.
                                            </p>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end border-t bg-muted/20 p-4">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button disabled={isWorking} className="w-full md:w-auto bg-primary hover:bg-primary/90">
                                                    {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                    Export Calibration
                                                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[200px]">
                                                <DropdownMenuItem onClick={() => handleBackup(false)} className="gap-2 cursor-pointer">
                                                    <FileJson className="h-4 w-4 text-muted-foreground" />
                                                    <span>Export as .dat (Raw)</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleBackup(true)} className="gap-2 cursor-pointer">
                                                    <FileArchive className="h-4 w-4 text-primary" />
                                                    <span>Export as .qsh (Package)</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </CardFooter>
                                </Card>
                            </TabsContent>

                            <TabsContent value="restore" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-primary/10">
                                                <Upload className="h-5 w-5 text-primary" />
                                            </div>
                                            Restore Calibration
                                        </CardTitle>
                                        <CardDescription>
                                            Write calibration data back to EEPROM.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {cachedBackups.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Saved Backups</Label>
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {cachedBackups.length}
                                                    </Badge>
                                                </div>
                                                <ScrollArea className="h-40 rounded-lg border bg-background">
                                                    <div className="p-2 space-y-1">
                                                        {cachedBackups.map((backup) => (
                                                            <div
                                                                key={backup.id}
                                                                onClick={() => { setSelectedCacheId(backup.id); setFile(null); }}
                                                                className={cn(
                                                                    "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border border-transparent",
                                                                    selectedCacheId === backup.id
                                                                        ? "bg-primary/5 border-primary/20"
                                                                        : "hover:bg-muted"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {selectedCacheId === backup.id ? (
                                                                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                                                            <Check className="h-4 w-4 text-primary" />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <span className="font-semibold">{backup.model.toUpperCase()}</span>
                                                                            <Badge variant="outline" className="text-[10px] h-4 py-0 font-mono text-muted-foreground">
                                                                                {backup.serial}
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                                                                            <span className="flex items-center gap-1">
                                                                                <Calendar className="h-3 w-3" />
                                                                                {new Date(backup.date).toLocaleDateString()}
                                                                            </span>
                                                                            <span className="font-mono">0x{backup.offset.toString(16).toUpperCase()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                                                    onClick={(e) => removeCacheEntry(e, backup.id)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                                <div className="relative py-2">
                                                    <Separator />
                                                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground uppercase tracking-wider font-bold">
                                                        OR
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Upload File</Label>
                                            <div className="flex items-center justify-center w-full">
                                                <label htmlFor="calib-file" className={cn(
                                                    "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                                                    file ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                                                )}>
                                                    <div className="flex flex-col items-center justify-center py-2">
                                                        {file ? (
                                                            <>
                                                                <HardDrive className="w-6 h-6 mb-2 text-primary" />
                                                                <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                                                                <p className="text-xs text-muted-foreground mt-1">{(file.size)} bytes</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
                                                                <p className="text-sm text-foreground font-medium">Click to upload backup file</p>
                                                                <p className="text-xs text-muted-foreground mt-1">.dat, .bin, or .qsh</p>
                                                            </>
                                                        )}
                                                    </div>
                                                    <Input
                                                        id="calib-file"
                                                        type="file"
                                                        accept=".dat,.bin,.qsh"
                                                        className="hidden"
                                                        onChange={handleFileChange}
                                                        disabled={isWorking}
                                                    />
                                                </label>
                                            </div>
                                            {file && !file.name.toLowerCase().endsWith('.qsh') && file.size !== 512 && (
                                                <p className="text-xs text-destructive flex items-center gap-1 font-medium bg-destructive/10 p-2 rounded">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    File must be exactly 512 bytes (or use .qsh)
                                                </p>
                                            )}
                                        </div>

                                        <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-medium">Target Offset</Label>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant={selectedOffset === 0x1E00 ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-7 font-mono text-xs"
                                                        onClick={() => setSelectedOffset(0x1E00)}
                                                    >
                                                        0x1E00
                                                    </Button>
                                                    <Button
                                                        variant={selectedOffset === 0xB000 ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-7 font-mono text-xs"
                                                        onClick={() => setSelectedOffset(0xB000)}
                                                    >
                                                        0xB000
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end border-t bg-muted/20 p-4">
                                        <Button
                                            variant="destructive"
                                            className="w-full md:w-auto"
                                            onClick={() => setIsRestoreConfirmOpen(true)}
                                            disabled={isWorking || (!file && !selectedCacheId) || (file ? (file.size !== 512 && !file.name.toLowerCase().endsWith('.qsh')) : false)}
                                        >
                                            {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                            Restore to Device
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* Confirmation Dialog */}
                        <Dialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-destructive" />
                                        Confirm Restore
                                    </DialogTitle>
                                    <DialogDescription>
                                        This will overwrite your radio's calibration data. Only restore backups from this exact device.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Source</span>
                                        <span className="font-mono">{selectedCacheId ? "Saved Backup" : file?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Offset</span>
                                        <span className="font-mono uppercase">0x{(selectedCacheId ? cachedBackups.find(b => b.id === selectedCacheId)?.offset : selectedOffset)?.toString(16)}</span>
                                    </div>
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button variant="ghost" onClick={() => setIsRestoreConfirmOpen(false)}>Cancel</Button>
                                    <Button variant="destructive" onClick={handleRestore}>
                                        Restore
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Progress Dialog */}
                        <FlashProgressDialog
                            isOpen={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            isFlashing={isWorking}
                            progress={progress}
                            statusMessage={statusMessage}
                            logs={logs}
                            stats={stats}
                            flashResult={operationResult}
                            endTime={endTime}
                            title="EEPROM Calibration"
                            description={isWorking ? "Transferring calibration data..." : undefined}
                        />
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}
