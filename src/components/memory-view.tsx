"use client"

import { useState, useCallback } from "react"
import { Channel, RadioProfile } from "@/lib/framework/module-interface"
import { protocol } from "@/lib/protocol"
import { Button } from "@/components/ui/button"
import { MemoryTable } from "./memory-table/memory-table"
import { exportToCSV, importFromCSV } from "@/lib/csv-utils"
import { useToast } from "@/hooks/use-toast"
import { FileUp, FileDown, Upload, Download, Loader2, Search, Columns2, ChevronLeft, ChevronRight } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

interface MemoryViewProps {
    connected: boolean
    activeProfile: RadioProfile | null
    onBusyChange: (busy: boolean) => void
}

export function MemoryView({ connected, activeProfile, onBusyChange }: MemoryViewProps) {
    const [channels, setChannels] = useState<Channel[]>([])
    const [loading, setLoading] = useState<"read" | "write" | null>(null)
    const [progress, setProgress] = useState(0)
    const [page, setPage] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
        name: true, rxFreq: true, offset: true, mode: true, power: true,
        rxTone: true, txTone: true, step: true, scan: true, scram: true,
        comp: true, pttid: true, busy: true, rev: true, sl1: true, sl2: true, sl3: true
    })
    const { toast } = useToast()

    const handleRead = useCallback(async () => {
        if (!connected || !activeProfile || !protocol) {
            toast({ title: "Not Connected", variant: "destructive" })
            return
        }

        setLoading("read")
        onBusyChange(true)
        setProgress(0)
        setChannels([])

        try {
            toast({ title: "Reading Memories", description: `Reading ${activeProfile.channelCount} channels...` });

            const results = await activeProfile.readChannels(
                protocol,
                (p) => setProgress(p),
                (batch) => setChannels(prev => [...prev, ...batch])
            );

            toast({ title: "Read Complete", description: `Loaded ${results.length} channels.` })
        } catch (e) {
            console.error(e)
            toast({ title: "Read Failed", description: String(e), variant: "destructive" })
        } finally {
            setLoading(null)
            onBusyChange(false)
            setProgress(0)
        }
    }, [connected, activeProfile, onBusyChange, toast])

    const handleWrite = useCallback(async () => {
        if (!connected || !activeProfile || !protocol) return;
        setLoading("write");
        onBusyChange(true);
        setProgress(0);

        try {
            toast({ title: "Writing Memories", description: `Writing ${channels.length} channels...` });

            await activeProfile.writeChannels(
                protocol,
                channels,
                (p) => setProgress(p)
            );

            toast({ title: "Write Complete" })
        } catch (e) {
            console.error(e);
            toast({ title: "Write Failed", variant: "destructive" })
        } finally {
            setLoading(null);
            onBusyChange(false);
            setProgress(0);
        }
    }, [connected, activeProfile, toast, onBusyChange, channels])

    const handleUpdate = (index: number, field: keyof Channel, value: any) => {
        setChannels(prev => {
            const next = [...prev];
            const idx = next.findIndex(c => c.index === index);
            if (idx !== -1) {
                next[idx] = { ...next[idx], [field]: value, empty: false };
            }
            return next;
        });
    }

    const handleExport = () => {
        if (channels.length === 0) return;
        const csv = exportToCSV(channels);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `channels_${activeProfile?.name || "radio"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            try {
                const imported = importFromCSV(text);
                setChannels(prev => {
                    let base = prev.length > 0 ? [...prev] : [];
                    if (base.length === 0 && activeProfile) {
                        for (let i = 0; i < activeProfile.channelCount; i++) {
                            base.push({ index: i + 1, name: "", rxFreq: 0, offset: 0, mode: 'FM', power: 'Low', scanList: 'None', empty: true });
                        }
                    }

                    imported.forEach(imp => {
                        const idx = base.findIndex(c => c.index === imp.index);
                        if (idx !== -1) {
                            base[idx] = { ...base[idx], ...imp, empty: false };
                        }
                    });
                    return base;
                });

                toast({ title: "Import Successful", description: `Updated ${imported.length} channels.` });
            } catch (e) {
                toast({ title: "Import Failed", variant: "destructive" });
            }
        };
        reader.readAsText(file);
    }

    const pageSize = 50
    const filteredChannels = searchQuery.toLowerCase()
        ? channels.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.rxFreq / 1000000).toString().includes(searchQuery)
        )
        : channels;
    const totalPages = Math.ceil(filteredChannels.length / pageSize) || 1;

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    }

    return (
        <div className="flex flex-col h-full bg-transparent">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-background shrink-0 h-11">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 p-0.5 bg-muted/20 rounded-md border border-muted-foreground/10">
                        <Button
                            onClick={handleRead}
                            disabled={!!loading || !connected}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] font-medium"
                        >
                            {loading === "read" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                            Read
                        </Button>
                        <Button
                            onClick={handleWrite}
                            disabled={!!loading || !connected}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] font-medium text-primary hover:text-primary hover:bg-primary/10"
                        >
                            {loading === "write" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                            Write
                        </Button>
                    </div>

                    <Separator orientation="vertical" className="h-6" />

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-[11px] font-mono font-medium px-2 py-0.5 bg-muted/40 rounded border border-muted-foreground/5 min-w-[3.5rem] text-center">
                            {page + 1} / {totalPages}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {loading && (
                        <div className="flex items-center gap-3 pl-3 animate-in fade-in duration-300">
                            <Progress value={progress} className="h-1 w-16" />
                            <span className="text-[10px] font-mono text-muted-foreground">{progress}%</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                            placeholder="Browser..."
                            className="h-7 w-48 pl-8 text-[11px] bg-muted/20 border-muted-foreground/10 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:bg-background transition-all"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(0);
                            }}
                        />
                    </div>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                <Columns2 className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-auto border-muted-foreground/10 shadow-xl">
                            <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground/70 px-2 py-1.5">Column Visibility</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="grid grid-cols-2 gap-x-1 p-1">
                                {Object.keys(visibleColumns).map((key) => {
                                    const labels: Record<string, string> = {
                                        rxFreq: "Frequency",
                                        offset: "Offset",
                                        scram: "Scramble",
                                        comp: "Compand",
                                        busy: "Busy Lock",
                                        sl1: "List 1",
                                        sl2: "List 2",
                                        sl3: "List 3",
                                        pttid: "PTT ID",
                                        rev: "Reverse"
                                    };
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={key}
                                            checked={visibleColumns[key]}
                                            onCheckedChange={() => toggleColumn(key)}
                                            onSelect={(e) => e.preventDefault()}
                                            className="text-[11px] capitalize cursor-pointer focus:bg-primary/5 focus:text-primary transition-colors py-1 pl-7"
                                        >
                                            {labels[key] || key.replace(/([A-Z0-9])/g, ' $1').trim()}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <div className="flex items-center gap-1 pr-1">
                        <Button variant="ghost" size="icon" onClick={handleExport} disabled={channels.length === 0} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                            <FileUp className="h-3.5 w-3.5" />
                        </Button>
                        <div className="relative">
                            <input type="file" accept=".csv" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                <FileDown className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-hidden">
                <div className="h-full">
                    <MemoryTable
                        data={filteredChannels}
                        activeProfile={activeProfile}
                        onUpdate={handleUpdate}
                        readOnly={!!loading}
                        page={page}
                        visibleColumns={visibleColumns}
                    />
                </div>
            </main>
        </div>
    )
}
