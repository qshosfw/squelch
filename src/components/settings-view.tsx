import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings2, Keyboard, Sun, Volume2 } from "lucide-react"

export function SettingsView() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card className="bg-muted/10 border-dashed">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-muted-foreground" />
                        Radio Configuration
                    </CardTitle>
                    <CardDescription>
                        Edit device-specific EEPROM settings directly.
                    </CardDescription>
                </CardHeader>
                <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 rounded-full bg-muted/20">
                        <Settings2 className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-semibold text-lg">Coming Soon</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Real-time editing of backlight, band limits, and feature flags is currently in development.
                            Application preferences can be found in the <strong>Settings</strong> button at the top.
                        </p>
                    </div>
                    <div className="flex gap-4 opacity-20 select-none">
                        <div className="flex items-center gap-1 text-xs"><Sun className="h-3 w-3" /> Backlight</div>
                        <div className="flex items-center gap-1 text-xs"><Volume2 className="h-3 w-3" /> Beep</div>
                        <div className="flex items-center gap-1 text-xs"><Keyboard className="h-3 w-3" /> Keylock</div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
