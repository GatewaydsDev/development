import {
    NavigationMenuContent,
    NavigationMenuLink,
} from '@/Components/ui/navigation-menu';
import {
    catalogItemHref,
    catalogItemsForGroup,
    serviceGroups,
    type CatalogItem,
} from '@/data/services';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ChevronDownIcon, WrenchIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function isServicePathActive(href: string) {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.location.pathname === href;
}

function ServiceNavLink({
    item,
    onNavigate,
}: {
    item: CatalogItem;
    onNavigate?: () => void;
}) {
    const { t } = useTranslation('common');
    const { t: tHome } = useTranslation('home');
    const Icon = item.Icon;
    const href = catalogItemHref(item);

    return (
        <li>
            <NavigationMenuLink asChild active={isServicePathActive(href)}>
                <Link
                    href={href}
                    onClick={onNavigate}
                    className="items-start gap-3"
                >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium leading-5">
                            {t(`navigation.serviceItems.${item.key}`)}
                        </span>
                        <span className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                            {tHome(`services.items.${item.key}.description`)}
                        </span>
                    </span>
                </Link>
            </NavigationMenuLink>
        </li>
    );
}

export function PublicServicesNavigationContent({
    onNavigate,
}: {
    onNavigate?: () => void;
}) {
    const { t } = useTranslation('common');
    const { t: tHome } = useTranslation('home');

    return (
        <NavigationMenuContent className="!fixed !inset-x-4 !top-[calc(var(--public-header-bottom,7rem)+0.5rem)] z-40 !w-auto max-h-[calc(100dvh-var(--public-header-bottom,7rem)-1.5rem)] !translate-x-0 overflow-y-auto p-4 pb-8">
            <div className="grid min-w-0 gap-6 pb-2 md:grid-cols-2 xl:grid-cols-4">
                {serviceGroups.map((group) => {
                    const groupHref = group.slug
                        ? route('services.show', group.slug)
                        : '/#services';
                    const isSpecialty = group.key === 'specialty';

                    return (
                        <div
                            key={group.key}
                            className={cn(
                                'flex min-w-0 flex-col gap-2',
                                isSpecialty && 'md:col-span-2',
                            )}
                        >
                            {group.slug ? (
                                <NavigationMenuLink
                                    asChild
                                    active={isServicePathActive(groupHref)}
                                >
                                    <Link
                                        href={groupHref}
                                        onClick={onNavigate}
                                        className="flex-col items-start gap-1"
                                    >
                                        <span className="text-sm font-semibold">
                                            {t(
                                                `navigation.serviceGroups.${group.key}`,
                                            )}
                                        </span>
                                        <span className="text-sm leading-5 text-muted-foreground">
                                            {tHome(
                                                `services.groups.${group.key}.description`,
                                            )}
                                        </span>
                                    </Link>
                                </NavigationMenuLink>
                            ) : (
                                <div className="flex flex-col gap-1 px-2 py-2">
                                    <p className="text-sm font-semibold">
                                        {t(
                                            `navigation.serviceGroups.${group.key}`,
                                        )}
                                    </p>
                                    <p className="text-sm leading-5 text-muted-foreground">
                                        {tHome(
                                            `services.groups.${group.key}.description`,
                                        )}
                                    </p>
                                </div>
                            )}

                            <ul className="flex min-w-0 flex-col gap-1">
                                {catalogItemsForGroup(group.key).map(
                                    (item) => (
                                        <ServiceNavLink
                                            key={item.key}
                                            item={item}
                                            onNavigate={onNavigate}
                                        />
                                    ),
                                )}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </NavigationMenuContent>
    );
}

export function PublicMobileServiceLinks({
    onNavigate,
}: {
    onNavigate: () => void;
}) {
    const { t } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [openGroup, setOpenGroup] = useState<string | null>(null);

    return (
        <div className="flex min-w-0 flex-col">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted"
            >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <WrenchIcon className="size-4" />
                </span>
                <span className="flex-1">{t('navigation.services')}</span>
                <ChevronDownIcon
                    className={cn('size-4 transition-transform', open && 'rotate-180')}
                />
            </button>

            {open ? (
                <div className="mt-1 flex min-w-0 flex-col gap-1 border-l-2 border-border pl-2 ml-5">
                    {serviceGroups.map((group) => {
                        const groupOpen = openGroup === group.key;
                        const groupHref = group.slug
                            ? route('services.show', group.slug)
                            : null;
                        const items = catalogItemsForGroup(group.key);

                        return (
                            <div key={group.key} className="flex flex-col">
                                <button
                                    type="button"
                                    aria-expanded={groupOpen}
                                    onClick={() =>
                                        setOpenGroup(groupOpen ? null : group.key)
                                    }
                                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted"
                                >
                                    <span className="flex-1">
                                        {t(`navigation.serviceGroups.${group.key}`)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {items.length}
                                    </span>
                                    <ChevronDownIcon
                                        className={cn(
                                            'size-4 transition-transform',
                                            groupOpen && 'rotate-180',
                                        )}
                                    />
                                </button>

                                {groupOpen ? (
                                    <div className="mb-1 flex flex-col gap-0.5 pl-2">
                                        {groupHref ? (
                                            <Link
                                                href={groupHref}
                                                onClick={onNavigate}
                                                className={cn(
                                                    'flex min-h-10 items-center rounded-md px-2 py-2 text-sm font-semibold text-primary transition hover:bg-muted',
                                                    isServicePathActive(groupHref) &&
                                                        'bg-muted',
                                                )}
                                            >
                                                {t(`navigation.serviceGroups.${group.key}`)}
                                                {' · '}
                                                {t('navigation.services')}
                                            </Link>
                                        ) : null}
                                        {items.map((item) => {
                                            const Icon = item.Icon;
                                            const href = catalogItemHref(item);

                                            return (
                                                <Link
                                                    key={item.key}
                                                    href={href}
                                                    onClick={onNavigate}
                                                    className={cn(
                                                        'flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition hover:bg-muted',
                                                        isServicePathActive(href) &&
                                                            'bg-muted',
                                                    )}
                                                >
                                                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 break-words">
                                                        {t(
                                                            `navigation.serviceItems.${item.key}`,
                                                        )}
                                                    </span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
