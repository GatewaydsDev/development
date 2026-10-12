import { router } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type NoticeKind = 'saving' | 'dashboard';

const counts: Record<NoticeKind, number> = { saving: 0, dashboard: 0 };
let pending = 0;
let noticeKind: NoticeKind = 'saving';
const listeners = new Set<() => void>();
const savingVisits = new WeakMap<object, NoticeKind>();

const notify = () => {
    listeners.forEach((listener) => listener());
};

const publish = (kind: NoticeKind, delta: number) => {
    counts[kind] = Math.max(0, counts[kind] + delta);
    pending = counts.saving + counts.dashboard;
    if (counts.saving > 0) {
        noticeKind = 'saving';
    } else if (counts.dashboard > 0) {
        noticeKind = 'dashboard';
    }
    notify();
};

export function beginSaving(kind: NoticeKind = 'saving') {
    publish(kind, 1);
}

export function endSaving(kind: NoticeKind = 'saving') {
    publish(kind, -1);
}

const visitPath = (url: string | URL) => {
    if (typeof url !== 'string') {
        return url.pathname;
    }

    try {
        return new URL(url, window.location.origin).pathname;
    } catch {
        return url;
    }
};

const noticeForVisit = (visit: { method: string; url: string | URL; prefetch?: boolean }): NoticeKind | null => {
    if ('prefetch' in visit && visit.prefetch) {
        return null;
    }

    const method = visit.method.toLowerCase();
    const path = visitPath(visit.url).replace(/\/+$/, '') || '/';

    const matches = (name: string) => path === `/${name}` || path.endsWith(`/${name}`);

    if (method === 'post' && matches('login')) {
        return 'dashboard';
    }

    if (method !== 'post' && method !== 'put' && method !== 'patch') {
        return null;
    }

    if (matches('logout') || matches('register') || matches('forgot-password') || matches('reset-password') || matches('confirm-password')) {
        return null;
    }

    return 'saving';
};

export default function SavingNotice() {
    const [pendingSaves, setPendingSaves] = useState(pending);
    const [kind, setKind] = useState<NoticeKind>(noticeKind);
    const [visible, setVisible] = useState(false);
    const saving = pendingSaves > 0;

    useEffect(() => {
        const sync = () => {
            setPendingSaves(pending);
            setKind(noticeKind);
        };
        listeners.add(sync);
        const stopStart = router.on('start', (event) => {
            const visit = event.detail.visit;
            const nextKind = noticeForVisit(visit);

            if (!nextKind || savingVisits.has(visit)) {
                return;
            }

            savingVisits.set(visit, nextKind);
            beginSaving(nextKind);
        });
        const stopFinish = router.on('finish', (event) => {
            const visit = event.detail.visit;
            const current = savingVisits.get(visit);

            if (!current) {
                return;
            }

            savingVisits.delete(visit);
            endSaving(current);
        });

        return () => {
            listeners.delete(sync);
            stopStart();
            stopFinish();
        };
    }, []);

    useEffect(() => {
        if (!saving) {
            setVisible(false);

            return;
        }

        const timer = window.setTimeout(() => setVisible(true), 200);

        return () => window.clearTimeout(timer);
    }, [saving]);

    if (!visible) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4"
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-busy="true"
            aria-labelledby="saving-notice-title"
            aria-describedby="saving-notice-description"
        >
            <div className="w-full max-w-sm rounded-xl border border-border bg-background px-6 py-6 text-center shadow-2xl">
                <LoaderCircleIcon className="mx-auto size-8 animate-spin text-emerald-700" />
                <p id="saving-notice-title" className="mt-3 text-base font-semibold text-foreground">
                    {kind === 'dashboard' ? 'Loading dashboard' : 'Saving data'}
                </p>
                <p id="saving-notice-description" className="mt-1 text-sm text-muted-foreground">
                    Please wait.
                </p>
            </div>
        </div>
    );
}
