import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, Upload, AlertTriangle, HardDrive, Loader2 } from "lucide-react"
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
    data: string;
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

    const logEndRef = useRef<HTMLDivElement>(null)
    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

    const detectOffset = async () => {
        if (isWorking) return;
        setIsDetecting(true);
        try {
            const info = await protocol.identify(1500);
            const versionMatch = info.blVersion.match(/v?(\d+)\.(\d+)\.(\d+)/);
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

    const handleBackup = async () => {
        if (!connected) {
            toast({ title: "Connection Required", description: "Please connect to your radio first." })
            const success = await onConnect();
            if (!success) return;
        }
        startWork("Preparing backup...");
        addLog("Starting Calibration Backup...", "info");

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
        <div className="flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="dump" className="gap-2">
                        <Download className="h-4 w-4" />
                        Backup
                    </TabsTrigger>
                    <TabsTrigger value="restore" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Restore
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dump" className="mt-4">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <HardDrive className="h-5 w-5 text-muted-foreground" />
                                Backup Calibration
                            </CardTitle>
                            <CardDescription>
                                Save the 512-byte calibration block from EEPROM
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
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

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Label className="text-sm">EEPROM Offset</Label>
                                    {isDetecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        variant={selectedOffset === 0x1E00 ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 font-mono text-xs"
                                        onClick={() => setSelectedOffset(0x1E00)}
                                    >
                                        0x1E00
                                    </Button>
                                    <Button
                                        variant={selectedOffset === 0xB000 ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 font-mono text-xs"
                                        onClick={() => setSelectedOffset(0xB000)}
                                    >
                                        0xB000
                                    </Button>
                                </div>
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleBackup}
                                disabled={isWorking}
                            >
                                {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Download Backup
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="restore" className="mt-4">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                Restore Calibration
                            </CardTitle>
                            <CardDescription>
                                Write calibration data back to EEPROM
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {cachedBackups.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm">Saved Backups</Label>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {cachedBackups.length}
                                        </Badge>
                                    </div>
                                    <ScrollArea className="h-32 rounded-lg border p-2">
                                        <div className="space-y-1">
                                            {cachedBackups.map((backup) => (
                                                <div
                                                    key={backup.id}
                                                    onClick={() => { setSelectedCacheId(backup.id); setFile(null); }}
                                                    className={cn(
                                                        "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                                                        selectedCacheId === backup.id
                                                            ? "bg-primary/10 border border-primary/20"
                                                            : "hover:bg-muted/50"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {selectedCacheId === backup.id ? (
                                                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                                        ) : (
                                                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <span className="font-medium">{backup.model.toUpperCase()}</span>
                                                                <span className="font-mono text-muted-foreground truncate">{backup.serial}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                                <Calendar className="h-3 w-3" />
                                                                {new Date(backup.date).toLocaleDateString()}
                                                                <span className="font-mono">0x{backup.offset.toString(16).toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                                        onClick={(e) => removeCacheEntry(e, backup.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <div className="relative">
                                        <Separator />
                                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                                            or
                                        </span>
                                    </div>
                                </>
                            )}

                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="calib-file" className={cn(
                                    "flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                                    file ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                                )}>
                                    <div className="flex flex-col items-center justify-center py-2">
                                        {file ? (
                                            <>
                                                <HardDrive className="w-5 h-5 mb-1 text-primary" />
                                                <p className="text-xs font-medium truncate max-w-[200px]">{file.name}</p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5 mb-1 text-muted-foreground" />
                                                <p className="text-xs text-muted-foreground">Upload .dat backup</p>
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

                            {file && file.size !== 512 && (
                                <p className="text-xs text-destructive">File must be exactly 512 bytes</p>
                            )}

                            <Separator />

                            <div className="flex items-center justify-between">
                                <Label className="text-sm">Target Offset</Label>
                                <div className="flex gap-1">
                                    <Button
                                        variant={selectedOffset === 0x1E00 ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 font-mono text-xs"
                                        onClick={() => setSelectedOffset(0x1E00)}
                                    >
                                        0x1E00
                                    </Button>
                                    <Button
                                        variant={selectedOffset === 0xB000 ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 font-mono text-xs"
                                        onClick={() => setSelectedOffset(0xB000)}
                                    >
                                        0xB000
                                    </Button>
                                </div>
                            </div>

                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={() => setIsRestoreConfirmOpen(true)}
                                disabled={isWorking || (!file && !selectedCacheId) || (file ? file.size !== 512 : false)}
                            >
                                {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Restore to Device
                            </Button>
                        </CardContent>
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
    )
}
