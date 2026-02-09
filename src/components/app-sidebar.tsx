import { usePreferences } from "@/contexts/PreferencesContext"
import * as React from "react"
import {
    Terminal,
    Radio,
    Zap,
    TableProperties,
    Wrench,
    Sliders,
    Play,
    Square,
    ChevronDown,
    Copy,
    Check,
    LayoutDashboard,
    ChevronsRight,
    ChevronsLeft
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"


import type { PortInfo } from "@/lib/protocol"
import { type RadioProfile } from "@/lib/framework/module-interface"
import { ModuleManager } from "@/lib/framework/module-manager"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    connected: boolean
    onConnect: () => void
    isBusy?: boolean
    currentView: string
    setCurrentView: (view: string) => void
    isCollapsed: boolean
    setIsCollapsed: (collapsed: boolean) => void
    deviceInfo?: {
        version?: string;
        portInfo?: PortInfo;
        extended?: Record<string, string>;
        telemetry?: any;
    }
    activeProfile?: RadioProfile | null
    onProfileSelect?: (profile: RadioProfile) => void
}



const BatteryIcon = ({ percentage, isCharging }: { percentage: number, isCharging: boolean }) => {
    const getFillColor = () => {
        if (isCharging) return "bg-primary";
        if (percentage < 20) return "bg-destructive";
        return "bg-foreground/80";
    };

    return (
        <div className="relative w-5 h-2.5 border border-muted-foreground/40 rounded-[2px] flex items-center p-[0.5px]">
            <div
                className={cn("h-full rounded-[1px] transition-all duration-500", getFillColor())}
                style={{ width: `${Math.max(5, percentage)}%` }}
            />
            <div className="absolute -right-[2.5px] w-[1.5px] h-1 bg-muted-foreground/40 rounded-r-[1px]" />
            {isCharging && (
                <div className="absolute inset-x-0 -bottom-[1px] flex justify-center">
                    <div className="h-[2px] w-[70%] bg-primary animate-pulse" />
                </div>
            )}
        </div>
    );
};

const SignalBar = ({ rssi_dBm }: { rssi_dBm: number }) => {
    // RSSI roughly -120 to -60 range
    const strength = Math.min(5, Math.max(0, Math.floor((rssi_dBm + 120) / 12)));

    return (
        <div className="flex items-end gap-[1.5px] h-3 px-1">
            {[1, 2, 3, 4, 5].map((bar) => (
                <div
                    key={bar}
                    className={cn(
                        "w-[2.5px] rounded-t-[0.5px] transition-all duration-300",
                        bar <= strength ? "bg-foreground" : "bg-muted-foreground/20"
                    )}
                    style={{ height: `${(bar / 5) * 100}%` }}
                />
            ))}
        </div>
    );
};

const CopyableField = ({ label, value }: { label: string, value: string }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className="group flex justify-between items-center text-[11px] cursor-pointer hover:bg-accent/50 px-1 py-0.5 -mx-1 rounded transition-colors"
            onClick={handleCopy}
            title={`Click to copy: ${value}`}
        >
            <span className="text-muted-foreground shrink-0">
                {label}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono font-medium truncate">{value}</span>
                <div className={cn("transition-all duration-200 shrink-0", copied ? "opacity-100 scale-100" : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100")}>
                    {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5 text-muted-foreground/40" />}
                </div>
            </div>
        </div>
    );
};


export function AppSidebar({
    className,
    connected,
    onConnect,
    isBusy = false,
    currentView,
    setCurrentView,
    isCollapsed,
    setIsCollapsed,
    deviceInfo,
    activeProfile,
    onProfileSelect
}: SidebarProps) {
    const { bootloaderDetected } = usePreferences()
    const allProfiles = ModuleManager.getProfiles();

    // Disable navigation if busy OR in DFU mode (except Flasher/Console for DFU logic if needed, but mostly DFU locks everything)
    // Actually DFU locks specific things, isBusy locks EVERYTHING to prevent state corruption
    const isLocked = isBusy || bootloaderDetected;

    const handleProfileChange = (id: string) => {
        const p = allProfiles.find(x => x.id === id);
        if (p) {
            if (onProfileSelect) onProfileSelect(p);
            else ModuleManager.setActiveProfile(p);
        }
    };

    const NavItem = ({ icon: Icon, label, value, shortcut, badge, disabled }: { icon: any, label: string, value: string, shortcut?: string, badge?: string, disabled?: boolean }) => {
        const isSelected = currentView === value

        if (isCollapsed) {
            return (
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <div className="relative">
                            <Button
                                variant={isSelected ? "secondary" : "ghost"}
                                size="icon"
                                className={cn("h-9 w-9", disabled && "opacity-50 pointer-events-none")}
                                onClick={() => !disabled && setCurrentView(value)}
                                disabled={disabled}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="sr-only">{label}</span>
                            </Button>
                            {badge && (
                                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-4">
                        {label} {disabled && isCollapsed && "(Disabled)"}
                        {badge && <Badge variant="secondary" className="h-4 px-1 text-[8px] uppercase tracking-tighter bg-primary/10 text-primary border-none">{badge}</Badge>}
                        {shortcut && <span className="ml-auto text-xs tracking-widest text-muted-foreground">{shortcut}</span>}
                    </TooltipContent>
                </Tooltip>
            )
        }

        return (
            <Button
                variant={isSelected ? "secondary" : "ghost"}
                className={cn("w-full justify-start h-9 px-2", disabled && "opacity-50 pointer-events-none")}
                onClick={() => !disabled && setCurrentView(value)}
                disabled={disabled}
            >
                <Icon className="mr-2 h-4 w-4" />
                <span className="flex-1 text-left text-sm">{label}</span>
                {badge && (
                    <Badge variant="secondary" className="ml-auto h-4 px-1 text-[8px] uppercase tracking-tighter font-bold bg-primary/10 text-primary border-none">
                        {badge}
                    </Badge>
                )}
            </Button>
        )
    }



    return (
        <div className={cn("relative flex flex-col border-r bg-background transition-all duration-300", isCollapsed ? "w-[60px]" : "w-64", className)}>

            {/* Header Area */}
            <div className={cn("flex border-b shrink-0 transition-all",
                isCollapsed ? "flex-col items-center py-2 gap-2" : "flex-row items-center p-3 gap-2"
            )}>

                {/* Connect Button */}
                <div className={cn("transition-all", isCollapsed ? "order-2" : "order-1 flex-1")}>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Button
                                size={isCollapsed ? "icon" : "sm"}
                                variant={connected ? "destructive" : "default"}
                                disabled={isBusy}
                                className={cn(
                                    "transition-all shadow-sm",
                                    isCollapsed ? "h-8 w-8" : "w-full justify-center gap-2",
                                    connected ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"
                                )}
                                onClick={onConnect}
                            >
                                {isBusy ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                    connected ? (
                                        <Square className="h-3 w-3 fill-current" />
                                    ) : (
                                        <Play className="h-4 w-4 fill-current" />
                                    )
                                )}

                                {!isCollapsed && <span>{connected ? "Disconnect" : "Connect"}</span>}
                            </Button>
                        </TooltipTrigger>
                        {isCollapsed && (
                            <TooltipContent side="right">
                                {connected ? "Disconnect" : "Connect Radio"}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </div>

                {/* Toggle Button */}
                <div className={cn(isCollapsed ? "order-1" : "order-2")}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsCollapsed(!isCollapsed)}>
                        {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                    </Button>
                </div>

            </div>

            <ScrollArea className="flex-1 py-4">
                <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
                    <NavItem icon={LayoutDashboard} label="Dashboard" value="overview" shortcut="⌘1" disabled={isBusy} />
                    <NavItem icon={TableProperties} label="Memories" value="memories" shortcut="⌘2" badge="WIP" disabled={isLocked} />
                    <NavItem icon={Zap} label="Flasher" value="flasher" shortcut="⌘3" disabled={isBusy} />
                    <NavItem icon={Radio} label="Remote" value="remote" shortcut="⌘4" badge="WIP" disabled={isLocked} />

                    {/* Custom Pages from Active Profile */}
                    {activeProfile?.customPages?.map((page) => (
                        <NavItem
                            key={page.id}
                            icon={page.icon || Square}
                            label={page.label}
                            value={page.id}
                            disabled={isLocked}
                        />
                    ))}

                    <NavItem icon={Sliders} label="Configuration" value="config" shortcut="⌘5" disabled={isLocked} />
                    <NavItem icon={Terminal} label="Console" value="console" shortcut="⌘6" disabled={isLocked} />
                    <NavItem icon={Wrench} label="Calibration" value="calib" disabled={isLocked} />
                </nav>

                <Separator className="my-4" />

                <div className={cn("px-2", isCollapsed ? "hidden" : "px-4")}>
                    <Collapsible defaultOpen >
                        <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <span className="flex items-center gap-2">
                                Device
                                {connected && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                )}
                            </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-2">
                            <div className="rounded-md border p-3 text-xs space-y-2 bg-muted/30">
                                {connected && deviceInfo?.portInfo ? (
                                    <>
                                        {/* Core Device Info (Always visible when connected) */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-muted-foreground">Driver</span>
                                                <span className="font-medium truncate max-w-[120px]" title={deviceInfo.portInfo.label}>
                                                    {deviceInfo.portInfo.label}
                                                </span>
                                            </div>
                                            {deviceInfo.version && deviceInfo.version !== "Identifying..." && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground">
                                                        {deviceInfo.version.startsWith("Bootloader") ? "Bootloader" : "Firmware"}
                                                    </span>
                                                    <span className="font-mono font-medium truncate max-w-[100px]" title={deviceInfo.version}>
                                                        {deviceInfo.version.replace("Bootloader ", "")}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hardware Section */}
                                        {deviceInfo.extended && (
                                            <Collapsible defaultOpen className="border-t pt-1.5 mt-1.5">
                                                <CollapsibleTrigger className="flex w-full items-center justify-between group">
                                                    <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                                                        Hardware
                                                    </div>
                                                    <ChevronDown className="h-3 w-3 text-muted-foreground/50 transition-transform group-data-[state=closed]:-rotate-90" />
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="space-y-1 mt-1.5">
                                                    <CopyableField label="Serial" value={deviceInfo.extended.serial || deviceInfo.extended.Serial || "---"} />
                                                    <CopyableField label="MAC" value={deviceInfo.extended.mac || deviceInfo.extended.MAC || "---"} />
                                                    {(deviceInfo.extended.commit || deviceInfo.extended.Commit) && (
                                                        <CopyableField label="Commit" value={deviceInfo.extended.commit || deviceInfo.extended.Commit} />
                                                    )}
                                                    {(deviceInfo.extended.buildDate || deviceInfo.extended.date) && (
                                                        <CopyableField label="Built" value={deviceInfo.extended.buildDate || deviceInfo.extended.date} />
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}

                                        {/* Battery Section */}
                                        {deviceInfo.telemetry && (
                                            <Collapsible defaultOpen className="border-t pt-1.5 mt-1.5">
                                                <CollapsibleTrigger className="flex w-full items-center justify-between group">
                                                    <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                                                        Battery
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <BatteryIcon
                                                            percentage={deviceInfo.telemetry.batteryPercentage ?? 0}
                                                            isCharging={deviceInfo.telemetry.isCharging ?? false}
                                                        />
                                                        <ChevronDown className="h-3 w-3 text-muted-foreground/50 transition-transform group-data-[state=closed]:-rotate-90" />
                                                    </div>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="space-y-1.5 mt-2">
                                                    <div className="flex justify-between items-center text-[11px]">
                                                        <span className="text-muted-foreground">Voltage</span>
                                                        <span className="font-medium text-sm">{deviceInfo.telemetry.batteryVoltage?.toFixed(2)}V</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[11px]">
                                                        <span className="text-muted-foreground">Level</span>
                                                        <span className={cn("font-bold text-sm", (deviceInfo.telemetry.batteryPercentage ?? 100) < 20 ? "text-red-500" : "text-foreground")}>
                                                            {deviceInfo.telemetry.batteryPercentage}%
                                                        </span>
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}

                                        {/* Signal Section */}
                                        {deviceInfo.telemetry && (
                                            <Collapsible defaultOpen className="border-t pt-1.5 mt-1.5">
                                                <CollapsibleTrigger className="flex w-full items-center justify-between group">
                                                    <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                                                        Signal
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {deviceInfo.telemetry.rssi_dBm !== undefined && (
                                                            <SignalBar rssi_dBm={deviceInfo.telemetry.rssi_dBm} />
                                                        )}
                                                        <ChevronDown className="h-3 w-3 text-muted-foreground/50 transition-transform group-data-[state=closed]:-rotate-90" />
                                                    </div>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="space-y-1 mt-2">
                                                    {deviceInfo.telemetry.rssi_dBm !== undefined && (
                                                        <div className="flex justify-between items-center text-[11px]">
                                                            <span className="text-muted-foreground">RSSI</span>
                                                            <span className="font-bold text-sm">{deviceInfo.telemetry.rssi_dBm} dBm</span>
                                                        </div>
                                                    )}
                                                    {deviceInfo.telemetry.gain_dB !== undefined && (
                                                        <div className="flex justify-between items-center text-[11px]">
                                                            <span className="text-muted-foreground">LNA Gain</span>
                                                            <span className="font-medium text-sm">{deviceInfo.telemetry.gain_dB} dB</span>
                                                        </div>
                                                    )}
                                                    {deviceInfo.telemetry.noiseIndicator !== undefined && (
                                                        <div className="flex justify-between items-center text-[11px]">
                                                            <span className="text-muted-foreground">Noise</span>
                                                            <span className="font-medium text-sm">{deviceInfo.telemetry.noiseIndicator}</span>
                                                        </div>
                                                    )}
                                                    {deviceInfo.telemetry.glitchIndicator !== undefined && deviceInfo.telemetry.glitchIndicator > 0 && (
                                                        <div className="flex justify-between items-center text-[11px]">
                                                            <span className="text-muted-foreground">Glitches</span>
                                                            <span className="font-bold text-sm">{deviceInfo.telemetry.glitchIndicator}</span>
                                                        </div>
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}

                                        {/* Profile Selector */}
                                        <div className="pt-2 mt-2 border-t space-y-1">
                                            <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                                                Profile
                                            </div>
                                            <Select value={activeProfile?.id || ""} onValueChange={handleProfileChange}>
                                                <SelectTrigger className="h-7 text-xs bg-background border-none hover:bg-accent ring-offset-0 focus:ring-0 px-1">
                                                    <SelectValue placeholder="Select..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allProfiles.map(p => (
                                                        <SelectItem key={p.id} value={p.id} className="text-xs">
                                                            {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-muted-foreground py-2">
                                        No device connected
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </ScrollArea >
        </div >
    )
}
