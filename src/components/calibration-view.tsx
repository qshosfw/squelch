import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Download, Upload, AlertTriangle, AlertCircle, XCircle, FileWarning, HardDrive, Loader2 } from "lucide-react"
import { protocol, SerialStats } from "@/lib/protocol"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FlashProgressDialog, type LogEntry } from "./flash-progress-dialog"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePreferences } from "@/contexts/PreferencesContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, Trash2, Clock, Check } from "lucide-react"

interface CachedBackup {
    id: string;
    model: string;
    serial: string;
    date: string;
    data: string; // Base64
    offset: number;
}

export function CalibrationView({ connected, onConnect, onBusyChange }: {
    connected: boolean,
    onConnect: () => Promise<boolean>,
    onBusyChange?: (isBusy: boolean) => void
}) {
    const { toast } = useToast()
    const { enableBackupCache } = usePreferences()
    const [file, setFile] = useState<File | null>(null)
    const [isWorking, setIsWorking] = useState(false)
    const [progress, setProgress] = useState(0)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
    const [operationResult, setOperationResult] = useState<'success' | 'error' | null>(null)
    const [stats, setStats] = useState<SerialStats | null>(null)
    const [activeTab, setActiveTab] = useState("dump")
    const [statusMessage, setStatusMessage] = useState("")
    const [selectedOffset, setSelectedOffset] = useState<number>(0x1E00)
    const [isDetecting, setIsDetecting] = useState(false)
    const [selectedCacheId, setSelectedCacheId] = useState<string | null>(null)

    // Radio Details Persistence
    const [radioModel, setRadioModel] = useState<string>(() => localStorage.getItem("calib-radio-model") || "uvk5")
    const [customModelName, setCustomModelName] = useState<string>(() => localStorage.getItem("calib-custom-model") || "")
    const [serialNumber, setSerialNumber] = useState<string>(() => localStorage.getItem("calib-serial-number") || "")

    useEffect(() => {
        localStorage.setItem("calib-custom-model", customModelName);
    }, [customModelName])
    const [cachedBackups, setCachedBackups] = useState<CachedBackup[]>(() => {
        const stored = localStorage.getItem("calib-backups");
        return stored ? JSON.parse(stored) : [];
    })

    useEffect(() => {
        localStorage.setItem("calib-radio-model", radioModel);
    }, [radioModel])

    useEffect(() => {
        localStorage.setItem("calib-serial-number", serialNumber);
    }, [serialNumber])

    useEffect(() => {
        localStorage.setItem("calib-backups", JSON.stringify(cachedBackups));
    }, [cachedBackups])

    const logEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [logs])

    const detectOffset = async () => {
        if (isWorking) return;
        setIsDetecting(true);
        try {
            const info = await protocol.identify(1500);
            const versionMatch = info.blVersion.match(/v?(\d+)\.(\d+)\.(\d+)/);
            if (versionMatch) {
                const major = parseInt(versionMatch[1], 10);
                if (major >= 5) {
                    setSelectedOffset(0xB000);
                } else {
                    setSelectedOffset(0x1E00);
                }
            }
        } catch (e) {
            console.warn("Offset detection skipped/failed", e);
        } finally {
            setIsDetecting(false);
        }
    };

    useEffect(() => {
        if (activeTab === "dump") {
            detectOffset();
        }
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
    }

    const finishWork = (success: boolean) => {
        setIsWorking(false);
        setOperationResult(success ? 'success' : 'error');
        onBusyChange?.(false);
        protocol.onProgress = null;
        protocol.onLog = null;
        protocol.onStatsUpdate = null;
    }

    const handleBackup = async () => {
        if (!connected) {
            toast({ title: "Connection Required", description: "Please connect to your radio before backing up calibration." })
            const success = await onConnect();
            if (!success) return;
        }
        startWork("Preparing backup...");
        addLog("Starting Calibration Backup...", "info");

        protocol.onProgress = (p) => setProgress(p);
        protocol.onLog = (msg, type) => {
            addLog(msg, type as any);
            if (type !== 'tx' && type !== 'rx') {
                setStatusMessage(msg);
            }
        };
        protocol.onStatsUpdate = (s) => setStats(s);

        try {
            const data = await protocol.backupCalibration(selectedOffset);

            // Save to cache if enabled and serial is provided
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
                setCachedBackups(prev => [newBackup, ...prev].slice(0, 10)); // Keep last 10
            }

            // Create download
            const blob = new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const now = new Date();
            const dateStr = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear().toString().slice(-2)}`;
            const modelName = radioModel === "custom" ? customModelName : radioModel;
            const modelClean = (modelName || 'radio').toLowerCase().replace(/[^a-z0-9]/g, '');
            const serialClean = serialNumber.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';

            a.download = `calib_${modelClean}_${serialClean}_${dateStr}.dat`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

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
            toast({ title: "Connection Required", description: "Please connect to your radio before restoring calibration." })
            const success = await onConnect();
            if (!success) return;
        }

        startWork("Restoring to device...");
        addLog("Starting Calibration Restore...", "info");

        protocol.onProgress = (p) => setProgress(p);
        protocol.onLog = (msg, type) => {
            addLog(msg, type as any);
            if (type !== 'tx' && type !== 'rx') {
                setStatusMessage(msg);
            }
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
                addLog(`Using cached backup from ${new Date(activeCache.date).toLocaleDateString()} (${activeCache.model})`, "info");
            } else {
                const buffer = await file!.arrayBuffer();
                data = new Uint8Array(buffer);
            }

            await protocol.restoreCalibration(data, offset);

            addLog("Restore complete. Radio will reboot.", "success");
            setStatusMessage("Restore successful");
            toast({ title: "Restore Complete", description: "Calibration data written. Radio rebooting." });
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
        <div className="flex flex-col gap-6 lg:max-w-4xl lg:mx-auto">
            {/* Header Info */}
            <Alert variant="default" className="bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300">
                <HardDrive className="h-4 w-4 text-blue-500" />
                <AlertTitle>Factory Calibration Management</AlertTitle>
                <AlertDescription className="text-sm">
                    Calibration data (EEPROM 0x1E00) contains unique factory-set values for your specific radio.
                    Only restore backups made from <strong>this exact device</strong>.
                </AlertDescription>
            </Alert>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="dump" className="gap-2">
                        <Download className="h-4 w-4" />
                        Dump Backup
                    </TabsTrigger>
                    <TabsTrigger value="restore" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Restore Calibration
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dump">
                    <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <Download className="h-5 w-5 text-emerald-500" />
                                </div>
                                Backup EEPROM Calibration
                            </CardTitle>
                            <CardDescription>
                                Download the 512-byte calibration block from your radio's memory.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-4">
                                    <div className="rounded-xl border bg-background/50 p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                Radio Hardware Profile
                                                <Badge variant="outline" className="text-[10px] font-normal py-0">Optional</Badge>
                                            </Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Select value={radioModel} onValueChange={setRadioModel}>
                                                    <SelectTrigger className="h-9 text-xs">
                                                        <SelectValue placeholder="Select Model" />
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
                                                <Input
                                                    placeholder="Serial Number..."
                                                    value={serialNumber}
                                                    onChange={(e) => setSerialNumber(e.target.value)}
                                                    className="h-9 text-xs font-mono"
                                                />
                                            </div>
                                            {radioModel === "custom" && (
                                                <Input
                                                    placeholder="Enter custom model (e.g. UV-K5-76)"
                                                    value={customModelName}
                                                    onChange={(e) => setCustomModelName(e.target.value)}
                                                    className="h-9 text-xs mt-2"
                                                />
                                            )}
                                            <p className="text-[10px] text-muted-foreground leading-tight">
                                                Model and serial are used to name your backup file and organize cached data.
                                            </p>
                                        </div>

                                        <div className="pt-2">
                                            <h4 className="text-sm font-semibold flex items-center gap-2 text-emerald-600">
                                                <HardDrive className="h-4 w-4" />
                                                Reading Calibration
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                                                Calibration data is unique to your radio and should be backed up regularly.
                                                This data is not included in standard programming backups.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-end gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">EEPROM Offset</Label>
                                            {isDetecting && <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />}
                                        </div>
                                        <Tabs
                                            value={selectedOffset === 0x1E00 ? "legacy" : "new"}
                                            onValueChange={(val) => setSelectedOffset(val === "legacy" ? 0x1E00 : 0xB000)}
                                            className="w-full"
                                        >
                                            <TabsList className="grid w-full grid-cols-2 bg-emerald-500/5 h-11 p-1">
                                                <TabsTrigger value="legacy" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                                                    0x1E00
                                                </TabsTrigger>
                                                <TabsTrigger value="new" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                                                    0xB000
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                    <Button
                                        size="lg"
                                        onClick={handleBackup}
                                        disabled={isWorking}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                                    >
                                        {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                        Download Backup
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="restore">
                    <Card className="border-destructive/20 bg-destructive/[0.02]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-destructive/10">
                                    <Upload className="h-5 w-5 text-destructive" />
                                </div>
                                Restore Calibration Data
                            </CardTitle>
                            <CardDescription>
                                Write a previously saved calibration file back to the radio's EEPROM.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive dark:text-red-400">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle className="font-bold">Never restore files from other radios</AlertTitle>
                                <AlertDescription className="text-xs leading-relaxed">
                                    Calibration data is unique to your specific hardware. It contains tuned values for your <strong>Radio Clock</strong>, <strong>TX Power levels</strong> for all bands, <strong>Microphone sensitivity</strong>, and <strong>Audio levels</strong>.
                                </AlertDescription>
                            </Alert>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">Select Source</Label>
                                        {cachedBackups.length > 0 && (
                                            <Badge variant="secondary" className="text-[10px] font-normal uppercase tracking-wider">
                                                {cachedBackups.length} Saved
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {cachedBackups.length > 0 && (
                                            <ScrollArea className="h-[140px] w-full rounded-xl border bg-background/50 p-2">
                                                <div className="space-y-1.5">
                                                    {cachedBackups.map((backup) => (
                                                        <div
                                                            key={backup.id}
                                                            onClick={() => {
                                                                setSelectedCacheId(backup.id);
                                                                setFile(null);
                                                            }}
                                                            className={cn(
                                                                "group flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all",
                                                                selectedCacheId === backup.id
                                                                    ? "border-destructive/40 bg-destructive/[0.03] shadow-inner"
                                                                    : "border-transparent bg-muted/30 hover:bg-muted/50"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={cn(
                                                                    "p-1.5 rounded-md",
                                                                    selectedCacheId === backup.id ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                                                                )}>
                                                                    {selectedCacheId === backup.id ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] font-bold uppercase tracking-tight">{backup.model}</span>
                                                                        <span className="text-[10px] font-mono text-muted-foreground truncate">{backup.serial}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                                        <Calendar className="h-3 w-3" />
                                                                        {new Date(backup.date).toLocaleDateString()}
                                                                        <Badge variant="outline" className="text-[9px] h-3 px-1 border-dotted">
                                                                            0x{backup.offset.toString(16).toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                                                onClick={(e) => removeCacheEntry(e, backup.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        )}

                                        <div className="flex items-center justify-center w-full">
                                            <label htmlFor="calib-file" className={cn(
                                                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-all",
                                                file ? "border-destructive bg-destructive/5" : "border-muted-foreground/25 opacity-70"
                                            )}>
                                                <div className="flex flex-col items-center justify-center pt-2 pb-2">
                                                    {file ? (
                                                        <>
                                                            <HardDrive className="w-6 h-6 mb-1 text-destructive" />
                                                            <p className="mb-0 text-xs text-foreground font-medium truncate max-w-[200px]">{file.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-5 h-5 mb-1 text-muted-foreground" />
                                                            <p className="text-[11px] text-muted-foreground font-medium">Click to upload .dat backup</p>
                                                        </>
                                                    )}
                                                </div>
                                                <Input
                                                    id="calib-file"
                                                    type="file"
                                                    accept=".dat,.bin"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                    disabled={isWorking}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                    {(file && file.size !== 512) && (
                                        <p className="text-[10px] text-destructive flex items-center gap-1 font-medium">
                                            <XCircle className="h-3 w-3" />
                                            File size must be exactly 512 bytes.
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col justify-end gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Offset</Label>
                                        </div>
                                        <Tabs
                                            value={selectedOffset === 0x1E00 ? "legacy" : "new"}
                                            onValueChange={(val) => setSelectedOffset(val === "legacy" ? 0x1E00 : 0xB000)}
                                            className="w-full"
                                        >
                                            <TabsList className="grid w-full grid-cols-2 bg-destructive/5 h-11 p-1">
                                                <TabsTrigger value="legacy" className="data-[state=active]:bg-destructive data-[state=active]:text-white">
                                                    0x1E00
                                                </TabsTrigger>
                                                <TabsTrigger value="new" className="data-[state=active]:bg-destructive data-[state=active]:text-white">
                                                    0xB000
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>

                                    <div className="rounded-xl border bg-background/50 p-4 space-y-3">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                            <FileWarning className="h-4 w-4 text-destructive" />
                                            Before you proceed:
                                        </h4>
                                        <ul className="space-y-2 text-xs text-muted-foreground">
                                            <li className="flex items-start gap-2">
                                                <Badge variant="outline" className="h-1 w-1 p-0 rounded-full bg-destructive border-none mt-1.5" />
                                                <span>Verify the radio is connected and stable.</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Badge variant="outline" className="h-1 w-1 p-0 rounded-full bg-destructive border-none mt-1.5" />
                                                <span>Ensure the battery is above 3.7V.</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <Button
                                        size="lg"
                                        variant="destructive"
                                        onClick={() => setIsRestoreConfirmOpen(true)}
                                        disabled={isWorking || (!file && !selectedCacheId) || (file ? file.size !== 512 : false)}
                                        className="w-full shadow-lg shadow-destructive/20"
                                    >
                                        {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        Restore to Device
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Confirmation Dialog */}
            <Dialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Confirm EEPROM Overwrite
                        </DialogTitle>
                        <DialogDescription>
                            You are about to overwrite the radio's calibration data. This action cannot be undone without a backup.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Source:</span>
                                <span className="font-mono">{selectedCacheId ? "Local Cache" : file?.name}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Target Offset:</span>
                                <span className="font-mono uppercase">0x{selectedCacheId ? cachedBackups.find(b => b.id === selectedCacheId)?.offset.toString(16) : selectedOffset.toString(16)}</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsRestoreConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRestore}>
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Overwrite EEPROM
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Progress/Log Dialog */}
            <FlashProgressDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                isFlashing={isWorking}
                progress={progress}
                statusMessage={statusMessage}
                logs={logs}
                stats={stats}
                flashResult={operationResult}
                title="EEPROM Calibration"
                description={isWorking ? "Transferring calibration data..." : undefined}
            />
        </div>
    )
}
