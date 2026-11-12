import { getEcho, isEchoConnected } from '@/lib/echo';
import type { PageProps } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

const fallbackPollInterval = 20_000;
const refreshDebounce = 250;

export default function useJobProgressLive(
    scheduleUuids: string[],
    only: string[],
) {
    const { realtime } = usePage<PageProps>().props;
    const realtimeKey = realtime?.key;
    const channelKey = [...new Set(scheduleUuids)].sort().join('|');
    const onlyKey = only.join('|');
    const onlyRef = useRef(only);
    const refreshing = useRef(false);
    const queued = useRef(false);
    const debounceTimer = useRef<number | null>(null);

    onlyRef.current = only;

    const refreshRef = useRef<() => void>(() => undefined);
    refreshRef.current = () => {
        if (refreshing.current) {
            queued.current = true;

            return;
        }

        refreshing.current = true;
        router.reload({
            only: onlyRef.current,
            preserveScroll: true,
            preserveState: true,
            showProgress: false,
            onFinish: () => {
                refreshing.current = false;

                if (queued.current) {
                    queued.current = false;
                    refreshRef.current();
                }
            },
        } as never);
    };

    const queueRefreshRef = useRef<() => void>(() => undefined);
    queueRefreshRef.current = () => {
        if (debounceTimer.current !== null) {
            window.clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = window.setTimeout(() => {
            debounceTimer.current = null;
            refreshRef.current();
        }, refreshDebounce);
    };

    useEffect(() => {
        const echo = getEcho(realtime);
        const channels = channelKey ? channelKey.split('|') : [];

        if (!echo || channels.length === 0) {
            return;
        }

        channels.forEach((scheduleUuid) => {
            echo.private(`job-progress.${scheduleUuid}`).listen(
                '.job-progress.changed',
                () => queueRefreshRef.current(),
            );
        });

        return () => {
            channels.forEach((scheduleUuid) => {
                const name = `job-progress.${scheduleUuid}`;

                echo.private(name).stopListening('.job-progress.changed');
                echo.leave(name);
            });
        };
        // The socket and subscriptions change only when the key or UUID set changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelKey, realtimeKey]);

    useEffect(() => {
        const refreshIfNeeded = () => {
            if (
                document.visibilityState === 'visible' &&
                !isEchoConnected()
            ) {
                queueRefreshRef.current();
            }
        };
        const interval = window.setInterval(
            refreshIfNeeded,
            fallbackPollInterval,
        );

        document.addEventListener('visibilitychange', refreshIfNeeded);
        window.addEventListener('focus', refreshIfNeeded);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refreshIfNeeded);
            window.removeEventListener('focus', refreshIfNeeded);

            if (debounceTimer.current !== null) {
                window.clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
        };
    }, [onlyKey]);
}
