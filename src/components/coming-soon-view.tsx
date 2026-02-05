import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { LucideIcon, Sparkles } from "lucide-react"

interface ComingSoonViewProps {
    title: string
    description: string
    icon: LucideIcon
}

export function ComingSoonView({ title, description, icon: Icon }: ComingSoonViewProps) {
    return (
        <div className="flex h-full w-full items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 relative overflow-hidden group">
                {/* Animated background accent */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center relative group-hover:scale-110 transition-transform duration-500">
                        <Icon className="h-10 w-10 text-primary" />
                        <div className="absolute -top-1 -right-1">
                            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary border-none text-xs">WIP</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {description}
                        </p>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/50">
                        Coming Soon to Squelch
                    </p>
                </div>
            </Card>
        </div>
    )
}
