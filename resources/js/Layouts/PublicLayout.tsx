import ApplicationLogo from '@/Components/ApplicationLogo';
import ContactSlideOver from '@/Components/ContactSlideOver';
import FloatingSiteGear from '@/Components/FloatingSiteGear';
import SiteVaultIntro from '@/Components/SiteVaultIntro';
import HelpCenter from '@/Components/HelpCenter';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import PublicActionFab from '@/Components/PublicActionFab';
import { openContactForm } from '@/lib/contact';
import {
    PublicMobileServiceLinks,
    PublicServicesNavigationContent,
} from '@/Components/PublicServicesNavigation';
import ThemeModeToggle from '@/Components/ThemeModeToggle';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from '@/Components/ui/navigation-menu';
import { serviceGroups } from '@/data/services';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    AnchorIcon,
    Building2Icon,
    FactoryIcon,
    GraduationCapIcon,
    HospitalIcon,
    KeyRoundIcon,
    LayoutDashboardIcon,
    LogInIcon,
    LandmarkIcon,
    RadioTowerIcon,
    ShieldIcon,
    WrenchIcon,
} from 'lucide-react';
import {
    isSiteVaultIntroPending,
    SITE_VAULT_INTRO_MS,
} from '@/lib/siteVaultIntro';
import {
    PropsWithChildren,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';

const navigation = [
    { labelKey: 'navigation.doors', href: '/#doors' },
    { labelKey: 'navigation.projects', href: '/#projects' },
    { labelKey: 'navigation.about', href: '/about' },
    { labelKey: 'navigation.contact', href: '/#quote' },
];

const quoteButtonClass =
    'inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-[#3FCF8E] px-4 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#35b87d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FCF8E]';

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
    const { i18n, t } = useTranslation('common');
    const { t: tHome } = useTranslation('home');
    const { auth, companyPhoneNumber, companyEmail } = usePage<
        PageProps<{
            companyPhoneNumber?: string | null;
            companyEmail?: string | null;
        }>
    >().props;
    const isHome = route().current('home');
    const isAuthPage =
        route().current('login') || route().current('register');
    const quotePhoneNumber = companyPhoneNumber?.replace(/\D/g, '') ?? '';
    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);
    const headerRef = useRef<HTMLElement>(null);
    const navRowRef = useRef<HTMLDivElement>(null);
    const navClusterRef = useRef<HTMLDivElement>(null);
    const [desktopNavFits, setDesktopNavFits] = useState(false);

    useEffect(() => {
        const header = headerRef.current;

        if (!header) {
            return;
        }

        const syncHeaderBottom = () => {
            document.documentElement.style.setProperty(
                '--public-header-bottom',
                `${Math.round(header.getBoundingClientRect().bottom)}px`,
            );
        };

        syncHeaderBottom();
        const observer = new ResizeObserver(syncHeaderBottom);
        observer.observe(header);
        window.addEventListener('resize', syncHeaderBottom);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', syncHeaderBottom);
        };
    }, []);

    useLayoutEffect(() => {
        const row = navRowRef.current;
        const cluster = navClusterRef.current;

        if (!row || !cluster) {
            return;
        }

        const measure = () => {
            const logo = row.querySelector<HTMLElement>('[data-public-logo]');
            const gap =
                Number.parseFloat(getComputedStyle(row).columnGap || '0') || 0;
            const previous = {
                position: cluster.style.position,
                visibility: cluster.style.visibility,
                width: cluster.style.width,
            };

            cluster.style.position = 'absolute';
            cluster.style.visibility = 'hidden';
            cluster.style.width = 'max-content';
            const needed = cluster.scrollWidth;
            cluster.style.position = previous.position;
            cluster.style.visibility = previous.visibility;
            cluster.style.width = previous.width;

            const available = row.clientWidth - (logo?.offsetWidth ?? 0) - gap;
            const fits = needed + 16 <= available;

            setDesktopNavFits((current) => (current === fits ? current : fits));
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(row);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [auth.user, i18n.language]);

    useEffect(() => {
        if (!isAuthPage) {
            return;
        }

        document.documentElement.classList.add('auth-static');

        return () => {
            document.documentElement.classList.remove('auth-static');
        };
    }, [isAuthPage]);

    useEffect(() => {
        const authScreen =
            isAuthPage ||
            route().current('password.request') ||
            route().current('password.reset');

        if (!authScreen) {
            return;
        }

        if (auth.user) {
            window.location.assign(route('dashboard'));

            return;
        }

        let cancelled = false;

        const leaveIfSignedIn = () => {
            const dashboardUrl = new URL(
                route('dashboard'),
                window.location.origin,
            );

            fetch(dashboardUrl.toString(), {
                credentials: 'same-origin',
                headers: { Accept: 'text/html' },
                redirect: 'manual',
            })
                .then((response) => {
                    if (cancelled || response.status !== 200 || !response.url) {
                        return;
                    }

                    const arrived = new URL(response.url);

                    if (arrived.pathname === dashboardUrl.pathname) {
                        window.location.assign(dashboardUrl.toString());
                    }
                })
                .catch(() => {});
        };

        leaveIfSignedIn();

        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                window.location.reload();
            }
        };

        window.addEventListener('pageshow', onPageShow);

        return () => {
            cancelled = true;
            window.removeEventListener('pageshow', onPageShow);
        };
    }, [auth.user, isAuthPage]);

    useEffect(() => {
        if (!showingNavigationDropdown) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [showingNavigationDropdown]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            {!isAuthPage && <SiteVaultIntro />}
            {!isAuthPage && (
                <FloatingSiteGear
                    delayMs={
                        isSiteVaultIntroPending() ? SITE_VAULT_INTRO_MS : 400
                    }
                />
            )}
            <header
                ref={headerRef}
                className={cn(
                    'sticky top-0 z-50',
                    showingNavigationDropdown &&
                        !desktopNavFits &&
                        'flex h-svh flex-col',
                )}
            >
                {isHome ? (
                    <div className="bg-[#111827] text-center text-sm font-medium tracking-wide text-white">
                        <p className="px-4 py-2.5 sm:text-base">
                            {tHome('serviceArea.banner')}
                        </p>
                    </div>
                ) : null}

                <nav
                    className={cn(
                        'border-b border-white/10 bg-[#111827] text-white',
                        showingNavigationDropdown &&
                            !desktopNavFits &&
                            'flex min-h-0 flex-1 flex-col',
                    )}
                >
                <div className="mx-auto w-full shrink-0 px-4 sm:px-6 lg:px-8">
                    <div
                        ref={navRowRef}
                        className="relative flex items-center justify-between gap-3 overflow-visible py-2 sm:py-2.5 md:py-3"
                    >
                        <div className="flex shrink-0 items-center" data-public-logo>
                            <Link href={route('home')} className="shrink-0">
                                <ApplicationLogo className="block size-12 sm:size-16 lg:size-20" />
                            </Link>
                        </div>

                        <div
                            ref={navClusterRef}
                            className={cn(
                                'flex items-center gap-3',
                                desktopNavFits
                                    ? 'min-w-0 flex-1 justify-between'
                                    : 'pointer-events-none invisible absolute left-0 top-0 w-max',
                            )}
                        >
                            <NavigationMenu
                                viewport={false}
                                className="max-w-none flex-none justify-start"
                            >
                                <NavigationMenuList className="flex-nowrap gap-1">
                                    {navigation.map((item) => (
                                        <NavigationMenuItem key={item.href}>
                                            <NavigationMenuLink
                                                asChild
                                                className={cn(
                                                    navigationMenuTriggerStyle(),
                                                    'rounded-full bg-transparent px-3 text-white hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white',
                                                )}
                                            >
                                                <Link href={item.href}>
                                                    {t(item.labelKey)}
                                                </Link>
                                            </NavigationMenuLink>
                                        </NavigationMenuItem>
                                    ))}

                                    <NavigationMenuItem>
                                        <NavigationMenuTrigger
                                            className={cn(
                                                'gap-2 rounded-full bg-transparent px-3 text-white hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white',
                                            )}
                                        >
                                            <WrenchIcon className="size-4" />
                                            {t('navigation.services')}
                                        </NavigationMenuTrigger>
                                        <PublicServicesNavigationContent />
                                    </NavigationMenuItem>
                                </NavigationMenuList>
                            </NavigationMenu>

                            <div className="flex shrink-0 items-center gap-3">
                            <button
                                type="button"
                                className={quoteButtonClass}
                                onClick={() => openContactForm()}
                            >
                                {t('navigation.quote')}
                            </button>
                            <LanguageSwitcher onDarkHeader />
                            <ThemeModeToggle onDarkHeader />

                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#3FCF8E] focus:ring-offset-2 focus:ring-offset-[#111827]"
                                >
                                    <LayoutDashboardIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                    {t('auth.dashboard')}
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    className="group inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-white transition hover:text-[#3FCF8E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FCF8E]"
                                >
                                    <LogInIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                    {t('auth.login')}
                                </Link>
                            )}
                            </div>
                        </div>

                        <div
                            className={cn(
                                '-me-2 items-center',
                                desktopNavFits ? 'hidden' : 'flex',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    setShowingNavigationDropdown(
                                        (previousState) => !previousState,
                                    )
                                }
                                aria-expanded={showingNavigationDropdown}
                                aria-label={showingNavigationDropdown ? t('contact.close') : t('navigation.menu')}
                                className="inline-flex size-11 items-center justify-center rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FCF8E]"
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
                    className={cn(
                        showingNavigationDropdown && !desktopNavFits ? 'flex' : 'hidden',
                        'min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-t border-white/10 bg-[#111827] text-white',
                    )}
                >
                    <div className="grid grid-cols-1 gap-1 px-4 pb-3 pt-4">
                        <button
                            type="button"
                            className={cn(quoteButtonClass, 'mb-2 w-full')}
                            onClick={() => {
                                setShowingNavigationDropdown(false);
                                openContactForm();
                            }}
                        >
                            {t('navigation.quote')}
                        </button>
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() =>
                                    setShowingNavigationDropdown(false)
                                }
                                className="flex min-h-11 items-center rounded-md px-3 py-2 text-base font-medium text-white hover:bg-white/10"
                            >
                                {t(item.labelKey)}
                            </Link>
                        ))}

                        <div className="mt-2 rounded-xl border border-white/15 bg-white p-2 text-[#111827]">
                            <p className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#111827]/70">
                                <WrenchIcon className="size-3.5" />
                                {t('navigation.services')}
                            </p>
                            <PublicMobileServiceLinks
                                onNavigate={() =>
                                    setShowingNavigationDropdown(false)
                                }
                            />
                        </div>
                    </div>

                    <div className="border-t border-white/10 px-4 pb-28 pt-4">
                        <div className="mb-4">
                            <div className="flex flex-wrap gap-3">
                                <LanguageSwitcher onDarkHeader />
                                <ThemeModeToggle onDarkHeader />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    onClick={() =>
                                        setShowingNavigationDropdown(false)
                                    }
                                    className="group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-base font-medium text-white transition hover:bg-white/10"
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
                                    className="group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-base font-medium text-white transition hover:bg-white/10"
                                >
                                    <LogInIcon className="size-4 shrink-0 transition group-hover:animate-bell-shake group-focus-visible:animate-bell-shake" />
                                    {t('auth.login')}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            </header>

            <main className="relative z-0 min-w-0 overflow-x-clip">{children}</main>

            <footer className="border-t border-white/10 bg-[#111827] pb-28 text-white">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
                    <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
                        <div>
                            <ApplicationLogo className="size-16 sm:size-20 md:size-24" />
                            <p className="mt-6 max-w-md leading-7 text-white/75">
                                {t('footer.description')}
                            </p>
                            <p className="mt-4 text-sm text-white/75">
                                {t('footer.serviceArea')}
                            </p>
                            {companyPhoneNumber ? (
                                <a
                                    href={`tel:${quotePhoneNumber}`}
                                    className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#3FCF8E]"
                                >
                                    {t('footer.phone')}: {companyPhoneNumber}
                                </a>
                            ) : null}
                            {companyEmail ? (
                                <a
                                    href={`mailto:${companyEmail}`}
                                    className="mt-1 block min-h-11 text-sm font-semibold text-[#3FCF8E]"
                                >
                                    {t('footer.email')}: {companyEmail}
                                </a>
                            ) : null}
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
                                    {navigation.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className="inline-flex min-h-11 items-center text-white/75 transition hover:text-white"
                                        >
                                            {t(item.labelKey)}
                                        </Link>
                                    ))}
                                    <Link
                                        href={route('certifications')}
                                        className="inline-flex min-h-11 items-center text-white/75 transition hover:text-white"
                                    >
                                        {t('navigation.certifications')}
                                    </Link>
                                </div>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                                    {t('footer.services')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-emerald-50/70">
                                    {serviceGroups.map((group) => (
                                        <Link
                                            key={group.key}
                                            href={
                                                group.slug
                                                    ? route(
                                                          'services.show',
                                                          group.slug,
                                                      )
                                                    : '/#services'
                                            }
                                            className="group inline-flex items-center gap-2 transition hover:text-white"
                                        >
                                            <WrenchIcon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                            <span>
                                                {t(
                                                    `navigation.serviceGroups.${group.key}`,
                                                )}
                                            </span>
                                        </Link>
                                    ))}
                                    <Link
                                        href={route(
                                            'services.show',
                                            'scif-rooms-construction',
                                        )}
                                        className="group inline-flex items-center gap-2 transition hover:text-white"
                                    >
                                        <Building2Icon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                        <span>
                                            {t(
                                                'navigation.serviceItems.scifRoomsConstruction',
                                            )}
                                        </span>
                                    </Link>
                                    <Link
                                        href={route(
                                            'services.show',
                                            'radio-frequency-doors',
                                        )}
                                        className="group inline-flex items-center gap-2 transition hover:text-white"
                                    >
                                        <RadioTowerIcon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                        <span>
                                            {t(
                                                'navigation.serviceItems.radioFrequencyDoors',
                                            )}
                                        </span>
                                    </Link>
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
                                    {auth.user ? (
                                        <Link
                                            href={route('dashboard')}
                                            className="group inline-flex items-center gap-2 transition hover:text-white"
                                        >
                                            <LayoutDashboardIcon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                            <span>{t('auth.dashboard')}</span>
                                        </Link>
                                    ) : (
                                        <>
                                            <Link
                                                href={route('login')}
                                                className="group inline-flex items-center gap-2 transition hover:text-white"
                                            >
                                                <LogInIcon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                                <span>
                                                    {t('auth.customerPortal')}
                                                </span>
                                            </Link>
                                            <Link
                                                href={route('register')}
                                                className="group inline-flex items-center gap-2 transition hover:text-white"
                                            >
                                                <KeyRoundIcon className="size-4 shrink-0 text-emerald-300 transition group-hover:animate-bell-shake" />
                                                <span>
                                                    {t('auth.createAccount')}
                                                </span>
                                            </Link>
                                        </>
                                    )}
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
            {!isAuthPage &&
                !route().current('password.request') &&
                !route().current('password.reset') && (
                    <PublicActionFab
                        callPhoneNumber={quotePhoneNumber}
                        forceFab={desktopNavFits}
                        className={
                            showingNavigationDropdown && !desktopNavFits
                                ? '!hidden'
                                : undefined
                        }
                    />
                )}
        </div>
    );
}
