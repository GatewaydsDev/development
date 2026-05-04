import ApplicationLogo from '@/Components/ApplicationLogo';
import ContactSlideOver from '@/Components/ContactSlideOver';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import ThemeModeToggle from '@/Components/ThemeModeToggle';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, useState } from 'react';
import { useTranslation } from 'react-i18next';

const navigation = [
    { labelKey: 'navigation.home', route: 'home' },
    { labelKey: 'navigation.about', route: 'about' },
];

const footerServices = [
    'installation',
    'maintenance',
    'repair',
    'accessControl',
];

const footerMarkets = [
    'commercial',
    'industrial',
    'healthcare',
    'education',
];

export default function PublicLayout({ children }: PropsWithChildren) {
    const { t } = useTranslation('common');
    const { auth } = usePage<PageProps>().props;
    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex min-h-20 items-center justify-between gap-4 sm:min-h-24 lg:min-h-28 lg:gap-8">
                        <div className="flex min-w-0 items-center">
                            <div className="flex shrink-0 items-center">
                                <Link href={route('home')}>
                                    <ApplicationLogo className="block h-16 w-auto max-w-none sm:h-20 lg:h-24" />
                                </Link>
                            </div>

                            <div className="hidden gap-8 lg:ms-12 lg:flex">
                                {navigation.map((item) => (
                                    <Link
                                        key={item.route}
                                        href={route(item.route)}
                                        className={
                                            'inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background ' +
                                            (route().current(item.route)
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                                        }
                                    >
                                        {t(item.labelKey)}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="hidden gap-2 sm:ms-4 sm:flex sm:items-center lg:gap-4 lg:ms-6">
                            <LanguageSwitcher />
                            <ThemeModeToggle />

                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-emerald-400/50 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
                                >
                                    {t('auth.dashboard')}
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
                                >
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
                                className={
                                    'block rounded-md px-3 py-2 text-base font-medium transition ' +
                                    (route().current(item.route)
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                                }
                            >
                                {t(item.labelKey)}
                            </Link>
                        ))}
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
                                    className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                >
                                    {t('auth.dashboard')}
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                >
                                    {t('auth.login')}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <main>{children}</main>

            <footer className="border-t border-border bg-card">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
                    <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
                        <div>
                            <ApplicationLogo className="h-16 w-auto max-w-none sm:h-20" />
                            <p className="mt-6 max-w-md leading-7 text-muted-foreground">
                                {t('footer.description')}
                            </p>
                            <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                    {t('footer.supportTitle')}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {t('footer.supportText')}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                    {t('footer.company')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
                                    {navigation.map((item) => (
                                        <Link
                                            key={item.route}
                                            href={route(item.route)}
                                            className="transition hover:text-foreground"
                                        >
                                            {t(item.labelKey)}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                    {t('footer.services')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
                                    {footerServices.map((service) => (
                                        <span key={service}>
                                            {t(`footer.serviceItems.${service}`)}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                    {t('footer.markets')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
                                    {footerMarkets.map((market) => (
                                        <span key={market}>
                                            {t(`footer.marketItems.${market}`)}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                    {t('footer.access')}
                                </h2>
                                <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
                                    <Link
                                        href={route('login')}
                                        className="transition hover:text-foreground"
                                    >
                                        {t('auth.customerPortal')}
                                    </Link>
                                    <Link
                                        href={route('register')}
                                        className="transition hover:text-foreground"
                                    >
                                        {t('auth.createAccount')}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex flex-col gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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

            <ContactSlideOver />
        </div>
    );
}
