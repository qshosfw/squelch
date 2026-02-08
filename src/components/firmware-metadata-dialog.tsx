import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FirmwareMetadata } from "@/lib/firmware-parser";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface FirmwareMetadataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    metadata: FirmwareMetadata | undefined;
    onConfirm: () => void;
    onCancel: () => void;
}

export function FirmwareMetadataDialog({
    open,
    onOpenChange,
    metadata,
    onConfirm,
    onCancel
}: FirmwareMetadataDialogProps) {
    if (!metadata) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Confirm Firmware Flash</DialogTitle>
                    <DialogDescription>
                        Please review the firmware details before proceeding.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{metadata.name || "Unknown Firmware"}</h3>
                        {metadata.version && (
                            <Badge variant="outline">{metadata.version}</Badge>
                        )}
                    </div>

                    {metadata.author && (
                        <div className="text-sm text-muted-foreground">
                            By: <span className="text-foreground font-medium">{metadata.author}</span>
                        </div>
                    )}

                    {metadata.description && (
                        <div className="rounded-md bg-muted p-3 text-sm">
                            {metadata.description}
                        </div>
                    )}

                    {metadata.changelog && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">Changelog</h4>
                            <ScrollArea className="h-[100px] w-full rounded-md border p-2 text-sm bg-muted/50">
                                <pre className="whitespace-pre-wrap font-sans text-xs">
                                    {metadata.changelog}
                                </pre>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={onConfirm}>Flash Firmware</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
