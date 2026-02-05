import * as React from "react"
import {
    Calculator,
    Settings,
    Zap,
    Radio,
    Terminal,
    Database,
    Search
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

export function CommandMenu() {
    const [open, setOpen] = React.useState(false)

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground px-4 py-0 relative h-7 w-full justify-start rounded-[0.5rem] bg-background text-[13px] font-medium text-muted-foreground shadow-none sm:pr-12 md:w-32 lg:w-48"
            >
                <Search className="mr-2 h-3.5 w-3.5" />
                <span className="inline-flex">Search...</span>
                <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.25rem] hidden h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[9px] font-medium opacity-100 sm:flex">
                    <span className="text-[10px]">⌘</span>K
                </kbd>
            </button>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                        <CommandItem>
                            <Zap className="mr-2 h-4 w-4" />
                            <span>Connect Radio</span>
                        </CommandItem>
                        <CommandItem>
                            <Radio className="mr-2 h-4 w-4" />
                            <span>Screencast</span>
                        </CommandItem>
                        <CommandItem>
                            <Calculator className="mr-2 h-4 w-4" />
                            <span>Calculators</span>
                        </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="Navigation">
                        <CommandItem>
                            <Terminal className="mr-2 h-4 w-4" />
                            <span>Console</span>
                            <CommandShortcut>⌘C</CommandShortcut>
                        </CommandItem>
                        <CommandItem>
                            <Database className="mr-2 h-4 w-4" />
                            <span>Memories</span>
                            <CommandShortcut>⌘M</CommandShortcut>
                        </CommandItem>
                        <CommandItem>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                            <CommandShortcut>⌘S</CommandShortcut>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
