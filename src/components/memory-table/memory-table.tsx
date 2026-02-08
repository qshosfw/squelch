import * as React from "react"
import { Channel, RadioProfile } from "@/lib/framework/module-interface"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { InputCell } from "./input-cell"
import { Copy, ClipboardPaste, Trash2, Columns2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"

interface DataTableProps {
    data: Channel[]
    activeProfile: RadioProfile | null
    onUpdate?: (index: number, field: keyof Channel, value: any) => void
    readOnly?: boolean
    page: number
    visibleColumns: Record<string, boolean>
}

export function MemoryTable({ data, activeProfile, onUpdate, readOnly, page, visibleColumns }: DataTableProps) {

    const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({
        index: 45, name: 160, rxFreq: 110, offset: 100, mode: 80, power: 80,
        rxTone: 100, txTone: 100, step: 80, scan: 80, scram: 80, comp: 80,
        pttid: 80, busy: 100, rev: 80, sl1: 50, sl2: 50, sl3: 50
    })

    const handleResize = React.useCallback((key: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const startX = e.clientX
        const startWidth = columnWidths[key]

        const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX
            setColumnWidths(prev => ({
                ...prev,
                [key]: Math.max(30, startWidth + delta)
            }))
        }

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onMouseUp)
        }

        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
    }, [columnWidths])
    const [clipboard, setClipboard] = React.useState<Partial<Channel> | null>(null)

    const pageSize = 50
    const paginatedData = React.useMemo(() => data.slice(page * pageSize, (page + 1) * pageSize), [data, page, pageSize])

    const handleEdit = React.useCallback((index: number, field: keyof Channel, value: any) => {
        let finalValue = value;
        if (field === 'rxFreq' || field === 'offset') {
            const parsed = parseFloat(value);
            if (isNaN(parsed)) return;
            finalValue = Math.round(parsed * 1000000);
        }
        if (field === 'step') finalValue = parseFloat(value);
        onUpdate?.(index, field, finalValue);
    }, [onUpdate])

    const handleCopy = React.useCallback((row: Channel) => {
        setClipboard({ ...row });
    }, [])

    const handlePaste = React.useCallback((index: number) => {
        if (!clipboard) return;
        Object.entries(clipboard).forEach(([field, value]) => {
            if (field !== 'index') {
                onUpdate?.(index, field as keyof Channel, value);
            }
        });
    }, [clipboard, onUpdate])

    const handleClear = React.useCallback((index: number) => {
        onUpdate?.(index, 'empty', true);
    }, [onUpdate])

    const lists = activeProfile?.lists || {};

    const modeOptions = React.useMemo(() => (lists.MODE || ["FM", "NFM", "AM", "NAM", "USB"]).map(String), [lists.MODE]);
    const powerOptions = React.useMemo(() => (lists.POWER || ["Low", "High"]).map(String), [lists.POWER]);
    const stepOptions = React.useMemo(() => (lists.STEPS || [2.5, 5, 6.25, 12.5, 25]).map(String), [lists.STEPS]);
    const scramblerOptions = React.useMemo(() => (lists.SCRAMBLER || ["OFF"]).map(String), [lists.SCRAMBLER]);
    const pttIdOptions = React.useMemo(() => (lists.PTTID || ["OFF"]).map(String), [lists.PTTID]);

    const toneList = React.useMemo(() => [
        "None",
        ...(lists.TONES || []),
        ...(lists.DCS || [])
    ].map(String).filter((t, i, arr) => arr.indexOf(t) === i), [lists.TONES, lists.DCS]);


    return (
        <div className="flex flex-col h-full bg-background select-none">
            <ScrollArea className="flex-1">
                <Table className="w-full border-separate border-spacing-0 table-fixed">
                    <TableHeader className="sticky top-0 z-30 bg-muted/50 backdrop-blur-sm border-b">
                        <TableRow className="h-4 hover:bg-transparent">
                            <TableHead
                                className="px-0 text-[11px] font-semibold text-muted-foreground border-r border-b text-center sticky left-0 bg-muted/50 z-40 relative group"
                                style={{ width: columnWidths.index }}
                            >
                                #
                                <div
                                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50"
                                    onMouseDown={(e) => handleResize('index', e)}
                                />
                            </TableHead>
                            {visibleColumns.name && (
                                <TableHead className="px-2 text-[11px] font-semibold text-muted-foreground border-r border-b relative group" style={{ width: columnWidths.name }}>
                                    Name
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('name', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.rxFreq && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.rxFreq }}>
                                    Frequency
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('rxFreq', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.offset && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.offset }}>
                                    Offset
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('offset', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.mode && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.mode }}>
                                    Mode
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('mode', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.power && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.power }}>
                                    Power
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('power', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.rxTone && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.rxTone }}>
                                    RX Tone
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('rxTone', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.txTone && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.txTone }}>
                                    TX Tone
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('txTone', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.step && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.step }}>
                                    Step
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('step', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.scan && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.scan }}>
                                    Scan
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('scan', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.scram && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.scram }}>
                                    Scramble
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('scram', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.comp && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.comp }}>
                                    Compand
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('comp', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.pttid && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.pttid }}>
                                    PTT ID
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('pttid', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.busy && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.busy }}>
                                    Busy Lock
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('busy', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.rev && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.rev }}>
                                    Reverse
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('rev', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.sl1 && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.sl1 }}>
                                    List 1
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('sl1', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.sl2 && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-r border-b text-center relative group" style={{ width: columnWidths.sl2 }}>
                                    List 2
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('sl2', e)} />
                                </TableHead>
                            )}
                            {visibleColumns.sl3 && (
                                <TableHead className="px-1 text-[11px] font-semibold text-muted-foreground border-b text-center relative group" style={{ width: columnWidths.sl3 }}>
                                    List 3
                                    <div className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-50" onMouseDown={(e) => handleResize('sl3', e)} />
                                </TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length ? (
                            paginatedData.map((row) => (
                                <MemoizedRow
                                    key={row.index}
                                    row={row}
                                    visibleColumns={visibleColumns}
                                    columnWidths={columnWidths}
                                    readOnly={readOnly}
                                    handleEdit={handleEdit}
                                    handleCopy={handleCopy}
                                    handlePaste={handlePaste}
                                    handleClear={handleClear}
                                    modeOptions={modeOptions}
                                    powerOptions={powerOptions}
                                    toneList={toneList}
                                    stepOptions={stepOptions}
                                    scramblerOptions={scramblerOptions}
                                    pttIdOptions={pttIdOptions}
                                    clipboard={clipboard}
                                />
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={13} className="h-24 text-center text-muted-foreground font-mono text-xs">
                                    No data available. Read from radio to start.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" className="h-1.5 bg-muted/20" />
            </ScrollArea>

        </div >
    )
}

interface MemoizedRowProps {
    row: Channel
    visibleColumns: Record<string, boolean>
    columnWidths: Record<string, number>
    readOnly?: boolean
    handleEdit: (index: number, field: keyof Channel, value: any) => void
    handleCopy: (row: Channel) => void
    handlePaste: (index: number) => void
    handleClear: (index: number) => void
    modeOptions: string[]
    powerOptions: string[]
    toneList: string[]
    stepOptions: string[]
    scramblerOptions: string[]
    pttIdOptions: string[]
    clipboard: Partial<Channel> | null
}

const MemoizedRow = React.memo(({
    row,
    visibleColumns,
    columnWidths,
    readOnly,
    handleEdit,
    handleCopy,
    handlePaste,
    handleClear,
    modeOptions,
    powerOptions,
    toneList,
    stepOptions,
    scramblerOptions,
    pttIdOptions,
    clipboard
}: MemoizedRowProps) => {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <TableRow
                    className={cn(
                        "h-9 group hover:bg-muted/50 transition-none",
                        row.empty ? "opacity-40 grayscale bg-muted/5" : "bg-background"
                    )}
                >
                    <TableCell
                        className="h-9 p-0 border-r border-b text-center text-[12px] font-medium bg-muted/10 text-foreground sticky left-0 z-10"
                        style={{ width: columnWidths.index }}
                    >
                        {row.index}
                    </TableCell>
                    {visibleColumns.name && (
                        <TableCell className="h-9 p-0 border-r border-b" style={{ width: columnWidths.name }}>
                            <InputCell
                                value={row.name}
                                onCommit={(v) => handleEdit(row.index, 'name', v)}
                                editable={!readOnly}
                                className={cn(row.empty && "text-muted-foreground/50", "text-[14px] px-1")}
                            />
                        </TableCell>
                    )}
                    {visibleColumns.rxFreq && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.rxFreq }}>
                            <InputCell
                                inputMode="decimal"
                                value={row.rxFreq ? (row.rxFreq / 1000000).toFixed(5) : "0.00000"}
                                onCommit={(v) => handleEdit(row.index, 'rxFreq', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.offset && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.offset }}>
                            <InputCell
                                inputMode="decimal"
                                value={row.offset ? (row.offset / 1000000).toFixed(5) : "0.00000"}
                                onCommit={(v) => handleEdit(row.index, 'offset', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.mode && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.mode }}>
                            <InputCell
                                value={row.mode}
                                options={modeOptions}
                                onCommit={(v) => handleEdit(row.index, 'mode', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.power && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.power }}>
                            <InputCell
                                value={row.power}
                                options={powerOptions}
                                onCommit={(v) => handleEdit(row.index, 'power', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.rxTone && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.rxTone }}>
                            <InputCell
                                value={row.rxTone || "None"}
                                options={toneList}
                                onCommit={(v) => handleEdit(row.index, 'rxTone', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.txTone && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.txTone }}>
                            <InputCell
                                value={row.txTone || "None"}
                                options={toneList}
                                onCommit={(v) => handleEdit(row.index, 'txTone', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.step && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.step }}>
                            <InputCell
                                value={row.step || 2.5}
                                options={stepOptions}
                                onCommit={(v) => handleEdit(row.index, 'step', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.scan && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.scan }}>
                            <InputCell
                                value={row.scanList || "None"}
                                onCommit={(v) => handleEdit(row.index, 'scanList', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.scram && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.scram }}>
                            <InputCell
                                value={row.scrambler || "OFF"}
                                options={scramblerOptions}
                                onCommit={(v) => handleEdit(row.index, 'scrambler', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.comp && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.comp }}>
                            <InputCell
                                value={row.compander || "OFF"}
                                options={["OFF", "ON"]}
                                onCommit={(v) => handleEdit(row.index, 'compander', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.pttid && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.pttid }}>
                            <InputCell
                                value={row.pttid || "OFF"}
                                options={pttIdOptions}
                                onCommit={(v) => handleEdit(row.index, 'pttid', v)}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.busy && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.busy }}>
                            <InputCell
                                value={row.busyLock ? "ON" : "OFF"}
                                options={["OFF", "ON"]}
                                onCommit={(v) => handleEdit(row.index, 'busyLock', v === "ON")}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.rev && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.rev }}>
                            <InputCell
                                value={row.freqRev ? "ON" : "OFF"}
                                options={["OFF", "ON"]}
                                onCommit={(v) => handleEdit(row.index, 'freqRev', v === "ON")}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.sl1 && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.sl1 }}>
                            <InputCell
                                value={row.scanList1 ? "●" : "○"}
                                options={["○", "●"]}
                                onCommit={(v) => handleEdit(row.index, 'scanList1', v === "●")}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.sl2 && (
                        <TableCell className="h-9 p-0 border-r border-b text-center" style={{ width: columnWidths.sl2 }}>
                            <InputCell
                                value={row.scanList2 ? "●" : "○"}
                                options={["○", "●"]}
                                onCommit={(v) => handleEdit(row.index, 'scanList2', v === "●")}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                    {visibleColumns.sl3 && (
                        <TableCell className="h-9 p-0 border-b text-center" style={{ width: columnWidths.sl3 }}>
                            <InputCell
                                value={row.scanList3 ? "●" : "○"}
                                options={["○", "●"]}
                                onCommit={(v) => handleEdit(row.index, 'scanList3', v === "●")}
                                editable={!readOnly}
                                className="text-[14px]"
                            />
                        </TableCell>
                    )}
                </TableRow>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
                <ContextMenuLabel className="text-[12px] font-bold text-muted-foreground px-2 py-1 flex items-center gap-2">
                    <Columns2 className="w-3 h-3" />
                    Channel {row.index}
                </ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleCopy(row)} className="text-xs flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    Copy Row
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handlePaste(row.index)} disabled={!clipboard} className="text-xs flex items-center gap-2">
                    <ClipboardPaste className="w-3.5 h-3.5 text-slate-400" />
                    Paste Data
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleClear(row.index)} className="text-xs text-red-600 focus:text-red-700 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Row
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}, (prev, next) => {
    return prev.row === next.row &&
        prev.visibleColumns === next.visibleColumns &&
        prev.columnWidths === next.columnWidths &&
        prev.readOnly === next.readOnly &&
        prev.clipboard === next.clipboard;
});
