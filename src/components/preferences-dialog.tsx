import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePreferences, ThemeMode } from "@/contexts/PreferencesContext"
import { LOCALES, SupportedLocale, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
    Palette,
    Usb,
    Github,
    Terminal,
    Sun,
    Moon,
    Monitor,
    Plus,
    Trash2,
    ExternalLink,
    Key,
    FolderGit2,
    LucideIcon
} from 'lucide-react';

interface PreferencesDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

type TabId = 'appearance' | 'connection' | 'github';

interface NavItem {
    id: TabId;
    label: string;
    icon: LucideIcon;
}

const navItems: NavItem[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'connection', label: 'Connection', icon: Usb },
    { id: 'github', label: 'GitHub', icon: Github },
];

// Parse repo string to get owner and repo name
function parseRepo(repo: string): { owner: string; name: string } {
    const parts = repo.split('/');
    return {
        owner: parts[0] || '',
        name: parts[1] || repo
    };
}

// Repository card component
function RepoCard({
    repo,
    onRemove
}: {
    repo: string;
    onRemove: () => void;
}) {
    const { owner, name } = parseRepo(repo);
    const avatarUrl = `https://github.com/${owner}.png?size=80`;

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
            <Avatar className="h-10 w-10 border">
                <AvatarImage src={avatarUrl} alt={owner} />
                <AvatarFallback className="text-xs font-medium">
                    {owner.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">{owner}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-sm font-medium truncate">{name}</span>
                </div>
                <a
                    href={`https://github.com/${repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5"
                >
                    View on GitHub
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                onClick={onRemove}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
    const {
        theme,
        setTheme,
        locale,
        setLocale,
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

    const [activeTab, setActiveTab] = useState<TabId>('appearance')
    const [localToken, setLocalToken] = useState(githubToken)
    const [newRepo, setNewRepo] = useState("")
    const [repoError, setRepoError] = useState("")

    useEffect(() => {
        setLocalToken(githubToken)
    }, [githubToken, open])

    const handleSave = () => {
        setGithubToken(localToken)
        onOpenChange(false)
    }

    const handleAddRepo = () => {
        const trimmed = newRepo.trim();

        // Validate format
        if (!trimmed) return;

        if (!trimmed.includes('/')) {
            setRepoError("Format: owner/repository");
            return;
        }

        if (customRepos.includes(trimmed)) {
            setRepoError("Repository already added");
            return;
        }

        addCustomRepo(trimmed);
        setNewRepo("");
        setRepoError("");
    }

    const handleRepoKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddRepo();
        }
        if (repoError) setRepoError("");
    }

    // Check if token looks valid
    const tokenStatus = useMemo(() => {
        if (!localToken) return 'empty';
        if (localToken.startsWith('ghp_') || localToken.startsWith('github_pat_')) return 'valid';
        return 'invalid';
    }, [localToken]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[720px] p-0 gap-0 overflow-hidden">
                <div className="flex h-[540px]">
                    {/* Sidebar Navigation */}
                    <div className="w-[180px] border-r bg-muted/30 p-3 flex flex-col">
                        <DialogHeader className="p-2 pb-4">
                            <DialogTitle className="text-sm font-medium">
                                {t('prefs.title', locale)}
                            </DialogTitle>
                        </DialogHeader>
                        <nav className="flex flex-col gap-1">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={cn(
                                        "flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors text-left",
                                        activeTab === item.id
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                    )}
                                >
                                    <item.icon size={16} />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col">
                        <ScrollArea className="flex-1 p-6">
                            {/* Appearance Tab */}
                            {activeTab === 'appearance' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-medium mb-1">{t('prefs.appearance', locale)}</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Customize how Squelch looks and feels.
                                        </p>
                                    </div>

                                    <Separator />

                                    {/* Theme Selector */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">{t('prefs.theme', locale)}</Label>
                                        <div className="flex gap-2">
                                            {[
                                                { id: 'light', icon: Sun, label: t('prefs.theme.light', locale) },
                                                { id: 'dark', icon: Moon, label: t('prefs.theme.dark', locale) },
                                                { id: 'system', icon: Monitor, label: t('prefs.theme.system', locale) },
                                            ].map((option) => (
                                                <Button
                                                    key={option.id}
                                                    variant={theme === option.id ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setTheme(option.id as ThemeMode)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <option.icon size={14} />
                                                    {option.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Language Selector */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">{t('prefs.language', locale)}</Label>
                                        <Select value={locale} onValueChange={(v) => setLocale(v as SupportedLocale)}>
                                            <SelectTrigger className="w-[260px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LOCALES.map((loc) => (
                                                    <SelectItem key={loc.code} value={loc.code}>
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-base">{loc.flag}</span>
                                                            <span>{loc.nativeName}</span>
                                                            {loc.code !== 'en' && (
                                                                <span className="text-muted-foreground">({loc.name})</span>
                                                            )}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {/* Connection Tab */}
                            {activeTab === 'connection' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-medium mb-1">{t('prefs.connection', locale)}</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Configure serial connection behavior.
                                        </p>
                                    </div>

                                    <Separator />

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium">{t('prefs.autoConnect', locale)}</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {t('prefs.autoConnectDesc', locale)}
                                            </p>
                                        </div>
                                        <Switch checked={autoConnect} onCheckedChange={setAutoConnect} />
                                    </div>

                                    <Separator />

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium">{t('prefs.profileSwitching', locale)}</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {t('prefs.profileSwitchingDesc', locale)}
                                            </p>
                                        </div>
                                        <Select value={profileSwitchMode} onValueChange={(v: any) => setProfileSwitchMode(v)}>
                                            <SelectTrigger className="w-[140px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">Auto-Switch</SelectItem>
                                                <SelectItem value="prompt">Ask Me</SelectItem>
                                                <SelectItem value="manual">Manual Only</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Separator />

                                    <div className="rounded-md bg-amber-500/10 p-4 border border-amber-500/20">
                                        <div className="flex items-center gap-2 text-amber-500 font-semibold mb-2">
                                            <Terminal className="h-4 w-4" />
                                            Debug Options
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm">Verbose Serial Logging</Label>
                                            <Switch disabled checked={true} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* GitHub Tab */}
                            {activeTab === 'github' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-medium mb-1">GitHub Integration</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Manage authentication and firmware repositories.
                                        </p>
                                    </div>

                                    <Separator />

                                    {/* API Token Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Key className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-sm font-medium">Personal Access Token</Label>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <Input
                                                    type="password"
                                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                                    value={localToken}
                                                    onChange={(e) => setLocalToken(e.target.value)}
                                                    className={cn(
                                                        "flex-1 font-mono text-sm",
                                                        tokenStatus === 'invalid' && "border-amber-500"
                                                    )}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open("https://github.com/settings/tokens/new?description=Squelch&scopes=public_repo", "_blank")}
                                                    className="shrink-0"
                                                >
                                                    <ExternalLink className="h-4 w-4 mr-1.5" />
                                                    Generate
                                                </Button>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    tokenStatus === 'empty' && "bg-muted-foreground",
                                                    tokenStatus === 'valid' && "bg-emerald-500",
                                                    tokenStatus === 'invalid' && "bg-amber-500"
                                                )} />
                                                <span className="text-xs text-muted-foreground">
                                                    {tokenStatus === 'empty' && "No token configured"}
                                                    {tokenStatus === 'valid' && "Token format valid"}
                                                    {tokenStatus === 'invalid' && "Token format may be invalid"}
                                                </span>
                                            </div>

                                            <p className="text-xs text-muted-foreground">
                                                Used for higher API rate limits when fetching firmware releases.
                                            </p>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Repositories Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-sm font-medium">Firmware Repositories</Label>
                                        </div>

                                        {/* Add Repository */}
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        placeholder="owner/repository"
                                                        value={newRepo}
                                                        onChange={(e) => setNewRepo(e.target.value)}
                                                        onKeyDown={handleRepoKeyDown}
                                                        className={cn(
                                                            "pr-10",
                                                            repoError && "border-destructive"
                                                        )}
                                                    />
                                                </div>
                                                <Button
                                                    onClick={handleAddRepo}
                                                    size="icon"
                                                    disabled={!newRepo.trim()}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {repoError && (
                                                <p className="text-xs text-destructive">{repoError}</p>
                                            )}
                                        </div>

                                        {/* Repository List */}
                                        <div className="space-y-2">
                                            {customRepos.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                                                    <FolderGit2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                                    <p className="text-sm text-muted-foreground">No repositories added</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Add repositories to fetch custom firmware releases
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                                    {customRepos.map((repo) => (
                                                        <RepoCard
                                                            key={repo}
                                                            repo={repo}
                                                            onRemove={() => removeCustomRepo(repo)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>

                        {/* Footer */}
                        <div className="border-t p-4 flex justify-end gap-2 bg-muted/20">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                {t('common.cancel', locale)}
                            </Button>
                            <Button onClick={handleSave}>
                                {t('common.save', locale)}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
