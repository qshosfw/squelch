
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
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
import { Zap, Github, Terminal, Shield, ChevronRight, Settings, LayoutDashboard, TableProperties, Wrench, Sliders, Radio, Activity } from "lucide-react"
import { usePreferences } from "@/contexts/PreferencesContext"
import { PreferencesDialog } from "@/components/preferences-dialog"
import { RemoteView } from "./components/remote/RemoteView"
import { MemoryView } from "./components/memory-view"
import { PWAReloadPrompt } from "./components/pwa-reload-prompt"
import { DynamicFavicon } from "./components/dynamic-favicon"
import { ModuleManager } from "@/lib/framework/module-manager"
import { RadioProfile } from "@/lib/framework/module-interface"
import { cn } from "@/lib/utils"

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
import { parseFirmwareFile, ParsedFirmware } from './lib/firmware-parser';
import { FirmwareMetadataDialog } from './components/firmware-metadata-dialog';
import { processFile, ProcessedFile } from './lib/file-processor';
import { QshDetailsDialog } from './components/qsh-details-dialog';
import { TAG_G_TYPE, TAG_F_NAME, TAG_D_LABEL } from './lib/qsh';
import { useHistory } from "@/hooks/use-history"
import { Channel } from "@/lib/framework/module-interface"

function App() {
    const [connected, setConnected] = useState(false)
    const [currentView, setCurrentView] = useState("overview")
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isBusy, setIsBusy] = useState(false)
    const [deviceInfo, setDeviceInfo] = useState<{
        version: string,
        portInfo: PortInfo,
        extended?: Record<string, string>,
        telemetry?: any
    } | undefined>(undefined);
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)
    const [activeProfile, setActiveProfile] = useState<RadioProfile | null>(ModuleManager.getActiveProfile());
    const [originalChannels, setOriginalChannels] = useState<any[]>([]);
    const [originalSettings, setOriginalSettings] = useState<any>({});

    // Undo/Redo History State
    const {
        state: channels,
        set: setChannels,
        replace: replaceChannels,
        reset: resetChannels,
        undo: undoChannels,
        redo: redoChannels
    } = useHistory<Channel[]>([]);

    const {
        state: settings,
        set: setSettings,
        reset: resetSettings,
        undo: undoSettings,
        redo: redoSettings
    } = useHistory<any>({});

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl+Z (Undo) and Ctrl+Shift+Z / Ctrl+Y (Redo)
            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    // Redo
                    e.preventDefault();
                    if (currentView === 'memories') redoChannels();
                    else if (currentView === 'config') redoSettings();
                } else {
                    // Undo
                    e.preventDefault();
                    if (currentView === 'memories') undoChannels();
                    else if (currentView === 'config') undoSettings();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'y') {
                // Redo (Windows style)
                e.preventDefault();
                if (currentView === 'memories') redoChannels();
                else if (currentView === 'config') redoSettings();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentView, undoChannels, redoChannels, undoSettings, redoSettings]);

    useEffect(() => {
        return ModuleManager.subscribe(setActiveProfile);
    }, []);

    // Fast Flash State
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [parsedFirmware, setParsedFirmware] = useState<ParsedFirmware | null>(null);
    const [showMetadataDialog, setShowMetadataDialog] = useState(false);
    const [showFlashConfirm, setShowFlashConfirm] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashProgress, setFlashProgress] = useState(0);
    const [flashStep, setFlashStep] = useState("");
    const [flashLogs, setFlashLogs] = useState<LogEntry[]>([]);
    const [flashResult, setFlashResult] = useState<'success' | 'error' | null>(null);
    const [flashStats, setFlashStats] = useState<SerialStats | null>(null);
    const [flashEndTime, setFlashEndTime] = useState<number | null>(null);
    const [showSkip, setShowSkip] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState<{ id: number; timestamp: string; type: 'info' | 'error' | 'success' | 'tx' | 'rx'; content: string; }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingProcessedFile, setPendingProcessedFile] = useState<ProcessedFile | null>(null);
    const [showQshDialog, setShowQshDialog] = useState(false);

    // generateSW strategy if not default? Defaults are usually fine.
    const { toast } = useToast()
    const { setBootloaderDetected, autoSwitchToFlasher, telemetryInterval, developerMode, profileSwitchMode } = usePreferences()
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

    // DFU Detection Auto-Switch
    const lastDfuToastRef = useRef<number>(0);
    useEffect(() => {
        protocol.onDfuDetected = (version) => {
            // Update device info immediately (idempotent)
            setDeviceInfo({
                version: `Bootloader ${version}`,
                portInfo: protocol.getPortInfo()
            });
            setBootloaderDetected(true);

            if (autoSwitchToFlasher) {
                const isFlasher = document.querySelector('h2')?.textContent?.toLowerCase() === 'flasher';
                if (!isFlasher) {
                    console.log("Auto-switching to flasher (DFU Detected)");
                    setCurrentView("flasher");
                    protocol.resetStats();

                    // Prevent spamming notification (throttle 5s) using ref
                    const now = Date.now();
                    if (now - lastDfuToastRef.current > 5000) {
                        toast({
                            title: "DFU Mode Detected",
                            description: `Bootloader ${version} detected. Switching to Flasher view...`,
                        });
                        lastDfuToastRef.current = now;
                    }
                }
            }
        };
        return () => { protocol.onDfuDetected = null; }
    }, [autoSwitchToFlasher, toast, setBootloaderDetected]);

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

    // Telemetry Polling
    useEffect(() => {
        if (!connected || !activeProfile || !telemetryInterval || telemetryInterval <= 0) return;

        const intervalId = setInterval(async () => {
            if (isBusy || isFlashing) return;
            try {
                const telemetry = await activeProfile.getTelemetry(protocol);
                if (telemetry) {
                    setDeviceInfo(prev => prev ? {
                        ...prev,
                        telemetry: { ...prev.telemetry, ...telemetry }
                    } : prev);
                }
            } catch (e) {
                console.warn("Telemetry poll failed", e);
            }
        }, telemetryInterval);

        return () => clearInterval(intervalId);
    }, [connected, activeProfile, telemetryInterval, isBusy, isFlashing]);

    const handleConnect = async (silent = false) => {
        // Check WebSerial support first
        if (!('serial' in navigator)) {
            toast({
                variant: "destructive",
                title: "WebSerial Not Supported",
                description: "Your browser doesn't support WebSerial. Please use Chrome, Edge, or Opera.",
            });
            return false;
        }

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
                const info = await protocol.identify(2000)
                const isBootloader = info.firmwareVersion.startsWith("Bootloader")
                setBootloaderDetected(isBootloader)

                setDeviceInfo(prev => ({
                    ...prev!,
                    version: info.firmwareVersion
                }));

                // Detect & Switch Profile
                const detectedProfile = ModuleManager.detectProfile(info.firmwareVersion) || ModuleManager.getProfiles().find(p => p.id === 'stock-uvk5v3');

                if (detectedProfile) {
                    const current = ModuleManager.getActiveProfile();

                    const switchProfile = async () => {
                        // Deactivate previous if needed
                        if (current && current.id !== detectedProfile.id) {
                            current.onDeactivate();
                        }

                        // Activate new
                        ModuleManager.setActiveProfile(detectedProfile);
                        detectedProfile.onActivate({
                            toast: (t, d, type) => toast({ title: t, description: d, variant: type as any }),
                            navigate: setCurrentView
                        });

                        // Fetch Extended Info
                        try {
                            const extended = await detectedProfile.getExtendedInfo(protocol);
                            if (extended) {
                                setDeviceInfo(prev => prev ? { ...prev, extended } : prev);
                            }
                        } catch (e) {
                            console.warn("Extended info fetch failed", e);
                        }

                        if (!silent) toast({ title: "Profile Activated", description: `Active: ${detectedProfile.name}` });
                    };

                    // Handle Switch Mode
                    const isSameProfile = current && current.id === detectedProfile.id;

                    if (isSameProfile || profileSwitchMode === 'auto' || !current) {
                        await switchProfile();
                    } else if (profileSwitchMode === 'prompt' && !isSameProfile) {
                        toast({
                            title: "New Profile Detected",
                            description: `Device matches profile: ${detectedProfile.name}. Switch?`,
                            action: (
                                <ToastAction altText="Switch" onClick={switchProfile}>Switch</ToastAction>
                            ),
                        });
                    } else if (profileSwitchMode === 'manual') {
                        // Do nothing, just notification
                        if (!silent) toast({ title: "Device Detected", description: `Matched: ${detectedProfile.name}` });
                    }
                }

                if (!silent) toast({ title: "Device Identified", description: `Version: ${info.firmwareVersion}` })
            } catch (e) {
                console.warn("Identification failed", e)
                setDeviceInfo(prev => {
                    if (prev?.version?.startsWith("Bootloader")) return prev;
                    return { ...prev!, version: "Unknown Device" };
                });
            }
            return true;
        } catch (error: any) {
            console.error(error)
            setConnected(false)
            setDeviceInfo(undefined);

            // Don't show error for user cancellation
            if (error.name === 'NotFoundError' || error.message?.includes('No port selected')) {
                // User cancelled the port selection dialog - silent fail
                return false;
            }

            if (!silent) {
                let errorMessage = error.message || "Could not establish connection.";
                let errorTitle = "Connection Failed";

                if (error.name === 'SecurityError') {
                    errorTitle = "Permission Denied";
                    errorMessage = "Serial port access was denied. Check browser permissions.";
                } else if (error.name === 'NetworkError' || error.message?.includes('port is already open')) {
                    errorTitle = "Port Busy";
                    errorMessage = "The serial port is already in use by another application.";
                } else if (error.message?.includes('Failed to open')) {
                    errorTitle = "Open Failed";
                    errorMessage = "Could not open the serial port. Check if the device is connected.";
                }

                toast({
                    variant: "destructive",
                    title: errorTitle,
                    description: errorMessage,
                })
            }
            return false;
        } finally {
            setIsBusy(false);
        }
    }

    // Unified File Handler
    const handleOpenFile = () => {
        fileInputRef.current?.click();
    }

    const handleGlobalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const processed = await processFile(file);
            setPendingProcessedFile(processed);

            // Reset input
            e.target.value = '';

            if (processed.type === "qsh") {
                setShowQshDialog(true);
            } else if (processed.type === "firmware") {
                // Route to flasher
                setCurrentView("flasher");
                // The FlasherView will need to know about this file
                // For now we'll use the existing pendingFile logic if possible, 
                // but we might need to pass it as a prop.
                setPendingFile(file);

                // Parse for metadata dialog if it's firmware
                try {
                    const parsed = await parseFirmwareFile(file);
                    setParsedFirmware(parsed);
                    if (!developerMode) {
                        setShowMetadataDialog(true);
                    } else {
                        performFlash(parsed);
                    }
                } catch (e) {
                    console.warn("Fast-parse failed, falling back to raw file", e);
                }
            } else if (processed.type === "calibration") {
                setCurrentView("calib");
                // Handled via props or context in next step
                setPendingFile(file);
            } else if (processed.type === "csv") {
                setCurrentView("memories");
                setPendingFile(file);
            } else if (processed.type === "json") {
                // Could be memories or settings, usually settings if .json
                // But MemoryView also supports .json occasionally.
                // Let's assume settings for now, or check content
                setCurrentView("config");
                setPendingFile(file);
            } else {
                toast({
                    title: "Unknown File Type",
                    description: "Squelch doesn't know how to handle this file yet.",
                    variant: "destructive"
                });
            }

        } catch (err: any) {
            toast({
                title: "Error processing file",
                description: err.message,
                variant: "destructive"
            });
        }
    }

    const handleQshProceed = async (profileId: string) => {
        if (!pendingProcessedFile?.qsh) return;
        setShowQshDialog(false);

        // 1. Enforce Profile Switch (Synchronous State Update Batching)
        if (profileId) {
            const newProfile = ModuleManager.getProfiles().find(p => p.id === profileId);
            if (newProfile && newProfile.id !== activeProfile?.id) {
                ModuleManager.setActiveProfile(newProfile);
                // Force local state update IMMEDIATELY in the same render batch
                // so that when pendingFile is set, MemoryView gets both props updated.
                setActiveProfile(newProfile);
            }
        }

        const qsh = pendingProcessedFile.qsh;
        const globalType = qsh.globalMeta[TAG_G_TYPE];

        // Find FW blob
        const fwBlob = qsh.blobs.find(b =>
            globalType === "firmware" ||
            b.metadata[TAG_G_TYPE] === "firmware" ||
            b.metadata[TAG_F_NAME]
        );
        // Find Calib blob
        const calBlob = qsh.blobs.find(b =>
            globalType === "calibration" ||
            b.metadata[TAG_G_TYPE] === "calibration" ||
            b.metadata[TAG_D_LABEL]?.toLowerCase().includes("calib")
        );

        if (fwBlob) {
            setCurrentView("flasher");
            const virtualFile = new File([fwBlob.data as any], fwBlob.metadata[TAG_F_NAME] || "firmware.bin", { type: "application/octet-stream" });
            setPendingFile(virtualFile);

            try {
                const parsed = await parseFirmwareFile(virtualFile);
                setParsedFirmware(parsed);
                if (!developerMode) {
                    setShowMetadataDialog(true);
                } else {
                    performFlash(parsed);
                }
            } catch (e) {
                console.warn("QSH FW parse failed", e);
            }
        } else if (calBlob) {
            setCurrentView("calib");
            const virtualFile = new File([calBlob.data as any], calBlob.metadata[TAG_D_LABEL] || "calibration.dat", { type: "application/octet-stream" });
            setPendingFile(virtualFile);
        } else if (qsh.blobs.some(b => b.metadata[TAG_G_TYPE] === "channels" || globalType === "channels")) {
            console.log("[App] QSH contains channels. Switching to MemoryView and passing file.");
            setCurrentView("memories");
            // Pass the original QSH file to MemoryView so it can handle multi-blob (channels + names) extraction
            setPendingFile(pendingProcessedFile.file);
        } else if (qsh.blobs.some(b => b.metadata[TAG_G_TYPE] === "config" || globalType === "settings")) {
            console.log("[App] QSH contains settings. Switching to SettingsView and passing file.");
            setCurrentView("config");
            // Pass the original QSH file to SettingsView
            setPendingFile(pendingProcessedFile.file);
        } else {
            toast({ title: "QSH Loaded", description: "Container processed successfully." });
        }
    }

    const performFlash = async (firmwareData?: ParsedFirmware) => {
        const targetFirmware = firmwareData || parsedFirmware;
        if (!targetFirmware && !pendingFile) return;

        // Check connection first
        if (!connected) {
            toast({
                title: "Connection Required",
                description: "Please connect your radio before flashing.",
            });
            const success = await handleConnect();
            if (!success) return;
        }

        setShowFlashConfirm(false);
        setShowMetadataDialog(false);
        setIsFlashing(true);
        setFlashProgress(0);
        setFlashStep("Initializing...");
        setFlashLogs([]);
        setFlashResult(null);
        setFlashStats(null);
        setFlashEndTime(null);
        protocol.resetStats();
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
            let data: Uint8Array;
            if (targetFirmware) {
                data = targetFirmware.data;
            } else if (pendingFile) {
                const buffer = await pendingFile.arrayBuffer();
                data = new Uint8Array(buffer);
            } else {
                throw new Error("No firmware data available");
            }

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
            setFlashEndTime(Date.now());
        } catch (e: any) {
            console.error(e);
            setFlashEndTime(Date.now());
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

    const handleFlashFirmware = () => {
        // Just switch to flasher view
        setCurrentView("flasher");
    }

    const handleBackupCalibration = () => {
        // Switch to calibration view
        setCurrentView("calib");
        // We might want to trigger the backup action automatically here?
        // For now, just navigating is safer.
    }

    const isDarkMode = theme === "dark";
    const toggleDarkMode = () => setTheme(isDarkMode ? "light" : "dark");

    // Telemetry Polling (Secondary)
    useEffect(() => {
        if (!connected || !activeProfile || isBusy || isFlashing) return;

        const poll = async () => {
            try {
                const telemetry = await activeProfile.getTelemetry(protocol);
                if (telemetry) {
                    setDeviceInfo(prev => prev ? {
                        ...prev,
                        telemetry: { ...prev.telemetry, ...telemetry }
                    } : prev);
                }
            } catch (e) {
                // silent
            }
        };

        const timer = setInterval(poll, 5000); // Poll every 5 seconds
        poll(); // Initial poll

        return () => clearInterval(timer);
    }, [connected, activeProfile, isBusy, isFlashing]);

    return (
        <TooltipProvider>
            <DynamicFavicon connected={connected} isBusy={isBusy || isFlashing} />
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".qsh,.bin,.hex,.dat,.csv,.json"
                onChange={handleGlobalFileChange}
            />

            <QshDetailsDialog
                open={showQshDialog}
                onOpenChange={setShowQshDialog}
                qsh={pendingProcessedFile?.qsh || null}
                onProceed={handleQshProceed}
                activeProfile={activeProfile}
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
                        <Button onClick={() => performFlash()}>Flash Firmware</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unified Flash Progress Dialog */}
            <FirmwareMetadataDialog
                open={showMetadataDialog}
                onOpenChange={setShowMetadataDialog}
                metadata={parsedFirmware?.metadata}
                onConfirm={() => performFlash()}
                onCancel={() => {
                    setShowMetadataDialog(false);
                    setParsedFirmware(null);
                    setPendingFile(null);
                }}
            />

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
                endTime={flashEndTime}
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
                            onImportFirmware={handleOpenFile}
                            onFlashFirmware={handleFlashFirmware}
                            onBackupCalibration={handleBackupCalibration}
                            onRestoreCalibration={handleOpenFile}
                            isDarkMode={isDarkMode}
                            onToggleDarkMode={toggleDarkMode}
                        />
                        <PreferencesDialog
                            open={isPreferencesOpen}
                            onOpenChange={setIsPreferencesOpen}
                        />
                    </div>

                    <div className="flex justify-center flex-1 max-w-sm px-2">
                        <CommandMenu
                            onConnect={handleConnect}
                            isConnected={connected}
                            setCurrentView={setCurrentView}
                            openPreferences={() => setIsPreferencesOpen(true)}
                            triggerBackupCalibration={handleBackupCalibration}
                            triggerImportFirmware={handleOpenFile}
                        />
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
                        onProfileSelect={async (p) => {
                            ModuleManager.setActiveProfile(p);
                            if (protocol && connected) {
                                try {
                                    const extended = await p.getExtendedInfo(protocol);
                                    if (extended) {
                                        setDeviceInfo(prev => prev ? { ...prev, extended } : prev);
                                        toast({ title: "Profile Activated", description: `Switched to ${p.name}` });
                                    }
                                } catch (e) {
                                    console.warn("Failed to fetch info on profile switch", e);
                                }
                            }
                        }}
                    />

                    <main className="flex-1 overflow-hidden bg-muted/10 relative flex flex-col">
                        <ContextMenu>
                            <ContextMenuTrigger className="flex-1 flex flex-col min-h-0">
                                <div className="flex-1 flex flex-col min-h-0">
                                    {/* Unified Page Header */}
                                    <div className="flex items-center justify-between px-6 py-4 bg-background border-b shrink-0 h-14">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                {(() => {
                                                    const iconSize = "h-5 w-5";
                                                    switch (currentView) {
                                                        case 'overview': return <LayoutDashboard className={iconSize} />;
                                                        case 'memories': return <TableProperties className={iconSize} />;
                                                        case 'config': return <Sliders className={iconSize} />;
                                                        case 'flasher': return <Zap className={iconSize} />;
                                                        case 'calib': return <Wrench className={iconSize} />;
                                                        case 'remote': return <Radio className={iconSize} />;
                                                        case 'console': return <Terminal className={iconSize} />;
                                                        default: return <Activity className={iconSize} />;
                                                    }
                                                })()}
                                            </div>
                                            <div className="space-y-0.5">
                                                <h2 className="text-base font-semibold tracking-tight capitalize">{currentView}</h2>
                                                <p className="text-[11px] text-muted-foreground leading-none">
                                                    {currentView === 'overview' ? 'Radio system status and health' : `Manage your radio ${currentView}`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={cn(
                                        "flex-1 flex flex-col min-h-0",
                                        (currentView === 'overview') ? "p-4 md:p-8 overflow-y-auto" : "p-0 overflow-hidden"
                                    )}>

                                        <div className="flex-1 min-h-0 flex flex-col">
                                            <div className={cn(
                                                "h-full",
                                                (currentView === 'overview') && "space-y-4"
                                            )}>
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
                                                    <MemoryView
                                                        connected={connected}
                                                        activeProfile={activeProfile}
                                                        onBusyChange={setIsBusy}
                                                        deviceInfo={deviceInfo}
                                                        originalChannels={originalChannels}
                                                        onOriginalChannelsChange={setOriginalChannels}
                                                        channels={channels}
                                                        onChannelsChange={setChannels}
                                                        onChannelsReplace={replaceChannels}
                                                        onChannelsReset={resetChannels}
                                                        pendingFile={pendingFile}
                                                        onPendingFileConsumed={() => setPendingFile(null)}
                                                    />
                                                )}

                                                {currentView === 'remote' && (
                                                    <RemoteView />
                                                )}

                                                {currentView === 'console' && (
                                                    <ConsoleView logs={consoleLogs} connected={connected} onClear={() => setConsoleLogs([])} />
                                                )}

                                                {currentView === 'calib' && (
                                                    <CalibrationView
                                                        connected={connected}
                                                        onConnect={handleConnect}
                                                        onBusyChange={setIsBusy}
                                                        deviceInfo={deviceInfo}
                                                        activeProfile={activeProfile}
                                                        initialFile={pendingFile}
                                                    />
                                                )}

                                                {currentView === 'config' && (
                                                    <SettingsView
                                                        connected={connected}
                                                        activeProfile={activeProfile}
                                                        onBusyChange={setIsBusy}
                                                        deviceInfo={deviceInfo}
                                                        originalSettings={originalSettings}
                                                        onOriginalSettingsChange={setOriginalSettings}
                                                        settings={settings}
                                                        onSettingsChange={setSettings}
                                                        onSettingsReset={resetSettings}
                                                        pendingFile={pendingFile}
                                                        onPendingFileConsumed={() => setPendingFile(null)}
                                                    />
                                                )}

                                                {/* Dynamic Custom Pages */}
                                                {activeProfile?.customPages?.map((page) => (
                                                    currentView === page.id && (
                                                        <page.component
                                                            key={page.id}
                                                            connected={connected}
                                                            activeProfile={activeProfile}
                                                            protocol={protocol}
                                                        />
                                                    )
                                                ))}
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
