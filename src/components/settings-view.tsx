import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, Save } from "lucide-react"
import { usePreferences } from "@/contexts/PreferencesContext"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

export function SettingsView() {
    const {
        githubToken,
        setGithubToken,
        customRepos,
        addCustomRepo,
        removeCustomRepo,
        autoConnect,
        setAutoConnect
    } = usePreferences()

    const { toast } = useToast()
    const [newToken, setNewToken] = useState(githubToken)
    const [newRepo, setNewRepo] = useState("")

    const handleSaveToken = () => {
        setGithubToken(newToken)
        toast({ title: "Preferences Saved", description: "GitHub token updated." })
    }

    const handleAddRepo = () => {
        if (!newRepo.includes("/")) {
            toast({ variant: "destructive", title: "Invalid Format", description: "Use 'username/repo'" })
            return
        }
        addCustomRepo(newRepo)
        setNewRepo("")
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Configure application behavior.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Auto-Connect</Label>
                            <p className="text-sm text-muted-foreground">
                                Automatically attempt to connect to the last used serial port on startup.
                            </p>
                        </div>
                        <Switch
                            checked={autoConnect}
                            onCheckedChange={setAutoConnect}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>GitHub Integration</CardTitle>
                    <CardDescription>API Access and Custom Repositories.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="token">Personal Access Token</Label>
                        <div className="flex gap-2">
                            <Input
                                id="token"
                                type="password"
                                placeholder="ghp_..."
                                value={newToken}
                                onChange={(e) => setNewToken(e.target.value)}
                            />
                            <Button onClick={handleSaveToken}>
                                <Save className="mr-2 h-4 w-4" />
                                Save
                            </Button>
                        </div>
                        <p className="text-[0.8rem] text-muted-foreground">
                            Required to avoid rate limits and access private repositories.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Custom Firmware Repositories</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="username/repo"
                                value={newRepo}
                                onChange={(e) => setNewRepo(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                            />
                            <Button variant="outline" onClick={handleAddRepo}>
                                <Plus className="h-4 w-4" />
                                Add
                            </Button>
                        </div>

                        <div className="rounded-md border mt-2">
                            {customRepos.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">No custom repositories added.</div>
                            ) : (
                                <div className="divide-y">
                                    {customRepos.map((repo) => (
                                        <div key={repo} className="flex items-center justify-between p-3">
                                            <span className="font-mono text-sm">{repo}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => removeCustomRepo(repo)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
