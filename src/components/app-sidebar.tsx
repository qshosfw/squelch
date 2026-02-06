import * as React from "react"
import {
    ChevronsLeft,
    ChevronsRight,
    Database,
    LayoutDashboard,
    Settings,
    Terminal,

    Radio,
    FileCode,
    ArrowUpCircle,
    Play,
    Square
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
    }
    activeProfile?: RadioProfile | null
}


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
    activeProfile
}: SidebarProps) {
    const allProfiles = ModuleManager.getProfiles();
    const handleProfileChange = (id: string) => {
        const p = allProfiles.find(x => x.id === id);
        if (p) ModuleManager.setActiveProfile(p);
    };

    const NavItem = ({ icon: Icon, label, value, shortcut, badge }: { icon: any, label: string, value: string, shortcut?: string, badge?: string }) => {
        const isSelected = currentView === value

        if (isCollapsed) {
            return (
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <div className="relative">
                            <Button
                                variant={isSelected ? "secondary" : "ghost"}
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setCurrentView(value)}
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
                        {label}
                        {badge && <Badge variant="secondary" className="h-4 px-1 text-[8px] uppercase tracking-tighter bg-primary/10 text-primary border-none">{badge}</Badge>}
                        {shortcut && <span className="ml-auto text-xs tracking-widest text-muted-foreground">{shortcut}</span>}
                    </TooltipContent>
                </Tooltip>
            )
        }

        return (
            <Button
                variant={isSelected ? "secondary" : "ghost"}
                className="w-full justify-start h-9 px-2"
                onClick={() => setCurrentView(value)}
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
                    <NavItem icon={LayoutDashboard} label="Dashboard" value="overview" shortcut="⌘1" />
                    <NavItem icon={Database} label="Memories" value="memories" shortcut="⌘2" badge="WIP" />
                    <NavItem icon={ArrowUpCircle} label="Flasher" value="flasher" shortcut="⌘3" />
                    <NavItem icon={Radio} label="Remote" value="remote" shortcut="⌘4" badge="WIP" />

                    {/* Custom Pages from Active Profile */}
                    {activeProfile?.customPages?.map((page) => (
                        <NavItem
                            key={page.id}
                            icon={page.icon || Square}
                            label={page.label}
                            value={page.id}
                        />
                    ))}

                    <NavItem icon={Settings} label="Configuration" value="config" shortcut="⌘5" />
                    <NavItem icon={Terminal} label="Console" value="console" shortcut="⌘6" />
                    <NavItem icon={FileCode} label="Calibration" value="calib" />
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
                                        {/* Driver/Chip Info */}
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Driver</span>
                                            <span className="font-medium truncate max-w-[120px]" title={deviceInfo.portInfo.label}>
                                                {deviceInfo.portInfo.label}
                                            </span>
                                        </div>
                                        {/* VID:PID */}
                                        {deviceInfo.portInfo.vidPid && deviceInfo.portInfo.vidPid !== "????" && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">VID:PID</span>
                                                <span className="font-mono text-muted-foreground">{deviceInfo.portInfo.vidPid}</span>
                                            </div>
                                        )}
                                        {/* Firmware Version */}
                                        {deviceInfo.version && deviceInfo.version !== "Identifying..." && (
                                            <div className="flex justify-between items-center border-t pt-2 mt-2">
                                                <span className="text-muted-foreground">
                                                    {deviceInfo.version.startsWith("Bootloader") ? "Bootloader" : "Firmware"}
                                                </span>
                                                <span className="font-mono font-medium truncate max-w-[100px]" title={deviceInfo.version}>
                                                    {deviceInfo.version.replace("Bootloader ", "")}
                                                </span>
                                            </div>
                                        )}

                                        {/* Profile Selector */}
                                        {connected && (
                                            <div className="pt-2 mt-2 border-t space-y-1">
                                                <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                                                    Active Profile
                                                </div>
                                                <Select value={activeProfile?.id || ""} onValueChange={handleProfileChange}>
                                                    <SelectTrigger className="h-7 text-xs bg-background">
                                                        <SelectValue placeholder="Select Profile..." />
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
                                        )}
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
