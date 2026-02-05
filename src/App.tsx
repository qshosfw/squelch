import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { protocolHandler } from "@/lib/protocol-handler"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AppSidebar } from "./components/app-sidebar"
import { CommandMenu } from "./components/command-menu"
import { TopMenuBar } from "./components/top-menu-bar"
import { FlasherView } from "./components/flasher-view"
import { CalibrationView } from "./components/calibration-view"
import { ConsoleView } from "./components/console-view"
import { SettingsView } from "./components/settings-view"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Zap, Github, Terminal, Shield, ChevronRight } from "lucide-react"
import { usePreferences } from "@/contexts/PreferencesContext"

function App() {
    const [connected, setConnected] = useState(false)
    const [currentView, setCurrentView] = useState("overview")
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isBusy, setIsBusy] = useState(false)
    const { toast } = useToast()
    const { setBootloaderDetected } = usePreferences()

    const handleConnect = async () => {
        if (connected) {
            try {
                await protocolHandler.disconnect()
                setConnected(false)
                setBootloaderDetected(false)
                toast({
                    title: "Disconnected",
                    description: "Radio disconnected.",
                })
            } catch (error) {
                console.error(error)
                toast({
                    variant: "destructive",
                    title: "Disconnect Failed",
                    description: "Could not cleanly disconnect.",
                })
                setConnected(false)
            }
            return
        }

        try {
            const success = await protocolHandler.connect()
            if (!success) throw new Error("Connection failed")

            setConnected(true)
            toast({
                title: "Connected",
                description: "Serial port opened.",
            })

            // Attempt identification
            try {
                const info = await protocolHandler.identifyDevice(2000)
                const isBootloader = info.blVersion.startsWith("Bootloader")
                setBootloaderDetected(isBootloader)
                toast({
                    title: "Device Identified",
                    description: `Version: ${info.blVersion}`,
                })
            } catch (e) {
                console.warn("Identification failed", e)
                // Don't disconnect, just warn
            }

        } catch (error: any) {
            console.error(error)
            toast({
                variant: "destructive",
                title: "Connection Failed",
                description: error.message || "Could not establish connection.",
            })
            setConnected(false)
        }
    }

    return (
        <TooltipProvider>
            <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground font-sans tracking-tight antialiased selection:bg-neutral-200 selection:text-black dark:selection:bg-neutral-800 dark:selection:text-white">
                {/* Header / Menu Bar */}
                <header className="flex h-12 w-full shrink-0 items-center border-b px-4 bg-background z-20">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 font-semibold">
                            Squelch
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a href="https://github.com/qshosfw/squelch" target="_blank" rel="noreferrer">
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                                            <span className="block hover:hidden">v0.1.0</span>
                                            <span className="hidden hover:block font-mono">2202890</span>
                                        </Badge>
                                    </a>
                                </TooltipTrigger>
                                <TooltipContent>View Commits (2202890)</TooltipContent>
                            </Tooltip>
                        </div>
                        <Separator orientation="vertical" className="h-6" />
                        <TopMenuBar />
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <CommandMenu />
                        <div className="flex items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Github className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>GitHub</TooltipContent>
                            </Tooltip>
                            <ModeToggle />
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    <AppSidebar
                        connected={connected}
                        onConnect={handleConnect}
                        isBusy={isBusy}
                        currentView={currentView}
                        setCurrentView={setCurrentView}
                        isCollapsed={isSidebarCollapsed}
                        setIsCollapsed={setIsSidebarCollapsed}
                    />

                    <main className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-8 relative">
                        {/* Context Menu Wrapper for the whole main area for global quick actions */}
                        <ContextMenu>
                            <ContextMenuTrigger className="h-full w-full">
                                <div className="mx-auto max-w-6xl space-y-8">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-bold tracking-tight capitalize">{currentView}</h2>
                                            <p className="text-sm text-muted-foreground">
                                                Manage your radio {currentView === 'overview' ? 'system status' : currentView}.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Content Rendering based on currentView */}
                                    <div className="space-y-4">
                                        {currentView === 'overview' && (
                                            <div className="space-y-6">
                                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                                    <Card>
                                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                                                            <Terminal className="h-4 w-4 text-muted-foreground" />
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="text-2xl font-bold">12%</div>
                                                            <p className="text-xs text-muted-foreground">42/1024 slots occupied</p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card>
                                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                            <CardTitle className="text-sm font-medium">Battery Level</CardTitle>
                                                            <Zap className="h-4 w-4 text-muted-foreground" />
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="text-2xl font-bold">--%</div>
                                                            <p className="text-xs text-muted-foreground">Voltage: -- V</p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card>
                                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                            <CardTitle className="text-sm font-medium">Status</CardTitle>
                                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="text-2xl font-bold">{connected ? "Connected" : "Idle"}</div>
                                                            <p className="text-xs text-muted-foreground">WebSerial Driver</p>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                                                    <Card className="col-span-4">
                                                        <CardHeader>
                                                            <CardTitle>Quick Actions</CardTitle>
                                                            <CardDescription>
                                                                Common tasks and operations for your radio.
                                                            </CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="space-y-2">
                                                            <Button variant="outline" className="w-full justify-between">
                                                                Backup Calibration
                                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                            <Button variant="outline" className="w-full justify-between">
                                                                Export Memory Channel CSV
                                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                            <Button variant="outline" className="w-full justify-between">
                                                                Factory Reset
                                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </div>
                                        )}

                                        {currentView === 'flasher' && (
                                            <FlasherView onBusyChange={setIsBusy} />
                                        )}

                                        {currentView === 'memories' && (
                                            <Card>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[80px]">CH</TableHead>
                                                                <TableHead>Name</TableHead>
                                                                <TableHead>Frequency</TableHead>
                                                                <TableHead>Modulation</TableHead>
                                                                <TableHead className="text-right">Action</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            <TableRow>
                                                                <TableCell className="font-mono font-medium">001</TableCell>
                                                                <TableCell>Local Repeater</TableCell>
                                                                <TableCell className="font-mono text-muted-foreground">145.600</TableCell>
                                                                <TableCell><Badge variant="secondary">FM</Badge></TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="sm">Edit</Button>
                                                                </TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-mono font-medium">002</TableCell>
                                                                <TableCell>Simplex Call</TableCell>
                                                                <TableCell className="font-mono text-muted-foreground">145.500</TableCell>
                                                                <TableCell><Badge variant="secondary">FM</Badge></TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="sm">Edit</Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {currentView === 'remote' && (
                                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 ">
                                                <Card className="lg:col-span-5 bg-zinc-950 dark:border-zinc-800">
                                                    <div className="aspect-video w-full flex items-center justify-center relative overflow-hidden bg-zinc-950 rounded-lg">
                                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black opacity-80" />
                                                        <div className="text-center space-y-2 relative z-10">
                                                            <div className="text-6xl font-mono font-bold text-emerald-500 tracking-tighter drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                                                                145.600
                                                            </div>
                                                            <div className="flex justify-center space-x-2">
                                                                <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">RX</Badge>
                                                                <Badge variant="outline" className="border-zinc-700 text-zinc-500">FM</Badge>
                                                            </div>
                                                        </div>
                                                        {/* Scanlines effect overlay */}
                                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none" />
                                                    </div>
                                                </Card>
                                                <Card className="lg:col-span-2">
                                                    <CardHeader>
                                                        <CardTitle>Keypad</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {['M', '▲', 'E', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                                                                <Button key={k} variant="outline" size="sm" className="font-mono text-xs">{k}</Button>
                                                            ))}
                                                            <Button variant="destructive" className="col-span-3 mt-2">PTT</Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        )}

                                        {currentView === 'console' && (
                                            <ConsoleView />
                                        )}

                                        {currentView === 'calib' && (
                                            <CalibrationView onBusyChange={setIsBusy} />
                                        )}

                                        {currentView === 'config' && (
                                            <SettingsView />
                                        )}
                                    </div>
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-64">
                                <ContextMenuLabel>Radio Actions</ContextMenuLabel>
                                <ContextMenuItem inset>
                                    Connect
                                    <ContextMenuShortcut>⌘O</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuItem inset>
                                    Flash Firmware
                                    <ContextMenuShortcut>⌘F</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem inset>
                                    Reload App
                                    <ContextMenuShortcut>⌘R</ContextMenuShortcut>
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    </main>
                </div>
                <Toaster />
            </div>
        </TooltipProvider>
    )
}

export default App
