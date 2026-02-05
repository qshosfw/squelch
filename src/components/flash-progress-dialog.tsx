import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, Terminal, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { SerialStats } from "@/lib/protocol"
import { SerialStatsDisplay } from "./serial-stats"
import { useState, useRef, useEffect } from "react"

export interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning' | 'tx' | 'rx';
}

interface FlashProgressDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    isFlashing: boolean;
    progress: number;
    statusMessage: string;
    logs: LogEntry[];
    stats: SerialStats | null;
    flashResult: 'success' | 'error' | null;
    onSkipWaiting?: () => void;
    showSkipButton?: boolean;
    title?: string;
    description?: string;
}

export function FlashProgressDialog({
    isOpen,
    onOpenChange,
    isFlashing,
    progress,
    statusMessage,
    logs,
    stats,
    flashResult,
    onSkipWaiting,
    showSkipButton,
    title = "Firmware Update",
    description
}: FlashProgressDialogProps) {
    const [showLogs, setShowLogs] = useState(true)
    const logEndRef = useRef<HTMLDivElement>(null)

    const defaultDescription = isFlashing
        ? "Please do not disconnect your device."
        : flashResult === 'success'
            ? "Operation completed successfully."
            : "Operation failed.";

    const displayDescription = description || defaultDescription;

    useEffect(() => {
        if (showLogs) {
            logEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [logs, showLogs, isOpen])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!isFlashing) onOpenChange(open);
        }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        {isFlashing ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : flashResult === 'success' ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : flashResult === 'error' ? (
                            <XCircle className="h-5 w-5 text-destructive" />
                        ) : null}
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {displayDescription}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className={cn(
                                "font-medium transition-colors",
                                flashResult === 'error' ? "text-destructive" :
                                    flashResult === 'success' ? "text-emerald-500" : "text-muted-foreground"
                            )}>
                                {statusMessage || (isFlashing ? "Working..." : "Ready")}
                            </span>
                            <span className="font-mono font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className={cn("h-2", flashResult === 'success' && "bg-emerald-100 dark:bg-emerald-950 [&>div]:bg-emerald-500")} />
                    </div>

                    {/* Stats Display */}
                    {stats && <SerialStatsDisplay stats={stats} compact />}

                    {isFlashing && progress === 0 && (
                        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            <AlertTitle>Waiting for Device</AlertTitle>
                            <AlertDescription className="text-xs">
                                If your device is not detected:
                                <ol className="list-decimal ml-4 mt-1 space-y-1">
                                    <li>Turn the radio <strong>OFF</strong></li>
                                    <li>Hold the <strong>PTT</strong> button</li>
                                    <li>Turn the radio <strong>ON</strong> while holding PTT</li>
                                    <li>Release PTT when flashlight turns on</li>
                                </ol>
                                {showSkipButton && onSkipWaiting && (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-amber-600 dark:text-amber-500 font-semibold mt-2"
                                        onClick={onSkipWaiting}
                                    >
                                        Skip waiting for bootloader...
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="rounded-lg border bg-card overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Terminal className="h-4 w-4" />
                                Live Log
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowLogs(!showLogs)}>
                                {showLogs ? "Hide" : "Show"}
                            </Button>
                        </div>
                        {showLogs && (
                            <ScrollArea className="h-[200px] w-full">
                                <div className="p-4 font-mono text-xs space-y-1">
                                    {logs.map((log, i) => (
                                        <div key={i} className={cn(
                                            "flex gap-2",
                                            log.type === 'error' ? "text-red-500" :
                                                log.type === 'success' ? "text-emerald-500" :
                                                    log.type === 'warning' ? "text-amber-500" :
                                                        log.type === 'tx' ? "text-blue-500" :
                                                            log.type === 'rx' ? "text-purple-500" :
                                                                "text-muted-foreground"
                                        )}>
                                            <span className="opacity-50 select-none shrink-0">[{log.time}]</span>
                                            <span className="break-all">{log.message}</span>
                                        </div>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant={flashResult === 'success' ? "default" : "secondary"}
                        onClick={() => onOpenChange(false)}
                        disabled={isFlashing}
                    >
                        {flashResult === 'success' ? "Done" : "Close"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
