
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { protocol, type PortInfo, type SerialStats } from "@/lib/protocol"
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
import { ComingSoonView } from "./components/coming-soon-view"
import { Database } from "lucide-react"
import { RemoteView } from "./components/remote/RemoteView"
import { PWAReloadPrompt } from "./components/pwa-reload-prompt"
import { DynamicFavicon } from "./components/dynamic-favicon"
import { ModuleManager } from "@/lib/framework/module-manager"
import { type RadioProfile } from "@/lib/framework/module-interface"

import { useTheme } from "@/components/theme-provider"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useRef, useEffect } from "react"
import { FlashProgressDialog, type LogEntry } from "./components/flash-progress-dialog"

function App() {
    const [connected, setConnected] = useState(false)
    const [currentView, setCurrentView] = useState("overview")
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isBusy, setIsBusy] = useState(false)
    const [deviceInfo, setDeviceInfo] = useState<{ version: string, portInfo: PortInfo } | undefined>(undefined);
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)
    const [activeProfile, setActiveProfile] = useState<RadioProfile | null>(ModuleManager.getActiveProfile());

    useEffect(() => {
        return ModuleManager.subscribe(setActiveProfile);
    }, []);

    // Fast Flash State
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [showFlashConfirm, setShowFlashConfirm] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashProgress, setFlashProgress] = useState(0);
    const [flashStep, setFlashStep] = useState("");
    const [flashLogs, setFlashLogs] = useState<LogEntry[]>([]);
    const [flashResult, setFlashResult] = useState<'success' | 'error' | null>(null);
    const [flashStats, setFlashStats] = useState<SerialStats | null>(null);
    const [showSkip, setShowSkip] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState<{ id: number; timestamp: string; type: 'info' | 'error' | 'success' | 'tx' | 'rx'; content: string; }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // generateSW strategy if not default? Defaults are usually fine.
    const { toast } = useToast()
    const { setBootloaderDetected } = usePreferences()
    const { theme, setTheme } = useTheme()

    // Listen for unexpected disconnects
    useEffect(() => {
        protocol.onStatusChange = (status, error) => {
            setConnected(status);
            if (!status) {
                setDeviceInfo(undefined);
                setBootloaderDetected(false);
                if (error) {
                    toast({
                        variant: "destructive",
                        title: "Connection Lost",
                        description: error,
                    });
                }
            }
        };

        // Cleanup
        return () => {
            protocol.onStatusChange = null;
        };
    }, [toast, setBootloaderDetected]);

    // Prevent accidental page close while busy (flashing or reading/writing)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isBusy || isFlashing) {
                e.preventDefault();
                e.returnValue = "Operation in progress. Are you sure you want to leave?";
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isBusy, isFlashing]);

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

        setIsBusy(true);
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

                // Detect Profile
                const matchedProfile = ModuleManager.detectProfile(info.blVersion);
                if (matchedProfile) {
                    ModuleManager.setActiveProfile(matchedProfile);
                    if (!silent) toast({ title: "Profile Activated", description: `Active: ${matchedProfile.name}` });
                } else {
                    // Fallback to stock or just stay null (selector allows manual pick)
                    // Maybe default to Stock if we have no better idea, or let user pick.
                    // For now, let's look for a generic "Stock" or first available if unknown?
                    // Actually better to leave it null or keep previous?
                    // Let's force Stock if nothing else matches, assuming Stock is basically "Basic Protocol".
                    const stock = ModuleManager.detectProfile("stock"); // assuming stock matches "stock" or we can find by ID
                    if (stock) ModuleManager.setActiveProfile(stock);
                }

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
        } finally {
            setIsBusy(false);
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
        setFlashResult(null);
        setFlashStats(null);
        setShowSkip(false);

        // Show skip button after 2.5s
        const skipTimer = setTimeout(() => setShowSkip(true), 2500);

        // Save global logger to restore later
        const globalLog = protocol.onLog;

        const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
            const time = new Date().toLocaleTimeString();
            setFlashLogs(prev => [...prev.slice(-100), { time, message: msg, type }]);
            if (type !== 'tx' && type !== 'rx') {
                setFlashStep(msg);
            }
        };

        try {
            const buffer = await pendingFile.arrayBuffer();
            const data = new Uint8Array(buffer);
            // Hook up progress
            protocol.onProgress = (p) => setFlashProgress(p);
            protocol.onStepChange = (s) => setFlashStep(s);
            protocol.onStatsUpdate = (s) => setFlashStats(s);

            protocol.onLog = (msg, type) => {
                if (globalLog) globalLog(msg, type);
                addLog(msg, type as any);
            };

            await protocol.flashFirmware(data);

            toast({ title: "Flashing Complete", description: "Device rebooting..." });
            setFlashStep("Complete");
            setFlashResult('success');
        } catch (e: any) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Flash Failed",
                description: e.message
            });
            setFlashStep("Failed");
            setFlashResult('error');
            addLog(`Error: ${e.message} `, "error");
        } finally {
            clearTimeout(skipTimer);
            setIsFlashing(false);
            protocol.onProgress = null;
            protocol.onStepChange = null;
            protocol.onStatsUpdate = null;
            // Restore global logger (don't restore immediately so dialog can still show logs)
            // Actually log is passed to dialog, so we can restore now.
            protocol.onLog = globalLog;
            // Don't set pendingFile to null yet, otherwise confirmation might show? 
            // Actually Dialog handles its own close.
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
            <DynamicFavicon connected={connected} isBusy={isBusy || isFlashing} />
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

            {/* Unified Flash Progress Dialog */}
            <FlashProgressDialog
                isOpen={isFlashing || flashResult !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setFlashResult(null);
                        setPendingFile(null);
                    }
                }}
                isFlashing={isFlashing}
                progress={flashProgress}
                statusMessage={flashStep}
                logs={flashLogs}
                stats={flashStats}
                flashResult={flashResult}
                onSkipWaiting={() => protocol.skipWaiting()}
                showSkipButton={showSkip && flashStep.includes("Waiting")}
            />

            <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground font-sans tracking-tight antialiased selection:bg-neutral-200 selection:text-black dark:selection:bg-neutral-800 dark:selection:text-white">
                {/* Header / Menu Bar */}
                <header className="flex h-10 w-full shrink-0 items-center border-b px-4 bg-background z-20">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2 font-semibold shrink-0">
                            Squelch
                            <a
                                href="https://github.com/qshosfw/squelch"
                                target="_blank"
                                rel="noreferrer"
                                className="group"
                            >
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                                    <span className="block group-hover:hidden">v0.1.0</span>
                                    <span className="hidden group-hover:block font-mono tracking-tighter">{__COMMIT_HASH__}</span>
                                </Badge>
                            </a>
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

                    <div className="flex justify-center flex-1 max-w-sm px-2">
                        <CommandMenu />
                    </div>

                    <div className="flex-1 flex items-center justify-end gap-2">
                        <div className="flex items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <Github className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>GitHub</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPreferencesOpen(true)}>
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
                        activeProfile={activeProfile}
                    />

                    <main className="flex-1 overflow-hidden bg-muted/10 relative flex flex-col">
                        {/* Context Menu Wrapper for the whole main area for global quick actions */}
                        <ContextMenu>
                            <ContextMenuTrigger className="flex-1 flex flex-col min-h-0">
                                <div className="flex-1 flex flex-col p-4 md:p-8 min-h-0">
                                    <div className="mx-auto w-full max-w-6xl flex-1 flex flex-col min-h-0 space-y-8">
                                        <div className="flex items-center justify-between shrink-0">
                                            <div className="space-y-1">
                                                <h2 className="text-2xl font-bold tracking-tight capitalize">{currentView}</h2>
                                                <p className="text-sm text-muted-foreground">
                                                    Manage your radio {currentView === 'overview' ? 'system status' : currentView}.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Content Rendering based on currentView */}
                                        <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
                                            <div className="space-y-4 h-full">
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
                                                    <FlasherView connected={connected} onConnect={handleConnect} onBusyChange={setIsBusy} />
                                                )}

                                                {currentView === 'memories' && (
                                                    <ComingSoonView
                                                        title="Memory Manager"
                                                        description="A powerful channel editor for your radio. Read, edit, and organize your memory channels with ease. Support for CHIRP imports and batch editing is in the works."
                                                        icon={Database}
                                                    />
                                                )}

                                                {currentView === 'remote' && (
                                                    <RemoteView />
                                                )}

                                                {currentView === 'console' && (
                                                    <ConsoleView logs={consoleLogs} connected={connected} onClear={() => setConsoleLogs([])} />
                                                )}

                                                {currentView === 'calib' && (
                                                    <CalibrationView connected={connected} onConnect={handleConnect} onBusyChange={setIsBusy} />
                                                )}

                                                {currentView === 'config' && (
                                                    <SettingsView />
                                                )}

                                                {/* Render Active Profile Custom Pages */}
                                                {activeProfile?.customPages?.map(page => {
                                                    if (currentView === page.id) {
                                                        const Component = page.component;
                                                        return <Component key={page.id} />;
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        </div>
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
                <PWAReloadPrompt />
            </div>
        </TooltipProvider>
    )
}

export default App
