import { router } from '@inertiajs/react';
import { useEffect } from 'react';

const projectListRefreshInterval = 2_000;

export function useProjectListRefresh(
    listVersion: string | null | undefined,
    reloadProps: string[],
) {
    const reloadKey = reloadProps.join(',');

    useEffect(() => {
        if (!listVersion) {
            return;
        }

        let stopped = false;
        let version = listVersion;

        const watch = window.setInterval(async () => {
            try {
                const response = await fetch(route('admin.projects.version'), {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!response.ok || stopped) {
                    return;
                }

                const body = (await response.json()) as { version?: string };

                if (!body.version || body.version === version || stopped) {
                    return;
                }

                version = body.version;

                router.reload({
                    only: reloadKey.split(','),
                    preserveState: true,
                    preserveScroll: true,
                    async: true,
                    showProgress: false,
                });
            } catch {
                // Keep the current list when the version check cannot be reached.
            }
        }, projectListRefreshInterval);

        return () => {
            stopped = true;
            window.clearInterval(watch);
        };
    }, [listVersion, reloadKey]);
}
