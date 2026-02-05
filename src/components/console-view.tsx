import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Separator } from '@/components/ui/separator';
import { Send, Trash2, Pause, Play, Download, TerminalSquare } from 'lucide-react';
import { protocol } from '@/lib/protocol';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LogMessage {
    id: number;
    timestamp: string;
    type: 'info' | 'error' | 'success' | 'tx' | 'rx';
    content: string;
}

interface ConsoleViewProps {
    logs: LogMessage[];
    onClear: () => void;
}

export function ConsoleView({ logs, onClear }: ConsoleViewProps) {
    // const [logs, setLogs] = useState<LogMessage[]>([]); // Removed internal state
    const [input, setInput] = useState('');
    const [inputType, setInputType] = useState('text'); // text, hex
    const [autoScroll, setAutoScroll] = useState(true);
    const [showKeepalives, setShowKeepalives] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    // const nextId = useRef(0); // Managed by App

    // Auto-scroll effect
    useEffect(() => {
        if (autoScroll && !isPaused && scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [logs, autoScroll, isPaused]);

    // Removed subscription useEffect since logs come from props

    const handleSend = async () => {
        if (!input.trim()) return;

        try {
            if (inputType === 'hex') {
                // Parse hex string "AA BB CC"
                const clean = input.replace(/[^0-9A-Fa-f]/g, '');
                if (clean.length % 2 !== 0) throw new Error("Invalid hex string");
                const buf = new Uint8Array(clean.length / 2);
                for (let i = 0; i < clean.length; i += 2) {
                    buf[i / 2] = parseInt(clean.substring(i, i + 2), 16);
                }
                await protocol.sendRaw(buf);
            } else {
                // Text mode (send as bytes)
                const encoder = new TextEncoder();
                await protocol.sendRaw(encoder.encode(input));
            }
            setInput('');
        } catch (e: any) {
            console.error("Send failed", e);
            // Try to log to console if possible, otherwise just ignore
            if (protocol.onLog) protocol.onLog(`Send Error: ${e.message}`, 'error');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    const exportLogs = () => {
        const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.content}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `serial_log_${new Date().toISOString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="flex flex-col h-full border-none shadow-none rounded-none bg-background/50">
            <CardHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    <TerminalSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <CardTitle className="text-base">Serial Console</CardTitle>
                        <CardDescription className="text-xs">Monitor device traffic</CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setIsPaused(!isPaused)} title={isPaused ? "Resume" : "Pause"}>
                        {isPaused ? <Play className="h-4 w-4 text-green-500" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClear} title="Clear Logs">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={exportLogs} title="Export Logs">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <div className="px-4 py-2 border-b flex items-center gap-4 bg-muted/20">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="autoscroll"
                        checked={autoScroll}
                        onCheckedChange={(c) => setAutoScroll(!!c)}
                    />
                    <Label htmlFor="autoscroll" className="text-xs font-normal cursor-pointer">Auto-scroll</Label>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="keepalives"
                        checked={showKeepalives}
                        onCheckedChange={(c) => setShowKeepalives(!!c)}
                    />
                    <Label htmlFor="keepalives" className="text-xs font-normal cursor-pointer">Show Keepalives</Label>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4 font-mono text-xs" ref={scrollRef}>
                <div className="space-y-1">
                    {logs.length === 0 && (
                        <div className="text-center text-muted-foreground py-10 opacity-50">
                            No logs to display
                        </div>
                    )}
                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-2 group hover:bg-muted/50 p-0.5 rounded px-2 -mx-2">
                            <span className="text-muted-foreground/50 shrink-0 select-none w-[70px] text-right">{log.timestamp}</span>
                            <Badge variant="outline" className={cn(
                                "h-5 text-[10px] px-1 uppercase shrink-0 w-12 justify-center",
                                log.type === 'tx' ? "border-orange-500/30 text-orange-500" :
                                    log.type === 'rx' ? "border-cyan-500/30 text-cyan-500" :
                                        log.type === 'error' ? "border-red-500/30 text-red-500" :
                                            log.type === 'success' ? "border-emerald-500/30 text-emerald-500" :
                                                "text-muted-foreground"
                            )}>
                                {log.type}
                            </Badge>
                            <span className={cn(
                                "break-all",
                                log.type === 'tx' ? "text-orange-400" :
                                    log.type === 'rx' ? "text-cyan-400" :
                                        log.type === 'error' ? "text-red-400" : ""
                            )}>
                                {log.content}
                            </span>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-muted/10">
                <div className="flex gap-2">
                    <Select value={inputType} onValueChange={setInputType}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="hex">Hex</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={inputType === 'hex' ? "e.g. AB CD 01 23" : "Type a command..."}
                        className="font-mono"
                    />
                    <Button onClick={handleSend} disabled={!input}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
