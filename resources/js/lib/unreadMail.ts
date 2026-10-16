import i18n from '@/i18n';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type UnreadMessage = {
    id: string;
    subject: string;
    from: string;
    preview: string;
};

let serverUnread: number | null = null;
let shown = 0;
let requestSerial = 0;
let started = false;
let primed = false;
const announced = new Set<string>();
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

        const data = (await response.json()) as { unread?: unknown; messages?: unknown };
        const count = Number(data.unread);
        const messages = unreadMessages(data.messages);

        if (serial !== requestSerial) {
            return;
        }

        announceNewMail(messages);
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
    window.setInterval(() => void refreshUnreadMail(), 20_000);
    window.addEventListener('focus', () => void refreshUnreadMail());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void refreshUnreadMail();
        }
    });
}

function unreadMessages(value: unknown): UnreadMessage[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') {
            return [];
        }

        const message = item as Partial<UnreadMessage>;

        if (typeof message.id !== 'string' || message.id === '') {
            return [];
        }

        return [
            {
                id: message.id,
                subject: typeof message.subject === 'string' ? message.subject : '',
                from: typeof message.from === 'string' ? message.from : '',
                preview: typeof message.preview === 'string' ? message.preview : '',
            },
        ];
    });
}

function announceNewMail(messages: UnreadMessage[]): void {
    if (!primed) {
        primed = true;
        messages.forEach((message) => announced.add(message.id));

        return;
    }

    messages.forEach((message) => {
        if (announced.has(message.id) || readingMessage(message.id)) {
            announced.add(message.id);

            return;
        }

        announced.add(message.id);
        const href = route('mailbox.index', { folder: 'inbox', message: message.id });
        const subject = message.subject || i18n.t('mail:noSubject');
        const description = message.from ? `${message.from} — ${subject}` : subject;

        toast(i18n.t('mail:newEmail'), {
            id: `mail-${message.id}`,
            description,
            duration: 30_000,
            action: {
                label: i18n.t('mail:openEmail'),
                onClick: () => router.visit(href),
            },
        });

        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return;
        }

        try {
            const notification = new Notification(i18n.t('mail:newEmail'), {
                body: description,
                tag: `mail-${message.id}`,
            });

            notification.onclick = () => {
                window.focus();
                router.visit(href);
                notification.close();
            };
        } catch {
            // Some browsers only allow notifications from a service worker.
        }
    });
}

function readingMessage(messageId: string): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const current = new URL(window.location.href);

    return current.pathname.endsWith('/email') && current.searchParams.get('message') === messageId;
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
