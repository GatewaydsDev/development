import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
    EditIcon,
    EyeIcon,
    FileTextIcon,
    PackageIcon,
    PlusIcon,
    PrinterIcon,
    SearchIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
    kindLabel,
    type ProductOptions,
    type ProductsPaginator,
} from './types';

type IndexProps = {
    filters: {
        search?: string;
        type?: number | string;
        highlight?: number | null;
    };
    options: ProductOptions;
    products: ProductsPaginator;
};

const compactBadgeClassName =
    'h-4 max-w-full truncate rounded-full px-1.5 text-[10px] leading-none';

const productRowGridClassName =
    'md:grid-cols-[minmax(20rem,2.6fr)_minmax(6rem,0.6fr)_5.25rem_minmax(6.25rem,0.7fr)_minmax(6.25rem,0.7fr)_5rem_4.5rem_11rem]';

function CatalogBadges({
    items,
}: {
    items?: Array<{ id: number; name: string }>;
}) {
    if (!items?.length) {
        return <span className="text-sm text-muted-foreground">—</span>;
    }

    return (
        <div className="flex flex-col items-start gap-1">
            {items.map((item) => (
                <Badge
                    key={item.id}
                    variant="outline"
                    className={compactBadgeClassName}
                >
                    {item.name}
                </Badge>
            ))}
        </div>
    );
}

export default function Index({ filters, options, products }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [type, setType] = useState(
        filters.type ? String(filters.type) : '',
    );
    const highlightedProductId = filters.highlight ?? null;

    useEffect(() => {
        if (!highlightedProductId) {
            return;
        }

        document
            .getElementById(`product-row-${highlightedProductId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightedProductId]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.products.index'),
            { search, type },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const paginationLabel = (label: string) =>
        label
            .replace('&laquo; Previous', 'Previous')
            .replace('Next &raquo;', 'Next');

    const exportQuery = {
        search: search || undefined,
        type: type || undefined,
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Products</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Products
                        </h2>
                    </div>

                    {options.can.create && (
                        <Button asChild>
                            <Link href={route('admin.products.create')}>
                                <PlusIcon className="size-4" />
                                Add product
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Products" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <PackageIcon className="size-4 text-muted-foreground" />
                                    Total products
                                </CardTitle>
                                <CardDescription>
                                    Reusable doors and parts.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {products.total}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Product directory</CardTitle>
                                <CardDescription>
                                    Search doors and reusable door parts.
                                </CardDescription>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-auto">
                                <form
                                    onSubmit={submit}
                                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                                >
                                    <div className="relative">
                                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            placeholder="Search products"
                                            className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground sm:w-64"
                                        />
                                    </div>
                                    <select
                                        value={type}
                                        onChange={(event) =>
                                            setType(event.target.value)
                                        }
                                        className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                                    >
                                        <option value="">All types</option>
                                        {(options.types ?? []).map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button type="submit" variant="outline">
                                        Search
                                    </Button>
                                </form>
                                <div className="flex flex-wrap gap-2 sm:justify-end">
                                    <Button variant="outline" asChild>
                                        <a
                                            href={route(
                                                'admin.products.print',
                                                exportQuery,
                                            )}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <PrinterIcon className="size-4" />
                                            Print
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <a
                                            href={route(
                                                'admin.products.export.pdf',
                                                exportQuery,
                                            )}
                                        >
                                            <FileTextIcon className="size-4" />
                                            PDF
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <a
                                            href={route(
                                                'admin.products.export.word',
                                                exportQuery,
                                            )}
                                        >
                                            <FileTextIcon className="size-4" />
                                            Word 2026
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-hidden rounded-lg border border-border">
                                <div className={cn('hidden items-center gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid', productRowGridClassName)}>
                                    <div>Model</div>
                                    <div>Manufacturer</div>
                                    <div>Type</div>
                                    <div>Configuration</div>
                                    <div>Door handing</div>
                                    <div>Price</div>
                                    <div>Linked</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {products.data.length > 0 ? (
                                    products.data.map((product) => (
                                        <div
                                            id={`product-row-${product.id}`}
                                            key={product.id}
                                            className={cn(
                                                'grid gap-3 border-b border-border px-4 py-4 last:border-b-0 md:min-h-20 md:items-center md:gap-3',
                                                productRowGridClassName,
                                                highlightedProductId ===
                                                    product.id &&
                                                    'bg-emerald-50 dark:bg-emerald-950/30',
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium text-foreground wrap-break-word">
                                                    {product.name}
                                                </p>
                                                {product.abbreviation ? (
                                                    <p className="truncate text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                                        {product.abbreviation}
                                                    </p>
                                                ) : null}
                                                {product.constructions
                                                    ?.length ? (
                                                    <div className="mt-1">
                                                        <CatalogBadges
                                                            items={
                                                                product.constructions
                                                            }
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="min-w-0 text-sm text-muted-foreground">
                                                {product.manufacturer?.name ||
                                                    'Not added yet'}
                                            </div>
                                            <div>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        compactBadgeClassName
                                                    }
                                                >
                                                    {product.type?.name ||
                                                        kindLabel(product.kind)}
                                                </Badge>
                                            </div>
                                            <div className="min-w-0">
                                                <CatalogBadges
                                                    items={
                                                        product.configurations
                                                    }
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <CatalogBadges
                                                    items={product.handings}
                                                />
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {product.price
                                                    ? formatCurrency(
                                                          product.price,
                                                      )
                                                    : '—'}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {product.type?.allows_parts ||
                                                product.kind === 'door'
                                                    ? `${product.part_count ?? 0} parts`
                                                    : `${product.door_count ?? 0} doors`}
                                            </div>
                                            <div className="flex flex-nowrap gap-2 md:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={route(
                                                            'admin.products.show',
                                                            product.id,
                                                        )}
                                                    >
                                                        <EyeIcon className="size-4" />
                                                        View
                                                    </Link>
                                                </Button>
                                                {options.can.update && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={route(
                                                                'admin.products.edit',
                                                                product.id,
                                                            )}
                                                        >
                                                            <EditIcon className="size-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                        No products found.
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {products.from ?? 0} to{' '}
                                    {products.to ?? 0} of {products.total}{' '}
                                    products
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {products.links.length > 3 &&
                                        products.links.map((link, index) =>
                                            link.url ? (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant={
                                                        link.active
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link href={link.url}>
                                                        {paginationLabel(
                                                            link.label,
                                                        )}
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                >
                                                    {paginationLabel(
                                                        link.label,
                                                    )}
                                                </Button>
                                            ),
                                        )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
