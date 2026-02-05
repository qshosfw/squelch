import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Zap, AlertCircle, Loader2, Download, Github, Plus, ArrowLeft, FileCode } from "lucide-react"
import { protocol, SerialStats } from "@/lib/protocol"
import { useToast } from "@/hooks/use-toast"
import { useState, useRef, useEffect } from "react"
import { FlashProgressDialog, LogEntry } from "./flash-progress-dialog"
import { cn } from "@/lib/utils"
import { GitHubService, GitHubRepo, GitHubRelease, GitHubAsset } from "@/lib/github"
import { FIRMWARE_REPOS } from "@/constants"
import { usePreferences } from "@/contexts/PreferencesContext"
import ReactMarkdown from 'react-markdown'




export function FlasherView({ connected, onConnect, onBusyChange }: {
    connected: boolean,
    onConnect: () => Promise<boolean>,
    onBusyChange?: (isBusy: boolean) => void
}) {
    const { toast } = useToast()
    const { githubToken, customRepos, addCustomRepo } = usePreferences()

    // GitHub Service
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
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [flashResult, setFlashResult] = useState<'success' | 'error' | null>(null)
    const [stats, setStats] = useState<SerialStats | null>(null)

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
        if (type !== 'tx' && type !== 'rx') {
            setStatusMessage(msg);
        }
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

        if (!connected) {
            toast({ title: "Connection Required", description: "Please connect to your radio before flashing." })
            const success = await onConnect();
            if (!success) return;
        }

        setIsFlashing(true)
        setIsDialogOpen(true)
        setProgress(0)
        setLogs([])
        setFlashResult(null)
        addLog("Initializing flashing process...", "info")
        onBusyChange?.(true)

        protocol.onProgress = (pct: number) => setProgress(pct);
        protocol.onLog = (msg: string, type: 'info' | 'error' | 'success' | 'tx' | 'rx') => addLog(msg, type as any);
        protocol.onStatsUpdate = (s: SerialStats) => setStats(s);

        try {
            const buffer = await file.arrayBuffer()
            const firmware = new Uint8Array(buffer)

            await protocol.flashFirmware(firmware)

            addLog("Flash successfully completed.", "success")
            toast({ title: "Flash Complete", description: "Firmware updated successfully." })
            setFlashResult('success')
        } catch (error: any) {
            addLog(`Error: ${error.message}`, "error")
            toast({ variant: "destructive", title: "Flash Failed", description: error.message })
            setFlashResult('error')
        } finally {
            setIsFlashing(false)
            onBusyChange?.(false)
            protocol.onProgress = null;
            protocol.onLog = null;
            protocol.onStatsUpdate = null;
        }
    }

    return (
        <div className="flex flex-col gap-6 lg:max-w-5xl lg:mx-auto">
            {/* Disclaimer */}
            <Alert variant="default" className="bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                <AlertCircle className="h-4 w-4 text-cyan-500" />
                <AlertDescription className="text-sm">
                    Ensure the radio is in DFU mode by holding the <strong>PTT button</strong> while turning on the radio. The flashlight will turn on once the radio is in DFU mode.
                </AlertDescription>
            </Alert>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="local">Local File</TabsTrigger>
                    <TabsTrigger value="online">Community Firmware</TabsTrigger>
                </TabsList>

                <TabsContent value="local" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <FileCode className="h-5 w-5 text-primary" />
                                </div>
                                Flash from File
                            </CardTitle>
                            <CardDescription>Select a .bin firmware file from your computer.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {manualDownloadHint && (
                                <Alert className="bg-emerald-500/10 border-emerald-500/20">
                                    <Download className="h-4 w-4 text-emerald-500" />
                                    <AlertTitle className="text-emerald-700 dark:text-emerald-400">Download Initiated</AlertTitle>
                                    <AlertDescription className="text-emerald-600 dark:text-emerald-500 text-sm">
                                        We've started downloading <strong>{manualDownloadHint}</strong>.
                                        Please select it below once the download finishes.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="grid w-full gap-4">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-center w-full">
                                        <label htmlFor="dropzone-file" className={cn(
                                            "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                                            file ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                                        )}>
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                {file ? (
                                                    <>
                                                        <FileCode className="w-8 h-8 mb-3 text-primary" />
                                                        <p className="mb-1 text-sm text-foreground font-medium">{file.name}</p>
                                                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="w-8 h-8 mb-3 text-muted-foreground" />
                                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                        <p className="text-xs text-muted-foreground">Firmware Binary (.bin)</p>
                                                    </>
                                                )}
                                            </div>
                                            <Input
                                                id="dropzone-file"
                                                type="file"
                                                accept=".bin"
                                                className="hidden"
                                                onChange={handleFileChange}
                                                disabled={isFlashing}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 border-t bg-muted/20 p-4">
                            <Button
                                size="lg"
                                onClick={startFlash}
                                disabled={isFlashing || !file}
                                className="w-full md:w-auto"
                            >
                                {isFlashing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                Flash Firmware
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="online" className="space-y-4">
                    <Card className="min-h-[500px]">
                        {!selectedRepo ? (
                            <>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <Github className="h-5 w-5" />
                                            Community Repositories
                                        </CardTitle>
                                        <CardDescription>Browse and download firmware from the community.</CardDescription>
                                    </div>
                                    <div className="flex gap-2 w-full max-w-sm">
                                        <Input
                                            placeholder="Add 'user/repo'..."
                                            value={newRepoInput}
                                            onChange={(e) => setNewRepoInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                                            className="h-9"
                                        />
                                        <Button size="sm" variant="outline" onClick={handleAddRepo}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingRepos ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="flex items-center space-x-4">
                                                    <Skeleton className="h-12 w-12 rounded-full" />
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-[250px]" />
                                                        <Skeleton className="h-4 w-[200px]" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {repos.map(repo => (
                                                <div
                                                    key={repo.id}
                                                    className="group flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-accent transition-all cursor-pointer"
                                                    onClick={() => handleSelectRepo(repo)}
                                                >
                                                    <Avatar className="h-10 w-10 border">
                                                        <AvatarImage src={repo.owner.avatar_url} />
                                                        <AvatarFallback>{repo.owner.login.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <div className="font-semibold flex items-center justify-between">
                                                            <span className="truncate">{repo.name}</span>
                                                            <Badge variant="secondary" className="text-[10px] font-normal group-hover:bg-background transition-colors">
                                                                {repo.owner.login}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                            {repo.description || "No description provided."}
                                                        </p>
                                                        <div className="flex items-center gap-2 pt-2 text-[10px] text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Zap className="h-3 w-3" />
                                                                {repo.stargazers_count} stars
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </>
                        ) : (
                            <>
                                <div className="border-b px-6 py-4 flex items-center gap-4 bg-muted/20">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-2"
                                        onClick={() => setSelectedRepo(null)}
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Separator orientation="vertical" className="h-6" />
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={selectedRepo.owner.avatar_url} />
                                            <AvatarFallback>?</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="text-sm font-semibold">{selectedRepo.name}</h3>
                                            <p className="text-xs text-muted-foreground">{selectedRepo.full_name}</p>
                                        </div>
                                    </div>
                                </div>

                                <CardContent className="space-y-6 pt-6">
                                    {isLoadingReleases ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : releases.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-12 bg-muted/20 rounded-lg border border-dashed">
                                            No releases found for this repository.
                                        </div>
                                    ) : (
                                        <div className="grid gap-6 lg:grid-cols-3">
                                            {/* Release Selection & Info */}
                                            <div className="lg:col-span-1 space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Select Version</label>
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
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{r.tag_name}</span>
                                                                        {r.prerelease && <Badge variant="outline" className="text-[10px] h-4">Beta</Badge>}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {selectedRelease && (
                                                    <div className="space-y-3 pt-4">
                                                        <h4 className="text-sm font-medium flex items-center gap-2">
                                                            <Download className="h-4 w-4" />
                                                            Assets
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {selectedRelease.assets.filter(a => a.name.endsWith('.bin')).map(asset => (
                                                                <Card key={asset.id} className="p-3 hover:bg-muted/50 transition-colors shadow-none border-dashed bg-transparent">
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="flex justify-between items-start">
                                                                            <span className="font-mono text-xs font-medium break-all">{asset.name}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] text-muted-foreground">{(asset.size / 1024).toFixed(1)} KB</span>
                                                                            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => handleDownloadAsset(asset)}>
                                                                                Download
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Release Notes */}
                                            <div className="lg:col-span-2">
                                                <Card className="h-full border-none shadow-none bg-muted/20">
                                                    <ScrollArea className="h-[400px] p-4">
                                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                                            <h3>{selectedRelease?.name || selectedRelease?.tag_name}</h3>
                                                            <ReactMarkdown>
                                                                {selectedRelease?.body || "*No release notes provided.*"}
                                                            </ReactMarkdown>
                                                        </div>
                                                    </ScrollArea>
                                                </Card>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            <FlashProgressDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                isFlashing={isFlashing}
                progress={progress}
                statusMessage={statusMessage}
                logs={logs}
                stats={stats}
                flashResult={flashResult}
            />
        </div>
    )
}
