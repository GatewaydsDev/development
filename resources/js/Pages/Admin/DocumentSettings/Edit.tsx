import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ColorPalettePicker from '@/Components/ColorPalettePicker';
import FormActionFab from '@/Components/FormActionFab';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useMemo } from 'react';

type ColorSettings = {
    header_background_color: string;
    table_header_background_color: string;
};

type DocumentOption = {
    id: string;
    label: string;
    description: string;
};

type FormatOption = {
    id: string;
    label: string;
    description: string;
};

type ThemeCatalog = Record<
    string,
    {
        label: string;
        description: string;
        formats: Record<string, ColorSettings>;
    }
>;

type EditProps = {
    selected: {
        document: string;
        format: string;
    };
    documents: DocumentOption[];
    formats: FormatOption[];
    themes: ThemeCatalog;
    settings: ColorSettings;
    defaults: ColorSettings;
};

const styleItems: Array<{
    id: 'header_background_color' | 'table_header_background_color';
    label: string;
    hint: string;
}> = [
    {
        id: 'header_background_color',
        label: 'Header background',
        hint: 'Banner at the top of the report.',
    },
    {
        id: 'table_header_background_color',
        label: 'Table header background',
        hint: 'Column headings in scope, pricing, and list tables.',
    },
];

function normalizeHex(value: string, fallback: string): string {
    const hex = value.trim().toLowerCase();

    if (/^#[0-9a-f]{6}$/.test(hex)) {
        return hex;
    }

    if (/^#[0-9a-f]{3}$/.test(hex)) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }

    return fallback;
}

function contrastColor(hex: string): string {
    const value = hex.replace('#', '');
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

    return luminance > 0.55 ? '#111827' : '#ffffff';
}

export default function Edit({
    selected,
    documents,
    formats,
    themes,
    settings,
    defaults,
}: EditProps) {
    const { data, setData, patch, processing, errors } = useForm({
        document: selected.document,
        format: selected.format,
        header_background_color: settings.header_background_color,
        table_header_background_color: settings.table_header_background_color,
    });

    const currentDocument =
        documents.find((item) => item.id === data.document) ?? documents[0];
    const currentFormat =
        formats.find((item) => item.id === data.format) ?? formats[0];
    const headerColor = normalizeHex(
        data.header_background_color,
        defaults.header_background_color,
    );
    const tableHeaderColor = normalizeHex(
        data.table_header_background_color,
        defaults.table_header_background_color,
    );

    const previewColumns = useMemo(() => {
        if (data.document === 'catalog') {
            return ['Model', 'Type', 'Price'];
        }

        if (data.document.endsWith('_list')) {
            return ['Name', 'Number', 'Status'];
        }

        if (data.document === 'quotation') {
            return ['Item', 'Qty', 'Amount'];
        }

        return ['Service', 'Product', 'Total'];
    }, [data.document]);

    const loadTheme = (documentId: string, formatId: string) => {
        const theme = themes[documentId]?.formats?.[formatId] ?? defaults;

        setData('document', documentId);
        setData('format', formatId);
        setData('header_background_color', theme.header_background_color);
        setData(
            'table_header_background_color',
            theme.table_header_background_color,
        );
    };

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        patch(route('admin.document-settings.update'), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <span className="text-foreground">Document colors</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Document colors
                    </h2>
                </div>
            }
        >
            <Head title="Document colors" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <form
                        id="document-colors-form"
                        onSubmit={submit}
                        className="grid w-full min-w-0 max-w-full gap-6 pr-4 pb-28 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:pr-20 lg:pb-6"
                    >
                        <Card className="h-fit shadow-sm">
                            <CardHeader>
                                <CardTitle>Choose a document</CardTitle>
                                <CardDescription>
                                    Pick the report you want to restyle.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {documents.map((document) => (
                                    <button
                                        key={document.id}
                                        type="button"
                                        onClick={() =>
                                            loadTheme(document.id, data.format)
                                        }
                                        className={cn(
                                            'rounded-lg border px-3 py-3 text-left transition',
                                            data.document === document.id
                                                ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40'
                                                : 'border-border bg-background hover:bg-muted/60',
                                        )}
                                    >
                                        <span className="block text-sm font-semibold text-foreground">
                                            {document.label}
                                        </span>
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            {document.description}
                                        </span>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        <div className="flex flex-col gap-6">
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle>
                                        {currentDocument?.label} colors
                                    </CardTitle>
                                    <CardDescription>
                                        Choose print-ready, PDF, or Word, then
                                        set the header and table colors for
                                        that file.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                            Output
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {formats.map((format) => (
                                                <Button
                                                    key={format.id}
                                                    type="button"
                                                    variant={
                                                        data.format ===
                                                        format.id
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    onClick={() =>
                                                        loadTheme(
                                                            data.document,
                                                            format.id,
                                                        )
                                                    }
                                                >
                                                    {format.label}
                                                </Button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {currentFormat?.description}. These
                                            colors apply the next time this
                                            file is generated.
                                        </p>
                                    </div>

                                    <div className="grid gap-4">
                                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                            Item to customize
                                        </p>
                                        {styleItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-lg border border-border bg-background p-4"
                                            >
                                                <ColorPalettePicker
                                                    id={item.id}
                                                    label={item.label}
                                                    hint={`${item.hint} Click the color square to open the palette.`}
                                                    value={data[item.id]}
                                                    error={errors[item.id]}
                                                    onChange={(hex) =>
                                                        setData(item.id, hex)
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setData(
                                                    'header_background_color',
                                                    defaults.header_background_color,
                                                );
                                                setData(
                                                    'table_header_background_color',
                                                    defaults.table_header_background_color,
                                                );
                                            }}
                                        >
                                            Restore Gateway green
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle>Preview</CardTitle>
                                    <CardDescription>
                                        {currentFormat?.label} look for the{' '}
                                        {currentDocument?.label.toLowerCase()}.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <DocumentPreview
                                        documentLabel={
                                            currentDocument?.label ?? 'Bid'
                                        }
                                        format={data.format}
                                        headerColor={headerColor}
                                        tableHeaderColor={tableHeaderColor}
                                        columns={previewColumns}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </form>
                </div>
            </div>

            <FormActionFab
                form="document-colors-form"
                cancelHref={route('dashboard')}
                saveLabel="Save colors"
                disabled={processing}
            />
        </AuthenticatedLayout>
    );
}

function DocumentPreview({
    documentLabel,
    format,
    headerColor,
    tableHeaderColor,
    columns,
}: {
    documentLabel: string;
    format: string;
    headerColor: string;
    tableHeaderColor: string;
    columns: string[];
}) {
    const headerText = contrastColor(headerColor);
    const tableText = contrastColor(tableHeaderColor);

    if (format === 'word') {
        return (
            <div className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p
                        className="text-sm font-semibold"
                        style={{ color: headerColor }}
                    >
                        Gateway Door Systems
                    </p>
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: headerColor }}
                    >
                        {documentLabel}
                    </p>
                </div>
                <div className="px-4 py-4">
                    <p
                        className="text-xl font-semibold"
                        style={{ color: headerColor }}
                    >
                        {documentLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Word document preview
                    </p>
                    <div className="mt-4 overflow-x-auto overscroll-x-contain">
                    <table className="w-max min-w-full text-left text-sm">
                        <thead>
                            <tr
                                style={{
                                    backgroundColor: tableHeaderColor,
                                    color: tableText,
                                }}
                            >
                                {columns.map((column) => (
                                    <th
                                        key={column}
                                        className="px-3 py-2 font-semibold"
                                    >
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-border">
                                <td className="px-3 py-2">Sample row</td>
                                <td className="px-3 py-2">A-01</td>
                                <td className="px-3 py-2">$2,500.00</td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border">
            <div
                className="px-5 py-6"
                style={{ backgroundColor: headerColor, color: headerText }}
            >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
                    Gateway Door Systems
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {documentLabel}
                </p>
                <p className="mt-1 text-sm opacity-80">
                    {format === 'pdf'
                        ? 'PDF file preview'
                        : 'Print-ready preview'}
                </p>
            </div>
            <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-max min-w-full text-left text-sm">
                <thead>
                    <tr
                        style={{
                            backgroundColor: tableHeaderColor,
                            color: tableText,
                        }}
                    >
                        {columns.map((column) => (
                            <th key={column} className="px-4 py-2 font-semibold">
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-t border-border bg-background">
                        <td className="px-4 py-2">Sample row</td>
                        <td className="px-4 py-2">A-01</td>
                        <td className="px-4 py-2">$2,500.00</td>
                    </tr>
                </tbody>
            </table>
            </div>
        </div>
    );
}
