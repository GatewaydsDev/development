import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { BellIcon, BellRingIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const publicKey = () => document.querySelector<HTMLMetaElement>('meta[name="vapid-public-key"]')?.content ?? '';

const toKey = (base64: string) => {
    const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);

    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const xsrf = () => {
    const raw = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length);

    return raw ? decodeURIComponent(raw) : '';
};

const send = async (method: 'POST' | 'DELETE', body: unknown) => {
    const response = await fetch(route(method === 'POST' ? 'push-subscriptions.store' : 'push-subscriptions.destroy'), {
        method,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': xsrf() },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error('Request failed');
    }
};

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function PushNotificationButton() {
    const { t } = useTranslation('mail');
    const [supported, setSupported] = useState(false);
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (publicKey() === '' || !('serviceWorker' in navigator)) {
            return;
        }

        setSupported(true);
        navigator.serviceWorker.register('/sw.js').then(async (registration) => {
            setSubscribed((await registration.pushManager?.getSubscription()) !== null && Notification.permission === 'granted');
        }).catch(() => undefined);
    }, []);

    if (!supported) {
        return null;
    }

    const enable = async () => {
        if (isIos() && !isStandalone()) {
            setMessage(t('notificationIosHelp'));

            return;
        }

        if (!('PushManager' in window) || !('Notification' in window)) {
            setMessage(t('notificationUnsupported'));

            return;
        }

        if ((await Notification.requestPermission()) !== 'granted') {
            setMessage(t('notificationBlocked'));

            return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey()) });
        await send('POST', { ...subscription.toJSON(), contentEncoding: (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings?.includes('aes128gcm') ? 'aes128gcm' : 'aesgcm' });
        setSubscribed(true);

        const result = await fetch(route('push-subscriptions.test'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': xsrf() },
        }).then((response) => response.json()).catch(() => ({ sent: 0, reason: 'Could not reach the server.' }));

        setMessage(result.sent > 0
            ? t('notificationEnabled')
            : t('notificationTestFailed', { reason: result.reason }));
    };

    const disable = async () => {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await send('DELETE', { endpoint: subscription.endpoint });
            await subscription.unsubscribe();
        }

        setSubscribed(false);
        setMessage(t('notificationDisabled'));
    };

    const toggle = async () => {
        setBusy(true);

        try {
            await (subscribed ? disable() : enable());
        } catch {
            setMessage(t('notificationChangeFailed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button
                type="button"
                disabled={busy}
                onClick={toggle}
                title={subscribed ? t('turnOffDeviceNotifications') : t('turnOnDeviceNotifications')}
                aria-label={subscribed ? t('turnOffDeviceNotifications') : t('turnOnDeviceNotifications')}
                className={
                    'inline-flex size-9 items-center justify-center rounded-md border bg-background transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring ' +
                    (subscribed ? 'border-emerald-500/60 text-emerald-600' : 'border-border text-muted-foreground')
                }
            >
                {subscribed ? <BellRingIcon className="size-4" /> : <BellIcon className="size-4" />}
            </button>
            <AlertDialog open={message !== null} onOpenChange={(open) => !open && setMessage(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deviceNotifications')}</AlertDialogTitle>
                        <AlertDialogDescription>{message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogAction>OK</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
