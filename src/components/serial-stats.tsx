import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Activity, ArrowDown, ArrowUp, Clock, Gauge, Radio } from "lucide-react"
import { SerialStats } from "@/lib/protocol"
import { useEffect, useState } from "react"

interface SerialStatsDisplayProps {
    stats: SerialStats | null
    compact?: boolean
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`
    } else {
        return `${seconds}s`
    }
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function SerialStatsDisplay({ stats, compact = false }: SerialStatsDisplayProps) {
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        if (!stats?.connectedAt) {
            setDuration(0)
            return
        }

        const interval = setInterval(() => {
            setDuration(Date.now() - stats.connectedAt!)
        }, 1000)

        return () => clearInterval(interval)
    }, [stats?.connectedAt])

    if (!stats || !stats.connectedAt) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Radio className="h-3 w-3" />
                <span>Not connected</span>
            </div>
        )
    }

    if (compact) {
        return (
            <TooltipProvider>
                <div className="flex items-center gap-3 text-xs">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span className="font-mono">{formatDuration(duration)}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>Connection Duration</TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-4" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-emerald-500">
                                <ArrowUp className="h-3 w-3" />
                                <span className="font-mono">{formatBytes(stats.bytesSent)}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>Bytes Sent ({stats.packetsSent} packets)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-blue-500">
                                <ArrowDown className="h-3 w-3" />
                                <span className="font-mono">{formatBytes(stats.bytesReceived)}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>Bytes Received ({stats.packetsReceived} packets)</TooltipContent>
                    </Tooltip>

                    {stats.avgLatencyMs > 0 && (
                        <>
                            <Separator orientation="vertical" className="h-4" />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                        <Gauge className="h-2.5 w-2.5 mr-1" />
                                        {stats.avgLatencyMs}ms
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Average Latency</TooltipContent>
                            </Tooltip>
                        </>
                    )}
                </div>
            </TooltipProvider>
        )
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg border bg-card">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Connected
                </div>
                <div className="font-mono text-lg font-semibold">{formatDuration(duration)}</div>
            </div>

            <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />
                    Sent
                </div>
                <div className="font-mono text-lg font-semibold">{formatBytes(stats.bytesSent)}</div>
                <div className="text-xs text-muted-foreground">{stats.packetsSent} packets</div>
            </div>

            <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowDown className="h-3.5 w-3.5 text-blue-500" />
                    Received
                </div>
                <div className="font-mono text-lg font-semibold">{formatBytes(stats.bytesReceived)}</div>
                <div className="text-xs text-muted-foreground">{stats.packetsReceived} packets</div>
            </div>

            <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    Avg Latency
                </div>
                <div className="font-mono text-lg font-semibold">
                    {stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs}ms` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">
                    {stats.latencySamples.length} samples
                </div>
            </div>
        </div>
    )
}
