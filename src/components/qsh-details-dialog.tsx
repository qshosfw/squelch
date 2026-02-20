import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QSHFile, TAG_MAP, TAG_G_TITLE, TAG_G_AUTHOR, TAG_G_DESC, TAG_G_DATE, TAG_F_NAME, TAG_F_VERSION, TAG_D_LABEL, TAG_ID_RADIO_UID, TAG_G_TYPE, TAG_ID_FW_STR } from "@/lib/qsh"
import { User, Calendar, Package, Cpu, Database, Binary, Radio } from "lucide-react"
import { RadioProfile } from "@/lib/framework/module-interface"
import { calculateCrockford, uidToBigInt } from "@/lib/framework/radio-utils"
import { ModuleManager } from "@/lib/framework/module-manager"
import { cn } from "@/lib/utils"

interface QshDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    qsh: QSHFile | null;
    onProceed: (profileId: string) => void;
    activeProfile?: RadioProfile | null;
}

export function QshDetailsDialog({ open, onOpenChange, qsh, onProceed, activeProfile }: QshDetailsDialogProps) {
    if (!qsh) return null;

    const global = qsh.globalMeta;
    const title = global[TAG_G_TITLE] || "Unnamed Package";
    const author = global[TAG_G_AUTHOR] || "Unknown";
    const desc = global[TAG_G_DESC];
    const date = global[TAG_G_DATE] ? new Date(global[TAG_G_DATE] * 1000).toLocaleString() : null;
    const gType = global[TAG_G_TYPE] || "generic";

    // Local state for profile selection
    const [selectedProfileId, setSelectedProfileId] = useState<string>(activeProfile?.id || "");
    const profiles = ModuleManager.getProfiles();

    // Effect to auto-select profile based on QSH metadata if possible
    useEffect(() => {
        if (!qsh) return;

        // Try to match by FW string or UID
        const fwStr = qsh.globalMeta[TAG_ID_FW_STR];
        // const uid = qsh.globalMeta[TAG_ID_RADIO_UID]; // We'd need to reverse lookup UID which is hard

        if (fwStr && typeof fwStr === 'string') {
            const match = profiles.find(p => p.matchFirmware(fwStr));
            if (match) {
                setSelectedProfileId(match.id);
                return;
            }
        }

        // Fallback to active if set, otherwise empty
        if (activeProfile && !selectedProfileId) {
            setSelectedProfileId(activeProfile.id);
        }
    }, [qsh, activeProfile, profiles]);


    const handleProceed = () => {
        const isRequired = ['channels', 'settings', 'config', 'generic', 'migration', 'backup'].includes(gType);
        if (isRequired && !selectedProfileId) {
            return;
        }

        // Pass the selected profile ID if required, or empty/existing if not
        onProceed(selectedProfileId);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                            <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                            <DialogTitle>{title}</DialogTitle>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" /> {author}
                                </span>
                                {date && (
                                    <>
                                        <Separator orientation="vertical" className="h-3" />
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> {date}
                                        </span>
                                    </>
                                )}
                                <Separator orientation="vertical" className="h-3" />
                                <Badge variant="outline" className="capitalize px-1.5 h-4 text-[10px]">
                                    {gType}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    {desc && (
                        <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-dashed">
                            {desc}
                        </p>
                    )}
                </DialogHeader>

                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-6 pb-6">
                        {/* Profile Selector Section - Only if package contains user data (channels/settings) */}
                        {['channels', 'settings', 'config', 'generic', 'migration', 'backup'].includes(gType) && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 space-y-3">
                                <div className="flex items-start gap-3">
                                    <Radio className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                    <div className="space-y-1 flex-1">
                                        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Decoding Preset</h4>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-normal">
                                            Select the radio profile to use for decoding this QSH file.
                                            Non-firmware data inside needs the correct preset to be interpreted correctly.
                                        </p>
                                    </div>
                                </div>

                                <div className="pl-8">
                                    <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                                        <SelectTrigger className="w-full bg-background border-blue-200 dark:border-blue-800">
                                            <SelectValue placeholder="Select a radio profile..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {profiles.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name} <span className="text-muted-foreground ml-2 text-xs">({p.id})</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <Separator />

                        <div>
                            <h3 className="text-xs font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                                <Package className="h-3 w-3" />
                                {qsh.blobs.length === 1 ? "1 Blob" : `${qsh.blobs.length} Blobs`}
                            </h3>

                            <div className="grid gap-4">
                                {qsh.blobs.map((blob, idx) => {
                                    const bMeta = blob.metadata;
                                    const bName = bMeta[TAG_F_NAME] || bMeta[TAG_D_LABEL] || `Blob ${idx + 1}`;
                                    const bVersion = bMeta[TAG_F_VERSION];
                                    const isFW = bMeta[TAG_F_NAME] || gType === 'firmware';
                                    const isCal = bMeta[TAG_D_LABEL] || gType === 'calibration';

                                    return (
                                        <Card key={idx} className="overflow-hidden shadow-none">
                                            <CardHeader className="py-3 px-4 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 rounded-md bg-background border shrink-0">
                                                        {isFW ? <Cpu className="h-3.5 w-3.5" /> : isCal ? <Database className="h-3.5 w-3.5" /> : <Binary className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                            {bName}
                                                            {bVersion && <Badge variant="secondary" className="text-[10px] h-4 py-0">{bVersion}</Badge>}
                                                        </CardTitle>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                                            {blob.data.length < 1024 ? `${blob.data.length} Bytes` : `${(blob.data.length / 1024).toFixed(1)} KB`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <TooltipProvider>
                                                    <Table>
                                                        <TableBody>
                                                            {Object.entries(bMeta).map(([tag, val]) => {
                                                                const tagNum = Number(tag);
                                                                if ([TAG_F_NAME, TAG_F_VERSION, TAG_D_LABEL].includes(tagNum)) return null;
                                                                const tagName = TAG_MAP[tagNum] || `0x${tagNum.toString(16).toUpperCase()}`;

                                                                let displayVal = String(val);
                                                                if (tagName.includes("Addr") && typeof val === 'number') {
                                                                    displayVal = `0x${val.toString(16).toUpperCase()}`;
                                                                }

                                                                const isUID = tagNum === TAG_ID_RADIO_UID;
                                                                let formattedUid = null;
                                                                if (isUID) {
                                                                    // Use the SELECTED profile to format if available, else fallback
                                                                    const p = profiles.find(pr => pr.id === selectedProfileId);
                                                                    if (p) {
                                                                        formattedUid = p.formatUID(val);
                                                                    } else if (activeProfile) {
                                                                        formattedUid = activeProfile.formatUID(val);
                                                                    } else {
                                                                        try {
                                                                            const bigVal = (val instanceof Uint8Array) ? uidToBigInt(val) : BigInt(val);
                                                                            if (bigVal !== null) formattedUid = calculateCrockford(bigVal);
                                                                        } catch (e) { }
                                                                    }
                                                                }

                                                                return (
                                                                    <TableRow key={tag} className="hover:bg-muted/50 border-muted/40">
                                                                        <TableCell className="py-1.5 px-4 text-[11px] text-muted-foreground w-[160px] font-medium">
                                                                            {tagName}
                                                                        </TableCell>
                                                                        <TableCell className="py-1.5 px-4 font-mono text-[11px]">
                                                                            {isUID ? (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <span className={cn(
                                                                                            "cursor-help underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground",
                                                                                            formattedUid ? "text-primary " : ""
                                                                                        )}>
                                                                                            {formattedUid || displayVal}
                                                                                        </span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="right">
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-[10px] font-semibold text-muted-foreground">Internal Radio UID</p>
                                                                                            <p className="text-xs font-mono">{String(val)}</p>
                                                                                            {formattedUid && <p className="text-[10px] text-primary">Formatted by: {profiles.find(p => p.id === selectedProfileId)?.name || "Unknown"}</p>}
                                                                                        </div>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            ) : (tagNum === 0x45) ? ( // TAG_D_CH_NAMES
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <span className="cursor-help underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground max-w-[200px] truncate block">
                                                                                            {String(val).split(',').filter(Boolean).length} Channels Named
                                                                                        </span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="right" className="max-w-[300px] bg-background border-muted shadow-xl">
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Channel List</p>
                                                                                            <div className="text-[10px] grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
                                                                                                {String(val).split(',').map((n, i) => n ? <div key={i}><span className="text-muted-foreground w-6 inline-block text-right mr-1">{i + 1}:</span>{n}</div> : null).filter(Boolean).slice(0, 20)}
                                                                                            </div>
                                                                                            {String(val).split(',').filter(Boolean).length > 20 && (
                                                                                                <p className="text-[9px] text-muted-foreground mt-1 pt-1 border-t italic">...and {String(val).split(',').filter(Boolean).length - 20} more</p>
                                                                                            )}
                                                                                        </div>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            ) : (
                                                                                <span>{displayVal}</span>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </TooltipProvider>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 pt-4 bg-muted/20 border-t flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleProceed} disabled={['channels', 'settings', 'config', 'generic', 'migration', 'backup'].includes(gType) && !selectedProfileId} className="font-semibold">
                        Proceed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
