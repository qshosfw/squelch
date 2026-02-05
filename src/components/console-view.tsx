import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
    connected: boolean;
    onClear: () => void;
}

export function ConsoleView({ logs, connected, onClear }: ConsoleViewProps) {
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
            <div className="px-4 py-3 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <TerminalSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <h3 className="text-sm font-semibold leading-none flex items-center gap-2">
                            Serial Monitor
                            {connected ? (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-none text-[10px] h-4 py-0">LIVE</Badge>
                            ) : (
                                <Badge variant="outline" className="text-[10px] h-4 py-0 opacity-50">OFFLINE</Badge>
                            )}
                        </h3>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsPaused(!isPaused)}>
                        {isPaused ? <Play className="h-4 w-4 text-green-500" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportLogs}>
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="px-4 py-2 border-b flex items-center gap-4 bg-muted/20">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="autoscroll"
                        checked={autoScroll}
                        onCheckedChange={(c) => setAutoScroll(!!c)}
                    />
                    <Label htmlFor="autoscroll" className="text-xs font-medium cursor-pointer">Auto-scroll</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="keepalives"
                        checked={showKeepalives}
                        onCheckedChange={(c) => setShowKeepalives(!!c)}
                    />
                    <Label htmlFor="keepalives" className="text-xs font-medium cursor-pointer">Keepalives</Label>
                </div>
            </div>

            <ScrollArea className="flex-1 text-[13px] leading-relaxed relative bg-[#0a0a0a] font-mono selection:bg-emerald-500/30" ref={scrollRef}>
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] z-10" />
                <div className="p-4 pt-2">
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-white/10">
                            <TerminalSquare className="h-12 w-12 mb-2 opacity-5" />
                            <p className="text-xs uppercase tracking-[0.2em]">Ready for input...</p>
                        </div>
                    )}
                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-3 group/line border-l-2 border-transparent hover:border-emerald-500/20 py-0.5 px-1">
                            <span className="text-white/20 shrink-0 select-none w-20 text-[10px] mt-0.5 opacity-0 group-hover/line:opacity-100 transition-opacity whitespace-nowrap">
                                {log.timestamp.split(':').slice(1).join(':')}
                            </span>
                            <span className={cn(
                                "shrink-0 w-8 font-bold text-[10px] mt-0.5 select-none",
                                log.type === 'tx' ? "text-orange-500/50" :
                                    log.type === 'rx' ? "text-cyan-500/50" :
                                        log.type === 'error' ? "text-red-500/50" :
                                            "text-emerald-500/50"
                            )}>
                                {log.type === 'tx' ? 'TX >>' : log.type === 'rx' ? 'RX <<' : ' :: '}
                            </span>
                            <span className={cn(
                                "break-all whitespace-pre-wrap flex-1",
                                log.type === 'tx' ? "text-orange-300" :
                                    log.type === 'rx' ? "text-cyan-100" :
                                        log.type === 'error' ? "text-red-400 font-bold" :
                                            log.type === 'success' ? "text-emerald-400" : "text-[#d4d4d4]"
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
                        placeholder={!connected ? "Connect to device..." : (inputType === 'hex' ? "Hex (AA BB CC)" : "Command...")}
                        className="font-mono"
                        disabled={!connected}
                    />
                    <Button onClick={handleSend} disabled={!input || !connected}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
