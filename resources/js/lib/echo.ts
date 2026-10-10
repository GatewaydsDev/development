import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import type { RealtimeConfig } from '@/types';

let echo: Echo<'reverb'> | null = null;

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

export function getEcho(config?: RealtimeConfig | null): Echo<'reverb'> | null {
    if (echo) {
        return echo;
    }

    const key =
        config?.key ||
        (import.meta.env.VITE_REVERB_APP_KEY as string | undefined);

    if (typeof window === 'undefined' || !key) {
        return null;
    }

    const scheme =
        config?.scheme ||
        (import.meta.env.VITE_REVERB_SCHEME as string) ||
        'https';
    const port = Number(
        config?.port ||
            import.meta.env.VITE_REVERB_PORT ||
            (scheme === 'https' ? 443 : 80),
    );
    const host =
        config?.host ||
        (import.meta.env.VITE_REVERB_HOST as string) ||
        window.location.hostname;

    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

    echo = new Echo({
        broadcaster: 'reverb',
        key,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        authorizer: (channel: { name: string }) => ({
            authorize: (
                socketId: string,
                callback: (
                    error: Error | null,
                    data: { auth: string } | null,
                ) => void,
            ) => {
                fetch('/broadcasting/auth', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-XSRF-TOKEN': xsrfToken(),
                    },
                    body: JSON.stringify({
                        socket_id: socketId,
                        channel_name: channel.name,
                    }),
                })
                    .then(async (response) => {
                        if (!response.ok) {
                            throw new Error(
                                `Broadcast auth failed (${response.status})`,
                            );
                        }

                        callback(null, await response.json());
                    })
                    .catch((error: Error) => callback(error, null));
            },
        }),
    });

    return echo;
}

export function isEchoConnected(): boolean {
    const connector = echo?.connector as
        | { pusher?: { connection?: { state?: string } } }
        | undefined;

    return connector?.pusher?.connection?.state === 'connected';
}
