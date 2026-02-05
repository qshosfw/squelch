import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePreferences } from "@/contexts/PreferencesContext"
import { useState, useEffect } from "react"
import { ModeToggle } from "@/components/mode-toggle"
import { Separator } from "@/components/ui/separator"
import { Github, Terminal } from "lucide-react"

interface PreferencesDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
    const {
        githubToken,
        setGithubToken,
        autoConnect,
        setAutoConnect,
        customRepos,
        addCustomRepo,
        removeCustomRepo,
        profileSwitchMode,
        setProfileSwitchMode
    } = usePreferences()

    const [localToken, setLocalToken] = useState(githubToken)
    const [newRepo, setNewRepo] = useState("")

    useEffect(() => {
        setLocalToken(githubToken)
    }, [githubToken, open])

    const handleSave = () => {
        setGithubToken(localToken)
        onOpenChange(false)
    }

    const handleAddRepo = () => {
        if (newRepo && !customRepos.includes(newRepo)) {
            addCustomRepo(newRepo)
            setNewRepo("")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Preferences</DialogTitle>
                    <DialogDescription>
                        Configure application settings and Developer options.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="connection">Connect</TabsTrigger>
                        <TabsTrigger value="profiles">Profiles</TabsTrigger>
                        <TabsTrigger value="developer">Developer</TabsTrigger>
                    </TabsList>

                    {/* General Settings */}
                    <TabsContent value="general" className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-base">Appearance</Label>
                                <p className="text-sm text-muted-foreground">
                                    Toggle light/dark mode.
                                </p>
                            </div>
                            <ModeToggle />
                        </div>
                    </TabsContent>

                    {/* Connection Settings */}
                    <TabsContent value="connection" className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-base">Auto-Connect</Label>
                                <p className="text-sm text-muted-foreground">
                                    Automatically connect to last used port on startup.
                                </p>
                            </div>
                            <Switch checked={autoConnect} onCheckedChange={setAutoConnect} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-base">Profile Switching</Label>
                                <p className="text-sm text-muted-foreground">
                                    How to handle different radio firmwares.
                                </p>
                            </div>
                            <Select value={profileSwitchMode} onValueChange={(v: any) => setProfileSwitchMode(v)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto-Switch</SelectItem>
                                    <SelectItem value="prompt">Ask Me</SelectItem>
                                    <SelectItem value="manual">Manual Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>

                    {/* Profiles Settings (New) */}
                    <TabsContent value="profiles" className="space-y-4 py-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-base">Installed Profiles</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Manage firmware profiles and capabilities.
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => alert("Import Profile coming soon!")}>
                                    Import .js
                                </Button>
                            </div>

                            {/* Placeholder for Profile List */}
                            <div className="rounded-md border p-4 bg-muted/20 text-center text-sm text-muted-foreground">
                                <p>Stock UV-K5 (Built-in)</p>
                                {/* We can map registered profiles here later */}
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <Label>Firmware Repositories (GitHub)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="user/repo"
                                        value={newRepo}
                                        onChange={(e) => setNewRepo(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                                    />
                                    <Button onClick={handleAddRepo} variant="secondary">Add</Button>
                                </div>
                                <div className="rounded-md border p-2 h-32 overflow-y-auto space-y-1 bg-muted/30">
                                    {customRepos.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                            <Github className="h-8 w-8 opacity-20" />
                                            <p className="text-xs">No custom repositories.</p>
                                        </div>
                                    ) : (
                                        customRepos.map((repo) => (
                                            <div key={repo} className="flex justify-between items-center text-sm bg-background border p-2 rounded shadow-sm group">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono">{repo}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => removeCustomRepo(repo)}
                                                >
                                                    &times;
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Developer Settings */}
                    <TabsContent value="developer" className="space-y-4 py-4">
                        <div className="space-y-3">
                            <Label>GitHub Personal Access Token</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Github className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        type="password"
                                        placeholder="ghp_..."
                                        value={localToken}
                                        onChange={(e) => setLocalToken(e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => window.open("https://github.com/settings/tokens/new?description=Squelch+Web+Flasher&scopes=public_repo", "_blank")}
                                    title="Generate new token on GitHub"
                                >
                                    Generate Token
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Required for higher rate limits when fetching releases.
                            </p>
                        </div>

                        <Separator />


                        <div className="rounded-md bg-amber-500/10 p-4 border border-amber-500/20">
                            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-2">
                                <Terminal className="h-4 w-4" />
                                Advanced Protocol Options
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                These options are for debugging protocol issues.
                            </p>
                            <div className="flex items-center justify-between">
                                <Label>Verbose Serial Logging</Label>
                                <Switch disabled checked={true} />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
