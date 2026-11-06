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
let chimeContext: AudioContext | null = null;
const announced = new Set<string>();
const acknowledgedIds = new Set<string>();
const listeners = new Set<(count: number) => void>();
const errorListeners = new Set<(failing: boolean) => void>();
let failing = false;
let unreadMessageIds: string[] = [];
const messageIdListeners = new Set<(ids: string[]) => void>();

function setFailing(next: boolean): void {
    if (failing !== next) {
        failing = next;
        errorListeners.forEach((listener) => listener(failing));
    }
}

function setUnreadMessageIds(messages: UnreadMessage[]): void {
    const next = messages.map((message) => message.id);

    if (next.length === unreadMessageIds.length && next.every((id, index) => id === unreadMessageIds[index])) {
        return;
    }

    unreadMessageIds = next;
    messageIdListeners.forEach((listener) => listener(unreadMessageIds));
}

function audioContextConstructor(): typeof AudioContext | null {
    return window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        ?? null;
}

function unlockMailChime(): void {
    const Context = audioContextConstructor();

    if (!Context) {
        return;
    }

    chimeContext ??= new Context();

    if (chimeContext.state === 'suspended') {
        void chimeContext.resume();
    }
}

function playMailChime(): void {
    const context = chimeContext;

    if (!context || context.state !== 'running') {
        return;
    }

    const now = context.currentTime;

    [659.25, 783.99, 987.77].forEach((frequency, index) => {
        const start = now + index * 0.1;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.45);
    });
}

export function useUnreadMailFailing(): boolean {
    const [value, setValue] = useState(failing);

    useEffect(() => {
        errorListeners.add(setValue);
        setValue(failing);

        return () => {
            errorListeners.delete(setValue);
        };
    }, []);

    return value;
}

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

        const data = (await response.json()) as { unread?: unknown; messages?: unknown; error?: unknown };
        const count = Number(data.unread);
        const messages = unreadMessages(data.messages);

        if (serial !== requestSerial) {
            return;
        }

        setFailing(data.error === true);
        announceNewMail(messages);
        setUnreadMessageIds(messages);
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
    window.addEventListener('pointerdown', unlockMailChime);
    window.addEventListener('keydown', unlockMailChime);
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

    const fresh = messages.filter((message) => {
        if (announced.has(message.id) || readingMessage(message.id)) {
            announced.add(message.id);

            return false;
        }

        announced.add(message.id);

        return true;
    });

    if (fresh.length > 0) {
        playMailChime();
    }

    fresh.forEach((message) => {
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

export function useUnreadMailMessageIds(): string[] {
    const [ids, setIds] = useState(unreadMessageIds);

    useEffect(() => {
        messageIdListeners.add(setIds);
        setIds(unreadMessageIds);

        return () => {
            messageIdListeners.delete(setIds);
        };
    }, []);

    return ids;
}
