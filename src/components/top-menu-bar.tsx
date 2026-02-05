import {
    Menubar,
    MenubarCheckboxItem,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarTrigger,
} from "@/components/ui/menubar"
import { usePWAInstall } from "@/hooks/use-pwa-install"
import { Github, Info, Download } from "lucide-react"

interface TopMenuBarProps {
    onOpenPreferences: () => void;
    onImportFirmware?: () => void;
    onFlashFirmware?: () => void;
    onBackupCalibration?: () => void;
    onRestoreCalibration?: () => void;
    isDarkMode: boolean; // Added isDarkMode prop
    onToggleDarkMode: () => void; // Added onToggleDarkMode prop
}

export function TopMenuBar({
    onOpenPreferences,
    onImportFirmware,
    onFlashFirmware,
    onBackupCalibration,
    onRestoreCalibration,
    isDarkMode, // Destructured isDarkMode
    onToggleDarkMode // Destructured onToggleDarkMode
}: TopMenuBarProps) {
    const { isInstallable, isAppInstalled, installPWA } = usePWAInstall();

    return (
        <div className="flex items-center justify-between px-2 lg:px-4 bg-background h-7"> {/* Changed h-8 to h-7 */}
            <Menubar className="rounded-none border-none h-7 px-0 shadow-none bg-transparent"> {/* Changed h-8 to h-7 */}
                <MenubarMenu>
                    <MenubarTrigger className="font-medium text-[13px] py-0 h-7">File</MenubarTrigger> {/* Added text-xs, py-0, h-7 */}
                    <MenubarContent>
                        <MenubarItem onClick={onImportFirmware}>
                            Import binary & flash <MenubarShortcut>⌘O</MenubarShortcut>
                        </MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={onBackupCalibration}>
                            Export calibration
                        </MenubarItem>
                        <MenubarItem onClick={onRestoreCalibration}>
                            Restore calibration
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>

                {/* New Edit Menu */}
                <MenubarMenu>
                    <MenubarTrigger className="font-medium text-[13px] py-0 h-7">Edit</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem disabled>
                            Undo <MenubarShortcut>⌘Z</MenubarShortcut>
                        </MenubarItem>
                        <MenubarItem disabled>
                            Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
                        </MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={onOpenPreferences}>
                            Preferences <MenubarShortcut>⌘,</MenubarShortcut>
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>

                <MenubarMenu>
                    <MenubarTrigger className="font-medium text-[13px] py-0 h-7">View</MenubarTrigger>
                    <MenubarContent>
                        {/* Dark Mode checkbox */}
                        <MenubarCheckboxItem checked={isDarkMode} onCheckedChange={onToggleDarkMode}>
                            Dark Mode
                        </MenubarCheckboxItem>
                        <MenubarCheckboxItem checked disabled>Show Status Bar</MenubarCheckboxItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={() => window.location.reload()}>
                            Reload Window <MenubarShortcut>⌘R</MenubarShortcut>
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>

                <MenubarMenu>
                    <MenubarTrigger className="font-medium text-[13px] py-0 h-7">Tools</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={onFlashFirmware}>
                            Flash Firmware to Radio
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>

                <MenubarMenu>
                    <MenubarTrigger className="font-medium text-[13px] py-0 h-7">Help</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={() => window.open("https://github.com/qshosfw/squelch", "_blank")}>
                            <Github className="mr-2 h-4 w-4" />
                            GitHub Repository
                        </MenubarItem>
                        <MenubarSeparator />
                        {!isAppInstalled ? (
                            <MenubarItem onClick={installPWA} disabled={!isInstallable}>
                                <Download className="mr-2 h-4 w-4" />
                                {isInstallable ? "Install PWA App" : "Install PWA App"}
                            </MenubarItem>
                        ) : (
                            <MenubarItem disabled>
                                <Download className="mr-2 h-4 w-4" />
                                App Installed
                            </MenubarItem>
                        )}
                        <MenubarItem disabled>
                            <Info className="mr-2 h-4 w-4" />
                            About Squelch
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>

        </div>
    )
}
