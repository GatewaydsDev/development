import CreatableSelect from '@/Components/CreatableSelect';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    emptyFieldTable,
    emptyProductField,
    selectableFieldsForProduct,
    valueFromProduct,
    type QuotationFieldTableFormData,
    type QuotationFormData,
    type QuotationOptions,
    type QuotationProductFieldFormData,
    type QuotationProductOption,
} from '../types';

type QuotationProductFieldsSectionProps = {
    options: QuotationOptions;
    tables: QuotationFieldTableFormData[];
    inputClassName: string;
    onChange: (tables: QuotationFieldTableFormData[]) => void;
};

const productLabel = (product: QuotationProductOption) =>
    [product.name, product.abbreviation].filter(Boolean).join(' · ');

export default function QuotationProductFieldsSection({
    options,
    tables,
    inputClassName,
    onChange,
}: QuotationProductFieldsSectionProps) {
    const products = options.products ?? [];
    const fieldOptions = options.fields ?? [];
    const [productTableIndex, setProductTableIndex] = useState<number | null>(
        null,
    );
    const [productQuery, setProductQuery] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedFieldNames, setSelectedFieldNames] = useState<string[]>([]);

    const productFor = (productId: string) =>
        products.find((product) => String(product.id) === productId);

    const selectedProduct = productFor(selectedProductId);

    const availableFields = useMemo(
        () => selectableFieldsForProduct(selectedProduct, fieldOptions),
        [fieldOptions, selectedProduct],
    );

    const filteredProducts = useMemo(() => {
        const query = productQuery.trim().toLowerCase();

        if (query === '') {
            return products;
        }

        return products.filter((product) => {
            const haystack = [product.name, product.abbreviation, product.kind]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(query);
        });
    }, [productQuery, products]);

    const updateTable = (
        index: number,
        patch: Partial<QuotationFieldTableFormData>,
    ) => {
        onChange(
            tables.map((table, tableIndex) =>
                tableIndex === index ? { ...table, ...patch } : table,
            ),
        );
    };

    const updateField = (
        tableIndex: number,
        fieldIndex: number,
        patch: Partial<QuotationProductFieldFormData>,
    ) => {
        const table = tables[tableIndex];

        if (!table) {
            return;
        }

        updateTable(tableIndex, {
            fields: table.fields.map((field, index) =>
                index === fieldIndex ? { ...field, ...patch } : field,
            ),
        });
    };

    const appendFields = (
        tableIndex: number,
        rows: QuotationProductFieldFormData[],
    ) => {
        const table = tables[tableIndex];

        if (!table || rows.length === 0) {
            return;
        }

        updateTable(tableIndex, {
            fields: [...table.fields, ...rows],
        });
    };

    const closeProductDialog = () => {
        setProductTableIndex(null);
        setProductQuery('');
        setSelectedProductId('');
        setSelectedFieldNames([]);
    };

    const toggleField = (name: string) => {
        setSelectedFieldNames((current) =>
            current.includes(name)
                ? current.filter((field) => field !== name)
                : [...current, name],
        );
    };

    const addSelectedProductFields = () => {
        if (
            productTableIndex === null ||
            !selectedProduct ||
            selectedFieldNames.length === 0
        ) {
            return;
        }

        const rows = selectedFieldNames.map((name) => {
            const option = fieldOptions.find(
                (field) => field.name.toLowerCase() === name.toLowerCase(),
            );
            const available = availableFields.find(
                (field) => field.name === name,
            );

            return {
                product_id: String(selectedProduct.id),
                field_id: option ? String(option.id) : '',
                field: option?.name ?? name,
                value: available?.value || valueFromProduct(selectedProduct, name),
            };
        });

        appendFields(productTableIndex, rows);
        closeProductDialog();
    };

    return (
        <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        Custom tables
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Create a table, then add only the fields you need. Type
                        values by hand or pull a selected specification from a
                        product.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => onChange([...tables, emptyFieldTable()])}
                >
                    <PlusIcon />
                    Create table
                </Button>
            </div>

            {tables.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                    No tables yet. Create one, then add fields such as
                    location / opening or fire rating.
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {tables.map((table, tableIndex) => (
                        <div
                            key={`quotation-table-${tableIndex}`}
                            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background p-4"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <TextInput
                                    id={`quotation-table-title-${tableIndex}`}
                                    value={table.title}
                                    className={`${inputClassName} min-w-0`}
                                    placeholder="Table title"
                                    onChange={(event) =>
                                        updateTable(tableIndex, {
                                            title: event.target.value,
                                        })
                                    }
                                />
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                        onClick={() =>
                                            appendFields(tableIndex, [
                                                emptyProductField(),
                                            ])
                                        }
                                    >
                                        <PlusIcon />
                                        Add field
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                        onClick={() =>
                                            setProductTableIndex(tableIndex)
                                        }
                                    >
                                        <PlusIcon />
                                        Add from product
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label={`Remove table ${tableIndex + 1}`}
                                        onClick={() =>
                                            onChange(
                                                tables.filter(
                                                    (_, index) =>
                                                        index !== tableIndex,
                                                ),
                                            )
                                        }
                                    >
                                        <Trash2Icon />
                                    </Button>
                                </div>
                            </div>

                            {table.fields.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Add a field or choose one specification from
                                    a product.
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full min-w-[32rem] border-collapse text-sm">
                                        <tbody>
                                            {table.fields.map((row, fieldIndex) => {
                                                const product = productFor(
                                                    row.product_id,
                                                );

                                                return (
                                                    <tr
                                                        key={`${tableIndex}-${row.field_id}-${fieldIndex}`}
                                                        className="border-b border-border last:border-b-0"
                                                    >
                                                        <td className="w-[34%] align-top border-r border-border bg-muted/40 p-3">
                                                            <CreatableSelect
                                                                id={`quotation-table-${tableIndex}-field-${fieldIndex}`}
                                                                label=""
                                                                value={
                                                                    row.field_id
                                                                }
                                                                options={
                                                                    fieldOptions
                                                                }
                                                                createRoute={route(
                                                                    'admin.quotation-fields.store',
                                                                )}
                                                                catalogKey="fields"
                                                                entityLabel="field"
                                                                compact
                                                                placeholder="Create or select a field"
                                                                menuMinWidth={280}
                                                                onChange={(
                                                                    fieldId,
                                                                    option,
                                                                ) => {
                                                                    const fieldName =
                                                                        option?.name ??
                                                                        '';
                                                                    const nextValue =
                                                                        fieldName !==
                                                                            '' &&
                                                                        row.product_id !==
                                                                            ''
                                                                            ? valueFromProduct(
                                                                                  product,
                                                                                  fieldName,
                                                                              )
                                                                            : '';

                                                                    updateField(
                                                                        tableIndex,
                                                                        fieldIndex,
                                                                        {
                                                                            field_id:
                                                                                fieldId,
                                                                            field: fieldName,
                                                                            ...(nextValue !==
                                                                            ''
                                                                                ? {
                                                                                      value: nextValue,
                                                                                  }
                                                                                : {}),
                                                                        },
                                                                    );
                                                                }}
                                                            />
                                                            {product ? (
                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    From{' '}
                                                                    {productLabel(
                                                                        product,
                                                                    )}
                                                                </p>
                                                            ) : null}
                                                        </td>
                                                        <td className="align-top p-3">
                                                            <TextInput
                                                                id={`quotation-table-${tableIndex}-value-${fieldIndex}`}
                                                                value={row.value}
                                                                className={`${inputClassName} min-w-0`}
                                                                placeholder="Enter a value"
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateField(
                                                                        tableIndex,
                                                                        fieldIndex,
                                                                        {
                                                                            value: event
                                                                                .target
                                                                                .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                        <td className="w-14 p-2 text-right align-top">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                aria-label={`Remove ${row.field || `field ${fieldIndex + 1}`}`}
                                                                onClick={() =>
                                                                    updateTable(
                                                                        tableIndex,
                                                                        {
                                                                            fields: table.fields.filter(
                                                                                (
                                                                                    _,
                                                                                    index,
                                                                                ) =>
                                                                                    index !==
                                                                                    fieldIndex,
                                                                            ),
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                <Trash2Icon />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <AlertDialog
                open={productTableIndex !== null}
                onOpenChange={(open) => {
                    if (open) {
                        return;
                    }

                    closeProductDialog();
                }}
            >
                <AlertDialogContent className="max-w-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Add from product
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose a product, then check only the information
                            you want in this table. Nothing is added unless you
                            select it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
                        <div className="flex min-w-0 flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="quotation-product-search"
                                    value="Product"
                                />
                                <TextInput
                                    id="quotation-product-search"
                                    value={productQuery}
                                    className={inputClassName}
                                    placeholder="Search products"
                                    onChange={(event) =>
                                        setProductQuery(event.target.value)
                                    }
                                />
                            </div>
                            <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-background">
                                {filteredProducts.length === 0 ? (
                                    <p className="px-4 py-6 text-sm text-muted-foreground">
                                        No products match that search.
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-border">
                                        {filteredProducts.map((product) => {
                                            const selected =
                                                selectedProductId ===
                                                String(product.id);

                                            return (
                                                <li key={product.id}>
                                                    <button
                                                        type="button"
                                                        className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left ${
                                                            selected
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/40'
                                                                : 'hover:bg-muted/60'
                                                        }`}
                                                        onClick={() => {
                                                            setSelectedProductId(
                                                                String(
                                                                    product.id,
                                                                ),
                                                            );
                                                            setSelectedFieldNames(
                                                                [],
                                                            );
                                                        }}
                                                    >
                                                        <span className="font-medium text-foreground">
                                                            {productLabel(
                                                                product,
                                                            )}
                                                        </span>
                                                        {product.kind ? (
                                                            <span className="text-xs capitalize text-muted-foreground">
                                                                {product.kind}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                        <div className="flex min-w-0 flex-col gap-3">
                            <InputLabel value="Information to add" />
                            <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-background">
                                {!selectedProduct ? (
                                    <p className="px-4 py-6 text-sm text-muted-foreground">
                                        Select a product, then check only the
                                        fields you need.
                                    </p>
                                ) : availableFields.length === 0 ? (
                                    <p className="px-4 py-6 text-sm text-muted-foreground">
                                        No specifications are available for this
                                        product.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-1 p-2">
                                        {availableFields.map((field) => (
                                            <label
                                                key={field.name}
                                                className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFieldNames.includes(
                                                        field.name,
                                                    )}
                                                    onChange={() =>
                                                        toggleField(field.name)
                                                    }
                                                    className="mt-1 size-4 rounded border-border text-emerald-600 focus:ring-emerald-600"
                                                />
                                                <span className="min-w-0">
                                                    <span className="block font-medium text-foreground">
                                                        {field.name}
                                                    </span>
                                                    <span className="block text-sm text-muted-foreground">
                                                        {field.value ||
                                                            'Add a value after inserting'}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            disabled={
                                !selectedProduct ||
                                selectedFieldNames.length === 0
                            }
                            onClick={addSelectedProductFields}
                        >
                            Add selected fields
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}

export function fieldTablesForSubmit(tables: QuotationFormData['field_tables']) {
    return tables
        .map((table) => ({
            title: table.title.trim(),
            fields: table.fields.filter(
                (row) =>
                    row.product_id.trim() !== '' ||
                    row.field_id.trim() !== '' ||
                    row.field.trim() !== '' ||
                    row.value.trim() !== '',
            ),
        }))
        .filter((table) => table.title !== '' || table.fields.length > 0);
}
