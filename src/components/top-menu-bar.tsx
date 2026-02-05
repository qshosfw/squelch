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
    return (
        <div className="flex items-center justify-between px-2 lg:px-4 bg-background">
            <Menubar className="rounded-none border-none h-9 px-0 shadow-none bg-transparent">
                <MenubarMenu>
                    <MenubarTrigger className="font-normal text-sm">File</MenubarTrigger>
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
                    <MenubarTrigger className="font-normal text-sm">Edit</MenubarTrigger>
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
                    <MenubarTrigger className="font-normal text-sm">View</MenubarTrigger>
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
                    <MenubarTrigger className="font-normal text-sm">Tools</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={onFlashFirmware}>
                            Flash Firmware to Radio
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>

                <MenubarMenu>
                    <MenubarTrigger className="font-normal text-sm">Help</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={() => window.open("https://github.com/sq5nit/squelch", "_blank")}>
                            GitHub Repository
                        </MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem disabled>About Squelch</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>

        </div>
    )
}
