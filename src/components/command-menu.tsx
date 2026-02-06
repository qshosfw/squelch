import * as React from "react"
import {
    LayoutDashboard,
    Settings,
    Zap,
    Radio,
    Terminal,
    Database,
    ArrowUpCircle,
    FileCode,
    Download,
    Moon,
    Sun,
    Search,
    Keyboard,
    Usb,
    Power
} from "lucide-react"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import { usePreferences } from "@/contexts/PreferencesContext"
import { Badge } from "@/components/ui/badge"

interface CommandMenuProps {
    onConnect?: () => void;
    isConnected?: boolean;
    setCurrentView?: (view: string) => void;
    openPreferences?: () => void;
    triggerBackupCalibration?: () => void;
    triggerImportFirmware?: () => void;
}

export function CommandMenu({
    onConnect,
    isConnected,
    setCurrentView,
    openPreferences,
    triggerBackupCalibration,
    triggerImportFirmware
}: CommandMenuProps) {
    const [open, setOpen] = React.useState(false)
    const { theme, setTheme } = usePreferences()

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Command palette: Cmd+K or Ctrl+K
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }

            // Direct navigation shortcuts (Cmd/Ctrl + number)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && setCurrentView) {
                switch (e.key) {
                    case "1":
                        e.preventDefault()
                        setCurrentView("overview")
                        break
                    case "2":
                        e.preventDefault()
                        setCurrentView("memories")
                        break
                    case "3":
                        e.preventDefault()
                        setCurrentView("flasher")
                        break
                    case "4":
                        e.preventDefault()
                        setCurrentView("remote")
                        break
                    case "5":
                        e.preventDefault()
                        setCurrentView("config")
                        break
                    case "6":
                        e.preventDefault()
                        setCurrentView("console")
                        break
                }
            }

            // Direct action shortcuts
            // Connect/Disconnect: Cmd+Shift+C
            if (e.key === "c" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault()
                onConnect?.()
            }

            // Backup Calibration: Cmd+Shift+B
            if (e.key === "b" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault()
                triggerBackupCalibration?.()
            }

            // Import Firmware: Cmd+Shift+F
            if (e.key === "f" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault()
                triggerImportFirmware?.()
            }

            // Theme toggle: Cmd+Shift+T
            if (e.key === "t" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault()
                setTheme(theme === 'dark' ? 'light' : 'dark')
            }

            // Preferences: Cmd+,
            if (e.key === "," && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                openPreferences?.()
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [setCurrentView, theme, setTheme, openPreferences, onConnect, triggerBackupCalibration, triggerImportFirmware])

    const handleSelect = (action: string) => {
        setOpen(false)

        switch (action) {
            case "connect":
                onConnect?.()
                break
            case "toggle-theme":
                setTheme(theme === 'dark' ? 'light' : 'dark')
                break
            case "preferences":
                openPreferences?.()
                break
            case "backup-calibration":
                triggerBackupCalibration?.()
                break
            case "import-firmware":
                triggerImportFirmware?.()
                break
            default:
                if (action.startsWith("nav:") && setCurrentView) {
                    setCurrentView(action.replace("nav:", ""))
                }
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground px-4 py-0 relative h-8 w-full justify-start rounded-lg bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-56"
            >
                <Search className="mr-2 h-4 w-4" />
                <span className="hidden lg:inline-flex">Search...</span>
                <span className="inline-flex lg:hidden">Search</span>
                <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>

                    {/* Quick Actions - These DO things directly */}
                    <CommandGroup heading="Quick Actions">
                        <CommandItem onSelect={() => handleSelect("connect")}>
                            {isConnected ? (
                                <Power className="mr-2 h-4 w-4 text-red-500" />
                            ) : (
                                <Usb className="mr-2 h-4 w-4 text-green-500" />
                            )}
                            <span>{isConnected ? "Disconnect Radio" : "Connect Radio"}</span>
                            {isConnected && (
                                <Badge variant="secondary" className="ml-2 h-4 px-1 text-[9px] bg-green-500/10 text-green-600 border-none">
                                    Connected
                                </Badge>
                            )}
                            <CommandShortcut>⇧⌘C</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("import-firmware")}>
                            <Zap className="mr-2 h-4 w-4 text-amber-500" />
                            <span>Flash Firmware...</span>
                            <CommandShortcut>⇧⌘F</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("backup-calibration")}>
                            <Download className="mr-2 h-4 w-4 text-emerald-500" />
                            <span>Backup Calibration</span>
                            <CommandShortcut>⇧⌘B</CommandShortcut>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Settings */}
                    <CommandGroup heading="Settings">
                        <CommandItem onSelect={() => handleSelect("toggle-theme")}>
                            {theme === 'dark' ? (
                                <Sun className="mr-2 h-4 w-4" />
                            ) : (
                                <Moon className="mr-2 h-4 w-4" />
                            )}
                            <span>Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                            <CommandShortcut>⇧⌘T</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("preferences")}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Preferences</span>
                            <CommandShortcut>⌘,</CommandShortcut>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Navigation */}
                    <CommandGroup heading="Go to">
                        <CommandItem onSelect={() => handleSelect("nav:overview")}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                            <CommandShortcut>⌘1</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("nav:memories")}>
                            <Database className="mr-2 h-4 w-4" />
                            <span>Memories</span>
                            <CommandShortcut>⌘2</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("nav:flasher")}>
                            <ArrowUpCircle className="mr-2 h-4 w-4" />
                            <span>Flasher</span>
                            <CommandShortcut>⌘3</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("nav:remote")}>
                            <Radio className="mr-2 h-4 w-4" />
                            <span>Remote</span>
                            <CommandShortcut>⌘4</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("nav:config")}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Configuration</span>
                            <CommandShortcut>⌘5</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("nav:console")}>
                            <Terminal className="mr-2 h-4 w-4" />
                            <span>Console</span>
                            <CommandShortcut>⌘6</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect("nav:calib")}>
                            <FileCode className="mr-2 h-4 w-4" />
                            <span>Calibration</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Help */}
                    <CommandGroup heading="Help">
                        <CommandItem>
                            <Keyboard className="mr-2 h-4 w-4" />
                            <span>Keyboard Shortcuts</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
