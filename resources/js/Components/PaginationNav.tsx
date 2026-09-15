import { Button } from '@/Components/ui/button';
import { Link } from '@inertiajs/react';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    type LucideIcon,
} from 'lucide-react';

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type Paginator = {
    current_page: number;
    last_page: number;
    from?: number | null;
    to?: number | null;
    total: number;
    per_page?: number;
    first_page_url?: string | null;
    last_page_url?: string | null;
    next_page_url?: string | null;
    prev_page_url?: string | null;
    links: PaginationLink[];
};

function decodeLabel(label: string): string {
    return label
        .replace('&laquo; Previous', 'Previous')
        .replace('Previous &laquo;', 'Previous')
        .replace('Next &raquo;', 'Next')
        .replace('&raquo; Next', 'Next')
        .replaceAll('&laquo;', '')
        .replaceAll('&raquo;', '')
        .replace(/&hellip;|&#8230;/g, '…')
        .trim();
}

function isPreviousLabel(label: string): boolean {
    return /previous/i.test(decodeLabel(label));
}

function isNextLabel(label: string): boolean {
    return /^next$/i.test(decodeLabel(label));
}

function withPage(url: string | null | undefined, page: number): string | null {
    if (!url) {
        return null;
    }

    try {
        const parsed = new URL(
            url,
            typeof window !== 'undefined'
                ? window.location.origin
                : 'http://localhost',
        );
        parsed.searchParams.set('page', String(page));

        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return url;
    }
}

function NavButton({
    href,
    label,
    icon: Icon,
    disabled = false,
}: {
    href?: string | null;
    label: string;
    icon: LucideIcon;
    disabled?: boolean;
}) {
    const content = (
        <>
            {label === 'Next' || label === 'Last' ? null : (
                <Icon className="size-4" />
            )}
            {label}
            {label === 'Next' || label === 'Last' ? (
                <Icon className="size-4" />
            ) : null}
        </>
    );

    if (!href || disabled) {
        return (
            <Button variant="outline" size="sm" disabled>
                {content}
            </Button>
        );
    }

    return (
        <Button variant="outline" size="sm" asChild>
            <Link href={href} preserveScroll preserveState>
                {content}
            </Link>
        </Button>
    );
}

export default function PaginationNav({
    paginator,
    itemLabel,
}: {
    paginator: Paginator;
    itemLabel: string;
}) {
    const pageLinks = paginator.links.filter(
        (link) => !isPreviousLabel(link.label) && !isNextLabel(link.label),
    );
    const previousUrl =
        paginator.prev_page_url ??
        paginator.links.find((link) => isPreviousLabel(link.label))?.url ??
        null;
    const nextUrl =
        paginator.next_page_url ??
        paginator.links.find((link) => isNextLabel(link.label))?.url ??
        null;
    const anyUrl =
        paginator.first_page_url ??
        paginator.last_page_url ??
        paginator.next_page_url ??
        paginator.prev_page_url ??
        pageLinks.find((link) => link.url)?.url ??
        previousUrl ??
        nextUrl;
    const firstUrl =
        paginator.current_page > 1
            ? (paginator.first_page_url ?? withPage(anyUrl, 1))
            : null;
    const lastUrl =
        paginator.current_page < paginator.last_page
            ? (paginator.last_page_url ??
              withPage(anyUrl, paginator.last_page))
            : null;

    return (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
                Showing {paginator.from ?? 0} to {paginator.to ?? 0} of{' '}
                {paginator.total} {itemLabel}
            </p>
            <nav
                aria-label="Pagination"
                className="flex flex-wrap items-center gap-2"
            >
                <NavButton
                    href={firstUrl}
                    label="First"
                    icon={ChevronsLeftIcon}
                    disabled={!firstUrl}
                />
                <NavButton
                    href={previousUrl}
                    label="Previous"
                    icon={ChevronLeftIcon}
                    disabled={!previousUrl}
                />
                {pageLinks.map((link, index) => {
                    const label = decodeLabel(link.label);

                    if (!link.url) {
                        return (
                            <Button
                                key={`${label}-${index}`}
                                variant="outline"
                                size="sm"
                                disabled
                            >
                                {label}
                            </Button>
                        );
                    }

                    return (
                        <Button
                            key={`${label}-${index}`}
                            variant={link.active ? 'default' : 'outline'}
                            size="sm"
                            asChild
                        >
                            <Link href={link.url} preserveScroll preserveState>
                                {label}
                            </Link>
                        </Button>
                    );
                })}
                <NavButton
                    href={nextUrl}
                    label="Next"
                    icon={ChevronRightIcon}
                    disabled={!nextUrl}
                />
                <NavButton
                    href={lastUrl}
                    label="Last"
                    icon={ChevronsRightIcon}
                    disabled={!lastUrl}
                />
            </nav>
        </div>
    );
}
