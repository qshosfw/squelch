import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DynamicFaviconProps {
    connected: boolean;
    isBusy: boolean;
}

export function DynamicFavicon({ connected, isBusy }: DynamicFaviconProps) {
    const { toasts } = useToast();

    // Check if there's an active destructive toast
    const hasError = toasts.some(t => t.variant === 'destructive' && t.open !== false);

    useEffect(() => {
        let color = '#ffffff';
        let type: 'filled' | 'empty' = 'empty';

        if (hasError) {
            color = '#ef4444'; // Red
            type = 'filled';
        } else if (isBusy) {
            color = '#3b82f6'; // Blue
            type = 'filled';
        } else if (connected) {
            color = '#10b981'; // Green
            type = 'filled';
        } else {
            color = '#ffffff'; // White
            type = 'empty';
        }

        const svg = type === 'filled'
            ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="4"/></svg>`;

        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
        link.type = 'image/svg+xml';
        link.rel = 'icon';
        link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;

        if (!document.querySelector("link[rel*='icon']")) {
            document.getElementsByTagName('head')[0].appendChild(link);
        }
    }, [connected, isBusy, hasError]);

    return null;
}
