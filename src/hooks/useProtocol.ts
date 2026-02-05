import { useState, useEffect } from 'react';
import { protocol } from '@/lib/protocol';

export function useProtocol() {
    const [isConnected, setIsConnected] = useState(protocol.isConnected);

    useEffect(() => {
        // We need to hook into protocol's status change.
        // However, protocol.onStatusChange is a single callback property,
        // so if we overwrite it, we might break App.tsx.
        // Ideally Protocol should support multiple listeners (EventEmitter style).
        // For now, we unfortunately have to poll or rely on shared state if we can't modify Protocol to be an emitter.

        // BETTER APPROACH: Let's assume for now we just want the instance.
        // But to make it reactive, we really need the event.

        // Since I cannot easily change Protocol to EventEmitter without potentially breaking App.tsx usage (which assigns onStatusChange),
        // I will just return the singleton and the initial state. 
        // Reactive updates might be limited until we refactor Protocol to support addEventListener.

        // Hacky poll for now used in some modules?
        const timer = setInterval(() => {
            if (protocol.isConnected !== isConnected) {
                setIsConnected(protocol.isConnected);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [isConnected]);

    return {
        protocol,
        isConnected
    };
}
