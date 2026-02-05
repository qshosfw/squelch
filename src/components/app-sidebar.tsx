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
        portName?: string;
    }
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
    deviceInfo
}: SidebarProps) {

    const NavItem = ({ icon: Icon, label, value, shortcut }: { icon: any, label: string, value: string, shortcut?: string }) => {
        const isSelected = currentView === value

        if (isCollapsed) {
            return (
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <Button
                            variant={isSelected ? "secondary" : "ghost"}
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setCurrentView(value)}
                        >
                            <Icon className="h-4 w-4" />
                            <span className="sr-only">{label}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-4">
                        {label}
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
                    <NavItem icon={Database} label="Memories" value="memories" shortcut="⌘2" />
                    <NavItem icon={ArrowUpCircle} label="Flasher" value="flasher" shortcut="⌘3" />
                    <NavItem icon={Radio} label="Remote" value="remote" shortcut="⌘4" />
                    <NavItem icon={Settings} label="Configuration" value="config" shortcut="⌘5" />
                    <NavItem icon={Terminal} label="Console" value="console" shortcut="⌘6" />
                    <NavItem icon={FileCode} label="Calibration" value="calib" />
                </nav>

                <Separator className="my-4" />

                <div className={cn("px-2", isCollapsed ? "hidden" : "px-4")}>
                    <Collapsible defaultOpen >
                        <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                            {deviceInfo?.portName || "Device Information"}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-2">
                            <div className="rounded-md border p-3 text-xs space-y-2 bg-muted/30">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className={cn("font-medium", connected ? "text-foreground" : "text-muted-foreground")}>
                                        {connected ? "Connected" : "Disconnected"}
                                    </span>
                                </div>
                                {connected && deviceInfo?.version && (
                                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                                        {deviceInfo.version.startsWith("Bootloader") ? (
                                            <span className="font-mono font-semibold text-amber-500">{deviceInfo.version}</span>
                                        ) : (
                                            <>
                                                <span className="text-muted-foreground">Firmware</span>
                                                <span className="font-mono font-medium truncate max-w-[120px]" title={deviceInfo.version}>
                                                    {deviceInfo.version}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </ScrollArea>
        </div>
    )
}
