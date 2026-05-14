import ApplicationLogo from '@/Components/ApplicationLogo';
import ContactSlideOver from '@/Components/ContactSlideOver';
import HelpCenter from '@/Components/HelpCenter';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import PublicActionFab from '@/Components/PublicActionFab';
import ThemeModeToggle from '@/Components/ThemeModeToggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { serviceDefinitions } from '@/data/services';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    AnchorIcon,
    Building2Icon,
    ChevronDownIcon,
    FactoryIcon,
    GraduationCapIcon,
    HomeIcon,
    HospitalIcon,
    InfoIcon,
    KeyRoundIcon,
    LayoutDashboardIcon,
    LogInIcon,
    LandmarkIcon,
    ShieldIcon,
    WrenchIcon,
} from 'lucide-react';
import { PropsWithChildren, useState } from 'react';
import { useTranslation } from 'react-i18next';

const navigation = [
    { labelKey: 'navigation.home', route: 'home', Icon: HomeIcon },
    { labelKey: 'navigation.about', route: 'about', Icon: InfoIcon },
];

const footerMarkets = [
    { key: 'commercial', Icon: Building2Icon },
    { key: 'industrial', Icon: FactoryIcon },
    { key: 'healthcare', Icon: HospitalIcon },
    { key: 'education', Icon: GraduationCapIcon },
    { key: 'government', Icon: LandmarkIcon },
    { key: 'military', Icon: ShieldIcon },
    { key: 'navy', Icon: AnchorIcon },
];

export default function PublicLayout({ children }: PropsWithChildren) {
    const { t } = useTranslation('common');
    const { auth, companyPhoneNumber } = usePage<
        PageProps<{ companyPhoneNumber?: string | null }>
    >().props;
    const quotePhoneNumber = companyPhoneNumber?.replace(/\D/g, '') ?? '';
    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex min-h-16 items-center justify-between gap-3 sm:min-h-20 lg:min-h-28 lg:gap-8">
                        <div className="flex min-w-0 items-center">
                            <div className="flex shrink-0 items-center">
                                <Link href={route('home')}>
                                    <ApplicationLogo className="block h-20 w-auto max-w-none sm:h-28 lg:h-36" />
                                </Link>
                            </div>

                            <div className="hidden gap-8 sm:ms-10 sm:flex sm:items-center lg:ms-12">
                                {navigation.map((item) => {
                                    const Icon = item.Icon;

                                    return (
                                        <Link
                                            key={item.route}
                                            href={route(item.route)}
                                            className={
                                                'group inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background ' +
                                                (route().current(item.route)
                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                                            }
                                        >
                                            <Icon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                            {t(item.labelKey)}
                                        </Link>
                                    );
                                })}

                                <DropdownMenu>
                                    <DropdownMenuTrigger className="group inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background data-open:bg-emerald-500/10 data-open:text-emerald-700 dark:data-open:text-emerald-300">
                                        <WrenchIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                        {t('navigation.services')}
                                        <ChevronDownIcon className="size-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-72 p-2">
                                        <DropdownMenuGroup>
                                            {serviceDefinitions.map((service) => {
                                                const Icon = service.Icon;

                                                return (
                                                    <DropdownMenuItem
                                                        key={service.key}
                                                        asChild
                                                        className="p-0"
                                                    >
                                                        <Link
                                                            href={route(
                                                                'services.show',
                                                                service.slug,
                                                            )}
                                                            className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm"
                                                        >
                                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                                                <Icon className="size-4 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                                            </span>
                                                            <span>
                                                                {t(
                                                                    `navigation.serviceItems.${service.key}`,
                                                                )}
                                                            </span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className="hidden gap-2 sm:ms-4 sm:flex sm:items-center lg:ms-6 lg:gap-4">
                            <LanguageSwitcher />
                            <ThemeModeToggle />

                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="group inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-emerald-400/50 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
                                >
                                    <LayoutDashboardIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                    {t('auth.dashboard')}
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    className="group inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
                                >
                                    <LogInIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                    {t('auth.login')}
                                </Link>
                            )}
                        </div>

                        <div className="-me-2 flex items-center sm:hidden">
                            <button
                                type="button"
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
                        ' border-t border-border sm:hidden'
                    }
                >
                    <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
                        {navigation.map((item) => (
                            <Link
                                key={item.route}
                                href={route(item.route)}
                                onClick={() =>
                                    setShowingNavigationDropdown(false)
                                }
                                className={
                                    'group flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition ' +
                                    (route().current(item.route)
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                                }
                            >
                                <item.Icon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                {t(item.labelKey)}
                            </Link>
                        ))}

                        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-2">
                            <p className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <WrenchIcon className="size-3.5" />
                                {t('navigation.services')}
                            </p>
                            <div className="mt-1 flex flex-col gap-1">
                                {serviceDefinitions.map((service) => {
                                    const Icon = service.Icon;

                                    return (
                                        <Link
                                            key={service.key}
                                            href={route(
                                                'services.show',
                                                service.slug,
                                            )}
                                            onClick={() =>
                                                setShowingNavigationDropdown(
                                                    false,
                                                )
                                            }
                                            className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background hover:text-foreground"
                                        >
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                                <Icon className="size-4 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                            </span>
                                            <span>
                                                {t(
                                                    `navigation.serviceItems.${service.key}`,
                                                )}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border px-4 pb-4 pt-4">
                        <div className="mb-4">
                            <div className="flex flex-wrap gap-3">
                                <LanguageSwitcher />
                                <ThemeModeToggle />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    onClick={() =>
                                        setShowingNavigationDropdown(false)
                                    }
                                    className="group flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                >
                                    <LayoutDashboardIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                    {t('auth.dashboard')}
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    onClick={() =>
                                        setShowingNavigationDropdown(false)
                                    }
                                    className="group flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                >
                                    <LogInIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                    {t('auth.login')}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <main>{children}</main>

            <footer className="border-t border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-background text-white">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
                    <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
                        <div>
                            <ApplicationLogo className="h-20 w-auto max-w-none sm:h-28" />
                            <p className="mt-6 max-w-md leading-7 text-emerald-50/75">
                                {t('footer.description')}
                            </p>
                            <div className="mt-8 rounded-2xl border border-emerald-300/20 bg-white/5 p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur">
                                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
                                    {t('footer.supportTitle')}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                                    {t('footer.supportText')}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                                    {t('footer.company')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-emerald-50/70">
                                    {navigation.map((item) => {
                                        const Icon = item.Icon;

                                        return (
                                            <Link
                                                key={item.route}
                                                href={route(item.route)}
                                                className="group inline-flex items-center gap-2 transition hover:text-white"
                                            >
                                                <Icon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                                <span>{t(item.labelKey)}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                                    {t('footer.services')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-emerald-50/70">
                                    {serviceDefinitions.map((service) => {
                                        const Icon = service.Icon;

                                        return (
                                            <Link
                                                key={service.key}
                                                href={route(
                                                    'services.show',
                                                    service.slug,
                                                )}
                                                className="group inline-flex items-center gap-2 transition hover:text-white"
                                            >
                                                <Icon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                                <span>
                                                    {t(
                                                        `navigation.serviceItems.${service.key}`,
                                                    )}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                                    {t('footer.markets')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-emerald-50/70">
                                    {footerMarkets.map((market) => {
                                        const Icon = market.Icon;

                                        return (
                                            <span
                                                key={market.key}
                                                className="group inline-flex items-center gap-2"
                                            >
                                                <Icon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                                <span>
                                                    {t(
                                                        `footer.marketItems.${market.key}`,
                                                    )}
                                                </span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                                    {t('footer.access')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-emerald-50/70">
                                    <Link
                                        href={route('login')}
                                        className="group inline-flex items-center gap-2 transition hover:text-white"
                                    >
                                        <LogInIcon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                        <span>{t('auth.customerPortal')}</span>
                                    </Link>
                                    <Link
                                        href={route('register')}
                                        className="group inline-flex items-center gap-2 transition hover:text-white"
                                    >
                                        <KeyRoundIcon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                        <span>{t('auth.createAccount')}</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm text-emerald-50/60 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            {t('footer.copyright', {
                                year: new Date().getFullYear(),
                            })}
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <span>{t('footer.tags.doors')}</span>
                            <span>{t('footer.tags.hardware')}</span>
                            <span>{t('footer.tags.access')}</span>
                        </div>
                    </div>
                </div>
            </footer>

            <ContactSlideOver showTrigger={false} />
            <HelpCenter showTrigger={false} />
            <PublicActionFab callPhoneNumber={quotePhoneNumber} />
        </div>
    );
}
