import ApplicationLogo from '@/Components/ApplicationLogo';
import DashboardSnapDrawer from '@/Components/DashboardSnapDrawer';
import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import ThemeModeToggle from '@/Components/ThemeModeToggle';
import UserAvatar from '@/Components/UserAvatar';
import { Badge } from '@/Components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { openSnapDrawer } from '@/lib/shortcuts';
import { PageProps } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    ActivityIcon,
    Building2Icon,
    BellIcon,
    BriefcaseIcon,
    ChevronDownIcon,
    ClipboardListIcon,
    FileSpreadsheetIcon,
    HardHatIcon,
    IdCardIcon,
    ListIcon,
    MailOpenIcon,
    PackageIcon,
    PaletteIcon,
    PenLineIcon,
    PlusCircleIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    UserCogIcon,
    UserPlusIcon,
    UsersIcon,
    WrenchIcon,
    ZapIcon,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    PropsWithChildren,
    ReactNode,
    useEffect,
    useRef,
    useState,
} from 'react';

function MobileDisclosure({
    label,
    icon: Icon,
    children,
    defaultOpen = false,
    variant = 'group',
    className,
}: {
    label: string;
    icon?: LucideIcon;
    children: ReactNode;
    defaultOpen?: boolean;
    variant?: 'section' | 'group';
    className?: string;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md py-2 text-left transition hover:bg-muted/50',
                    variant === 'section'
                        ? 'text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
                        : 'text-sm font-semibold text-foreground',
                    className ?? 'px-4',
                )}
            >
                <span className="inline-flex items-center gap-2">
                    {Icon && <Icon className="size-4" />}
                    {label}
                </span>
                <ChevronDownIcon
                    className={cn(
                        'size-4 shrink-0 transition-transform',
                        open && 'rotate-180',
                    )}
                />
            </button>
            {open && <div className="flex flex-col">{children}</div>}
        </div>
    );
}

type AdminResourceLinks = {
    label: string;
    icon: LucideIcon;
    canView?: boolean;
    canCreate?: boolean;
    viewHref?: string;
    createHref?: string;
    viewActive?: boolean;
    createActive?: boolean;
    viewIcon?: LucideIcon;
    createIcon?: LucideIcon;
};

function AdminResourceSubmenu({
    label,
    icon: Icon,
    canView = false,
    canCreate = false,
    viewHref,
    createHref,
    viewIcon: ViewIcon = ListIcon,
    createIcon: CreateIcon = PlusCircleIcon,
}: AdminResourceLinks) {
    if (!canView && !canCreate) {
        return null;
    }

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <Icon className="size-4" />
                {label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-44">
                {canView && viewHref ? (
                    <DropdownMenuItem asChild>
                        <Link
                            href={viewHref}
                            className="flex items-center gap-2"
                        >
                            <ViewIcon className="size-4" />
                            See all
                        </Link>
                    </DropdownMenuItem>
                ) : null}
                {canCreate && createHref ? (
                    <DropdownMenuItem asChild>
                        <Link
                            href={createHref}
                            className="flex items-center gap-2"
                        >
                            <CreateIcon className="size-4" />
                            Add new
                        </Link>
                    </DropdownMenuItem>
                ) : null}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
}

function MobileAdminResource({
    label,
    icon: Icon,
    canView = false,
    canCreate = false,
    viewHref,
    createHref,
    viewActive = false,
    createActive = false,
    viewIcon: ViewIcon = ListIcon,
    createIcon: CreateIcon = PlusCircleIcon,
}: AdminResourceLinks) {
    if (!canView && !canCreate) {
        return null;
    }

    return (
        <MobileDisclosure label={label} icon={Icon} className="ps-10 pe-4">
            {canView && viewHref ? (
                <ResponsiveNavLink
                    href={viewHref}
                    active={viewActive}
                    className="ps-14"
                >
                    <span className="inline-flex items-center gap-2">
                        <ViewIcon className="size-4" />
                        See all
                    </span>
                </ResponsiveNavLink>
            ) : null}
            {canCreate && createHref ? (
                <ResponsiveNavLink
                    href={createHref}
                    active={createActive}
                    className="ps-14"
                >
                    <span className="inline-flex items-center gap-2">
                        <CreateIcon className="size-4" />
                        Add new
                    </span>
                </ResponsiveNavLink>
            ) : null}
        </MobileDisclosure>
    );
}

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
    children,
}: PropsWithChildren<{ header?: ReactNode; stickyTitle?: string }>) {
    const page = usePage<PageProps>();
    const { auth, session, flash } = page.props;
    const user = auth.user;
    const idleTimeoutMinutes = Number(session?.idleTimeoutMinutes ?? 0);
    const canManageUsers = Boolean(auth.can?.manageUsers);
    const canViewUsers = Boolean(auth.can?.viewUsers);
    const canCreateUsers = Boolean(auth.can?.createUsers);
    const canViewUserActivity = Boolean(auth.can?.viewUserActivity);
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
    const canOpenProducts = canViewProducts || canCreateProducts;
    const canOpenServices = canViewServices || canCreateServices;
    const canOpenContractors = canViewContractors || canCreateContractors;
    const canOpenEmployees = canViewEmployees || canCreateEmployees;
    const canOpenWork =
        canOpenProjects ||
        canOpenBids ||
        canOpenQuotations ||
        canOpenProducts ||
        canOpenServices;
    const canOpenPeople =
        canOpenContractors ||
        canOpenEmployees ||
        canManageNotifications;
    const canOpenWorkspace = true;
    const canOpenSecurity =
        canManageUsers || canManageAccess || canViewUserActivity;
    const canOpenAdministration =
        canOpenWork || canOpenPeople || canOpenWorkspace || canOpenSecurity;
    const notifications = auth.notifications;
    const hasUnreadNotifications = notifications.unreadCount > 0;
    const previousUnreadCount = useRef(notifications.unreadCount);
    const idleTimeoutRef = useRef<number | null>(null);
    const hasIdleLoggedOut = useRef(false);
    const [shouldShakeBell, setShouldShakeBell] = useState(false);

    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);
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

    return (
        <div className="min-h-screen bg-muted/30 text-foreground">
            <nav
                ref={navRef}
                className="sticky top-0 z-40 border-b border-border bg-background"
            >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center justify-between gap-3 overflow-visible py-2 sm:py-2.5 md:py-3 lg:gap-8">
                        <div className="flex">
                            <div className="flex shrink-0 items-center">
                                <Link href="/" className="shrink-0">
                                    <ApplicationLogo className="block size-12 sm:size-16 md:size-20 lg:size-24" />
                                </Link>
                            </div>

                            <div className="hidden gap-6 lg:-my-px lg:ms-8 lg:flex lg:items-center">
                                <button
                                    type="button"
                                    onClick={() => openSnapDrawer()}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50/80 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-600"
                                    title="Open shortcuts drawer (⌘K)"
                                >
                                    <ZapIcon className="size-3.5 text-emerald-600 dark:text-emerald-400 group-hover:text-white" />
                                    <span>Shortcuts</span>
                                    <kbd className="rounded bg-emerald-200/50 px-1 py-0.2 text-[10px] font-bold dark:bg-emerald-900/60">
                                        ⌘K
                                    </kbd>
                                </button>

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

                                {canOpenAdministration && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className={
                                                    'inline-flex items-center gap-1 border-b-2 px-1 pt-1 text-sm font-medium leading-5 transition duration-150 ease-in-out focus:outline-none ' +
                                                    (route().current(
                                                        'admin.*',
                                                    )
                                                        ? 'border-emerald-500 text-emerald-700 focus:border-emerald-600 dark:border-emerald-400 dark:text-emerald-300 dark:focus:border-emerald-300'
                                                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground focus:border-border focus:text-foreground')
                                                }
                                            >
                                                <ShieldIcon className="size-4" />
                                                Administration
                                                <ChevronDownIcon className="size-4" />
                                            </button>
                                        </DropdownMenuTrigger>

                                        <DropdownMenuContent
                                            align="start"
                                            sideOffset={2}
                                            className="w-60 max-h-[min(80vh,var(--radix-dropdown-menu-content-available-height,80vh))]"
                                        >
                                            {canOpenWork && (
                                                <>
                                                    <DropdownMenuLabel>
                                                        Operations
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuGroup>
                                                        <AdminResourceSubmenu
                                                            label="Projects"
                                                            icon={BriefcaseIcon}
                                                            canView={canViewProjects}
                                                            canCreate={canCreateProjects}
                                                            viewHref={route(
                                                                'admin.projects.index',
                                                            )}
                                                            createHref={route(
                                                                'admin.projects.create',
                                                            )}
                                                        />
                                                        <AdminResourceSubmenu
                                                            label="Bids"
                                                            icon={ClipboardListIcon}
                                                            canView={canViewBids}
                                                            canCreate={canCreateBids}
                                                            viewHref={route(
                                                                'admin.bids.index',
                                                            )}
                                                            createHref={route(
                                                                'admin.bids.create',
                                                            )}
                                                        />
                                                        <AdminResourceSubmenu
                                                            label="Quotations"
                                                            icon={FileSpreadsheetIcon}
                                                            canView={canViewQuotations}
                                                            canCreate={canCreateQuotations}
                                                            viewHref={route(
                                                                'admin.quotations.index',
                                                            )}
                                                            createHref={route(
                                                                'admin.quotations.create',
                                                            )}
                                                        />
                                                        <AdminResourceSubmenu
                                                            label="Products"
                                                            icon={PackageIcon}
                                                            canView={canViewProducts}
                                                            canCreate={canCreateProducts}
                                                            viewHref={route(
                                                                'admin.products.index',
                                                            )}
                                                            createHref={route(
                                                                'admin.products.create',
                                                            )}
                                                        />
                                                        <AdminResourceSubmenu
                                                            label="Services"
                                                            icon={WrenchIcon}
                                                            canView={canViewServices}
                                                            canCreate={canCreateServices}
                                                            viewHref={route(
                                                                'admin.services.index',
                                                            )}
                                                            createHref={route(
                                                                'admin.services.create',
                                                            )}
                                                        />
                                                    </DropdownMenuGroup>
                                                </>
                                            )}

                                            {canOpenWork &&
                                                (canOpenPeople ||
                                                    canOpenWorkspace ||
                                                    canOpenSecurity) && (
                                                    <DropdownMenuSeparator />
                                                )}

                                            {canOpenPeople && (
                                                <>
                                                    <DropdownMenuLabel>
                                                        People
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuGroup>
                                                        <AdminResourceSubmenu
                                                            label="Contractors"
                                                            icon={HardHatIcon}
                                                            canView={canViewContractors}
                                                            canCreate={canCreateContractors}
                                                            viewHref={route(
                                                                'admin.contractors.index',
                                                            )}
                                                            createHref={route(
                                                                'admin.contractors.create',
                                                            )}
                                                        />
                                                        {canManageNotifications && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.contacts.index',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <MailOpenIcon className="size-4" />
                                                                    Contacts
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <AdminResourceSubmenu
                                                            label="Employees"
                                                            icon={IdCardIcon}
                                                            canView={canViewEmployees}
                                                            canCreate={canCreateEmployees}
                                                            viewHref={route(
                                                                'admin.employees.index',
                                                            )}
                                                            createHref={route(
                                                                'admin.employees.create',
                                                            )}
                                                            viewIcon={UsersIcon}
                                                            createIcon={UserPlusIcon}
                                                        />
                                                    </DropdownMenuGroup>
                                                </>
                                            )}

                                            {canOpenPeople &&
                                                (canOpenWorkspace ||
                                                    canOpenSecurity) && (
                                                    <DropdownMenuSeparator />
                                                )}

                                            {canOpenWorkspace && (
                                                <>
                                                    <DropdownMenuLabel>
                                                        Company
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuGroup>
                                                        <DropdownMenuItem
                                                            asChild
                                                        >
                                                            <Link
                                                                href={route(
                                                                    'admin.signature.edit',
                                                                )}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <PenLineIcon className="size-4" />
                                                                Signature
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        {canManageOwnAccount && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.account.edit',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <UserCogIcon className="size-4" />
                                                                    Account
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canViewCompany && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.company.show',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <Building2Icon className="size-4" />
                                                                    Company
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canManageDocumentColors && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.document-settings.edit',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <PaletteIcon className="size-4" />
                                                                    Document
                                                                    colors
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuGroup>
                                                </>
                                            )}

                                            {canOpenWorkspace &&
                                                canOpenSecurity && (
                                                    <DropdownMenuSeparator />
                                                )}

                                            {canOpenSecurity && (
                                                <>
                                                    <DropdownMenuLabel>
                                                        Security
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuGroup>
                                                        {canViewUsers && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.users.index',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <UsersIcon className="size-4" />
                                                                    Users
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canCreateUsers && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.users.create',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <UserPlusIcon className="size-4" />
                                                                    Add user
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canManageAccess && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.access-control.edit',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <SlidersHorizontalIcon className="size-4" />
                                                                    Access
                                                                    control
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canViewUserActivity && (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.user-activities.index',
                                                                    )}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <ActivityIcon className="size-4" />
                                                                    User
                                                                    activity
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuGroup>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>

                        <div className="hidden gap-2 lg:ms-6 lg:flex lg:items-center lg:gap-4">
                            <button
                                type="button"
                                onClick={() => openSnapDrawer()}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-emerald-500/40 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                                title="Dashboard shortcuts (⌘K)"
                                aria-label="Open shortcuts drawer"
                            >
                                <ZapIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="hidden xl:inline">Shortcuts</span>
                                <kbd className="hidden rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground sm:inline-block">
                                    ⌘K
                                </kbd>
                            </button>

                            <ThemeModeToggle />

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

                            <div className="relative ms-3">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-full">
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 rounded-full p-0.5 text-muted-foreground transition duration-150 ease-in-out hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                                                aria-label="Open user menu"
                                            >
                                                <UserAvatar
                                                    name={user.name}
                                                    avatarUrl={user.avatar_url}
                                                    initials={user.initials}
                                                />
                                                <ChevronDownIcon className="size-4" />
                                            </button>
                                        </span>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <Dropdown.Link
                                            href={route('profile.edit')}
                                        >
                                            Profile
                                        </Dropdown.Link>
                                        <Dropdown.Link
                                            href={route(
                                                'admin.signature.edit',
                                            )}
                                        >
                                            Signature
                                        </Dropdown.Link>
                                        <Dropdown.Link
                                            href={route('logout')}
                                            method="post"
                                            as="button"
                                        >
                                            Log Out
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>
                        </div>

                        <div className="-me-2 flex items-center lg:hidden">
                            <button
                                onClick={() =>
                                    setShowingNavigationDropdown(
                                        (previousState) => !previousState,
                                    )
                                }
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

                <div
                    className={
                        (showingNavigationDropdown ? 'block' : 'hidden') +
                        ' lg:hidden'
                    }
                >
                    <div className="flex flex-col gap-1 pb-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowingNavigationDropdown(false);
                                openSnapDrawer();
                            }}
                            className="mx-4 mb-2 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-50/50 px-3 py-2 text-left text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                            <span className="inline-flex items-center gap-2">
                                <ZapIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                                Shortcuts Drawer
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                                ⌘K
                            </Badge>
                        </button>

                        <ResponsiveNavLink
                            href={route('home')}
                            active={route().current('home')}
                        >
                            Home
                        </ResponsiveNavLink>

                        <ResponsiveNavLink
                            href={route('dashboard')}
                            active={route().current('dashboard')}
                        >
                            Dashboard
                        </ResponsiveNavLink>

                        {canOpenAdministration && (
                            <div className="mt-2 border-t border-border pt-3">
                                <MobileDisclosure
                                    label="Administration"
                                    variant="section"
                                    defaultOpen
                                >
                                    {canOpenWork && (
                                        <MobileDisclosure
                                            label="Operations"
                                            icon={BriefcaseIcon}
                                            className="ps-6 pe-4"
                                        >
                                            <MobileAdminResource
                                                label="Projects"
                                                icon={BriefcaseIcon}
                                                canView={canViewProjects}
                                                canCreate={canCreateProjects}
                                                viewHref={route(
                                                    'admin.projects.index',
                                                )}
                                                createHref={route(
                                                    'admin.projects.create',
                                                )}
                                                viewActive={route().current(
                                                    'admin.projects.index',
                                                )}
                                                createActive={route().current(
                                                    'admin.projects.create',
                                                )}
                                            />
                                            <MobileAdminResource
                                                label="Bids"
                                                icon={ClipboardListIcon}
                                                canView={canViewBids}
                                                canCreate={canCreateBids}
                                                viewHref={route(
                                                    'admin.bids.index',
                                                )}
                                                createHref={route(
                                                    'admin.bids.create',
                                                )}
                                                viewActive={route().current(
                                                    'admin.bids.index',
                                                )}
                                                createActive={route().current(
                                                    'admin.bids.create',
                                                )}
                                            />
                                            <MobileAdminResource
                                                label="Quotations"
                                                icon={FileSpreadsheetIcon}
                                                canView={canViewQuotations}
                                                canCreate={canCreateQuotations}
                                                viewHref={route(
                                                    'admin.quotations.index',
                                                )}
                                                createHref={route(
                                                    'admin.quotations.create',
                                                )}
                                                viewActive={route().current(
                                                    'admin.quotations.index',
                                                )}
                                                createActive={route().current(
                                                    'admin.quotations.create',
                                                )}
                                            />
                                            <MobileAdminResource
                                                label="Products"
                                                icon={PackageIcon}
                                                canView={canViewProducts}
                                                canCreate={canCreateProducts}
                                                viewHref={route(
                                                    'admin.products.index',
                                                )}
                                                createHref={route(
                                                    'admin.products.create',
                                                )}
                                                viewActive={route().current(
                                                    'admin.products.index',
                                                )}
                                                createActive={route().current(
                                                    'admin.products.create',
                                                )}
                                            />
                                            <MobileAdminResource
                                                label="Services"
                                                icon={WrenchIcon}
                                                canView={canViewServices}
                                                canCreate={canCreateServices}
                                                viewHref={route(
                                                    'admin.services.index',
                                                )}
                                                createHref={route(
                                                    'admin.services.create',
                                                )}
                                                viewActive={route().current(
                                                    'admin.services.index',
                                                )}
                                                createActive={route().current(
                                                    'admin.services.create',
                                                )}
                                            />
                                        </MobileDisclosure>
                                    )}

                                    {canOpenPeople && (
                                        <MobileDisclosure
                                            label="People"
                                            icon={UsersIcon}
                                            className="ps-6 pe-4"
                                        >
                                            <MobileAdminResource
                                                label="Contractors"
                                                icon={HardHatIcon}
                                                canView={canViewContractors}
                                                canCreate={canCreateContractors}
                                                viewHref={route(
                                                    'admin.contractors.index',
                                                )}
                                                createHref={route(
                                                    'admin.contractors.create',
                                                )}
                                                viewActive={route().current(
                                                    'admin.contractors.index',
                                                )}
                                                createActive={route().current(
                                                    'admin.contractors.create',
                                                )}
                                            />
                                            {canManageNotifications && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.contacts.index',
                                                    )}
                                                    active={route().current(
                                                        'admin.contacts.index',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <MailOpenIcon className="size-4" />
                                                        Contacts
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                            <MobileAdminResource
                                                label="Employees"
                                                icon={IdCardIcon}
                                                canView={canViewEmployees}
                                                canCreate={canCreateEmployees}
                                                viewHref={route(
                                                    'admin.employees.index',
                                                )}
                                                createHref={route(
                                                    'admin.employees.create',
                                                )}
                                                viewActive={route().current(
                                                    'admin.employees.index',
                                                )}
                                                createActive={route().current(
                                                    'admin.employees.create',
                                                )}
                                                viewIcon={UsersIcon}
                                                createIcon={UserPlusIcon}
                                            />
                                        </MobileDisclosure>
                                    )}

                                    {canOpenWorkspace && (
                                        <MobileDisclosure
                                            label="Company"
                                            icon={Building2Icon}
                                            className="ps-6 pe-4"
                                        >
                                            <ResponsiveNavLink
                                                href={route(
                                                    'admin.signature.edit',
                                                )}
                                                active={route().current(
                                                    'admin.signature.edit',
                                                )}
                                                className="ps-10"
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <PenLineIcon className="size-4" />
                                                    Signature
                                                </span>
                                            </ResponsiveNavLink>
                                            {canManageOwnAccount && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.account.edit',
                                                    )}
                                                    active={route().current(
                                                        'admin.account.edit',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <UserCogIcon className="size-4" />
                                                        Account
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                            {canViewCompany && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.company.show',
                                                    )}
                                                    active={route().current(
                                                        'admin.company.show',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <Building2Icon className="size-4" />
                                                        Company
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                            {canManageDocumentColors && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.document-settings.edit',
                                                    )}
                                                    active={route().current(
                                                        'admin.document-settings.*',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <PaletteIcon className="size-4" />
                                                        Document colors
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                        </MobileDisclosure>
                                    )}

                                    {canOpenSecurity && (
                                        <MobileDisclosure
                                            label="Security"
                                            icon={ShieldIcon}
                                            className="ps-6 pe-4"
                                        >
                                            {canViewUsers && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.users.index',
                                                    )}
                                                    active={route().current(
                                                        'admin.users.index',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <UsersIcon className="size-4" />
                                                        Users
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                            {canCreateUsers && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.users.create',
                                                    )}
                                                    active={route().current(
                                                        'admin.users.create',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <UserPlusIcon className="size-4" />
                                                        Add user
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                            {canManageAccess && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.access-control.edit',
                                                    )}
                                                    active={route().current(
                                                        'admin.access-control.edit',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <SlidersHorizontalIcon className="size-4" />
                                                        Access control
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                            {canViewUserActivity && (
                                                <ResponsiveNavLink
                                                    href={route(
                                                        'admin.user-activities.index',
                                                    )}
                                                    active={route().current(
                                                        'admin.user-activities.*',
                                                    )}
                                                    className="ps-10"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <ActivityIcon className="size-4" />
                                                        User activity
                                                    </span>
                                                </ResponsiveNavLink>
                                            )}
                                        </MobileDisclosure>
                                    )}
                                </MobileDisclosure>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border pb-1 pt-4">
                        <div className="px-4 pb-4">
                            <ThemeModeToggle />
                        </div>

                        {canManageNotifications && (
                        <div className="border-b border-border px-4 pb-4">
                            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
                                <span>Notifications</span>
                                {hasUnreadNotifications && (
                                    <Badge variant="destructive">
                                        {notifications.unreadCount} new
                                    </Badge>
                                )}
                            </div>
                            {notifications.latestUnread.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {notifications.latestUnread.map(
                                        (notification) => (
                                            <Link
                                                key={notification.id}
                                                href={route(
                                                    'notifications.show',
                                                    notification.id,
                                                )}
                                                className="rounded-md border border-border bg-background px-3 py-2 text-left text-sm"
                                            >
                                                <span className="block font-medium text-foreground">
                                                    {notification.title}
                                                </span>
                                                <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                                                    {notification.message ||
                                                        notification.email ||
                                                        'New contact message'}
                                                </span>
                                            </Link>
                                        ),
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No unread notifications.
                                </p>
                            )}
                            <Link
                                href={route('notifications.index')}
                                className="mt-3 block rounded-md border border-border px-3 py-2 text-center text-sm font-medium text-foreground"
                            >
                                View all notifications
                            </Link>
                        </div>
                        )}

                        <div className="flex items-center gap-3 px-4">
                            <UserAvatar
                                name={user.name}
                                avatarUrl={user.avatar_url}
                                initials={user.initials}
                                className="size-10"
                            />
                            <div>
                                <div className="text-base font-medium text-foreground">
                                    {user.name}
                                </div>
                                <div className="text-sm font-medium text-muted-foreground">
                                    {user.email}
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-1">
                            <ResponsiveNavLink href={route('profile.edit')}>
                                Profile
                            </ResponsiveNavLink>
                            <ResponsiveNavLink
                                href={route('admin.signature.edit')}
                            >
                                Signature
                            </ResponsiveNavLink>
                            <ResponsiveNavLink
                                method="post"
                                href={route('logout')}
                                as="button"
                            >
                                Log Out
                            </ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {header && (
                <header
                    ref={headerRef}
                    className="border-b border-border bg-card shadow-sm"
                >
                    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                        {header}
                    </div>
                </header>
            )}

            {showCompactTitle && (
                <div
                    className="fixed left-0 right-0 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur"
                    style={{ top: navHeight }}
                    aria-hidden="true"
                >
                    <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
                        <p className="truncate text-lg font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            {compactTitle}
                        </p>
                    </div>
                </div>
            )}

            <main className="relative z-0 min-w-0 overflow-x-clip">{children}</main>

            <DashboardSnapDrawer />
        </div>
    );
}
