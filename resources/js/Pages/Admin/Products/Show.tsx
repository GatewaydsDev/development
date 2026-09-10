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
import { EditIcon, FileTextIcon, PackageIcon, TrashIcon } from 'lucide-react';
import {
    applyMarkup,
    applyTax,
    applyTaxTotal,
    formatCurrency,
} from '@/lib/money';
import { kindLabel, type ProductOptions, type ProductPayload } from './types';

type ShowProps = {
    product: ProductPayload;
    options: ProductOptions;
};

function DetailItem({
    label,
    value,
}: {
    label: string;
    value?: string | number | null;
}) {
    return (
        <div className="rounded-lg border border-border bg-background p-4">
            <dt className="text-sm font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">
                {value || 'Not added yet'}
            </dd>
        </div>
    );
}

export default function Show({ product, options }: ShowProps) {
    const sellPrice = applyMarkup(product.price, product.markup_percent);
    const minSellPrice = applyMarkup(
        product.price,
        product.min_markup_percent,
    );
    const taxRate = product.tax_rate ?? null;
    const sellTax = applyTax(sellPrice, taxRate);
    const sellTotal = applyTaxTotal(sellPrice, taxRate);
    const minSellTax = applyTax(minSellPrice, taxRate);
    const minSellTotal = applyTaxTotal(minSellPrice, taxRate);
    const removeProduct = () => {
        if (!window.confirm('Remove this product? This cannot be undone.')) {
            return;
        }

        router.delete(route('admin.products.destroy', product.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav
                            aria-label="Breadcrumb"
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                        >
                            <span>Administration</span>
                            <span>/</span>
                            <Link
                                href={route('admin.products.index')}
                                className="transition hover:text-foreground"
                            >
                                Products
                            </Link>
                            <span>/</span>
                            <span className="text-foreground">
                                {product.name}
                            </span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Product details
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {options.can.update && (
                            <Button asChild>
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
                        {options.can.delete && (
                            <Button variant="outline" onClick={removeProduct}>
                                <TrashIcon className="size-4" />
                                Remove
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title={product.name} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PackageIcon className="size-4 text-muted-foreground" />
                                {product.name}
                            </CardTitle>
                            <CardDescription>
                                {product.abbreviation
                                    ? `${product.abbreviation} · `
                                    : ''}
                                Reusable{' '}
                                {(
                                    product.type?.name ||
                                    kindLabel(product.kind)
                                ).toLowerCase()}{' '}
                                record.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-2">
                                <DetailItem
                                    label="Model"
                                    value={product.name}
                                />
                                <DetailItem
                                    label="Abbreviation"
                                    value={product.abbreviation}
                                />
                                <DetailItem
                                    label="Manufacturer"
                                    value={product.manufacturer?.name}
                                />
                                <DetailItem
                                    label="Type"
                                    value={
                                        product.type?.name ||
                                        kindLabel(product.kind)
                                    }
                                />
                                {(product.state_prices ?? []).length > 0 ? (
                                    <div className="md:col-span-2 flex flex-col gap-3">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            State prices
                                        </p>
                                        <div className="flex flex-col gap-3">
                                            {product.state_prices?.map(
                                                (statePrice) => {
                                                    const sell = applyMarkup(
                                                        statePrice.price,
                                                        statePrice.markup_percent,
                                                    );
                                                    const minSell =
                                                        applyMarkup(
                                                            statePrice.price,
                                                            statePrice.min_markup_percent,
                                                        );
                                                    const rate =
                                                        statePrice.tax_rate ??
                                                        statePrice.tax_state
                                                            ?.rate ??
                                                        null;
                                                    const sellTaxAmount =
                                                        applyTax(sell, rate);
                                                    const sellTotalAmount =
                                                        applyTaxTotal(
                                                            sell,
                                                            rate,
                                                        );
                                                    const minSellTaxAmount =
                                                        applyTax(minSell, rate);
                                                    const minSellTotalAmount =
                                                        applyTaxTotal(
                                                            minSell,
                                                            rate,
                                                        );

                                                    return (
                                                        <div
                                                            key={
                                                                statePrice.id ??
                                                                statePrice.tax_state_id
                                                            }
                                                            className="rounded-lg border border-border bg-background p-4"
                                                        >
                                                            <p className="text-sm font-medium text-foreground">
                                                                {statePrice
                                                                    .tax_state
                                                                    ?.name ||
                                                                    'State'}
                                                                {rate !== null
                                                                    ? ` (${rate}%)`
                                                                    : ''}
                                                            </p>
                                                            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                                                                <DetailItem
                                                                    label="Price"
                                                                    value={
                                                                        statePrice.price
                                                                            ? formatCurrency(
                                                                                  statePrice.price,
                                                                              )
                                                                            : null
                                                                    }
                                                                />
                                                                <DetailItem
                                                                    label="Sell markup"
                                                                    value={
                                                                        statePrice.markup_percent
                                                                            ? `${statePrice.markup_percent}%`
                                                                            : null
                                                                    }
                                                                />
                                                                <DetailItem
                                                                    label="Minimum markup"
                                                                    value={
                                                                        statePrice.min_markup_percent
                                                                            ? `${statePrice.min_markup_percent}%`
                                                                            : null
                                                                    }
                                                                />
                                                                <DetailItem
                                                                    label="Sell price"
                                                                    value={
                                                                        sell ===
                                                                        null
                                                                            ? null
                                                                            : formatCurrency(
                                                                                  sell,
                                                                              )
                                                                    }
                                                                />
                                                                <DetailItem
                                                                    label="Minimum sell price"
                                                                    value={
                                                                        minSell ===
                                                                        null
                                                                            ? null
                                                                            : formatCurrency(
                                                                                  minSell,
                                                                              )
                                                                    }
                                                                />
                                                                <DetailItem
                                                                    label="Sell price with tax"
                                                                    value={
                                                                        sellTotalAmount ===
                                                                        null
                                                                            ? null
                                                                            : formatCurrency(
                                                                                  sellTotalAmount,
                                                                              )
                                                                    }
                                                                />
                                                                <DetailItem
                                                                    label="Minimum sell price with tax"
                                                                    value={
                                                                        minSellTotalAmount ===
                                                                        null
                                                                            ? null
                                                                            : formatCurrency(
                                                                                  minSellTotalAmount,
                                                                              )
                                                                    }
                                                                />
                                                            </dl>
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                <DetailItem
                                    label="Price"
                                    value={
                                        product.price
                                            ? formatCurrency(product.price)
                                            : null
                                    }
                                />
                                <DetailItem
                                    label="Sell markup"
                                    value={
                                        product.markup_percent
                                            ? `${product.markup_percent}%`
                                            : null
                                    }
                                />
                                <DetailItem
                                    label="Minimum markup"
                                    value={
                                        product.min_markup_percent
                                            ? `${product.min_markup_percent}%`
                                            : null
                                    }
                                />
                                <DetailItem
                                    label="Sell price"
                                    value={
                                        sellPrice === null
                                            ? null
                                            : formatCurrency(sellPrice)
                                    }
                                />
                                <DetailItem
                                    label="Minimum sell price"
                                    value={
                                        minSellPrice === null
                                            ? null
                                            : formatCurrency(minSellPrice)
                                    }
                                />
                                <DetailItem
                                    label="State tax"
                                    value={
                                        product.tax_state
                                            ? `${product.tax_state.name}${
                                                  product.tax_rate != null ||
                                                  product.tax_state.rate !=
                                                      null
                                                      ? ` (${product.tax_rate ?? product.tax_state.rate}%)`
                                                      : ''
                                              }`
                                            : null
                                    }
                                />
                                <DetailItem
                                    label="Sell tax"
                                    value={
                                        sellTax === null
                                            ? null
                                            : formatCurrency(sellTax)
                                    }
                                />
                                <DetailItem
                                    label="Sell price with tax"
                                    value={
                                        sellTotal === null
                                            ? null
                                            : formatCurrency(sellTotal)
                                    }
                                />
                                <DetailItem
                                    label="Minimum sell tax"
                                    value={
                                        minSellTax === null
                                            ? null
                                            : formatCurrency(minSellTax)
                                    }
                                />
                                <DetailItem
                                    label="Minimum sell price with tax"
                                    value={
                                        minSellTotal === null
                                            ? null
                                            : formatCurrency(minSellTotal)
                                    }
                                />
                                    </>
                                )}
                            </dl>
                        </CardContent>
                    </Card>

                    {product.type?.allows_parts || product.kind === 'door' ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Door information</CardTitle>
                                <CardDescription>
                                    Configuration, handing, construction,
                                    ratings, and specification file for this
                                    door.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Configuration
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {(product.configurations ?? []).length >
                                        0 ? (
                                            product.configurations?.map(
                                                (item) => (
                                                    <Badge
                                                        key={item.id}
                                                        variant="outline"
                                                    >
                                                        {item.name}
                                                    </Badge>
                                                ),
                                            )
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No configuration added yet.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Door handing
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {(product.handings ?? []).length >
                                        0 ? (
                                            product.handings?.map((item) => (
                                                <Badge
                                                    key={item.id}
                                                    variant="outline"
                                                >
                                                    {item.name}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No handing added yet.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(product.constructions ?? []).length >
                                    0 ? (
                                        product.constructions?.map((item) => (
                                            <Badge
                                                key={item.id}
                                                variant="outline"
                                            >
                                                {item.name}
                                            </Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No construction added yet.
                                        </p>
                                    )}
                                </div>
                                <dl className="grid gap-4 md:grid-cols-2">
                                    <DetailItem
                                        label="RF shielding"
                                        value={product.rf_shielding}
                                    />
                                    <DetailItem
                                        label="STC rating"
                                        value={product.stc_rating}
                                    />
                                    <DetailItem
                                        label="ADA"
                                        value={
                                            product.ada === true
                                                ? 'Yes'
                                                : product.ada === false
                                                  ? 'No'
                                                  : null
                                        }
                                    />
                                    <DetailItem
                                        label="Fire label"
                                        value={product.fire_label}
                                    />
                                    <DetailItem
                                        label="Thickness"
                                        value={product.thickness}
                                    />
                                </dl>
                                {product.spec_pdf_url ? (
                                    <a
                                        href={product.spec_pdf_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                                    >
                                        <FileTextIcon className="size-4" />
                                        {product.spec_pdf_name ||
                                            'Door information PDF'}
                                    </a>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No specification PDF uploaded.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ) : null}

                    {product.type?.allows_parts || product.kind === 'door' ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Parts</CardTitle>
                                <CardDescription>
                                    Reusable parts attached to this door.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                {product.parts.length > 0 ? (
                                    product.parts.map((part) => (
                                        <Badge key={part.id} variant="outline">
                                            {part.name}
                                        </Badge>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No parts attached yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {(product.type?.name ||
                                        kindLabel(product.kind))}{' '}
                                    details
                                </CardTitle>
                                <CardDescription>
                                    Default text for this{' '}
                                    {(
                                        product.type?.name ||
                                        kindLabel(product.kind)
                                    ).toLowerCase()}
                                    .
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-base font-medium text-foreground">
                                    {product.description ||
                                        product.type?.name ||
                                        kindLabel(product.kind)}
                                </p>
                                {product.doors.length > 0 ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {product.doors.map((door) => (
                                            <Badge
                                                key={door.id}
                                                variant="outline"
                                            >
                                                {door.name}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Additional information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-2">
                                {(product.type?.allows_parts ||
                                    product.kind === 'door') && (
                                    <DetailItem
                                        label="Description"
                                        value={product.description}
                                    />
                                )}
                                <DetailItem
                                    label="Notes"
                                    value={product.notes}
                                />
                            </dl>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
