"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Channel, RadioProfile } from "@/lib/framework/module-interface"
import { protocol } from "@/lib/protocol"
import { Button } from "@/components/ui/button"
import { MemoryTable } from "./memory-table/memory-table"
import { exportToCSV, importFromCSV } from "@/lib/csv-utils"
import { useToast } from "@/hooks/use-toast"
import { FileUp, FileDown, Upload, Download, Loader2, Search, Columns2, ChevronLeft, ChevronRight, FileSpreadsheet, FileCode } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { QSHFile, TAG_G_TITLE, TAG_G_AUTHOR, TAG_G_TYPE, TAG_G_DATE, TAG_D_LABEL, TAG_D_START_ADDR, TAG_D_END_ADDR, TAG_D_CH_COUNT, TAG_D_CH_NAMES, TAG_ID_RADIO_UID, TAG_ID_LABEL } from "@/lib/qsh"

interface MemoryViewProps {
    connected: boolean
    activeProfile: RadioProfile | null
    onBusyChange: (busy: boolean) => void
    pendingFile?: File | null
    onPendingFileConsumed?: () => void
    deviceInfo?: { version: string, extended?: Record<string, string> }
    originalChannels?: Channel[]
    onOriginalChannelsChange?: (channels: Channel[]) => void
    channels: Channel[]
    onChannelsChange: (channels: Channel[] | ((prev: Channel[]) => Channel[])) => void
    onChannelsReplace?: (channels: Channel[] | ((prev: Channel[]) => Channel[])) => void
    onChannelsReset?: (channels: Channel[]) => void
}

export function MemoryView({ connected, activeProfile, onBusyChange, pendingFile, onPendingFileConsumed, deviceInfo, originalChannels, onOriginalChannelsChange, channels, onChannelsChange, onChannelsReplace, onChannelsReset }: MemoryViewProps) {
    const [loading, setLoading] = useState<"read" | "write" | null>(null)
    const [progress, setProgress] = useState(0)
    const [page, setPage] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
        name: true, rxFreq: true, offset: true, mode: true, power: true,
        rxTone: true, txTone: true, step: true, scan: true, scram: true,
        comp: true, pttid: true, busy: true, rev: true, sl1: true, sl2: true, sl3: true
    })
    const [hasRead, setHasRead] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    const handleRead = useCallback(async () => {
        if (!connected || !activeProfile || !protocol) {
            toast({ title: "Not Connected", variant: "destructive" })
            return
        }

        setLoading("read")
        onBusyChange(true)
        setProgress(0)
        if (onChannelsReset) onChannelsReset([])
        else onChannelsChange([])
        setHasRead(false)

        try {
            toast({ title: "Reading Memories", description: `Reading ${activeProfile.channelCount} channels...` });

            const results = await activeProfile.readChannels(
                protocol,
                (p) => setProgress(p),
                (batch) => {
                    if (onChannelsReplace) onChannelsReplace(prev => [...prev, ...batch])
                    else onChannelsChange(prev => [...prev, ...batch])
                }
            );

            setHasRead(true)
            onOriginalChannelsChange?.(results)
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
            onOriginalChannelsChange?.(channels)
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
        onChannelsChange(prev => {
            const next = [...prev];
            const idx = next.findIndex(c => c.index === index);
            if (idx !== -1) {
                next[idx] = { ...next[idx], [field]: value, empty: false };
            }
            return next;
        });
    }

    const handleExportCSV = () => {
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

    const handleExportQSH = async () => {
        if (channels.length === 0 || !activeProfile) return;

        try {
            const qsh = new QSHFile();
            const now = new Date();

            qsh.setGlobal({
                [TAG_G_TITLE]: `Channels Backup (${activeProfile.name})`,
                [TAG_G_AUTHOR]: "Squelch User",
                [TAG_G_TYPE]: "channels",
                [TAG_G_DATE]: Math.floor(now.getTime() / 1000)
            });

            // Fetch numeric UID if possible
            let numericUid: bigint | Uint8Array | null = null;
            if (activeProfile && connected && protocol) {
                try {
                    numericUid = await activeProfile.getNumericUID(protocol);
                } catch (err) { }
            }

            const mapping = activeProfile.memoryMapping;
            const mainRange = mapping.channels;
            if (!mainRange) throw new Error("Profile does not define channel memory range");

            // Allocate buffer for the entire range
            const buffer = new Uint8Array(mainRange.size);
            buffer.fill(0xFF); // Default to empty/erased

            // Determine if we have extra ranges (like names on some firmwares)
            const extraRanges = mapping.extra || {};
            const extraBuffers: Record<string, Uint8Array> = {};

            for (const [key, range] of Object.entries(extraRanges)) {
                extraBuffers[key] = new Uint8Array(range.size);
                extraBuffers[key].fill(0xFF);
            }

            // Encode channels into the buffer
            channels.forEach((c, i) => {
                const offset = i * mainRange.stride;
                if (offset + mainRange.stride <= buffer.length) {
                    const block = buffer.subarray(offset, offset + mainRange.stride);

                    // Prepare aux items
                    const aux: any = {};
                    if (extraBuffers['names']) {
                        const nameStride = 16;
                        aux.name = extraBuffers['names'].subarray(i * nameStride, Math.min((i + 1) * nameStride, extraBuffers['names'].length));
                    }

                    activeProfile.encodeChannel(c, block, i + 1, aux);
                }
            });

            // Add Main Channels Blob
            qsh.addBlob(buffer, {
                [TAG_G_TYPE]: "channels",
                [TAG_D_LABEL]: "Main Channel Data",
                [TAG_D_START_ADDR]: mainRange.start,
                [TAG_D_END_ADDR]: mainRange.start + mainRange.size,
                [TAG_D_CH_COUNT]: channels.length,
                [TAG_D_CH_NAMES]: channels.map(c => c.empty ? "" : (c.name || "")).join(","),
                [TAG_ID_RADIO_UID]: (typeof numericUid === 'bigint') ? numericUid.toString() : "",
                [TAG_ID_LABEL]: deviceInfo?.version || activeProfile.name
            });

            // Add Extras
            for (const [key, range] of Object.entries(extraRanges)) {
                if (extraBuffers[key]) {
                    qsh.addBlob(extraBuffers[key], {
                        [TAG_G_TYPE]: "channels",
                        [TAG_D_LABEL]: key,
                        [TAG_D_START_ADDR]: range.start,
                        [TAG_D_END_ADDR]: range.start + range.size,
                    });
                }
            }

            const qshBytes = await qsh.toUint8Array();
            const blob = new Blob([qshBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
            a.download = `channels_${activeProfile.name.toLowerCase().replace(/\s+/g, '_')}_${dateStr}.qsh`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: "Export Successful", description: "Channels saved as binary QSH." });
        } catch (e) {
            console.error(e);
            toast({ title: "Export Failed", description: String(e), variant: "destructive" });
        }
    }

    const processImportFile = useCallback(async (file: File) => {
        if (!activeProfile) {
            toast({
                title: "No Profile Selected",
                description: "Please select a radio profile before importing channels.",
                variant: "destructive"
            });
            return;
        }

        try {
            if (file.name.endsWith(".csv") || file.name.endsWith(".json")) {
                const text = await file.text();
                const imported = importFromCSV(text);
                onChannelsChange(prev => {
                    let base = prev.length > 0 ? [...prev] : [];
                    if (base.length === 0 && activeProfile) {
                        for (let i = 0; i < activeProfile.channelCount; i++) {
                            base.push({ index: i + 1, name: "", rxFreq: 0, offset: 0, mode: 'FM', power: 'Low', scanList: 'None', empty: true });
                        }
                    }
                    imported.forEach(imp => {
                        const idx = base.findIndex(c => c.index === imp.index);
                        if (idx !== -1) base[idx] = { ...base[idx], ...imp, empty: false };
                    });

                    onOriginalChannelsChange?.(base);
                    return base;
                });
                setHasRead(true);
                toast({ title: "Import Successful", description: `Updated ${imported.length} channels.` });
            } else {
                // Binary or QSH Import
                const buffer = new Uint8Array(await file.arrayBuffer() as ArrayBuffer);
                let channelData: Uint8Array = buffer;
                let nameData: Uint8Array | undefined = undefined;
                let attrData: Uint8Array | undefined = undefined;

                // Check for QSH Magic Bytes
                const isQshSignature = buffer.length >= 8 && buffer[0] === 0xe6 && buffer[1] === 0x51 && buffer[2] === 0x53 && buffer[3] === 0x48;

                // Try to parse as QSH
                let qsh: QSHFile | null = null;
                try {
                    qsh = await QSHFile.fromUint8Array(buffer as any);
                } catch (e) { console.error("QSH Parse Error", e); }


                if (isQshSignature && !qsh) {
                    toast({ title: "Import Error", description: "QSH file integrity check failed or file is corrupted.", variant: "destructive" });
                    return;
                }

                if (qsh) {
                    const gType = qsh.globalMeta[TAG_G_TYPE];
                    if (gType && gType !== "channels" && gType !== "memories") {
                        toast({ title: "Import Error", description: `Not a channels QSH file. Found type: ${gType}`, variant: "destructive" });
                        return;
                    }

                    // It's a QSH file, find our blobs
                    const map = activeProfile.memoryMapping;
                    const channelBlob = qsh.blobs.find(b => b.metadata[TAG_D_START_ADDR] === map.channels.start);

                    if (channelBlob) {
                        channelData = channelBlob.data;
                        toast({ title: "QSH Detected", description: "Found channel data in container." });
                    } else {
                        // Improved Fuzzy Search
                        const candidates = qsh.blobs.filter(b => b.metadata[TAG_G_TYPE] === "channels");

                        // 1. Try label containing "main"
                        let best = candidates.find(b =>
                            typeof b.metadata[TAG_D_LABEL] === 'string' &&
                            b.metadata[TAG_D_LABEL].toLowerCase().includes("main")
                        );

                        // 2. Try exact size match (if not found yet)
                        if (!best) {
                            best = candidates.find(b => b.data.length === map.channels.size);
                        }

                        // 3. Fallback to first candidate that ISN'T names/attributes (heuristic)
                        if (!best && candidates.length > 0) {
                            best = candidates.find(b => {
                                const label = (b.metadata[TAG_D_LABEL] as string || "").toLowerCase();
                                return !label.includes("name") && !label.includes("attr");
                            });
                        }

                        // 4. Last resort
                        if (!best && candidates.length > 0) best = candidates[0];

                        if (best) {
                            channelData = best.data;
                            toast({ title: "QSH Detected", description: `Found channel data (fuzzy: ${best.metadata[TAG_D_LABEL] || "unnamed"}).` });
                        } else {
                            toast({ title: "Import Error", description: "Valid QSH container but no matching channel data found.", variant: "destructive" });
                            return;
                        }
                    }

                    if (map.extra?.names) {
                        const nameBlob = qsh.blobs.find(b => b.metadata[TAG_D_START_ADDR] === map.extra!.names.start);
                        if (nameBlob) {
                            nameData = nameBlob.data;
                        }
                    }
                    if (map.extra?.attributes) {
                        const attrBlob = qsh.blobs.find(b => b.metadata[TAG_D_START_ADDR] === map.extra!.attributes.start);
                        if (attrBlob) {
                            attrData = attrBlob.data;
                        }
                    }
                }

                // Decode
                const range = activeProfile.memoryMapping.channels;
                if (!range) throw new Error("Profile does not support binary channel import");

                toast({ title: "Decoding Channels", description: "Parsing binary data..." });

                const decoded: Channel[] = [];
                for (let i = 0; i < activeProfile.channelCount; i++) {
                    const offset = i * activeProfile.channelStride;
                    // Check if we have enough data
                    if (offset + activeProfile.channelStride <= channelData.length) {
                        const block = channelData.subarray(offset, offset + activeProfile.channelStride);

                        let aux: any = {};
                        if (nameData) {
                            const nameStride = 16; // Standardize this?
                            if ((i + 1) * nameStride <= nameData.length) {
                                aux.name = nameData.subarray(i * nameStride, (i + 1) * nameStride);
                            }
                        }
                        if (attrData) {
                            const attrStride = 1;
                            if (i < attrData.length) {
                                aux.attr = attrData.subarray(i * attrStride, (i + 1) * attrStride);
                            }
                        }

                        if (Object.keys(aux).length === 0) aux = undefined;

                        decoded.push(activeProfile.decodeChannel(block, i + 1, aux));
                    }
                }

                onChannelsChange(decoded);
                setHasRead(true);
                onOriginalChannelsChange?.(decoded);
                toast({ title: "Import Successful", description: `Decoded ${decoded.length} channels.` });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Import Failed", description: String(e), variant: "destructive" });
        }
    }, [activeProfile, toast]);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processImportFile(file);
        e.target.value = ""; // Reset
    }

    // Effect to handle pending file from App.tsx (QSH Proceed)
    useEffect(() => {
        if (pendingFile && activeProfile) {
            processImportFile(pendingFile);
            if (onPendingFileConsumed) onPendingFileConsumed();
        }
    }, [pendingFile, activeProfile, processImportFile, onPendingFileConsumed]);

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
                            disabled={!!loading || !connected || !hasRead}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] font-medium text-primary hover:text-primary hover:bg-primary/10"
                            title={!hasRead ? "Read or Import first" : ""}
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={channels.length === 0} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                    <FileUp className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground/70">Export Format</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleExportCSV} className="text-xs cursor-pointer">
                                    <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                                    Export as CSV (.csv)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportQSH} className="text-xs cursor-pointer">
                                    <FileCode className="mr-2 h-3.5 w-3.5" />
                                    Export as QSH (.qsh)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                    <FileDown className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground/70">Import Format</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-xs cursor-pointer focus:bg-primary/5 p-0">
                                    <label className="flex items-center w-full px-2 py-1.5 cursor-pointer">
                                        <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                                        Import from CSV/JSON
                                        <input type="file" accept=".csv,.json" onChange={handleImport} className="hidden" />
                                    </label>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-xs cursor-pointer focus:bg-primary/5 p-0">
                                    <label className="flex items-center w-full px-2 py-1.5 cursor-pointer">
                                        <FileCode className="mr-2 h-3.5 w-3.5" />
                                        Import from QSH
                                        <input type="file" accept=".qsh" onChange={handleImport} className="hidden" />
                                    </label>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-hidden">
                <div className="h-full">
                    {!hasRead && channels.length === 0 && !loading ? (
                        <div
                            className={cn(
                                "flex flex-col items-center justify-center h-full p-8 transition-all duration-300",
                                isDragging ? "bg-primary/5" : "bg-transparent"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                const file = e.dataTransfer.files[0];
                                if (file) processImportFile(file);
                            }}
                        >
                            <div
                                className={cn(
                                    "w-full max-w-2xl border-2 border-dashed rounded-2xl p-16 transition-all duration-300 cursor-pointer group relative",
                                    isDragging ? "border-primary bg-primary/10 scale-[1.02] shadow-xl" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30"
                                )}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleImport}
                                    accept=".qsh,.csv,.json"
                                />
                                <div className="flex flex-col items-center gap-6 text-center">
                                    <div className={cn(
                                        "p-6 rounded-full bg-muted transition-all duration-300 group-hover:scale-110",
                                        isDragging ? "bg-primary/20 scale-110" : "group-hover:bg-primary/10"
                                    )}>
                                        <Upload className={cn(
                                            "h-12 w-12 text-muted-foreground transition-colors duration-300",
                                            isDragging ? "text-primary" : "group-hover:text-primary"
                                        )} />
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-2xl font-semibold tracking-tight">Import Channels</h3>
                                        <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                                            Connect and <span className="text-foreground font-semibold">Read from Radio</span> to load memories,
                                            or drag and drop a file here to import.
                                        </p>
                                        <div className="flex items-center justify-center gap-2 pt-4">
                                            <Badge variant="secondary" className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border-primary/20">.qsh</Badge>
                                            <Badge variant="outline" className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase">.csv</Badge>
                                            <Badge variant="outline" className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase">.json</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <MemoryTable
                            data={filteredChannels}
                            activeProfile={activeProfile}
                            onUpdate={handleUpdate}
                            readOnly={!!loading}
                            page={page}
                            visibleColumns={visibleColumns}
                            originalData={originalChannels}
                        />
                    )}
                </div>
            </main>
        </div>
    )
}
