import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
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
    ActivityIcon,
    ArrowRightIcon,
    BellIcon,
    Building2Icon,
    ChevronRightIcon,
    ClipboardListIcon,
    FileSpreadsheetIcon,
    HardHatIcon,
    IdCardIcon,
    LayoutDashboardIcon,
    MailOpenIcon,
    PackageIcon,
    PaletteIcon,
    PenLineIcon,
    PlusCircleIcon,
    PlusIcon,
    SearchIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    SparklesIcon,
    UserCheckIcon,
    UserCogIcon,
    UsersIcon,
    WrenchIcon,
    XIcon,
    ZapIcon,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ShortcutCategory = 'all' | 'create' | 'work' | 'directory' | 'workspace';

type ShortcutItem = {
    id: string;
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    category: 'create' | 'work' | 'directory' | 'workspace';
    badge?: string;
    keywords?: string[];
    isCreateAction?: boolean;
    quickAddHref?: string;
    quickAddTitle?: string;
    visible: boolean;
};

type DashboardSnapDrawerProps = {
    showFloatingTrigger?: boolean;
};

export default function DashboardSnapDrawer({
    showFloatingTrigger = true,
}: DashboardSnapDrawerProps) {
    const { auth } = usePage<PageProps>().props;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] =
        useState<ShortcutCategory>('all');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const canManageUsers = Boolean(auth?.can?.manageUsers);
    const canViewUsers = Boolean(auth?.can?.viewUsers);
    const canCreateUsers = Boolean(auth?.can?.createUsers);
    const canManageDocumentColors = Boolean(auth?.can?.manageDocumentColors);
    const canManageAccess = Boolean(auth?.can?.manageAccess);
    const canManageNotifications = Boolean(auth?.can?.manageNotifications);
    const canViewCompany = Boolean(auth?.can?.viewCompany);
    const canViewProjects = Boolean(auth?.can?.viewProjects);
    const canCreateProjects = Boolean(auth?.can?.createProjects);
    const canViewBids = Boolean(auth?.can?.viewBids);
    const canCreateBids = Boolean(auth?.can?.createBids);
    const canViewQuotations = Boolean(auth?.can?.viewQuotations);
    const canCreateQuotations = Boolean(auth?.can?.createQuotations);
    const canViewProducts = Boolean(auth?.can?.viewProducts);
    const canCreateProducts = Boolean(auth?.can?.createProducts);
    const canViewServices = Boolean(auth?.can?.viewServices);
    const canCreateServices = Boolean(auth?.can?.createServices);
    const canViewContractors = Boolean(auth?.can?.viewContractors);
    const canCreateContractors = Boolean(auth?.can?.createContractors);
    const canViewEmployees = Boolean(auth?.can?.viewEmployees);
    const canCreateEmployees = Boolean(auth?.can?.createEmployees);
    const canViewUserActivity = Boolean(auth?.can?.viewUserActivity);
    const notifications = auth?.notifications;
    const unreadCount = notifications?.unreadCount ?? 0;

    const shortcuts: ShortcutItem[] = useMemo(
        () => [
            // Quick Create Actions
            {
                id: 'create-quotation',
                title: 'New Quotation',
                description: 'Start a new customer quote with line items and custom pricing.',
                href: route('admin.quotations.create'),
                icon: PlusCircleIcon,
                category: 'create',
                badge: 'Create',
                keywords: ['quote', 'pricing', 'estimate', 'line items', 'price', 'bid'],
                isCreateAction: true,
                visible: canCreateQuotations,
            },
            {
                id: 'create-bid',
                title: 'New Bid Proposal',
                description: 'Draft a commercial bid with specification scope and clauses.',
                href: route('admin.bids.create'),
                icon: PlusCircleIcon,
                category: 'create',
                badge: 'Create',
                keywords: ['bid', 'proposal', 'commercial', 'scope', 'contract'],
                isCreateAction: true,
                visible: canCreateBids,
            },
            {
                id: 'create-project',
                title: 'New Project',
                description: 'Register a project site address, general contractor, and schedule.',
                href: route('admin.projects.create'),
                icon: PlusCircleIcon,
                category: 'create',
                badge: 'Create',
                keywords: ['project', 'site', 'address', 'general contractor', 'job'],
                isCreateAction: true,
                visible: canCreateProjects,
            },
            {
                id: 'create-product',
                title: 'New Product',
                description: 'Add a door, frame, hardware item, or material to the catalog.',
                href: route('admin.products.create'),
                icon: PlusCircleIcon,
                category: 'create',
                badge: 'Create',
                keywords: ['product', 'door', 'frame', 'hardware', 'material', 'item'],
                isCreateAction: true,
                visible: canCreateProducts,
            },
            {
                id: 'create-contractor',
                title: 'New Contractor',
                description: 'Add a partner contractor company and estimator contacts.',
                href: route('admin.contractors.create'),
                icon: PlusCircleIcon,
                category: 'create',
                badge: 'Create',
                keywords: ['contractor', 'partner', 'company', 'estimator', 'gc'],
                isCreateAction: true,
                visible: canCreateContractors,
            },
            {
                id: 'create-user',
                title: 'Invite Teammate',
                description: 'Add an authorized user with custom roles and permission levels.',
                href: route('admin.users.create'),
                icon: PlusCircleIcon,
                category: 'create',
                badge: 'Create',
                keywords: ['user', 'invite', 'team', 'staff', 'role', 'account'],
                isCreateAction: true,
                visible: canCreateUsers,
            },

            // Work & Documents
            {
                id: 'work-quotations',
                title: 'Quotations',
                description: 'Search, review, export to PDF/Word, and convert quotes to bids.',
                href: route('admin.quotations.index'),
                icon: FileSpreadsheetIcon,
                category: 'work',
                badge: 'Quotes',
                keywords: ['quotations', 'quotes', 'pdf', 'word', 'export', 'pricing'],
                quickAddHref: canCreateQuotations ? route('admin.quotations.create') : undefined,
                quickAddTitle: 'Add quote',
                visible: canViewQuotations || canCreateQuotations,
            },
            {
                id: 'work-bids',
                title: 'Bids & Proposals',
                description: 'Manage active bidding proposals, revisions, and status tracking.',
                href: route('admin.bids.index'),
                icon: ClipboardListIcon,
                category: 'work',
                badge: 'Bids',
                keywords: ['bids', 'proposals', 'revisions', 'commercial', 'pricing'],
                quickAddHref: canCreateBids ? route('admin.bids.create') : undefined,
                quickAddTitle: 'Add bid',
                visible: canViewBids || canCreateBids,
            },
            {
                id: 'work-projects',
                title: 'Projects',
                description: 'Track commercial job sites, contractor relations, and status.',
                href: route('admin.projects.index'),
                icon: Building2Icon,
                category: 'work',
                badge: 'Projects',
                keywords: ['projects', 'sites', 'contractors', 'jobs', 'locations'],
                quickAddHref: canCreateProjects ? route('admin.projects.create') : undefined,
                quickAddTitle: 'Add project',
                visible: canViewProjects || canCreateProjects,
            },
            {
                id: 'work-products',
                title: 'Products Catalog',
                description: 'Door models, frame construction, hardware specs, and pricing.',
                href: route('admin.products.index'),
                icon: PackageIcon,
                category: 'work',
                badge: 'Catalog',
                keywords: ['products', 'catalog', 'doors', 'frames', 'hardware'],
                quickAddHref: canCreateProducts ? route('admin.products.create') : undefined,
                quickAddTitle: 'Add product',
                visible: canViewProducts || canCreateProducts,
            },
            {
                id: 'work-services',
                title: 'Services & Divisions',
                description: 'Commercial installation, SCIF rooms, RF shielding, and field works.',
                href: route('admin.services.index'),
                icon: WrenchIcon,
                category: 'work',
                badge: 'Services',
                keywords: ['services', 'installation', 'scif', 'shielding', 'fieldwork'],
                quickAddHref: canCreateServices ? route('admin.services.create') : undefined,
                quickAddTitle: 'Add service',
                visible: canViewServices || canCreateServices,
            },

            // Directory & Team
            {
                id: 'dir-contractors',
                title: 'Contractors Directory',
                description: 'General contractors, site superintendents, and contact details.',
                href: route('admin.contractors.index'),
                icon: HardHatIcon,
                category: 'directory',
                badge: 'Contractors',
                keywords: ['contractors', 'directory', 'builders', 'clients', 'contacts'],
                quickAddHref: canCreateContractors ? route('admin.contractors.create') : undefined,
                quickAddTitle: 'Add contractor',
                visible: canViewContractors || canCreateContractors,
            },
            {
                id: 'dir-employees',
                title: 'Staff & Employees',
                description: 'Internal employee roster, field technicians, and team profiles.',
                href: route('admin.employees.index'),
                icon: IdCardIcon,
                category: 'directory',
                badge: 'Staff',
                keywords: ['staff', 'employees', 'technicians', 'roster', 'team'],
                quickAddHref: canCreateEmployees ? route('admin.employees.create') : undefined,
                quickAddTitle: 'Add employee',
                visible: canViewEmployees || canCreateEmployees,
            },
            {
                id: 'dir-contacts',
                title: 'Customer Inquiries & Contacts',
                description: 'Review incoming contact submissions, leads, and customer inquiries.',
                href: route('admin.contacts.index'),
                icon: MailOpenIcon,
                category: 'directory',
                badge: 'Inquiries',
                keywords: ['contacts', 'inquiries', 'leads', 'submissions', 'messages'],
                visible: canManageNotifications,
            },
            {
                id: 'dir-users',
                title: 'Users & Roles',
                description: 'Manage authorized accounts, logins, and system roles.',
                href: route('admin.users.index'),
                icon: UsersIcon,
                category: 'directory',
                badge: 'Team',
                keywords: ['users', 'roles', 'permissions', 'accounts', 'logins'],
                quickAddHref: canCreateUsers ? route('admin.users.create') : undefined,
                quickAddTitle: 'Invite user',
                visible: canViewUsers || canCreateUsers || canManageUsers,
            },

            // Workspace & Account
            {
                id: 'ws-dashboard',
                title: 'Dashboard Overview',
                description: 'Main workspace home, session metrics, and live access status.',
                href: route('dashboard'),
                icon: LayoutDashboardIcon,
                category: 'workspace',
                badge: 'Home',
                keywords: ['dashboard', 'home', 'overview', 'metrics', 'workspace'],
                visible: true,
            },
            {
                id: 'ws-notifications',
                title: 'Notifications & Alerts',
                description: 'View customer inquiries, submission alerts, and contact logs.',
                href: route('notifications.index'),
                icon: BellIcon,
                category: 'workspace',
                badge: unreadCount > 0 ? `${unreadCount} new` : 'Inbox',
                keywords: ['notifications', 'alerts', 'inbox', 'messages', 'unread'],
                visible: canManageNotifications,
            },
            {
                id: 'ws-company',
                title: 'Company Profile',
                description: 'Manage corporate contacts, phone number, address, and license.',
                href: route('admin.company.show'),
                icon: Building2Icon,
                category: 'workspace',
                badge: 'Company',
                keywords: ['company', 'profile', 'address', 'phone', 'license', 'details'],
                visible: canViewCompany,
            },
            {
                id: 'ws-profile',
                title: 'My Profile & Security',
                description: 'Update your account name, email address, and login password.',
                href: route('profile.edit'),
                icon: UserCogIcon,
                category: 'workspace',
                badge: 'Account',
                keywords: ['profile', 'account', 'password', 'email', 'security', 'user'],
                visible: true,
            },
            {
                id: 'ws-signature',
                title: 'Digital Signature',
                description: 'Upload or draw your representative signature for document printouts.',
                href: route('admin.signature.edit'),
                icon: PenLineIcon,
                category: 'workspace',
                badge: 'Signature',
                keywords: ['signature', 'draw', 'upload', 'sign', 'documents'],
                visible: true,
            },
            {
                id: 'ws-document-settings',
                title: 'Document Colors & Branding',
                description: 'Customize document printout color themes and proposal headers.',
                href: route('admin.document-settings.edit'),
                icon: PaletteIcon,
                category: 'workspace',
                badge: 'Branding',
                keywords: ['colors', 'branding', 'document', 'theme', 'pdf', 'styling'],
                visible: canManageDocumentColors,
            },
            {
                id: 'ws-access-control',
                title: 'Access Control & Permissions',
                description: 'Tune role-based permissions, level gates, and user capabilities.',
                href: route('admin.access-control.edit'),
                icon: ShieldIcon,
                category: 'workspace',
                badge: 'Security',
                keywords: ['access', 'permissions', 'security', 'gates', 'roles', 'levels'],
                visible: canManageAccess,
            },
            {
                id: 'ws-user-activity',
                title: 'User Activity Logs',
                description: 'Audit log of actions, record edits, and login activity across the system.',
                href: route('admin.user-activities.index'),
                icon: ActivityIcon,
                category: 'workspace',
                badge: 'Audit',
                keywords: ['activity', 'audit', 'logs', 'history', 'tracking'],
                visible: canViewUserActivity,
            },
            {
                id: 'ws-site',
                title: 'Public Website',
                description: 'Preview the public customer portal, landing page, and services.',
                href: route('home'),
                icon: ActivityIcon,
                category: 'workspace',
                badge: 'Public',
                keywords: ['website', 'public', 'site', 'portal', 'home'],
                visible: true,
            },
        ],
        [
            canCreateQuotations,
            canCreateBids,
            canCreateProjects,
            canCreateProducts,
            canCreateContractors,
            canCreateUsers,
            canViewQuotations,
            canViewBids,
            canViewProjects,
            canViewProducts,
            canViewServices,
            canCreateServices,
            canViewContractors,
            canViewEmployees,
            canCreateEmployees,
            canViewUsers,
            canManageUsers,
            canManageNotifications,
            canViewCompany,
            canManageDocumentColors,
            canManageAccess,
            canViewUserActivity,
            unreadCount,
        ],
    );

    const visibleShortcuts = useMemo(
        () => shortcuts.filter((item) => item.visible),
        [shortcuts],
    );

    const quickActionPills = useMemo(() => {
        const pills: Array<{ id: string; label: string; href: string; isAdd?: boolean }> = [];

        if (canCreateQuotations) {
            pills.push({ id: 'qa-quotation', label: 'Quote', href: route('admin.quotations.create'), isAdd: true });
        } else if (canViewQuotations) {
            pills.push({ id: 'qa-quotations', label: 'Quotes', href: route('admin.quotations.index') });
        }

        if (canCreateBids) {
            pills.push({ id: 'qa-bid', label: 'Bid', href: route('admin.bids.create'), isAdd: true });
        } else if (canViewBids) {
            pills.push({ id: 'qa-bids', label: 'Bids', href: route('admin.bids.index') });
        }

        if (canCreateProjects) {
            pills.push({ id: 'qa-project', label: 'Project', href: route('admin.projects.create'), isAdd: true });
        } else if (canViewProjects) {
            pills.push({ id: 'qa-projects', label: 'Projects', href: route('admin.projects.index') });
        }

        if (canCreateProducts) {
            pills.push({ id: 'qa-product', label: 'Product', href: route('admin.products.create'), isAdd: true });
        }

        if (canCreateContractors) {
            pills.push({ id: 'qa-contractor', label: 'Contractor', href: route('admin.contractors.create'), isAdd: true });
        }

        if (canCreateEmployees) {
            pills.push({ id: 'qa-employee', label: 'Staff', href: route('admin.employees.create'), isAdd: true });
        }

        if (canCreateUsers) {
            pills.push({ id: 'qa-user', label: 'User', href: route('admin.users.create'), isAdd: true });
        }

        pills.push({ id: 'qa-signature', label: 'Signature', href: route('admin.signature.edit') });
        pills.push({ id: 'qa-profile', label: 'Account', href: route('profile.edit') });

        return pills;
    }, [
        canCreateQuotations,
        canViewQuotations,
        canCreateBids,
        canViewBids,
        canCreateProjects,
        canViewProjects,
        canCreateProducts,
        canCreateContractors,
        canCreateEmployees,
        canCreateUsers,
    ]);

    const filteredShortcuts = useMemo(() => {
        let list = visibleShortcuts;

        if (selectedCategory !== 'all') {
            list = list.filter((item) => item.category === selectedCategory);
        }

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter(
                (item) =>
                    item.title.toLowerCase().includes(query) ||
                    item.description.toLowerCase().includes(query) ||
                    item.badge?.toLowerCase().includes(query) ||
                    item.keywords?.some((k) => k.toLowerCase().includes(query)),
            );
        }

        return list;
    }, [visibleShortcuts, selectedCategory, searchQuery]);

    const handleOpenDrawer = useCallback(() => {
        setOpen(true);
    }, []);

    // Auto-focus search input when drawer opens
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setSearchQuery('');
        }
    }, [open]);

    // Listen for custom event trigger
    useEffect(() => {
        const handleCustomOpen = () => {
            setOpen(true);
        };

        window.addEventListener(openSnapDrawerEventName, handleCustomOpen);

        return () => {
            window.removeEventListener(
                openSnapDrawerEventName,
                handleCustomOpen,
            );
        };
    }, []);

    // Keyboard shortcut handler (Cmd+K / Ctrl+K)
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
        <Drawer
            direction="left"
            open={open}
            onOpenChange={setOpen}
        >
            {showFloatingTrigger && (
                <DrawerTrigger asChild>
                    <button
                        type="button"
                        onClick={handleOpenDrawer}
                        className={cn(
                            'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-40 group flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-700 dark:bg-emerald-800 text-white px-3 py-2 sm:px-4 sm:py-2.5 shadow-xl shadow-emerald-950/30 transition-all duration-300 hover:scale-105 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background landscape:bottom-3 landscape:left-3 landscape:px-2.5 landscape:py-1.5 landscape:gap-1.5',
                        )}
                        aria-label="Open Dashboard Shortcuts Menu (⌘K)"
                    >
                        <div className="flex size-6 sm:size-7 landscape:size-5 items-center justify-center rounded-full bg-white/20 text-white transition group-hover:rotate-12">
                            <ZapIcon className="size-3.5 sm:size-4 landscape:size-3 fill-current" />
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="text-xs sm:text-sm font-semibold tracking-wide">
                                Shortcuts
                            </span>
                            <span className="hidden sm:inline-flex items-center rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-50">
                                ⌘K
                            </span>
                        </div>
                    </button>
                </DrawerTrigger>
            )}

            <DrawerContent className="fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-sm sm:max-w-md md:max-w-xl flex-col border-r border-border bg-card text-card-foreground shadow-2xl focus:outline-none landscape:max-w-sm">
                <div className="flex h-full flex-col overflow-hidden">
                    {/* Header */}
                    <div className="border-b border-border bg-card px-4 pt-4 pb-2.5 sm:px-6 sm:pt-7 sm:pb-4 landscape:pt-3 landscape:pb-2 landscape:px-3">
                        <DrawerHeader className="p-0 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2.5 sm:gap-3 text-left">
                                <div className="flex size-8 sm:size-10 landscape:size-7 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400 shrink-0">
                                    <SparklesIcon className="size-4 sm:size-5 landscape:size-3.5" />
                                </div>
                                <div>
                                    <DrawerTitle className="text-base font-bold tracking-tight text-foreground sm:text-xl landscape:text-sm flex items-center gap-2">
                                        <span>Shortcuts Menu</span>
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60"
                                        >
                                            {visibleShortcuts.length} available
                                        </Badge>
                                    </DrawerTitle>
                                    <DrawerDescription className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 landscape:hidden">
                                        Quick jump to dashboard screens, tools, and actions.
                                    </DrawerDescription>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <DrawerClose asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full size-7 sm:size-8 text-muted-foreground hover:text-foreground"
                                        aria-label="Close shortcuts drawer"
                                    >
                                        <XIcon className="size-4" />
                                    </Button>
                                </DrawerClose>
                            </div>
                        </DrawerHeader>

                        {/* Search bar */}
                        <div className="relative mt-2 sm:mt-3 landscape:mt-1.5">
                            <SearchIcon className="absolute left-3 top-1/2 size-3.5 sm:size-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search shortcuts, quotes, bids, team..."
                                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-9 text-xs sm:py-2.5 sm:pl-10 sm:pr-10 sm:text-sm font-medium text-foreground shadow-xs placeholder:text-muted-foreground focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-border dark:bg-muted/40 dark:focus:border-emerald-400 landscape:py-1.5 landscape:text-xs"
                                aria-label="Search shortcuts"
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        searchInputRef.current?.focus();
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label="Clear search"
                                >
                                    <XIcon className="size-3.5" />
                                </button>
                            ) : (
                                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                                    ⌘K
                                </kbd>
                            )}
                        </div>

                        {/* Quick Add Actions */}
                        {quickActionPills.length > 0 && !searchQuery && (
                            <div className="mt-2 sm:mt-2.5 landscape:mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 pr-0.5">
                                    <ZapIcon className="size-2.5 sm:size-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>Quick Add:</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                                    {quickActionPills.map((action) => (
                                        <Link
                                            key={action.id}
                                            href={action.href}
                                            onClick={() => setOpen(false)}
                                            className="group inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/50 px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-200 transition hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
                                        >
                                            {action.isAdd && (
                                                <PlusIcon className="size-2.5 sm:size-3 transition group-hover:scale-125" />
                                            )}
                                            <span>{action.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Category Filter Tabs */}
                        <div className="mt-2 sm:mt-2.5 landscape:mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {(
                                [
                                    { id: 'all', label: 'All' },
                                    { id: 'create', label: 'Create' },
                                    { id: 'work', label: 'Work & Quotes' },
                                    { id: 'directory', label: 'Directory' },
                                    { id: 'workspace', label: 'Workspace' },
                                ] as const
                            ).map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={cn(
                                        'whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition',
                                        selectedCategory === cat.id
                                            ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-600'
                                            : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Shortcuts List (Scrollable) */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6">
                        {filteredShortcuts.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {filteredShortcuts.map((item) => {
                                    const Icon = item.icon;

                                    return (
                                        <div
                                            key={item.id}
                                            className="group relative flex flex-col rounded-xl border border-border bg-background p-2.5 sm:p-3 landscape:p-2 transition hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/15 hover:shadow-sm"
                                        >
                                            <div className="flex items-start gap-2.5 sm:gap-3">
                                                <div className="flex size-8 sm:size-9 landscape:size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-emerald-600 group-hover:text-white">
                                                    <Icon className="size-4 sm:size-4.5 landscape:size-3.5" />
                                                </div>

                                                <div className="flex min-w-0 flex-1 flex-col">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <Link
                                                            href={item.href}
                                                            onClick={() => setOpen(false)}
                                                            className="truncate text-xs sm:text-sm font-semibold text-foreground hover:text-emerald-600 focus:outline-none"
                                                        >
                                                            {item.title}
                                                        </Link>
                                                        {item.badge && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px] px-1.5 py-0 uppercase tracking-wide shrink-0 font-medium"
                                                            >
                                                                {item.badge}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground line-clamp-1 sm:line-clamp-2">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-2 sm:mt-2.5 landscape:mt-1.5 flex items-center justify-between border-t border-border/50 pt-1.5 sm:pt-2 text-[11px] sm:text-xs">
                                                <Link
                                                    href={item.href}
                                                    onClick={() => setOpen(false)}
                                                    className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 transition hover:underline"
                                                >
                                                    <span>Open screen</span>
                                                    <ChevronRightIcon className="size-3.5 transition group-hover:translate-x-0.5" />
                                                </Link>

                                                {item.quickAddHref && (
                                                    <Link
                                                        href={item.quickAddHref}
                                                        onClick={() => setOpen(false)}
                                                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-muted-foreground transition hover:bg-emerald-600 hover:text-white"
                                                    >
                                                        <PlusIcon className="size-3" />
                                                        <span>{item.quickAddTitle ?? 'Add new'}</span>
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                                <SearchIcon className="size-8 text-muted-foreground/60" />
                                <h3 className="mt-3 text-sm font-semibold text-foreground">
                                    No shortcuts found
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    No feature matches &ldquo;{searchQuery}&rdquo;.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCategory('all');
                                    }}
                                    className="mt-4"
                                >
                                    Clear search filters
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border bg-card px-4 py-3 sm:px-6">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 truncate">
                                <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500" />
                                <span className="truncate">
                                    <strong>{auth?.user?.name}</strong> ({auth?.user?.level?.name ?? 'Standard'})
                                </span>
                            </div>
                            <div className="shrink-0">
                                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground border border-border">
                                    ⌘K
                                </kbd>
                            </div>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
