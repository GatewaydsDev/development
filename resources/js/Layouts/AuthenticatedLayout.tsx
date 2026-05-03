import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import ThemeModeToggle from '@/Components/ThemeModeToggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    ChevronDownIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    UserPlusIcon,
    UsersIcon,
} from 'lucide-react';
import { PropsWithChildren, ReactNode, useState } from 'react';

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const canManageUsers = Boolean(auth.can?.manageUsers);
    const canViewUsers = Boolean(auth.can?.viewUsers);
    const canCreateUsers = Boolean(auth.can?.createUsers);
    const canManageAccess = Boolean(auth.can?.manageAccess);
    const canOpenAdministration = canManageUsers || canManageAccess;

    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);

    return (
        <div className="min-h-screen bg-muted/30 text-foreground">
            <nav className="border-b border-border bg-background/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex min-h-20 items-center justify-between gap-4 sm:min-h-24 lg:min-h-28 lg:gap-8">
                        <div className="flex">
                            <div className="flex shrink-0 items-center">
                                <Link href="/">
                                    <ApplicationLogo className="block h-16 w-auto max-w-none sm:h-20 lg:h-24" />
                                </Link>
                            </div>

                            <div className="hidden gap-8 sm:-my-px sm:ms-10 sm:flex sm:items-center">
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
                                            className="w-56"
                                        >
                                            <DropdownMenuGroup>
                                                {(canManageUsers ||
                                                    canManageAccess) && (
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger>
                                                            <UsersIcon className="size-4" />
                                                            Users
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent className="min-w-44">
                                                            {(canViewUsers ||
                                                                canCreateUsers) && (
                                                                <>
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
                                                                                See
                                                                                all
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
                                                                                Add
                                                                                new
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </>
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
                                                                        Control
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                )}
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>

                        <div className="hidden gap-2 sm:ms-4 sm:flex sm:items-center lg:gap-4 lg:ms-6">
                            <ThemeModeToggle />

                            <div className="relative ms-3">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md">
                                            <button
                                                type="button"
                                                className="inline-flex items-center rounded-md border border-transparent bg-background px-3 py-2 text-sm font-medium leading-4 text-muted-foreground transition duration-150 ease-in-out hover:text-foreground focus:outline-none"
                                            >
                                                {user.name}

                                                <svg
                                                    className="-me-0.5 ms-2 h-4 w-4"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
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

                        <div className="-me-2 flex items-center sm:hidden">
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
                        ' sm:hidden'
                    }
                >
                    <div className="flex flex-col gap-1 pb-3 pt-2">
                        <ResponsiveNavLink
                            href={route('dashboard')}
                            active={route().current('dashboard')}
                        >
                            Dashboard
                        </ResponsiveNavLink>

                        {canOpenAdministration && (
                            <div className="mt-2 border-t border-border pt-3">
                                <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Administration
                                </div>
                                {(canManageUsers || canManageAccess) && (
                                    <>
                                        <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-foreground">
                                        <UsersIcon className="size-4" />
                                            Users
                                        </div>
                                        {(canViewUsers || canCreateUsers) && (
                                            <>
                                                {canViewUsers && (
                                                    <ResponsiveNavLink
                                                        href={route(
                                                            'admin.users.index',
                                                        )}
                                                        active={route().current(
                                                            'admin.users.index',
                                                        )}
                                                        className="ps-8"
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            <UsersIcon className="size-4" />
                                                            See all
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
                                                        className="ps-8"
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            <UserPlusIcon className="size-4" />
                                                            Add new
                                                        </span>
                                                    </ResponsiveNavLink>
                                                )}
                                            </>
                                        )}

                                        {canManageAccess && (
                                            <ResponsiveNavLink
                                                href={route(
                                                    'admin.access-control.edit',
                                                )}
                                                active={route().current(
                                                    'admin.access-control.edit',
                                                )}
                                                className="ps-8"
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <SlidersHorizontalIcon className="size-4" />
                                                    Access Control
                                                </span>
                                            </ResponsiveNavLink>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border pb-1 pt-4">
                        <div className="px-4 pb-4">
                            <ThemeModeToggle />
                        </div>

                        <div className="px-4">
                            <div className="text-base font-medium text-foreground">
                                {user.name}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">
                                {user.email}
                            </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-1">
                            <ResponsiveNavLink href={route('profile.edit')}>
                                Profile
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
                <header className="border-b border-border bg-card shadow-sm">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        {header}
                    </div>
                </header>
            )}

            <main>{children}</main>
        </div>
    );
}
