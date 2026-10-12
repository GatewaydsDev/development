import { Skeleton } from '@/Components/ui/skeleton';
import { router } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

type SkeletonKind = 'dashboard' | 'list' | 'form' | 'detail' | 'public';

type LoadingVisit = {
    method: string;
    url: string | URL;
    prefetch?: boolean;
    only?: string[];
    except?: string[];
    showProgress?: boolean;
};

let pending = 0;
let destination = '/';
const listeners = new Set<() => void>();
const trackedVisits = new WeakSet<object>();

const notify = () => {
    listeners.forEach((listener) => listener());
};

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

const isWorkspace = (path: string) =>
    path === '/dashboard' ||
    path.startsWith('/administration') ||
    path.startsWith('/profile') ||
    path.startsWith('/appearance') ||
    path.startsWith('/notifications');

const skeletonKind = (path: string): SkeletonKind => {
    if (!isWorkspace(path)) {
        return 'public';
    }

    if (path === '/dashboard') {
        return 'dashboard';
    }

    if (
        /\/(create|edit|bulk)(\/|$)/.test(path) ||
        path.includes('/document-settings') ||
        path.includes('/access-control') ||
        path.includes('/company') ||
        path.includes('/signature') ||
        path.includes('/account') ||
        path.startsWith('/profile') ||
        path.startsWith('/appearance')
    ) {
        return 'form';
    }

    if (/\/\d+(\/|$)/.test(path) || /\/[0-9a-f]{8}-[0-9a-f-]{27,}(\/|$)/i.test(path)) {
        return 'detail';
    }

    return 'list';
};

const shouldShowSkeleton = (visit: LoadingVisit) => {
    if (visit.prefetch || visit.showProgress === false) {
        return false;
    }

    if ((visit.only && visit.only.length > 0) || (visit.except && visit.except.length > 0)) {
        return false;
    }

    return visit.method.toLowerCase() === 'get';
};

function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
    return <Skeleton className={className} style={style} />;
}

function PageTitle() {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
                <Bone className="h-4 w-28" />
                <Bone className="h-7 w-52" />
            </div>
            <Bone className="h-10 w-28" />
        </div>
    );
}

function StatRow() {
    return (
        <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                    <Bone className="h-4 w-24" />
                    <Bone className="h-3 w-36" />
                    <Bone className="h-8 w-16" />
                </div>
            ))}
        </div>
    );
}

function ListSkeleton() {
    return (
        <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <PageTitle />
            <StatRow />
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <Bone className="h-5 w-32" />
                        <Bone className="h-3 w-56" />
                    </div>
                    <Bone className="h-11 w-full sm:w-64" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 6 }, (_, index) => (
                        <Bone key={index} className="h-12 w-full" />
                    ))}
                </div>
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <Bone className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                        <Bone className="h-6 w-40" />
                        <Bone className="h-4 w-56" />
                        <div className="flex h-40 items-end gap-3">
                            {Array.from({ length: 5 }, (_, bar) => (
                                <Bone key={bar} className="w-full" style={{ height: `${40 + ((bar * 17) % 60)}%` }} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FormSkeleton() {
    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <PageTitle />
            <div className="space-y-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="space-y-2">
                        <Bone className="h-4 w-28" />
                        <Bone className="h-11 w-full" />
                    </div>
                ))}
                <div className="flex justify-end gap-3 pt-2">
                    <Bone className="h-10 w-24" />
                    <Bone className="h-10 w-28" />
                </div>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <PageTitle />
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                    <Bone className="h-6 w-40" />
                    {Array.from({ length: 5 }, (_, index) => (
                        <Bone key={index} className="h-10 w-full" />
                    ))}
                </div>
                <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                    <Bone className="h-6 w-32" />
                    <Bone className="h-24 w-full" />
                    <Bone className="h-10 w-full" />
                </div>
            </div>
        </div>
    );
}

function PublicSkeleton() {
    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
            <div className="space-y-3">
                <Bone className="h-5 w-32" />
                <Bone className="h-10 w-2/3 max-w-xl" />
                <Bone className="h-4 w-full max-w-2xl" />
                <Bone className="h-4 w-4/5 max-w-lg" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                        <Bone className="h-8 w-8 rounded-full" />
                        <Bone className="h-5 w-32" />
                        <Bone className="h-4 w-full" />
                        <Bone className="h-4 w-4/5" />
                    </div>
                ))}
            </div>
        </div>
    );
}

const skeletons: Record<SkeletonKind, () => ReactNode> = {
    dashboard: DashboardSkeleton,
    list: ListSkeleton,
    form: FormSkeleton,
    detail: DetailSkeleton,
    public: PublicSkeleton,
};

export default function PageSkeleton() {
    const [pendingLoads, setPendingLoads] = useState(pending);
    const [path, setPath] = useState(destination);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const sync = () => {
            setPendingLoads(pending);
            setPath(destination);
        };
        listeners.add(sync);
        const stopStart = router.on('start', (event) => {
            const visit = event.detail.visit as LoadingVisit;

            if (!shouldShowSkeleton(visit) || trackedVisits.has(visit)) {
                return;
            }

            trackedVisits.add(visit);
            destination = visitPath(visit.url);
            pending += 1;
            notify();
        });
        const stopFinish = router.on('finish', (event) => {
            const visit = event.detail.visit;

            if (!trackedVisits.has(visit)) {
                return;
            }

            pending = Math.max(0, pending - 1);
            notify();
        });

        return () => {
            listeners.delete(sync);
            stopStart();
            stopFinish();
        };
    }, []);

    useEffect(() => {
        if (pendingLoads === 0) {
            setVisible(false);

            return;
        }

        const timer = window.setTimeout(() => setVisible(true), 180);

        return () => window.clearTimeout(timer);
    }, [pendingLoads]);

    if (!visible) {
        return null;
    }

    const workspace = isWorkspace(window.location.pathname);
    const collapsed = window.localStorage.getItem('sidebarCollapsed') === '1';
    const kind = skeletonKind(path);
    const Screen = skeletons[kind];

    return (
        <div
            className={
                'fixed overflow-y-auto bg-[color-mix(in_oklch,var(--muted)_30%,var(--background))] ' +
                (workspace
                    ? 'inset-x-0 bottom-0 top-16 z-[25] ' + (collapsed ? 'lg:left-16' : 'lg:left-72 xl:left-80')
                    : 'inset-0 z-[60]')
            }
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <p className="flex items-center gap-2 px-4 pt-4 text-sm font-medium text-muted-foreground sm:px-6 lg:px-8">
                <LoaderCircleIcon className="size-4 animate-spin text-emerald-700" />
                Loading page
            </p>
            <Screen />
        </div>
    );
}
