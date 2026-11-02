import DashboardSidebar from '@/Components/DashboardSidebar';
import { Dialog as DialogPrimitive } from 'radix-ui';
import ExpenseUpdates from '@/Components/ExpenseUpdates';
import IncomingAlert from '@/Components/IncomingAlert';
import FollowUpReminders from '@/Components/FollowUpReminders';
import TabUnreadBadge from '@/Components/TabUnreadBadge';
import InternalChat from '@/Components/InternalChat';
import DashboardSnapDrawer from '@/Components/DashboardSnapDrawer';
import NavLink from '@/Components/NavLink';
import {
    RevisionAssignmentListener,
    RevisionAssignmentsMenu,
} from '@/Components/RevisionAssignments';
import LogoutConfirmDialog from '@/Components/LogoutConfirmDialog';
import ThemeModeToggle from '@/Components/ThemeModeToggle';
import UnreadMailButton from '@/Components/UnreadMailButton';
import UserAvatar from '@/Components/UserAvatar';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';

import { openSnapDrawer } from '@/lib/shortcuts';
import { useUnreadMail } from '@/lib/unreadMail';
import { PageProps } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    ActivityIcon,
    Building2Icon,
    BellIcon,
    SparklesIcon,
    CalendarDaysIcon,
    BriefcaseIcon,
    ChevronDownIcon,
    ClipboardListIcon,
    FileSpreadsheetIcon,
    RulerIcon,
    HardHatIcon,
    IdCardIcon,
    ListIcon,
    MailOpenIcon,
    PackageIcon,
    PaletteIcon,
    LogOutIcon,
    PenLineIcon,
    ReceiptIcon,
    PlusCircleIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    UserCogIcon,
    UserPlusIcon,
    UsersIcon,
    WrenchIcon,
    XIcon,
    ZapIcon,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    PropsWithChildren,
    ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';

const notificationPollInterval = 60_000;
const idleActivityEvents = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
] as const;

export default function Authenticated({
    header,
    stickyTitle,
    fullWidth = false,
    children,
}: PropsWithChildren<{ header?: ReactNode; stickyTitle?: string; fullWidth?: boolean }>) {
    const page = usePage<PageProps>();
    const { auth, session, flash, impersonation } = page.props;
    const user = auth.user;
    const idleTimeoutMinutes = Number(session?.idleTimeoutMinutes ?? 0);
    const canManageUsers = Boolean(auth.can?.manageUsers);
    const canViewUsers = Boolean(auth.can?.viewUsers);
    const canCreateUsers = Boolean(auth.can?.createUsers);
    const canViewUserActivity = Boolean(auth.can?.viewUserActivity);
    const canManageExpenses = Boolean(auth.can?.manageExpenses);
    const canManageDocumentColors = Boolean(auth.can?.manageDocumentColors);
    const canManageAccess = Boolean(auth.can?.manageAccess);
    const canManageNotifications = Boolean(auth.can?.manageNotifications);
    const canViewCompany = Boolean(auth.can?.viewCompany);
    const canManageOwnAccount = Boolean(auth.can?.manageOwnAccount);
    const canViewProjects = Boolean(auth.can?.viewProjects);
    const canCreateProjects = Boolean(auth.can?.createProjects);
    const canViewBids = Boolean(auth.can?.viewBids);
    const canCreateBids = Boolean(auth.can?.createBids);
    const canViewQuotations = Boolean(auth.can?.viewQuotations);
    const canCreateQuotations = Boolean(auth.can?.createQuotations);
    const canViewTakeoffs = Boolean(auth.can?.viewTakeoffs);
    const canCreateTakeoffs = Boolean(auth.can?.createTakeoffs);
    const canViewProducts = Boolean(auth.can?.viewProducts);
    const canCreateProducts = Boolean(auth.can?.createProducts);
    const canViewServices = Boolean(auth.can?.viewServices);
    const canCreateServices = Boolean(auth.can?.createServices);
    const canViewContractors = Boolean(auth.can?.viewContractors);
    const canCreateContractors = Boolean(auth.can?.createContractors);
    const canViewEmployees = Boolean(auth.can?.viewEmployees);
    const canCreateEmployees = Boolean(auth.can?.createEmployees);
    const canOpenProjects = canViewProjects || canCreateProjects;
    const canOpenBids = canViewBids || canCreateBids;
    const canOpenQuotations = canViewQuotations || canCreateQuotations;
    const canOpenTakeoffs = canViewTakeoffs || canCreateTakeoffs;
    const canOpenProducts = canViewProducts || canCreateProducts;
    const canOpenServices = canViewServices || canCreateServices;
    const canOpenContractors = canViewContractors || canCreateContractors;
    const canOpenEmployees = canViewEmployees || canCreateEmployees;
    const canOpenWork =
        canOpenProjects ||
        canOpenBids ||
        canOpenQuotations ||
        canOpenTakeoffs ||
        canOpenProducts ||
        canOpenServices;
    const canOpenPeople =
        canOpenContractors ||
        canOpenEmployees ||
        canManageNotifications;
    const canOpenWorkspace = true;
    const canOpenSecurity =
        canManageUsers ||
        canManageAccess ||
        canViewUserActivity ||
        canManageExpenses;
    const canOpenAdministration =
        canOpenWork || canOpenPeople || canOpenWorkspace || canOpenSecurity;
    const notifications = auth.notifications;
    const systemUpdatesUnread = auth.systemUpdatesUnread ?? 0;
    const unreadMail = useUnreadMail();
    const hasUnreadMail = unreadMail > 0;
    const hasUnreadNotifications = notifications.unreadCount > 0;
    const previousUnreadCount = useRef(notifications.unreadCount);
    const idleTimeoutRef = useRef<number | null>(null);
    const hasIdleLoggedOut = useRef(false);
    const [shouldShakeBell, setShouldShakeBell] = useState(false);

    const [confirmLogout, setConfirmLogout] = useState(false);
    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return window.localStorage.getItem('sidebarCollapsed') === '1';
    });

    useEffect(() => {
        const query = window.matchMedia('(min-width: 1024px)');
        const close = (event: MediaQueryListEvent) => {
            if (event.matches) {
                setShowingNavigationDropdown(false);
            }
        };

        query.addEventListener('change', close);

        return () => query.removeEventListener('change', close);
    }, []);

    useLayoutEffect(() => {
        document.documentElement.dataset.dashboardTheme =
            user.dashboard_theme || 'gateway';

        return () => {
            document.documentElement.dataset.dashboardTheme = 'gateway';
        };
    }, [user.dashboard_theme]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(
            'sidebarCollapsed',
            sidebarCollapsed ? '1' : '0',
        );
        document.documentElement.dataset.sidebarCollapsed = sidebarCollapsed
            ? '1'
            : '0';
    }, [sidebarCollapsed]);

    const navRef = useRef<HTMLElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const [navHeight, setNavHeight] = useState(0);
    const [pageTitleVisible, setPageTitleVisible] = useState(true);
    const [headerHeading, setHeaderHeading] = useState('');
    const compactTitle = (stickyTitle ?? headerHeading).trim();
    const showCompactTitle = Boolean(header && compactTitle && !pageTitleVisible);

    useEffect(() => {
        const nav = navRef.current;

        if (!nav) {
            return;
        }

        const updateNavHeight = () => {
            setNavHeight(nav.getBoundingClientRect().height);
        };

        updateNavHeight();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateNavHeight);

            return () => window.removeEventListener('resize', updateNavHeight);
        }

        const observer = new ResizeObserver(updateNavHeight);
        observer.observe(nav);

        return () => observer.disconnect();
    }, [showingNavigationDropdown]);

    useEffect(() => {
        const headerElement = headerRef.current;

        if (!headerElement) {
            setHeaderHeading('');
            setPageTitleVisible(true);
            return;
        }

        const titleElement =
            headerElement.querySelector('h2') ?? headerElement;

        setHeaderHeading(titleElement.textContent?.trim() ?? '');

        const updateTitleVisibility = () => {
            const navBottom =
                navRef.current?.getBoundingClientRect().bottom ?? 0;
            const titleBottom = titleElement.getBoundingClientRect().bottom;

            setPageTitleVisible(titleBottom > navBottom + 8);
        };

        updateTitleVisibility();
        window.addEventListener('scroll', updateTitleVisibility, {
            passive: true,
        });
        window.addEventListener('resize', updateTitleVisibility);

        return () => {
            window.removeEventListener('scroll', updateTitleVisibility);
            window.removeEventListener('resize', updateTitleVisibility);
        };
    }, [page.url, stickyTitle]);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }

        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!canManageNotifications) {
            return;
        }

        const { stop } = router.poll(
            notificationPollInterval,
            {
                only: ['auth'],
                async: true,
                showProgress: false,
            },
            {
                keepAlive: false,
                autoStart: true,
            },
        );

        return () => stop();
    }, [canManageNotifications]);

    useEffect(() => {
        if (notifications.unreadCount > previousUnreadCount.current) {
            setShouldShakeBell(true);

            const timeout = window.setTimeout(() => {
                setShouldShakeBell(false);
            }, 1400);

            previousUnreadCount.current = notifications.unreadCount;

            return () => window.clearTimeout(timeout);
        }

        previousUnreadCount.current = notifications.unreadCount;
    }, [notifications.unreadCount]);

    useEffect(() => {
        if (!user || idleTimeoutMinutes <= 0) {
            return;
        }

        const idleTimeoutMs = idleTimeoutMinutes * 60 * 1000;
        const clearIdleTimeout = () => {
            if (idleTimeoutRef.current !== null) {
                window.clearTimeout(idleTimeoutRef.current);
                idleTimeoutRef.current = null;
            }
        };
        const logoutForInactivity = () => {
            if (hasIdleLoggedOut.current) {
                return;
            }

            hasIdleLoggedOut.current = true;
            router.post(route('logout'), undefined, {
                preserveScroll: false,
            });
        };
        const resetIdleTimeout = () => {
            if (hasIdleLoggedOut.current) {
                return;
            }

            clearIdleTimeout();
            idleTimeoutRef.current = window.setTimeout(
                logoutForInactivity,
                idleTimeoutMs,
            );
        };

        resetIdleTimeout();
        idleActivityEvents.forEach((eventName) => {
            window.addEventListener(eventName, resetIdleTimeout, {
                passive: true,
            });
        });
        document.addEventListener('visibilitychange', resetIdleTimeout);

        return () => {
            clearIdleTimeout();
            idleActivityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, resetIdleTimeout);
            });
            document.removeEventListener('visibilitychange', resetIdleTimeout);
        };
    }, [idleTimeoutMinutes, user]);

    const embedded = typeof window !== 'undefined' && window.parent !== window;

    if (embedded) {
        return (
            <div className="min-h-screen bg-muted/30 text-foreground">
                {header ? (
                    <header className="border-b border-border bg-card">
                        <div className={cn('mx-auto w-full px-4 py-4 sm:px-6', !fullWidth && 'max-w-[96rem]')}>
                            {header}
                        </div>
                    </header>
                ) : null}
                <main className="min-w-0">{children}</main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 text-foreground">
            <RevisionAssignmentListener userId={user.id} />
            <TabUnreadBadge />
            {canManageExpenses ? <ExpenseUpdates /> : null}
            {/* Full-height sidebar covering the whole left side (desktop) */}
            <DashboardSidebar
                collapsed={sidebarCollapsed}
                onToggleCollapse={() =>
                    setSidebarCollapsed((value) => !value)
                }
                className={cn(
                    'hidden shrink-0 rounded-none border-y-0 border-l-0 border-r border-[#cfe0d6] shadow-none transition-[width] duration-500 ease-in-out motion-reduce:transition-none lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:overflow-hidden dark:border-white/10',
                    sidebarCollapsed ? 'lg:w-16' : 'lg:w-72 xl:w-80',
                )}
            />

            <div
                className={cn(
                    'flex min-h-screen flex-col transition-[padding] duration-500 ease-in-out motion-reduce:transition-none',
                    sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72 xl:pl-80',
                )}
            >
                {impersonation ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
                        <p>
                            Signed in as {impersonation.name} ({impersonation.email}).
                        </p>
                        <button
                            type="button"
                            className="min-h-11 rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-950 touch-manipulation hover:bg-amber-100"
                            onClick={() => router.delete(route('impersonation.destroy'))}
                        >
                            Return to your account
                        </button>
                    </div>
                ) : null}
                <nav
                    ref={navRef}
                    className="sticky top-0 z-30 border-b border-border bg-background"
                >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center justify-between gap-3 overflow-visible py-2 sm:py-2.5 md:py-3 lg:gap-8">
                        <div className="flex min-w-0 items-center gap-2">
                            {/* Mobile: brand (sidebar is off-canvas here) */}
                            <Link
                                href={route('dashboard')}
                                className="text-base font-bold tracking-tight text-foreground lg:hidden"
                            >
                                Gateway
                            </Link>

                            <div className="hidden gap-6 xl:-my-px xl:flex xl:items-center">
                                <NavLink
                                    href={route('home')}
                                    active={route().current('home')}
                                >
                                    Home
                                </NavLink>

                                <NavLink
                                    href={route('dashboard')}
                                    active={route().current('dashboard')}
                                >
                                    Dashboard
                                </NavLink>

                                <NavLink
                                    href={route('mailbox.index')}
                                    active={route().current('mailbox.*')}
                                    className={
                                        hasUnreadMail
                                            ? ' text-red-600 dark:text-red-400'
                                            : ''
                                    }
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        Email
                                        {hasUnreadMail ? (
                                            <MailOpenIcon className="size-3.5 animate-mail-alert text-red-600 dark:text-red-400" />
                                        ) : null}
                                    </span>
                                </NavLink>

                            </div>
                        </div>

                        <div className="hidden gap-2 lg:ms-6 lg:flex lg:items-center lg:gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openSnapDrawer()}
                                aria-label="Open fast menu"
                                title="Fast menu (⌘K)"
                            >
                                <ZapIcon data-icon="inline-start" />
                                <span className="hidden xl:inline">Fast</span>
                            </Button>
                            <ThemeModeToggle />
                            <div className="flex items-center gap-1.5">
                            {systemUpdatesUnread > 0 && (
                                <Link
                                    href={route('admin.system-updates.index')}
                                    className="relative inline-flex size-9 items-center justify-center rounded-md border border-red-500/50 bg-background text-red-600 shadow-sm shadow-red-500/20 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                    aria-label={`${systemUpdatesUnread} new system updates`}
                                    title={`${systemUpdatesUnread} new system update${systemUpdatesUnread === 1 ? '' : 's'}`}
                                >
                                    <SparklesIcon className="size-4" />
                                    <span className="absolute -right-1 -top-1 flex size-3">
                                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                                        <span className="relative inline-flex size-3 rounded-full bg-red-500 ring-2 ring-background" />
                                    </span>
                                </Link>
                            )}
                            <UnreadMailButton />
                                                        <RevisionAssignmentsMenu />

                            {canManageNotifications && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className={
                                            'relative inline-flex size-9 items-center justify-center rounded-md border bg-background transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ' +
                                            (hasUnreadNotifications
                                                ? 'border-destructive/50 text-destructive shadow-sm shadow-destructive/20'
                                                : 'border-border text-muted-foreground') +
                                            (shouldShakeBell
                                                ? ' animate-bell-shake'
                                                : '')
                                        }
                                        aria-label="Open notifications"
                                    >
                                        <BellIcon className="size-4" />
                                        {hasUnreadNotifications && (
                                            <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.65rem] font-semibold leading-5 text-white ring-2 ring-background">
                                                {notifications.unreadCount}
                                            </span>
                                        )}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-[min(20rem,calc(100vw-2rem))]"
                                >
                                    <DropdownMenuLabel className="flex items-center justify-between gap-3">
                                        Notifications
                                        {hasUnreadNotifications && (
                                            <Badge variant="destructive">
                                                {notifications.unreadCount} new
                                            </Badge>
                                        )}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                        {notifications.latestUnread.length >
                                        0 ? (
                                            notifications.latestUnread.map(
                                                (notification) => (
                                                    <DropdownMenuItem
                                                        key={notification.id}
                                                        asChild
                                                        className="items-start"
                                                    >
                                                        <Link
                                                            href={route(
                                                                'notifications.show',
                                                                notification.id,
                                                            )}
                                                            className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left"
                                                        >
                                                            <MailOpenIcon className="mt-0.5 size-4 text-muted-foreground" />
                                                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                                                <span className="font-medium text-foreground">
                                                                    {
                                                                        notification.title
                                                                    }
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {notification.name ||
                                                                        notification.email ||
                                                                        'New contact'}
                                                                </span>
                                                                {notification.message && (
                                                                    <span className="line-clamp-2 text-xs text-muted-foreground">
                                                                        {
                                                                            notification.message
                                                                        }
                                                                    </span>
                                                                )}
                                                                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                                    Open message
                                                                </span>
                                                            </span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                ),
                                            )
                                        ) : (
                                            <div className="px-2 py-4 text-sm text-muted-foreground">
                                                No unread notifications.
                                            </div>
                                        )}
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link
                                            href={route('notifications.index')}
                                            className="justify-center font-medium"
                                        >
                                            View all notifications
                                        </Link>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            )}
                            <button
                                type="button"
                                onClick={() => setConfirmLogout(true)}
                                className="inline-flex size-9 items-center justify-center rounded-md border border-red-500/50 bg-background text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background dark:text-red-400 dark:hover:bg-red-950/30"
                                aria-label="Log out"
                                title="Log out"
                            >
                                <LogOutIcon className="size-4" />
                            </button>
                            </div>
                        </div>

                        <div className="-me-2 flex items-center gap-2 lg:hidden">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => openSnapDrawer()}
                                aria-label="Open fast menu"
                                title="Fast menu"
                            >
                                <ZapIcon data-icon="inline-start" />
                            </Button>
                            <UnreadMailButton />
                            <RevisionAssignmentsMenu />
                            <button
                                type="button"
                                aria-label="Open menu"
                                aria-expanded={showingNavigationDropdown}
                                onClick={() => setShowingNavigationDropdown(true)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition duration-150 ease-in-out hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground focus:outline-none"
                            >
                                <svg
                                    className="h-6 w-6"
                                    stroke="currentColor"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        className={
                                            !showingNavigationDropdown
                                                ? 'inline-flex'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 6h16M4 12h16M4 18h16"
                                    />
                                    <path
                                        className={
                                            showingNavigationDropdown
                                                ? 'inline-flex'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <DialogPrimitive.Root
                    open={showingNavigationDropdown}
                    onOpenChange={setShowingNavigationDropdown}
                >
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
                        <DialogPrimitive.Content
                            aria-describedby={undefined}
                            className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col gap-3 overscroll-contain bg-background p-3 shadow-xl outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left lg:hidden"
                        >
                            <DialogPrimitive.Title className="sr-only">
                                Main menu
                            </DialogPrimitive.Title>
                            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-3">
                                <UserAvatar
                                    name={user.name}
                                    avatarUrl={user.avatar_url}
                                    initials={user.initials}
                                    className="size-10"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {user.name}
                                    </p>
                                    <Link
                                        href={route('profile.edit')}
                                        onClick={() => setShowingNavigationDropdown(false)}
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        View profile
                                    </Link>
                                </div>
                                <ThemeModeToggle />
                                <DialogPrimitive.Close
                                    aria-label="Close menu"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <XIcon className="size-5" />
                                </DialogPrimitive.Close>
                            </div>
                            <div className="min-h-0 flex-1">
                                <DashboardSidebar
                                    onNavigate={() => setShowingNavigationDropdown(false)}
                                    className="rounded-xl shadow-none"
                                />
                            </div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            </nav>

                <LogoutConfirmDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
                <IncomingAlert />
                {Boolean(auth.can?.manageProjectControl) ? <FollowUpReminders /> : null}

                {/* Main Content Area */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {header && (
                        <header
                            ref={headerRef}
                            className="border-b border-border bg-card shadow-sm"
                        >
                            <div className={cn('mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8', !fullWidth && 'max-w-[96rem]')}>
                                {header}
                            </div>
                        </header>
                    )}

                    {showCompactTitle && (
                        <div
                            data-sticky-page-title
                            className={cn(
                                'fixed left-0 right-0 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur transition-[left] duration-500 ease-in-out motion-reduce:transition-none',
                                sidebarCollapsed
                                    ? 'lg:left-16'
                                    : 'lg:left-72 xl:left-80',
                            )}
                            style={{ top: navHeight }}
                            aria-hidden="true"
                        >
                            <div className={cn('mx-auto w-full px-4 py-3 sm:px-6 lg:px-8', !fullWidth && 'max-w-[96rem]')}>
                                <p className="truncate text-lg font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                                    {compactTitle}
                                </p>
                            </div>
                        </div>
                    )}

                    <main className="relative z-0 min-w-0 flex-1 overflow-x-clip">{children}</main>
                </div>
            </div>

            <DashboardSnapDrawer />
            <InternalChat />
        </div>
    );
}
