import ApplicationLogo from '@/Components/ApplicationLogo';
import UserAvatar from '@/Components/UserAvatar';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    ActivityIcon,
    BriefcaseIcon,
    Building2Icon,
    CalendarClockIcon,
    CalendarDaysIcon,
    ClipboardListIcon,
    ClockIcon,
    FileSpreadsheetIcon,
    HardHatIcon,
    IdCardIcon,
    LayoutDashboardIcon,
    LockKeyholeIcon,
    LogOutIcon,
    PackageIcon,
    PaletteIcon,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
    ShieldCheckIcon,
    UserCogIcon,
    UsersIcon,
    WrenchIcon,
    type LucideIcon,
} from 'lucide-react';


type NavItem = {
    title: string;
    href: string;
    icon: LucideIcon;
    active?: boolean;
    badge?: string | number;
    badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
};

type NavGroup = {
    label: string;
    items: NavItem[];
};

const formatLastLogin = (value?: string | null) => {
    if (!value) {
        return 'Never';
    }

    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    } catch {
        return value;
    }
};

export default function DashboardSidebar({
    className,
    onNavigate,
    onToggleCollapse,
    collapsed = false,
}: {
    className?: string;
    onNavigate?: () => void;
    onToggleCollapse?: () => void;
    collapsed?: boolean;
}) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const can = auth.can ?? {};


    const canViewProjects = Boolean(can.viewProjects);
    const canViewBids = Boolean(can.viewBids);
    const canViewQuotations = Boolean(can.viewQuotations);
    const canViewProducts = Boolean(can.viewProducts);
    const canViewServices = Boolean(can.viewServices);
    const canViewContractors = Boolean(can.viewContractors);
    const canViewEmployees = Boolean(can.viewEmployees);
    const canViewUsers = Boolean(can.viewUsers);
    const canManageAccess = Boolean(can.manageAccess);
    const canViewUserActivity = Boolean(can.viewUserActivity);
    const canViewCompany = Boolean(can.viewCompany);
    const canManageDocumentColors = Boolean(can.manageDocumentColors);

    const isRouteActive = (patterns: string | string[]) => {
        if (Array.isArray(patterns)) {
            return patterns.some((pattern) => Boolean(route().current(pattern)));
        }

        return Boolean(route().current(patterns));
    };

    const navigationGroups: NavGroup[] = [
        {
            label: 'Overview',
            items: [
                {
                    title: 'Dashboard',
                    href: route('dashboard'),
                    icon: LayoutDashboardIcon,
                    active: isRouteActive('dashboard'),
                },
            ],
        },
        {
            label: 'Work',
            items: [
                ...(canViewProjects
                    ? [
                          {
                              title: 'Projects',
                              href: route('admin.projects.index'),
                              icon: BriefcaseIcon,
                              active: isRouteActive('admin.projects.*'),
                          },
                      ]
                    : []),
                ...(canViewBids
                    ? [
                          {
                              title: 'Bids',
                              href: route('admin.bids.index'),
                              icon: ClipboardListIcon,
                              active: isRouteActive('admin.bids.*'),
                          },
                      ]
                    : []),
                ...(canViewQuotations
                    ? [
                          {
                              title: 'Quotations',
                              href: route('admin.quotations.index'),
                              icon: FileSpreadsheetIcon,
                              active: isRouteActive('admin.quotations.*'),
                          },
                      ]
                    : []),
            ],
        },
        {
            label: 'Catalog',
            items: [
                ...(canViewProducts
                    ? [
                          {
                              title: 'Products',
                              href: route('admin.products.index'),
                              icon: PackageIcon,
                              active: isRouteActive('admin.products.*'),
                          },
                      ]
                    : []),
                ...(canViewServices
                    ? [
                          {
                              title: 'Services',
                              href: route('admin.services.index'),
                              icon: WrenchIcon,
                              active: isRouteActive('admin.services.*'),
                          },
                      ]
                    : []),
            ],
        },
        {
            label: 'People',
            items: [
                ...(canViewContractors
                    ? [
                          {
                              title: 'Contractors',
                              href: route('admin.contractors.index'),
                              icon: HardHatIcon,
                              active: isRouteActive('admin.contractors.*'),
                          },
                      ]
                    : []),
                {
                    title: 'Contacts',
                    href: route('admin.contacts.index'),
                    icon: IdCardIcon,
                    active: isRouteActive('admin.contacts.*'),
                },
                ...(canViewEmployees
                    ? [
                          {
                              title: 'Employees',
                              href: route('admin.employees.index'),
                              icon: UsersIcon,
                              active: isRouteActive('admin.employees.*'),
                          },
                          {
                              title: 'Attendance',
                              href: route('admin.employee-attendance.index'),
                              icon: CalendarDaysIcon,
                              active: isRouteActive(
                                  'admin.employee-attendance.*',
                              ),
                          },
                          {
                              title: 'Work Schedule',
                              href: route('admin.employee-schedules.index'),
                              icon: CalendarClockIcon,
                              active: isRouteActive(
                                  'admin.employee-schedules.*',
                              ),
                          },
                      ]
                    : []),
            ],
        },
        {
            label: 'Administration',
            items: [
                ...(canViewUsers
                    ? [
                          {
                              title: 'User Management',
                              href: route('admin.users.index'),
                              icon: UserCogIcon,
                              active: isRouteActive('admin.users.*'),
                          },
                      ]
                    : []),
                ...(canManageAccess
                    ? [
                          {
                              title: 'Access Control',
                              href: route('admin.access-control.edit'),
                              icon: LockKeyholeIcon,
                              active: isRouteActive('admin.access-control.*'),
                          },
                      ]
                    : []),
                ...(canViewUserActivity
                    ? [
                          {
                              title: 'Activity Audit',
                              href: route('admin.user-activities.index'),
                              icon: ActivityIcon,
                              active: isRouteActive('admin.user-activities.*'),
                          },
                      ]
                    : []),
                ...(canViewCompany
                    ? [
                          {
                              title: 'Company Settings',
                              href: route('admin.company.show'),
                              icon: Building2Icon,
                              active: isRouteActive('admin.company.*'),
                          },
                      ]
                    : []),
                ...(canManageDocumentColors
                    ? [
                          {
                              title: 'Print layouts',
                              href: route('admin.document-settings.edit'),
                              icon: PaletteIcon,
                              active: isRouteActive(
                                  'admin.document-settings.*',
                              ),
                          },
                      ]
                    : []),
            ],
        },
        {
            label: 'Account',
            items: [
                {
                    title: 'Account & Profile',
                    href: route('profile.edit'),
                    icon: UserCogIcon,
                    active: isRouteActive('profile.*'),
                },
                {
                    title: 'Themes',
                    href: route('appearance.edit'),
                    icon: PaletteIcon,
                    active: isRouteActive('appearance.edit'),
                },
            ],
        },
    ].filter((group) => group.items.length > 0);

    const displayLevel = user.level?.name ?? 'Standard Access';

    return (
        <aside
            className={cn(
                'flex h-full w-full flex-col justify-between overflow-y-auto rounded-2xl border border-border bg-card shadow-sm transition-all duration-300',
                collapsed ? 'p-2' : 'p-4 sm:p-5',
                className,
            )}
        >
            <div className="flex flex-col gap-5">
                {/* Brand / Logo Header */}
                <div
                    className={cn(
                        'flex items-center border-b border-border pb-4',
                        collapsed ? 'justify-center' : 'gap-3',
                    )}
                >
                    <Link
                        href={route('dashboard')}
                        onClick={onNavigate}
                        className={cn(
                            'flex items-center transition hover:opacity-90',
                            collapsed ? 'justify-center' : 'gap-2.5',
                        )}
                        title={collapsed ? 'Gateway Workspace' : undefined}
                    >
                        <ApplicationLogo
                            className={cn(
                                'bg-background',
                                collapsed ? 'size-12' : 'size-16',
                            )}
                        />
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-base font-bold tracking-tight text-foreground">
                                    Gateway
                                </span>
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                    Workspace
                                </span>
                            </div>
                        )}
                    </Link>
                </div>

                {/* Logged User Info Card */}
                {collapsed ? (
                    <div className="flex justify-center" title={user.name}>
                        <UserAvatar
                            name={user.name}
                            avatarUrl={user.avatar_url}
                            initials={user.initials}
                            className="size-10 ring-2 dash-ring"
                        />
                    </div>
                ) : (
                    <div className="dash-soft dash-border rounded-xl border p-3.5">
                        <div className="flex items-start gap-3">
                            <UserAvatar
                                name={user.name}
                                avatarUrl={user.avatar_url}
                                initials={user.initials}
                                className="size-10 ring-2 dash-ring"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">
                                    {user.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {user.email}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <Badge
                                        variant="outline"
                                        className="dash-border dash-text border bg-white/80 text-[10px] dark:bg-background/70"
                                    >
                                        <ShieldCheckIcon className="dash-icon mr-1 size-3" />
                                        {displayLevel}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Last Login Info Box */}
                        <div className="dash-border mt-3 flex items-center gap-1.5 rounded-lg border bg-white/70 px-2.5 py-1.5 text-xs text-muted-foreground dark:bg-background/60">
                            <ClockIcon className="dash-icon size-3.5 shrink-0" />
                            <div className="min-w-0 flex-1 truncate">
                                <span className="font-medium text-foreground">
                                    Last login:
                                </span>{' '}
                                <span className="dash-text font-semibold">
                                    {formatLastLogin(user.last_login_at)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Sections */}
                <nav className="flex flex-col gap-5">
                    {navigationGroups.map((group, index) => (
                        <div
                            key={group.label}
                            className={cn(
                                'flex flex-col gap-1.5',
                                collapsed &&
                                    index > 0 &&
                                    'border-t border-border pt-3',
                            )}
                        >
                            {!collapsed && (
                                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                                    {group.label}
                                </p>
                            )}
                            <div className="flex flex-col gap-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = item.active;

                                    return (
                                        <Link
                                            key={item.title}
                                            href={item.href}
                                            onClick={onNavigate}
                                            title={
                                                collapsed ? item.title : undefined
                                            }
                                            className={cn(
                                                'group flex items-center rounded-lg py-2 text-sm font-medium transition',
                                                collapsed
                                                    ? 'justify-center px-0'
                                                    : 'justify-between px-2.5',
                                                isActive
                                                    ? 'dash-accent shadow-sm'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    'flex min-w-0 items-center',
                                                    !collapsed && 'gap-2.5',
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'size-4 shrink-0 transition',
                                                        isActive
                                                            ? 'text-white'
                                                            : 'text-muted-foreground group-hover:text-foreground',
                                                    )}
                                                />
                                                {!collapsed && (
                                                    <span className="truncate">
                                                        {item.title}
                                                    </span>
                                                )}
                                            </div>
                                            {!collapsed && item.badge && (
                                                <Badge
                                                    variant={
                                                        isActive
                                                            ? 'secondary'
                                                            : item.badgeVariant ??
                                                              'outline'
                                                    }
                                                    className="ml-auto text-[10px]"
                                                >
                                                    {item.badge}
                                                </Badge>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            {/* Bottom Actions & User Account */}
            <div className="sticky bottom-0 mt-6 flex flex-col gap-2 border-t border-border bg-card pt-4">
                {/* Log out */}
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'w-full text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40',
                        collapsed ? 'justify-center px-0' : 'justify-start',
                    )}
                >
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        onClick={onNavigate}
                        title={collapsed ? 'Log out' : undefined}
                    >
                        <LogOutIcon
                            className={cn('size-3.5', !collapsed && 'mr-2')}
                        />
                        {!collapsed && 'Log out'}
                    </Link>
                </Button>

                {/* Show/Hide sidebar toggle (desktop) */}
                {onToggleCollapse && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onToggleCollapse}
                        title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
                        className={cn(
                            'mt-1 w-full text-xs text-muted-foreground hover:text-foreground',
                            collapsed ? 'justify-center px-0' : 'justify-start gap-2',
                        )}
                    >
                        {collapsed ? (
                            <PanelLeftOpenIcon className="size-3.5" />
                        ) : (
                            <>
                                <PanelLeftCloseIcon className="size-3.5" />
                                Hide sidebar
                            </>
                        )}
                    </Button>
                )}
            </div>
        </aside>
    );
}
