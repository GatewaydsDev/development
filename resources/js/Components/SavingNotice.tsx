import { router } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

let pending = 0;
const listeners = new Set<() => void>();
const savingVisits = new WeakSet<object>();

const notify = () => {
    listeners.forEach((listener) => listener());
};

export function beginSaving() {
    pending += 1;
    notify();
}

export function endSaving() {
    pending = Math.max(0, pending - 1);
    notify();
}

const isSaveVisit = (visit: { method: string; url: string | URL; prefetch?: boolean }) => {
    const method = visit.method.toLowerCase();

    if ('prefetch' in visit && visit.prefetch) {
        return false;
    }

    if (method !== 'post' && method !== 'put' && method !== 'patch') {
        return false;
    }

    const url = typeof visit.url === 'string' ? visit.url : visit.url.href;

    return !url.includes('/logout');
};

export default function SavingNotice() {
    const [pendingSaves, setPendingSaves] = useState(pending);
    const [visible, setVisible] = useState(false);
    const saving = pendingSaves > 0;

    useEffect(() => {
        const sync = () => setPendingSaves(pending);
        listeners.add(sync);
        const stopStart = router.on('start', (event) => {
            const visit = event.detail.visit;

            if (!isSaveVisit(visit) || savingVisits.has(visit)) {
                return;
            }

            savingVisits.add(visit);
            beginSaving();
        });
        const stopFinish = router.on('finish', (event) => {
            const visit = event.detail.visit;

            if (!savingVisits.has(visit)) {
                return;
            }

            endSaving();
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
                    Saving data
                </p>
                <p id="saving-notice-description" className="mt-1 text-sm text-muted-foreground">
                    Please wait.
                </p>
            </div>
        </div>
    );
}
