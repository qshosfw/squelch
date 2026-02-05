import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Zap, AlertCircle, Loader2, Terminal, Download, Github, Plus, ArrowLeft } from "lucide-react"
import { protocol } from "@/lib/protocol"
import { useToast } from "@/hooks/use-toast"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { GitHubService, GitHubRepo, GitHubRelease, GitHubAsset } from "@/lib/github"
import { FIRMWARE_REPOS } from "@/constants"
import { usePreferences } from "@/contexts/PreferencesContext"
import ReactMarkdown from 'react-markdown'

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

export function FlasherView({ onBusyChange }: { onBusyChange?: (isBusy: boolean) => void }) {
    const { toast } = useToast()
    const { githubToken, customRepos, addCustomRepo } = usePreferences()

    // GitHub Service Instance with Token
    // We recreate it if token changes to ensure it picks up the new token.
    const [ghService, setGhService] = useState(() => new GitHubService(githubToken))

    useEffect(() => {
        setGhService(new GitHubService(githubToken));
    }, [githubToken])

    // Flashing State
    const [file, setFile] = useState<File | null>(null)
    const [isFlashing, setIsFlashing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState("")
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [showLogs, setShowLogs] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // UI State
    const [activeTab, setActiveTab] = useState("local")
    const [manualDownloadHint, setManualDownloadHint] = useState<string | null>(null)

    // GitHub State
    const [repos, setRepos] = useState<GitHubRepo[]>([])
    const [isLoadingRepos, setIsLoadingRepos] = useState(false)
    const [newRepoInput, setNewRepoInput] = useState("")

    const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
    const [releases, setReleases] = useState<GitHubRelease[]>([])
    const [isLoadingReleases, setIsLoadingReleases] = useState(false)
    const [selectedRelease, setSelectedRelease] = useState<GitHubRelease | null>(null)

    const logEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [logs, isDialogOpen])

    // Load Repos when Online tab is active
    useEffect(() => {
        if (activeTab === "online" && repos.length === 0) {
            fetchRepos();
        }
    }, [activeTab]);

    const fetchRepos = async () => {
        setIsLoadingRepos(true);
        const repoList = [...FIRMWARE_REPOS, ...customRepos];
        const unique = Array.from(new Set(repoList));

        try {
            const results = await Promise.allSettled(unique.map(name => ghService.getRepo(name)));
            const valid = results
                .filter(r => r.status === 'fulfilled')
                // @ts-ignore
                .map(r => r.value as GitHubRepo);

            setRepos(valid);
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Failed to fetch repositories" });
        }
        setIsLoadingRepos(false);
    }

    const handleAddRepo = () => {
        if (!newRepoInput.includes("/")) {
            toast({ variant: "destructive", title: "Invalid format", description: "Use 'username/repo'" });
            return;
        }
        addCustomRepo(newRepoInput);
        setNewRepoInput("");
        // Trigger fetch
        setTimeout(fetchRepos, 100);
    }

    const handleSelectRepo = async (repo: GitHubRepo) => {
        setSelectedRepo(repo);
        setIsLoadingReleases(true);
        try {
            const rels = await ghService.getReleases(repo.full_name);
            setReleases(rels);
            if (rels.length > 0) setSelectedRelease(rels[0]);
        } catch (e) {
            toast({ variant: "destructive", title: "Failed to fetch releases" });
        }
        setIsLoadingReleases(false);
    }

    const handleDownloadAsset = (asset: GitHubAsset) => {
        // Trigger download
        const link = document.createElement('a');
        link.href = asset.browser_download_url;
        link.download = asset.name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setActiveTab("local");
        setManualDownloadHint(asset.name);
        toast({ title: "Download Started", description: `Please select '${asset.name}' from your downloads.` });
    }

    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, message: msg, type }]);
        setStatusMessage(msg);
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setManualDownloadHint(null);
        }
    }

    const startFlash = async () => {
        if (!file) {
            toast({ variant: "destructive", title: "No Firmware Selected" })
            return
        }

        setIsFlashing(true)
        setIsDialogOpen(true)
        setProgress(0)
        setLogs([])
        addLog("Initializing flashing process...", "info")
        onBusyChange?.(true)

        protocol.onProgress = (pct) => setProgress(pct);
        protocol.onLog = (msg, type) => addLog(msg, type as any);

        try {
            const buffer = await file.arrayBuffer()
            const firmware = new Uint8Array(buffer)

            await protocol.flashFirmware(firmware)

            addLog("Flash successfully completed.", "success")
            toast({ title: "Flash Complete", description: "Firmware updated successfully." })
        } catch (error: any) {
            addLog(`Error: ${error.message}`, "error")
        } finally {
            setIsFlashing(false)
            onBusyChange?.(false)
            protocol.onProgress = null;
            protocol.onLog = null;
        }
    }

    return (
        <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="local">Local File</TabsTrigger>
                    <TabsTrigger value="online">Community Firmware</TabsTrigger>
                </TabsList>

                <TabsContent value="local">
                    <Card>
                        <CardHeader>
                            <CardTitle>Flash Firmware from File</CardTitle>
                            <CardDescription>Select a firmware file (.bin) from your computer.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {manualDownloadHint && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-200 animate-in slide-in-from-top-2">
                                    <div className="flex items-start gap-3">
                                        <Download className="h-5 w-5 mt-0.5" />
                                        <div>
                                            <p className="font-semibold">Download Initiated</p>
                                            <p className="text-sm mt-1">
                                                We've started downloading <strong>{manualDownloadHint}</strong>.
                                                Please find it in your downloads folder and select it below.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid w-full gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium">Firmware File</label>
                                    <Input
                                        type="file"
                                        accept=".bin"
                                        onChange={handleFileChange}
                                        disabled={isFlashing}
                                        className="h-12 pt-2"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        {file ? `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "Supports .bin files"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={startFlash} disabled={isFlashing || !file}>
                                    <Zap className="mr-2 h-4 w-4" />
                                    Begin Flash
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="online">
                    <Card className="min-h-[400px]">
                        {!selectedRepo ? (
                            <>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <Github className="h-5 w-5" />
                                            <CardTitle>Community Repositories</CardTitle>
                                        </div>
                                        <CardDescription>Browse and flash firmware from the community.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Add repo (username/repo)..."
                                            value={newRepoInput}
                                            onChange={(e) => setNewRepoInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                                        />
                                        <Button size="icon" variant="outline" onClick={handleAddRepo}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {isLoadingRepos ? (
                                        <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {repos.map(repo => (
                                                <div
                                                    key={repo.id}
                                                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                                                    onClick={() => handleSelectRepo(repo)}
                                                >
                                                    <Avatar>
                                                        <AvatarImage src={repo.owner.avatar_url} />
                                                        <AvatarFallback>{repo.owner.login.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold flex items-center gap-2">
                                                            {repo.name}
                                                            <Badge variant="outline" className="text-[10px] font-normal">{repo.owner.login}</Badge>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground truncate">{repo.description}</div>
                                                    </div>
                                                    <Button variant="ghost" size="icon">
                                                        <ArrowLeft className="h-4 w-4 rotate-180" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </>
                        ) : (
                            <>
                                <CardHeader>
                                    <Button
                                        variant="ghost"
                                        className="w-fit -ml-2 mb-2 h-8 px-2"
                                        onClick={() => setSelectedRepo(null)}
                                    >
                                        <ArrowLeft className="mr-1 h-4 w-4" /> Back to List
                                    </Button>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={selectedRepo.owner.avatar_url} />
                                            <AvatarFallback>?</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle>{selectedRepo.name}</CardTitle>
                                            <CardDescription>{selectedRepo.full_name}</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {isLoadingReleases ? (
                                        <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                                    ) : releases.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-8">No releases found.</div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Select Release</label>
                                                <Select
                                                    value={selectedRelease?.id.toString()}
                                                    onValueChange={(val) => setSelectedRelease(releases.find(r => r.id.toString() === val) || null)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {releases.map(r => (
                                                            <SelectItem key={r.id} value={r.id.toString()}>
                                                                {r.name || r.tag_name} {r.prerelease ? '(Beta)' : ''}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {selectedRelease && (
                                                <div className="space-y-4 animate-in fade-in">
                                                    <ScrollArea className="h-64 rounded-md border p-4 text-sm text-muted-foreground">
                                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                                            <ReactMarkdown>{selectedRelease.body || "*No release notes provided.*"}</ReactMarkdown>
                                                        </div>
                                                    </ScrollArea>

                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Assets</label>
                                                        <div className="grid gap-2">
                                                            {selectedRelease.assets.filter(a => a.name.endsWith('.bin')).map(asset => (
                                                                <div key={asset.id} className="flex items-center justify-between p-3 rounded-md border bg-secondary/20">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-mono text-sm">{asset.name}</span>
                                                                        <span className="text-xs text-muted-foreground">{(asset.size / 1024).toFixed(1)} KB</span>
                                                                    </div>
                                                                    <Button size="sm" variant="secondary" onClick={() => handleDownloadAsset(asset)}>
                                                                        <Download className="mr-2 h-3 w-3" />
                                                                        Download
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                            {selectedRelease.assets.filter(a => a.name.endsWith('.bin')).length === 0 && (
                                                                <div className="text-sm text-muted-foreground italic">No .bin files in this release.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                if (!isFlashing) setIsDialogOpen(open);
            }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Flashing Firmware</DialogTitle>
                        <DialogDescription>
                            Please do not disconnect your device.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>{statusMessage}</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-4" />
                        </div>

                        {isFlashing && progress === 0 && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-200">
                                <div className="font-semibold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Wait for Device...
                                </div>
                                <div className="mt-1">
                                    If your device is not detected, ensure it is OFF, then hold PTT and turn it ON.
                                    The screen should remain blank and the flashlight on.
                                </div>
                            </div>
                        )}

                        <div className="rounded-md border">
                            <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Terminal className="h-4 w-4" />
                                    Execution Log
                                </div>
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowLogs(!showLogs)}>
                                    {showLogs ? "Hide" : "Show"}
                                </Button>
                            </div>
                            {showLogs && (
                                <ScrollArea className="h-[200px] w-full p-4 font-mono text-xs">
                                    <div className="space-y-1">
                                        {logs.map((log, i) => (
                                            <div key={i} className={cn(
                                                "flex gap-2",
                                                log.type === 'error' ? "text-red-500" :
                                                    log.type === 'success' ? "text-green-500" :
                                                        log.type === 'warning' ? "text-amber-500" : "text-muted-foreground"
                                            )}>
                                                <span className="opacity-50 select-none">[{log.time}]</span>
                                                <span>{log.message}</span>
                                            </div>
                                        ))}
                                        <div ref={logEndRef} />
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="secondary"
                            onClick={() => setIsDialogOpen(false)}
                            disabled={isFlashing}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
