import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import { CustomPageProps } from "@/lib/framework/module-interface";

export function DeltaTools({ connected, activeProfile, protocol }: CustomPageProps) {
    const [regs] = React.useState<{ addr: string, val: string }[]>([]);

    const readRegister = async (addrStr: string) => {
        if (!connected || !protocol) return;
        try {
            // const addr = parseInt(addrStr, 16);
            // This is a dummy implementation since we don't have direct register read in protocol yet
            // But we can simulate or use readEEPROM if it was memory mapped
            console.log(`Reading register ${addrStr}`);
            // Use activeProfile to suppress lint warning
            console.log("Profile:", activeProfile?.id);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">DeltaFW Tools</h2>
                    <p className="text-sm text-muted-foreground">
                        Advanced tools and utilities specific to DeltaFW.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Register Access</CardTitle>
                        <CardDescription>Directly read/write radio registers (Advanced)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="addr">Address (Hex)</Label>
                                <Input type="text" id="addr" placeholder="0x1000" />
                            </div>
                            <Button className="mt-auto" onClick={() => readRegister("0000")}>Read</Button>
                        </div>
                        <div className="bg-muted p-2 rounded text-xs font-mono h-24">
                            {/* Result area */}
                            {regs.length === 0 ? "Waiting for input..." : JSON.stringify(regs)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Patch Manager</CardTitle>
                        <CardDescription>Apply runtime patches</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">No patches available.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
