import { router } from '@inertiajs/react';
import { useEffect } from 'react';

const projectListRefreshInterval = 2_000;

export function useProjectListRefresh(
    listVersion: string | null | undefined,
    reloadProps: string[],
    versionRoute = 'admin.projects.version',
) {
    const reloadKey = reloadProps.join(',');

    useEffect(() => {
        if (!listVersion) {
            return;
        }

        let stopped = false;
        let reloading = false;
        let version = listVersion;

        const watch = window.setInterval(async () => {
            try {
                const response = await fetch(route(versionRoute), {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!response.ok || stopped || reloading) {
                    return;
                }

                const body = (await response.json()) as { version?: string };
                const nextVersion = body.version;

                if (!nextVersion || nextVersion === version || stopped) {
                    return;
                }

                reloading = true;

                router.reload({
                    only: reloadKey.split(','),
                    preserveState: true,
                    preserveScroll: true,
                    async: true,
                    showProgress: false,
                    onSuccess: () => {
                        version = nextVersion;
                    },
                    onFinish: () => {
                        reloading = false;
                    },
                });
            } catch {
                reloading = false;
                // Keep the current list when the version check cannot be reached.
            }
        }, projectListRefreshInterval);

        return () => {
            stopped = true;
            window.clearInterval(watch);
        };
    }, [listVersion, reloadKey, versionRoute]);
}
