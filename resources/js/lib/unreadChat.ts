import { useEffect, useState } from 'react';

let shown = 0;
const listeners = new Set<(count: number) => void>();

function notify(): void {
    listeners.forEach((listener) => listener(shown));
}

export function setUnreadChat(count: number): void {
    const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;

    if (next === shown) {
        return;
    }

    shown = next;
    notify();
}

export function useUnreadChat(): number {
    const [count, setCount] = useState(shown);

    useEffect(() => {
        listeners.add(setCount);
        setCount(shown);

        return () => {
            listeners.delete(setCount);
        };
    }, []);

    return count;
}
