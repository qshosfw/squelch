import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function PWAReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r)
        },
        onRegisterError(error) {
            console.log('SW registration error', error)
        },
    })

    const close = () => {
        setOfflineReady(false)
        setNeedRefresh(false)
    }

    if (!offlineReady && !needRefresh) return null

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={cn(
                "flex flex-col gap-3 rounded-lg border bg-popover p-4 shadow-lg min-w-[300px]",
                needRefresh ? "border-primary/50" : "border-border"
            )}>
                <div className="flex items-start gap-3">
                    {needRefresh ? (
                        <RefreshCw className="h-5 w-5 text-primary mt-0.5 animate-spin-slow" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {offlineReady ? "App ready to work offline" : "New version available!"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {offlineReady
                                ? "You can now use Squelch without an internet connection."
                                : "A new update is ready. Reload to apply latest changes."}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1" onClick={close}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {needRefresh && (
                    <div className="flex gap-2">
                        <Button size="sm" className="w-full h-8" onClick={() => updateServiceWorker(true)}>
                            Update Now
                        </Button>
                        <Button size="sm" variant="outline" className="w-full h-8" onClick={close}>
                            Dismiss
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
