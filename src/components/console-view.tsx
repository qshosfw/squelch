import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { Trash2, Pause, Play, Download, ArrowDown, ArrowUp, Terminal } from 'lucide-react';
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
    const [input, setInput] = useState('');
    const [inputType, setInputType] = useState('text'); // text, hex
    const [autoScroll, setAutoScroll] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll effect
    useEffect(() => {
        if (autoScroll && !isPaused && scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [logs, autoScroll, isPaused]);

    const handleSend = async () => {
        if (!input.trim()) return;

        try {
            if (inputType === 'hex') {
                // Parse hex string "AA BB CC"
                const clean = input.replace(/[^0-9A-Fa-f]/g, '');
                if (clean.length % 2 !== 0) throw new Error("Invalid hex string (odd length)");
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

    // Filter logs if needed (e.g. keepalives)
    // For now we assume all logs are passed, but we might want to filter 'PING' if strictly keepalive?
    // The protocol doesn't explicitly flag keepalives separate from 'tx'/'rx' usually.
    // If 'showKeepalives' is false, we could filter basic PING/PONG if we knew what they were.
    // Given the current architecture, we'll just show everything or let the user decide.
    // Actually, let's implement a simple filter: if !showKeepalives, hide messages containing "0x0518" (DFU Ping) or similar if they are annoying.
    // But "0x0518" is DFU detection, not normal operation. 
    // Let's just render all for now, as 'showKeepalives' was requested but we don't have a reliable wa to tag them yet without parsing.

    return (
        <div className="flex flex-col h-full w-full bg-[#09090b] text-neutral-300 font-mono text-sm relative overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/50 shrink-0 h-11">
                <div className="flex items-center gap-2">
                    {connected ? (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-[10px] h-6 px-2 gap-1.5 transition-all">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            LIVE
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="border-neutral-700 text-neutral-500 text-[10px] h-6 px-2">OFFLINE</Badge>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <div className="flex items-center mr-2 space-x-2">
                        <div className="flex items-center gap-1.5 bg-neutral-800/50 px-2 py-1 rounded border border-neutral-800">
                            <Checkbox
                                id="autoscroll"
                                checked={autoScroll}
                                onCheckedChange={(c) => setAutoScroll(!!c)}
                                className="border-neutral-600 data-[state=checked]:bg-neutral-600 data-[state=checked]:border-neutral-600 h-3.5 w-3.5 rounded-[2px]"
                            />
                            <Label htmlFor="autoscroll" className="text-[10px] uppercase tracking-wider text-neutral-400 cursor-pointer">Auto-Scroll</Label>
                        </div>
                        {/* Keepalives toggle - placeholder for future logic or generic filtering */}
                        {/*  <div className="flex items-center gap-1.5">
                            <Checkbox 
                                id="keepalives" 
                                checked={showKeepalives} 
                                onCheckedChange={(c) => setShowKeepalives(!!c)}
                                className="border-neutral-600 data-[state=checked]:bg-neutral-600 data-[state=checked]:border-neutral-600 h-3.5 w-3.5 rounded-[2px]"
                            />
                            <Label htmlFor="keepalives" className="text-[10px] uppercase tracking-wider text-neutral-400 cursor-pointer">All Data</Label>
                        </div> */}
                    </div>

                    <Separator orientation="vertical" className="h-4 bg-neutral-800 mx-1" />

                    <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-white hover:bg-neutral-800" onClick={() => setIsPaused(!isPaused)} title={isPaused ? "Resume" : "Pause"}>
                        {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-white hover:bg-neutral-800" onClick={onClear} title="Clear Output">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-white hover:bg-neutral-800" onClick={exportLogs} title="Download Logs">
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Terminal Output */}
            <ScrollArea className="flex-1 bg-[#0a0a0a] relative" ref={scrollRef}>
                <div className="p-4 font-mono text-xs md:text-[13px] space-y-0.5">
                    {logs.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                            <div className="text-center">
                                <Terminal className="h-16 w-16 mx-auto mb-4" />
                                <p className="text-sm uppercase tracking-widest">Awaiting Data</p>
                            </div>
                        </div>
                    )}

                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-2 group hover:bg-white/5 -mx-4 px-4 py-0.5">
                            <span className="text-neutral-600 shrink-0 w-[70px] select-none text-[10px] pt-0.5 font-mono opacity-50 group-hover:opacity-100 transition-opacity">
                                {log.timestamp.split(':').slice(0, 3).join(':')}
                                <span className="text-[8px] text-neutral-700">.{log.timestamp.split('.')[1] || '000'}</span>
                            </span>

                            <div className="flex-1 break-all whitespace-pre-wrap flex gap-2">
                                {log.type === 'tx' && (
                                    <span className="text-orange-500/70 font-bold text-[10px] pt-0.5 shrink-0 select-none flex items-center gap-1">
                                        <ArrowUp className="h-2.5 w-2.5" /> TX
                                    </span>
                                )}
                                {log.type === 'rx' && (
                                    <span className="text-cyan-500/70 font-bold text-[10px] pt-0.5 shrink-0 select-none flex items-center gap-1">
                                        <ArrowDown className="h-2.5 w-2.5" /> RX
                                    </span>
                                )}
                                {log.type !== 'tx' && log.type !== 'rx' && (
                                    <span className={cn(
                                        "font-bold text-[10px] pt-0.5 shrink-0 select-none w-8 text-center",
                                        log.type === 'error' ? "text-red-500" :
                                            log.type === 'success' ? "text-emerald-500" : "text-neutral-500"
                                    )}>
                                        {log.type.substring(0, 3).toUpperCase()}
                                    </span>
                                )}

                                <span className={cn(
                                    "leading-relaxed",
                                    log.type === 'tx' ? "text-orange-200" :
                                        log.type === 'rx' ? "text-cyan-200" :
                                            log.type === 'error' ? "text-red-400 font-medium bg-red-950/20 px-1 rounded-sm" :
                                                log.type === 'success' ? "text-emerald-400" :
                                                    "text-neutral-300"
                                )}>
                                    {log.content}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Spacer for auto-scroll */}
                    <div className="h-4" />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="shrink-0 p-2 bg-neutral-900 border-t border-neutral-800">
                <div className="flex gap-0 rounded-md overflow-hidden border border-neutral-700 focus-within:border-neutral-500 transition-colors bg-black">
                    <Select value={inputType} onValueChange={setInputType}>
                        <SelectTrigger className="w-[75px] h-9 border-none bg-neutral-800 text-neutral-300 rounded-none focus:ring-0 focus:ring-offset-0 text-xs font-medium">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-neutral-900 dark:border-neutral-800">
                            <SelectItem value="text" className="text-xs">TEXT</SelectItem>
                            <SelectItem value="hex" className="text-xs">HEX</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex-1 flex items-center relative">
                        <span className="pl-3 pr-1 text-emerald-500 font-bold select-none text-xs">{'>'}</span>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={!connected ? "Device offline" : (inputType === 'hex' ? "AA BB CC..." : "Enter command...")}
                            className="flex-1 w-full bg-transparent border-none text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-0 h-9 px-2 font-mono"
                            disabled={!connected}
                            spellCheck={false}
                            autoComplete="off"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
