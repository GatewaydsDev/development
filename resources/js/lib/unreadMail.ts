import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const heldKey = 'mailbox-unread-held';

let unread = 0;
let heldCount = readHeldCount();
let held = heldCount > 0;
let started = false;
const listeners = new Set<(count: number) => void>();

function readHeldCount(): number {
    if (typeof window === 'undefined') {
        return 0;
    }

    const value = Number(window.sessionStorage.getItem(heldKey));

    return Number.isFinite(value) && value > 0 ? value : 0;
}

function visibleCount(): number {
    if (!held) {
        return unread;
    }

    return Math.max(0, unread - heldCount);
}

function rememberHeld(count: number): void {
    held = true;
    heldCount = count;

    if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(heldKey, String(count));
    }
}

function publish(count: number): void {
    unread = count;

    if (held && unread < heldCount) {
        rememberHeld(unread);
    }

    const visible = visibleCount();
    listeners.forEach((listener) => listener(visible));
}

export function acknowledgeUnreadMail(): void {
    rememberHeld(Math.max(heldCount, unread));
    listeners.forEach((listener) => listener(0));

    void refreshUnreadMail().finally(() => {
        rememberHeld(unread);
        listeners.forEach((listener) => listener(visibleCount()));
    });
}

async function refreshUnreadMail(): Promise<void> {
    if (document.visibilityState === 'hidden') {
        return;
    }

    try {
        const response = await fetch(route('mailbox.unread'), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            return;
        }

        const data = (await response.json()) as { unread?: unknown };
        const count = Number(data.unread);

        publish(Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0);
    } catch {
        // Keep the last count when Microsoft 365 does not answer.
    }
}

function ensureUnreadMailPolling(): void {
    if (started || typeof window === 'undefined') {
        return;
    }

    started = true;
    void refreshUnreadMail();
    window.setInterval(() => void refreshUnreadMail(), 60_000);
    window.addEventListener('focus', () => void refreshUnreadMail());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void refreshUnreadMail();
        }
    });
    router.on('navigate', () => void refreshUnreadMail());
}

export function useUnreadMail(): number {
    const [count, setCount] = useState(unread);

    useEffect(() => {
        ensureUnreadMailPolling();
        listeners.add(setCount);
        setCount(unread);

        return () => {
            listeners.delete(setCount);
        };
    }, []);

    return count;
}
