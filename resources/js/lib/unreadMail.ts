import { useEffect, useState } from 'react';

let serverUnread: number | null = null;
let shown = 0;
let requestSerial = 0;
let started = false;
const acknowledgedIds = new Set<string>();
const listeners = new Set<(count: number) => void>();

function notify(): void {
    listeners.forEach((listener) => listener(shown));
}

function applyServerCount(count: number): void {
    if (serverUnread === null) {
        serverUnread = count;
        shown = count;
        notify();

        return;
    }

    if (count > serverUnread) {
        shown += count - serverUnread;
        serverUnread = count;
        notify();

        return;
    }

    serverUnread = count;
    shown = Math.min(shown, count);
    notify();
}

export function setUnreadMail(count: number): void {
    requestSerial += 1;
    const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    serverUnread = next;
    shown = next;
    notify();
}

export function acknowledgeUnreadMail(messageId: string): void {
    if (messageId === '' || acknowledgedIds.has(messageId)) {
        return;
    }

    acknowledgedIds.add(messageId);

    if (acknowledgedIds.size > 200) {
        const oldest = acknowledgedIds.values().next().value;

        if (oldest) {
            acknowledgedIds.delete(oldest);
        }
    }

    if (serverUnread !== null) {
        shown = Math.max(0, shown - 1);
        notify();
    }

    void refreshUnreadMail();
}

async function refreshUnreadMail(): Promise<void> {
    if (typeof document === 'undefined' || document.visibilityState === 'hidden') {
        return;
    }

    const serial = ++requestSerial;

    try {
        const response = await fetch(route('mailbox.unread'), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (serial !== requestSerial || !response.ok) {
            return;
        }

        const data = (await response.json()) as { unread?: unknown };
        const count = Number(data.unread);

        if (serial !== requestSerial) {
            return;
        }

        applyServerCount(Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0);
    } catch {
        // Keep the last count when Microsoft 365 does not answer.
    }
}

function ensureUnreadMailPolling(): void {
    if (started || typeof window === 'undefined') {
        return;
    }

    started = true;
    window.sessionStorage.removeItem('mailbox-unread-held');
    void refreshUnreadMail();
    window.setInterval(() => void refreshUnreadMail(), 60_000);
    window.addEventListener('focus', () => void refreshUnreadMail());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void refreshUnreadMail();
        }
    });
}

export function useUnreadMail(): number {
    const [count, setCount] = useState(shown);

    useEffect(() => {
        ensureUnreadMailPolling();
        listeners.add(setCount);
        setCount(shown);

        return () => {
            listeners.delete(setCount);
        };
    }, []);

    return count;
}
