import {
    Menubar,
    MenubarCheckboxItem,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from "@/components/ui/menubar"

export function TopMenuBar() {
    return (
        <Menubar className="rounded-none border-b border-none px-2 lg:px-4 h-9">
            <MenubarMenu>
                <MenubarTrigger className="font-normal text-sm">File</MenubarTrigger>
                <MenubarContent>
                    <MenubarItem>
                        Connect Radio... <MenubarShortcut>⌘O</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem>
                        Load Firmware... <MenubarShortcut>⌘L</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator />
                    <MenubarSub>
                        <MenubarSubTrigger>Export</MenubarSubTrigger>
                        <MenubarSubContent>
                            <MenubarItem>Memory CSV</MenubarItem>
                            <MenubarItem>Calibration Dump</MenubarItem>
                            <MenubarItem>Full Backup</MenubarItem>
                        </MenubarSubContent>
                    </MenubarSub>
                    <MenubarSeparator />
                    <MenubarItem>
                        Preferences... <MenubarShortcut>⌘,</MenubarShortcut>
                    </MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger className="font-normal text-sm">Edit</MenubarTrigger>
                <MenubarContent>
                    <MenubarItem>
                        Undo <MenubarShortcut>⌘Z</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem>
                        Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem>Cut</MenubarItem>
                    <MenubarItem>Copy</MenubarItem>
                    <MenubarItem>Paste</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger className="font-normal text-sm">View</MenubarTrigger>
                <MenubarContent>
                    <MenubarCheckboxItem>Always on Top</MenubarCheckboxItem>
                    <MenubarCheckboxItem checked>Show Status Bar</MenubarCheckboxItem>
                    <MenubarSeparator />
                    <MenubarItem>
                        Reload <MenubarShortcut>⌘R</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem>
                        Force Reload <MenubarShortcut>⇧⌘R</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem inset>Toggle Fullscreen</MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem inset>Hide Sidebar</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger className="font-normal text-sm">Tools</MenubarTrigger>
                <MenubarContent>
                    <MenubarItem>Flash Firmware</MenubarItem>
                    <MenubarItem>Calibration Tool</MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem>Serial Terminal</MenubarItem>
                    <MenubarItem>Spectrum Analyzer</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger className="font-normal text-sm">Help</MenubarTrigger>
                <MenubarContent>
                    <MenubarItem>Documentation</MenubarItem>
                    <MenubarItem>GitHub Repository</MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem>Check for Updates...</MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem>About Squelch</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </Menubar>
    )
}
