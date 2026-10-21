import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/Components/ui/drawer';
import { openSnapDrawerEventName } from '@/lib/shortcuts';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    Building2Icon,
    ChevronRightIcon,
    ClipboardListIcon,
    FileSpreadsheetIcon,
    PlusIcon,
    RulerIcon,
    SparklesIcon,
    XIcon,
    ZapIcon,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ShortcutItem = {
    id: string;
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    visible: boolean;
};

type DashboardSnapDrawerProps = {
    showFloatingTrigger?: boolean;
};

export default function DashboardSnapDrawer({
    showFloatingTrigger = false,
}: DashboardSnapDrawerProps) {
    const { auth } = usePage<PageProps>().props;
    const [open, setOpen] = useState(false);
    const [screen, setScreen] = useState<{ title: string; href: string } | null>(null);
    const [screenReady, setScreenReady] = useState(false);

    const canCreateProjects = Boolean(auth?.can?.createProjects);
    const canCreateQuotations = Boolean(auth?.can?.createQuotations);
    const canCreateBids = Boolean(auth?.can?.createBids);
    const canCreateTakeoffs = Boolean(auth?.can?.createTakeoffs);

    const shortcuts: ShortcutItem[] = useMemo(
        () => [
            {
                id: 'create-project',
                title: 'New project',
                description: 'Add a job site without leaving this page.',
                href: route('admin.projects.create'),
                icon: Building2Icon,
                visible: canCreateProjects,
            },
            {
                id: 'create-quotation',
                title: 'New quote',
                description: 'Start a quotation on top of the page you are using.',
                href: route('admin.quotations.create'),
                icon: FileSpreadsheetIcon,
                visible: canCreateQuotations,
            },
            {
                id: 'create-bid',
                title: 'New bid',
                description: 'Start a bid proposal on top of the page you are using.',
                href: route('admin.bids.create'),
                icon: ClipboardListIcon,
                visible: canCreateBids,
            },
            {
                id: 'create-takeoff',
                title: 'New takeoff',
                description: 'Count doors and windows for a project.',
                href: route('admin.takeoffs.create'),
                icon: RulerIcon,
                visible: canCreateTakeoffs,
            },
        ],
        [canCreateProjects, canCreateQuotations, canCreateBids, canCreateTakeoffs],
    );

    const visibleShortcuts = useMemo(
        () => shortcuts.filter((item) => item.visible),
        [shortcuts],
    );

    const openScreen = useCallback((title: string, href: string) => {
        setScreenReady(false);
        setScreen({ title, href });
        setOpen(false);
    }, []);

    useEffect(() => {
        const handleCustomOpen = () => {
            setOpen(true);
        };

        window.addEventListener(openSnapDrawerEventName, handleCustomOpen);

        return () => {
            window.removeEventListener(openSnapDrawerEventName, handleCustomOpen);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <>
            <Drawer direction="left" open={open} onOpenChange={setOpen}>
                {showFloatingTrigger && (
                    <DrawerTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-40 group flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-700 px-3 py-2 text-white shadow-xl shadow-emerald-950/30 transition-all duration-300 hover:scale-105 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background dark:bg-emerald-800 sm:px-4 sm:py-2.5',
                            )}
                            aria-label="Open fast menu (⌘K)"
                        >
                            <ZapIcon className="size-4" />
                            <span className="text-sm font-semibold tracking-wide">Fast</span>
                        </button>
                    </DrawerTrigger>
                )}

                <DrawerContent className="fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-sm flex-col border-r border-border bg-card text-card-foreground shadow-2xl focus:outline-none">
                    <div className="flex h-full flex-col overflow-hidden">
                        <div className="border-b border-border bg-card px-4 py-4">
                            <DrawerHeader className="flex flex-row items-center justify-between p-0">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
                                        <SparklesIcon className="size-4" />
                                    </div>
                                    <div>
                                        <DrawerTitle className="text-base font-bold tracking-tight text-foreground">
                                            Fast menu
                                        </DrawerTitle>
                                        <DrawerDescription className="text-xs text-muted-foreground">
                                            The records you add most often.
                                        </DrawerDescription>
                                    </div>
                                </div>
                                <DrawerClose asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full text-muted-foreground hover:text-foreground"
                                        aria-label="Close fast menu"
                                    >
                                        <XIcon />
                                    </Button>
                                </DrawerClose>
                            </DrawerHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3">
                            {visibleShortcuts.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {visibleShortcuts.map((item) => {
                                        const Icon = item.icon;

                                        return (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    openScreen(item.title, item.href);
                                                }}
                                                className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/15"
                                            >
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
                                                    <PlusIcon className="size-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                                        <Icon className="size-4 text-muted-foreground" />
                                                        {item.title}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {item.description}
                                                    </p>
                                                </div>
                                                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                                    Create actions appear here when this account can add projects, quotes, bids, or takeoffs.
                                </p>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
            <Dialog
                open={screen !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        setScreen(null);
                        setScreenReady(false);
                    }
                }}
            >
                <DialogContent
                    className="flex h-[min(92dvh,52rem)] w-[min(96vw,76rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:p-0"
                    onFocusOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-14 text-left">
                        <DialogTitle>{screen?.title ?? 'Screen'}</DialogTitle>
                        <DialogDescription>
                            This stays on top of the page you were using. Close it to go back to that page.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative min-h-0 flex-1 bg-muted/30">
                        {screen && !screenReady ? (
                            <p className="absolute inset-x-0 top-6 text-center text-sm text-muted-foreground">
                                Opening {screen.title}…
                            </p>
                        ) : null}
                        {screen ? (
                            <iframe
                                key={screen.href}
                                src={screen.href}
                                title={screen.title}
                                className="h-full w-full bg-background"
                                onLoad={() => setScreenReady(true)}
                            />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
