import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { protocol, type PortInfo } from "@/lib/protocol"
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
import { Zap, Github, Terminal, Shield, ChevronRight, Settings } from "lucide-react"
import { usePreferences } from "@/contexts/PreferencesContext"
import { PreferencesDialog } from "@/components/preferences-dialog"

import { useTheme } from "@/components/theme-provider"
import { Progress } from "@/components/ui/progress"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useRef, useEffect } from "react"

function App() {
    const [connected, setConnected] = useState(false)
    const [currentView, setCurrentView] = useState("overview")
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isBusy, setIsBusy] = useState(false)
    const [deviceInfo, setDeviceInfo] = useState<{ version: string, portInfo: PortInfo } | undefined>(undefined);
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

    // Fast Flash State
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [showFlashConfirm, setShowFlashConfirm] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashProgress, setFlashProgress] = useState(0);
    const [flashStep, setFlashStep] = useState("");
    const [flashLogs, setFlashLogs] = useState<string[]>([]);
    const [showSkip, setShowSkip] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState<{ id: number; timestamp: string; type: 'info' | 'error' | 'success' | 'tx' | 'rx'; content: string; }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // generateSW strategy if not default? Defaults are usually fine.
    const { toast } = useToast()
    const { setBootloaderDetected } = usePreferences()
    const { theme, setTheme } = useTheme()

    const handleConnect = async (silent = false) => {
        if (connected) {
            try {
                await protocol.disconnect()
                setConnected(false)
                setBootloaderDetected(false)
                setDeviceInfo(undefined);
                if (!silent) toast({ title: "Disconnected", description: "Radio disconnected." })
            } catch (error) {
                console.error(error)
                setConnected(false)
                setDeviceInfo(undefined);
            }
            return false;
        }

        try {
            const success = await protocol.connect()
            if (!success) throw new Error("Connection failed")

            setConnected(true)
            const portInfo = protocol.getPortInfo();
            setDeviceInfo({ version: "Identifying...", portInfo });

            if (!silent) toast({ title: "Connected", description: "Serial port opened." })

            // Attempt identification
            try {
                const info = await protocol.identifyDevice(2000)
                const isBootloader = info.blVersion.startsWith("Bootloader")
                setBootloaderDetected(isBootloader)
                setDeviceInfo({ version: info.blVersion, portInfo });
                if (!silent) toast({ title: "Device Identified", description: `Version: ${info.blVersion}` })
            } catch (e) {
                console.warn("Identification failed", e)
                setDeviceInfo({ version: "Unknown Device", portInfo });
            }
            return true;
        } catch (error: any) {
            console.error(error)
            if (!silent) {
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: error.message || "Could not establish connection.",
                })
            }
            setConnected(false)
            setDeviceInfo(undefined);
            return false;
        }
    }

    // Quick Actions Handlers
    const handleImportFirmware = () => {
        // Trigger hidden file input
        fileInputRef.current?.click();
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);

        // Reset input so same file can be selected again if needed
        e.target.value = '';

        // Check connection
        if (!connected) {
            const success = await handleConnect();
            if (success) {
                setShowFlashConfirm(true);
            }
        } else {
            setShowFlashConfirm(true);
        }
    }

    const performFlash = async () => {
        if (!pendingFile) return;
        setShowFlashConfirm(false);
        setIsFlashing(true);
        setFlashProgress(0);
        setFlashStep("Initializing...");
        setFlashLogs([]);
        setShowSkip(false);

        // Show skip button after 2.5s
        const skipTimer = setTimeout(() => setShowSkip(true), 2500);

        // Save global logger to restore later
        const globalLog = protocol.onLog;

        try {
            const buffer = await pendingFile.arrayBuffer();
            const data = new Uint8Array(buffer);
            // Hook up progress
            protocol.onProgress = (p) => setFlashProgress(p);
            protocol.onStepChange = (s) => setFlashStep(s);

            // We want both global log AND flash log.
            protocol.onLog = (msg, type) => {
                if (globalLog) globalLog(msg, type);
                const timestamp = new Date().toLocaleTimeString().split(' ')[0];
                setFlashLogs(prev => [...prev.slice(-20), `[${timestamp}] ${msg}`]);
            };

            await protocol.flashFirmware(data);

            toast({ title: "Flashing Complete", description: "Device rebooting..." });
            setFlashStep("Complete");
        } catch (e: any) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Flash Failed",
                description: e.message
            });
            setFlashStep("Failed");
        } finally {
            clearTimeout(skipTimer);
            // Delay closing to show success/fail state briefly
            setTimeout(() => {
                setIsFlashing(false);
                setFlashProgress(0);
                protocol.onProgress = null;
                protocol.onStepChange = null;
                // Restore global logger
                protocol.onLog = globalLog;
                setPendingFile(null);
            }, 1000);
        }
    }

    // Console logging effect
    useEffect(() => {
        // Don't override if flash is active? Actually we want global logs anyway.
        // But flash has its own temporary logger.
        // We can make protocol support multiple listeners or just chain them.
        // For now, let's just use the global one and make performFlash update BOTH if needed,
        // OR just rely on console logs.
        // But performFlash uses specific separate state.
        // Let's hook it up globally.

        const handleLog = (msg: string, type: 'info' | 'error' | 'success' | 'tx' | 'rx') => {
            setConsoleLogs(prev => {
                const newLog = {
                    id: Date.now() + Math.random(), // Simple ID
                    timestamp: new Date().toLocaleTimeString(),
                    type,
                    content: msg
                };
                const updated = [...prev, newLog];
                if (updated.length > 1000) return updated.slice(updated.length - 1000);
                return updated;
            });
        };

        // We need to be careful not to overwrite flash logger if it's active.
        // Actually, performFlash overwrites it. 
        // We should modify performFlash to NOT overwrite but maybe we can just share?
        // Or make protocol emit events we can subscribe to.
        // Given existing code, I'll set it here, but performFlash will overwrite it temporarily.
        // This means console stops updating during flash.
        // User wants "auto update even when not opened".
        // Better: Make protocol support multiple listeners?
        // Or hack: App.tsx wraps the logger.

        protocol.onLog = handleLog;

        return () => {
            // cleanup
        };
    }, []);

    const handleFlashFirmware = () => setCurrentView("flasher");
    const handleBackupCalibration = () => setCurrentView("calib");
    const handleRestoreCalibration = () => setCurrentView("calib");

    const isDarkMode = theme === "dark";
    const toggleDarkMode = () => setTheme(isDarkMode ? "light" : "dark");

    return (
        <TooltipProvider>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".bin"
                onChange={handleFileChange}
            />

            {/* Flash Confirmation Dialog */}
            <Dialog open={showFlashConfirm} onOpenChange={setShowFlashConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Flash Firmware?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to flash <strong>{pendingFile?.name}</strong> to the connected device?
                            This process cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingFile(null)}>Cancel</Button>
                        <Button onClick={performFlash}>Flash Firmware</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Flashing Progress Dialog */}
            <Dialog open={isFlashing}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Flashing Firmware</DialogTitle>
                        <DialogDescription>
                            Please do not disconnect the device.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                <span>{flashStep}</span>
                                <span>{Math.round(flashProgress)}%</span>
                            </div>
                            <Progress value={flashProgress} />
                        </div>

                        {/* Log Output */}
                        <div className="h-32 overflow-y-auto rounded-md bg-muted/50 p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap border">
                            {flashLogs.length === 0 ? <span className="opacity-50">Starting log...</span> : flashLogs.map((l, i) => (
                                <div key={i}>{l}</div>
                            ))}
                        </div>

                        {/* Skip Button */}
                        {showSkip && flashStep.includes("Waiting") && (
                            <div className="flex justify-center pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-muted-foreground hover:text-foreground h-6 px-2 hover:bg-transparent"
                                    onClick={() => protocol.skipWaiting()}
                                >
                                    Skip waiting for DFU...
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground font-sans tracking-tight antialiased selection:bg-neutral-200 selection:text-black dark:selection:bg-neutral-800 dark:selection:text-white">
                {/* Header / Menu Bar */}
                <header className="flex h-12 w-full shrink-0 items-center border-b px-4 bg-background z-20">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 font-semibold">
                            Squelch
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a href="https://github.com/sq5nit/squelch" target="_blank" rel="noreferrer">
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
                        <TopMenuBar
                            onOpenPreferences={() => setIsPreferencesOpen(true)}
                            onImportFirmware={handleImportFirmware}
                            onFlashFirmware={handleFlashFirmware}
                            onBackupCalibration={handleBackupCalibration}
                            onRestoreCalibration={handleRestoreCalibration}
                            isDarkMode={isDarkMode}
                            onToggleDarkMode={toggleDarkMode}
                        />
                        <PreferencesDialog
                            open={isPreferencesOpen}
                            onOpenChange={setIsPreferencesOpen}
                        />
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
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsPreferencesOpen(true)}>
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Preferences</TooltipContent>
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
                        deviceInfo={deviceInfo}
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
                                            <ConsoleView logs={consoleLogs} onClear={() => setConsoleLogs([])} />
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
