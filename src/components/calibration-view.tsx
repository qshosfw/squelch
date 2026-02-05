import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Download, Upload, AlertTriangle, Terminal } from "lucide-react"
import { protocol } from "@/lib/protocol"
import { useToast } from "@/hooks/use-toast"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

export function CalibrationView({ onBusyChange }: { onBusyChange?: (isBusy: boolean) => void }) {
    const { toast } = useToast()
    const [file, setFile] = useState<File | null>(null)
    const [isWorking, setIsWorking] = useState(false)
    const [progress, setProgress] = useState(0)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [showLogs, setShowLogs] = useState(true)
    const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)

    const logEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [logs, isLogDialogOpen])

    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, message: msg, type }]);
    }

    const startWork = () => {
        setIsWorking(true);
        setIsLogDialogOpen(true);
        setProgress(0);
        setLogs([]);
        onBusyChange?.(true);
    }

    const finishWork = () => {
        setIsWorking(false);
        onBusyChange?.(false);
        // Clear callbacks
        protocol.onProgress = null;
        protocol.onLog = null;
    }

    const handleBackup = async () => {
        startWork();
        addLog("Starting Calibration Backup...", "info");

        protocol.onProgress = (p) => setProgress(p);
        protocol.onLog = (msg, type) => addLog(msg, type as any);

        try {
            const data = await protocol.backupEEPROM();

            // Create download
            const blob = new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `k5_calibration_${new Date().toISOString().slice(0, 10)}.bin`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            addLog("Backup downloaded successfully.", "success");
            toast({ title: "Backup Complete", description: "Calibration data saved." });
        } catch (e: any) {
            addLog(`Error: ${e.message}`, "error");
            toast({ variant: "destructive", title: "Backup Failed", description: e.message });
        } finally {
            finishWork();
        }
    };

    const handleRestore = async () => {
        setIsRestoreConfirmOpen(false);
        if (!file) return;

        startWork();
        addLog("Starting Calibration Restore...", "info");

        protocol.onProgress = (p) => setProgress(p);
        protocol.onLog = (msg, type) => addLog(msg, type as any);

        try {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);

            await protocol.restoreEEPROM(data);

            addLog("Restore complete. Please reboot device.", "success");
            toast({ title: "Restore Complete", description: "Calibration data written. Reboot required." });
        } catch (e: any) {
            addLog(`Error: ${e.message}`, "error");
            toast({ variant: "destructive", title: "Restore Failed", description: e.message });
        } finally {
            finishWork();
        }
    };

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
                {/* Backup Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-emerald-500" />
                            Backup Calibration
                        </CardTitle>
                        <CardDescription>
                            Read the calibration data (EEPROM) from your device.
                            Always keep a backup before modifying settings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <div className="bg-muted/30 p-4 rounded-lg text-sm text-muted-foreground border border-dashed">
                                Identifies legacy vs new firmware offsets automatically based on device handshake.
                            </div>
                            <Button onClick={handleBackup} disabled={isWorking} variant="outline" className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                Download Backup (.bin)
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Restore Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-blue-500" />
                            Restore Calibration
                        </CardTitle>
                        <CardDescription>
                            Write a calibration file back to the device.
                            <span className="text-amber-500 font-semibold block mt-1">Warning: Incorrect data can bricks radio RF.</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Calibration File</label>
                                <Input
                                    type="file"
                                    accept=".bin"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    disabled={isWorking}
                                />
                            </div>
                            <Button
                                onClick={() => setIsRestoreConfirmOpen(true)}
                                disabled={isWorking || !file}
                                className="w-full"
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Flash to Device
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Confirm Restore
                        </DialogTitle>
                        <DialogDescription>
                            You are about to overwrite the radio's calibration data.
                            If this file is from a different radio, signal and power levels may be incorrect.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="rounded border bg-muted p-2 text-sm font-mono">
                            File: {file?.name}<br />
                            Size: {file?.size} bytes
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRestoreConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRestore}>Overwrite EEPROM</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Progress/Log Dialog */}
            <Dialog open={isLogDialogOpen} onOpenChange={(open) => { if (!isWorking) setIsLogDialogOpen(open) }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Calibration Operation</DialogTitle>
                        <DialogDescription>Please wait while data is transferred...</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>

                        <div className="rounded-md border">
                            <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Terminal className="h-4 w-4" />
                                    Log
                                </div>
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowLogs(!showLogs)}>
                                    {showLogs ? "Hide" : "Show"}
                                </Button>
                            </div>
                            {showLogs && (
                                <ScrollArea className="h-[200px] w-full p-4 font-mono text-xs">
                                    <div className="space-y-1">
                                        {logs.map((log, i) => (
                                            <div key={i} className={cn(
                                                "flex gap-2",
                                                log.type === 'error' ? "text-red-500" :
                                                    log.type === 'success' ? "text-green-500" :
                                                        log.type === 'warning' ? "text-amber-500" : "text-muted-foreground"
                                            )}>
                                                <span className="opacity-50 select-none">[{log.time}]</span>
                                                <span>{log.message}</span>
                                            </div>
                                        ))}
                                        <div ref={logEndRef} />
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsLogDialogOpen(false)} disabled={isWorking}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
