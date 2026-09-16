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
        <NavigationMenuContent className="left-1/2 overflow-visible p-4 pb-8 md:w-[min(72rem,calc(100vw-3rem))] md:-translate-x-1/2">
            <div className="grid gap-4 pb-2 lg:grid-cols-4">
                {serviceGroups.map((group) => {
                    const groupHref = group.slug
                        ? route('services.show', group.slug)
                        : '/#services';
                    const isSpecialty = group.key === 'specialty';

                    return (
                        <div
                            key={group.key}
                            className={cn(
                                'flex flex-col gap-2',
                                isSpecialty && 'lg:col-span-2',
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

                            <ul
                                className={cn(
                                    'flex flex-col gap-1',
                                    isSpecialty && 'sm:grid sm:grid-cols-2',
                                )}
                            >
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
    const { t: tHome } = useTranslation('home');

    return (
        <div className="mt-1 flex flex-col gap-3">
            {serviceGroups.map((group) => {
                const groupHref = group.slug
                    ? route('services.show', group.slug)
                    : '/#services';

                return (
                    <div key={group.key} className="flex flex-col gap-1">
                        {group.slug ? (
                            <Link
                                href={groupHref}
                                onClick={onNavigate}
                                className="flex flex-col gap-1 rounded-md px-2 py-2"
                            >
                                <span className="text-xs font-semibold uppercase tracking-wide">
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
                        ) : (
                            <div className="flex flex-col gap-1 px-2 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide">
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

                        {catalogItemsForGroup(group.key).map((item) => {
                            const Icon = item.Icon;
                            const href = catalogItemHref(item);

                            return (
                                <Link
                                    key={item.key}
                                    href={href}
                                    onClick={onNavigate}
                                    className={cn(
                                        'flex items-start gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-background hover:text-foreground',
                                        isServicePathActive(href)
                                            ? 'bg-background text-foreground'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                        <Icon className="size-4" />
                                    </span>
                                    <span className="flex min-w-0 flex-col gap-1 break-words">
                                        <span className="font-medium leading-5">
                                            {t(
                                                `navigation.serviceItems.${item.key}`,
                                            )}
                                        </span>
                                        <span className="text-sm leading-5 text-muted-foreground">
                                            {tHome(
                                                `services.items.${item.key}.description`,
                                            )}
                                        </span>
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}
