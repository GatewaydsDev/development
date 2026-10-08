import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ColorPalettePicker from '@/Components/ColorPalettePicker';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import LayoutElementsEditor, {
    ElementsReadOnly,
    LayoutElement,
    LayoutElementsController,
    ImportPanel,
    LayoutElementsFileInput,
    MergeField,
    PreviewZone,
    useLayoutElements,
} from './LayoutElements';
import { Head, useForm } from '@inertiajs/react';
import {
    CheckIcon,
    FilePlus2Icon,
    FileTextIcon,
    LayoutTemplateIcon,
    SearchIcon,
    XIcon,
} from 'lucide-react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { FormEventHandler, useMemo, useRef, useState } from 'react';

type TextCase = 'original' | 'camel' | 'uppercase' | 'lowercase';

type ZoneColors = { body: string; footer: string };

type DocumentSettings = {
    header_background_color: string;
    table_header_background_color: string;
    text_case: TextCase;
};

type LayoutRecord = DocumentSettings & {
    id: number;
    name: string;
    assignments: string[];
    elements: LayoutElement[];
    zone_colors: ZoneColors;
};

type AssignmentOption = {
    id: string;
    document: string;
    format: string;
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

type LayoutForm = DocumentSettings & {
    layout_id: number | null;
    name: string;
    assignments: string[];
    elements: LayoutElement[];
    zone_colors: ZoneColors;
};

type EditProps = {
    selected: {
        document: string;
        format: string;
    };
    selectedLayoutId: number | null;
    documents: DocumentOption[];
    formats: FormatOption[];
    assignmentOptions: AssignmentOption[];
    layouts: LayoutRecord[];
    settings: DocumentSettings;
    defaults: DocumentSettings;
    fields: MergeField[];
};

const textCaseOptions: Array<{
    id: TextCase;
    label: string;
    description: string;
}> = [
    {
        id: 'original',
        label: 'As entered',
        description: 'Keep the original text casing.',
    },
    {
        id: 'camel',
        label: 'camelCase',
        description: 'Join words and capitalize each word after the first.',
    },
    {
        id: 'uppercase',
        label: 'UPPERCASE',
        description: 'Convert all text to uppercase.',
    },
    {
        id: 'lowercase',
        label: 'lowercase',
        description: 'Convert all text to lowercase.',
    },
];

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

function applyTextCase(value: string, textCase: TextCase): string {
    if (textCase === 'uppercase') {
        return value.toUpperCase();
    }

    if (textCase === 'lowercase') {
        return value.toLowerCase();
    }

    if (textCase === 'camel') {
        const words = value.split(/[\s_-]+/u).filter(Boolean);

        return words
            .map((word, index) => {
                const lower = word.toLowerCase();

                return index === 0
                    ? lower
                    : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
            })
            .join('');
    }

    return value;
}

function emptyLayout(defaults: DocumentSettings): LayoutForm {
    return {
        layout_id: null,
        name: 'New print layout',
        assignments: [],
        elements: [],
        zone_colors: { body: '', footer: '' },
        ...defaults,
    };
}

export default function Edit({
    selected,
    selectedLayoutId,
    documents,
    formats,
    assignmentOptions,
    layouts,
    settings,
    defaults,
    fields,
}: EditProps) {
    const initialLayout = layouts.find(
        (layout) => layout.id === selectedLayoutId,
    );
    const {
        data,
        setData,
        setDefaults,
        post,
        patch,
        processing,
        errors,
        isDirty,
        clearErrors,
    } =
        useForm<LayoutForm>(
            initialLayout
                ? {
                      layout_id: initialLayout.id,
                      name: initialLayout.name,
                      assignments: initialLayout.assignments,
                      elements: initialLayout.elements,
                      header_background_color:
                          initialLayout.header_background_color,
                      table_header_background_color:
                          initialLayout.table_header_background_color,
                      text_case: initialLayout.text_case,
                      zone_colors: initialLayout.zone_colors,
                  }
                : {
                      layout_id: null,
                      name: 'New print layout',
                      assignments: [],
                      elements: [],
                      zone_colors: { body: '', footer: '' },
                      ...settings,
                  },
        );
    const elementsController = useLayoutElements(
        data.elements,
        (elements) => setData('elements', elements),
        fields,
        {
            header: data.header_background_color,
            body: data.zone_colors?.body ?? '',
            footer: data.zone_colors?.footer ?? '',
        },
        (zone, color) => {
            if (zone === 'header') {
                setData('header_background_color', color);
            } else {
                setData('zone_colors', {
                    body: data.zone_colors?.body ?? '',
                    footer: data.zone_colors?.footer ?? '',
                    [zone]: color,
                });
            }
        },
    );
    const [search, setSearch] = useState('');
    const [previewLayout, setPreviewLayout] = useState<LayoutRecord | LayoutForm | null>(
        null,
    );
    const editorSectionRef = useRef<HTMLElement>(null);

    const selectedLayout = layouts.find(
        (layout) => layout.id === data.layout_id,
    );
    const filteredLayouts = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return layouts;
        }

        return layouts.filter((layout) => {
            const assignments = layout.assignments
                .map((key) => assignmentOptions.find((option) => option.id === key))
                .filter((option): option is AssignmentOption => option !== undefined)
                .map((option) => `${option.document} ${option.format}`)
                .join(' ');

            return `${layout.name} ${assignments}`.toLowerCase().includes(query);
        });
    }, [assignmentOptions, layouts, search]);

    const headerColor = normalizeHex(
        data.header_background_color,
        defaults.header_background_color,
    );
    const tableHeaderColor = normalizeHex(
        data.table_header_background_color,
        defaults.table_header_background_color,
    );
    const previewColumns = useMemo(() => {
        const currentDocument = selected.document;

        if (currentDocument === 'catalog') {
            return ['Model', 'Type', 'Price'];
        }

        if (currentDocument.endsWith('_list')) {
            return ['Name', 'Number', 'Status'];
        }

        if (currentDocument === 'quotation') {
            return ['Item', 'Qty', 'Amount'];
        }

        return ['Service', 'Product', 'Total'];
    }, [selected.document]);

    const loadLayout = (layout: LayoutRecord) => {
        const values: LayoutForm = {
            layout_id: layout.id,
            name: layout.name,
            assignments: layout.assignments,
            elements: layout.elements,
            header_background_color: layout.header_background_color,
            table_header_background_color: layout.table_header_background_color,
            text_case: layout.text_case,
            zone_colors: layout.zone_colors,
        };
        setData(values);
        setDefaults(values);
        clearErrors();
    };

    const canReplaceDraft = () =>
        !isDirty ||
        window.confirm(
            'Discard your unsaved changes and switch to another layout?',
        );

    const scrollToEditor = () => {
        window.requestAnimationFrame(() =>
            editorSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            }),
        );
    };

    const selectLayout = (layout: LayoutRecord) => {
        if (canReplaceDraft()) {
            loadLayout(layout);
            scrollToEditor();
        }
    };

    const addLayout = () => {
        if (canReplaceDraft()) {
            const values = emptyLayout(defaults);
            setData(values);
            setDefaults(values);
            clearErrors();
            scrollToEditor();
        }
    };

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        const onSuccess = (page: { props: Record<string, unknown> }) => {
            const updatedProps = page.props as unknown as EditProps;
            const savedLayout = updatedProps.layouts.find(
                (layout) => layout.id === updatedProps.selectedLayoutId,
            );

            if (savedLayout) {
                loadLayout(savedLayout);
            }
        };

        if (data.layout_id === null) {
            post(route('admin.document-settings.store'), {
                preserveScroll: true,
                onSuccess,
            });

            return;
        }

        patch(
            route('admin.document-settings.update', data.layout_id),
            {
                preserveScroll: true,
                onSuccess,
            },
        );
    };

    const toggleAssignment = (key: string) => {
        const assignments = data.assignments.includes(key)
            ? data.assignments.filter((assignment) => assignment !== key)
            : [...data.assignments, key];

        setData('assignments', assignments);
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
                        <span className="text-foreground">Print layouts</span>
                    </nav>
                    <h2 className="mt-1 text-2xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Print layouts
                    </h2>
                </div>
            }
        >
            <Head title="Print layouts" />

            <div className="w-full px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
                <div className="mx-auto max-w-[120rem] space-y-10">
                    <section aria-labelledby="saved-layouts-heading">
                        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                                    Layout library
                                </p>
                                <h1
                                    id="saved-layouts-heading"
                                    className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                                >
                                    Choose a layout to work on
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                                    Reuse a saved style across print, PDF, and
                                    Word outputs—or create a new one.
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={addLayout}
                                disabled={processing}
                                className="h-10 gap-2 self-start bg-emerald-700 text-white hover:bg-emerald-800 sm:self-auto"
                            >
                                <FilePlus2Icon />
                                Add new layout
                            </Button>
                        </div>

                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">
                                {layouts.length}{' '}
                                {layouts.length === 1 ? 'saved layout' : 'saved layouts'}
                            </p>
                            <label className="relative block w-full sm:max-w-xs">
                                <span className="sr-only">Search layouts</span>
                                <SearchIcon
                                    aria-hidden="true"
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search layouts or assignments"
                                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                                />
                            </label>
                        </div>

                        {filteredLayouts.length > 0 ? (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {filteredLayouts.map((layout) => (
                                    <Card
                                        key={layout.id}
                                        className={cn(
                                            'group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg',
                                            data.layout_id === layout.id
                                                ? 'border-emerald-600 ring-2 ring-emerald-600/20 dark:border-emerald-400'
                                                : 'border-border',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => selectLayout(layout)}
                                            disabled={processing}
                                            aria-pressed={
                                                data.layout_id === layout.id
                                            }
                                            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                                        >
                                            <LayoutThumbnail
                                                headerColor={
                                                    layout.header_background_color
                                                }
                                                tableColor={
                                                    layout.table_header_background_color
                                                }
                                            />
                                            <div className="p-4 pb-2">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <CardTitle className="truncate text-base">
                                                            {layout.name}
                                                        </CardTitle>
                                                        <CardDescription className="mt-1">
                                                            {layout.assignments.length ===
                                                            0
                                                                ? 'Not assigned to an output'
                                                                : `${layout.assignments.length} assigned ${
                                                                      layout.assignments.length ===
                                                                      1
                                                                          ? 'output'
                                                                          : 'outputs'
                                                                  }`}
                                                        </CardDescription>
                                                    </div>
                                                    {data.layout_id ===
                                                    layout.id ? (
                                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                                                            <CheckIcon className="size-3.5" />
                                                            Selected
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </button>
                                        <CardContent className="flex items-center justify-between gap-3 pt-2">
                                            <p className="line-clamp-1 text-xs text-muted-foreground">
                                                {textCaseOptions.find(
                                                    (option) =>
                                                        option.id ===
                                                        layout.text_case,
                                                )?.label ?? 'As entered'}
                                                {' · '}
                                                {layout.assignments
                                                    .slice(0, 2)
                                                    .map((key) => {
                                                        const assignment =
                                                            assignmentOptions.find(
                                                                (option) =>
                                                                    option.id ===
                                                                    key,
                                                            );

                                                        return assignment
                                                            ? `${assignment.document} ${assignment.format}`
                                                            : key;
                                                    })
                                                    .join(', ')}
                                                {layout.assignments.length > 2
                                                    ? ` +${layout.assignments.length - 2}`
                                                    : ''}
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0 gap-1.5"
                                                onClick={() =>
                                                    setPreviewLayout(layout)
                                                }
                                            >
                                                <FileTextIcon />
                                                Preview
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="border-dashed shadow-none">
                                <CardContent className="flex flex-col items-center py-12 text-center">
                                    <LayoutTemplateIcon className="size-9 text-muted-foreground" />
                                    <p className="mt-3 font-semibold text-foreground">
                                        No layouts match that search
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Try another name or output combination.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </section>

                    <section
                        ref={editorSectionRef}
                        aria-labelledby="layout-editor-heading"
                        className="scroll-mt-6"
                    >
                        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                                    Layout editor
                                </p>
                                <h2
                                    id="layout-editor-heading"
                                    className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
                                >
                                    {data.layout_id === null
                                        ? 'Create a new layout'
                                        : `Edit ${selectedLayout?.name ?? data.name}`}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Set where this layout is used and how it
                                    transforms the generated document.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={processing}
                                    onClick={() => {
                                        setData({
                                            ...data,
                                            header_background_color:
                                                defaults.header_background_color,
                                            table_header_background_color:
                                                defaults.table_header_background_color,
                                            text_case: defaults.text_case,
                                            zone_colors: { body: "", footer: "" },
                                        });
                                    }}
                                >
                                    Restore style defaults
                                </Button>
                                <Button
                                    type="submit"
                                    form="print-layouts-form"
                                    disabled={processing}
                                    className="min-w-32 gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
                                >
                                    <CheckIcon />
                                    {processing
                                        ? 'Saving…'
                                        : data.layout_id === null
                                          ? 'Create layout'
                                          : 'Save layout'}
                                </Button>
                            </div>
                        </div>

                        <form
                            id="print-layouts-form"
                            onSubmit={submit}
                            className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(25rem,0.8fr)]"
                        >
                            <div className="space-y-6">
                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle>Layout details</CardTitle>
                                        <CardDescription>
                                            Give this style a clear name and
                                            select every output that should use
                                            it.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div>
                                            <InputLabel
                                                htmlFor="layout-name"
                                                value="Layout name"
                                            />
                                            <TextInput
                                                id="layout-name"
                                                value={data.name}
                                                onChange={(event) =>
                                                    setData(
                                                        'name',
                                                        event.target.value,
                                                    )
                                                }
                                                maxLength={120}
                                                required
                                                className="mt-1.5 h-11 w-full"
                                                placeholder="e.g. Modern proposal"
                                            />
                                            <InputError
                                                message={errors.name}
                                            />
                                        </div>

                                        <fieldset>
                                            <legend className="text-sm font-medium text-foreground">
                                                Assign to documents and outputs
                                            </legend>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                The same layout can be shared
                                                across multiple combinations.
                                            </p>
                                            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                {documents.map((document) => (
                                                    <div
                                                        key={document.id}
                                                        className="rounded-xl border border-border bg-muted/20 p-3"
                                                    >
                                                        <p className="mb-2 text-sm font-semibold text-foreground">
                                                            {document.label}
                                                        </p>
                                                        <div className="space-y-2">
                                                            {formats.map(
                                                                (format) => {
                                                                    const key = `${document.id}.${format.id}`;
                                                                    const checked =
                                                                        data.assignments.includes(
                                                                            key,
                                                                        );

                                                                    return (
                                                                        <label
                                                                            key={
                                                                                key
                                                                            }
                                                                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground"
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={
                                                                                    checked
                                                                                }
                                                                                onChange={() =>
                                                                                    toggleAssignment(
                                                                                        key,
                                                                                    )
                                                                                }
                                                                                className="size-4 rounded border-border accent-emerald-700 focus-visible:ring-2 focus-visible:ring-ring/50"
                                                                            />
                                                                            <span>
                                                                                {
                                                                                    format.label
                                                                                }
                                                                            </span>
                                                                        </label>
                                                                    );
                                                                },
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <InputError
                                                message={errors.assignments}
                                            />
                                        </fieldset>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle>Layout design</CardTitle>
                                        <CardDescription>
                                            Add, remove, and resize text,
                                            images, dates, dividers, and
                                            spacers at the top or bottom of
                                            every assigned document. Applies
                                            to print and PDF output.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <LayoutElementsFileInput
                                            controller={elementsController}
                                        />
                                        <ImportPanel
                                            controller={elementsController}
                                        />
                                        <LayoutElementsEditor
                                            controller={elementsController}
                                            applyCase={(value) =>
                                                applyTextCase(
                                                    value,
                                                    data.text_case,
                                                )
                                            }
                                            error={errors.elements}
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle>Style and text</CardTitle>
                                        <CardDescription>
                                            These settings apply to every text
                                            element in each assigned output.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Text casing
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Choose how all generated text
                                                should be capitalized.
                                            </p>
                                            <div
                                                role="group"
                                                aria-label="Text casing"
                                                className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
                                            >
                                                {textCaseOptions.map(
                                                    (option) => (
                                                        <button
                                                            key={option.id}
                                                            type="button"
                                                            aria-pressed={
                                                                data.text_case ===
                                                                option.id
                                                            }
                                                            onClick={() =>
                                                                setData(
                                                                    'text_case',
                                                                    option.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                'rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                                                                data.text_case ===
                                                                    option.id
                                                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-100'
                                                                    : 'border-border bg-background hover:bg-muted/50',
                                                            )}
                                                        >
                                                            <span className="block text-sm font-semibold">
                                                                {option.label}
                                                            </span>
                                                            <span className="mt-1 block text-xs text-muted-foreground">
                                                                {
                                                                    option.description
                                                                }
                                                            </span>
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            {styleItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="rounded-xl border border-border bg-background p-4"
                                                >
                                                    <ColorPalettePicker
                                                        id={item.id}
                                                        label={item.label}
                                                        hint={item.hint}
                                                        value={data[item.id]}
                                                        error={errors[item.id]}
                                                        onChange={(hex) =>
                                                            setData(
                                                                item.id,
                                                                hex,
                                                            )
                                                        }
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="h-fit overflow-hidden shadow-sm 2xl:sticky 2xl:top-6">
                                <CardHeader className="border-b border-border">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle>Live preview</CardTitle>
                                            <CardDescription className="mt-1">
                                                Click the top or bottom section
                                                to add or remove components.
                                            </CardDescription>
                                        </div>
                                        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                            Sample
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="bg-muted/40 p-4 sm:p-6">
                                    <DocumentPreview
                                        documentLabel={
                                        data.assignments[0]
                                            ? assignmentOptions.find(
                                                  (option) =>
                                                      option.id ===
                                                      data.assignments[0],
                                              )?.document ?? 'Bid'
                                            : 'Bid'
                                        }
                                        textCase={data.text_case}
                                        headerColor={headerColor}
                                        tableHeaderColor={tableHeaderColor}
                                        columns={previewColumns}
                                        elements={data.elements}
                                        zoneColors={data.zone_colors}
                                        controller={elementsController}
                                    />
                                </CardContent>
                            </Card>
                        </form>
                    </section>
                </div>
            </div>

            <Dialog
                open={previewLayout !== null}
                onClose={() => setPreviewLayout(null)}
                className="relative z-50"
            >
                <div
                    className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
                    aria-hidden="true"
                />
                <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                        <DialogPanel className="w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                                        Document preview
                                    </p>
                                    <DialogTitle className="mt-1 text-lg font-semibold text-foreground">
                                        {previewLayout?.name ?? 'Layout preview'}
                                    </DialogTitle>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Close preview"
                                    onClick={() => setPreviewLayout(null)}
                                >
                                    <XIcon />
                                </Button>
                            </div>
                            {previewLayout ? (
                                <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto bg-slate-100 p-4 dark:bg-slate-950 sm:p-8">
                                    <div className="mx-auto max-w-4xl">
                                        <DocumentPreview
                                            documentLabel={
                                                previewLayout.assignments[0]
                                                    ? assignmentOptions.find(
                                                          (option) =>
                                                              option.id ===
                                                              previewLayout
                                                                  .assignments[0],
                                                      )?.document ?? 'Bid'
                                                    : 'Bid'
                                            }
                                            textCase={previewLayout.text_case}
                                            headerColor={
                                                previewLayout.header_background_color
                                            }
                                            tableHeaderColor={
                                                previewLayout.table_header_background_color
                                            }
                                            columns={previewColumns}
                                            elements={previewLayout.elements}
                                            zoneColors={previewLayout.zone_colors}
                                            fields={fields}
                                            fullPage
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </DialogPanel>
                    </div>
                </div>
            </Dialog>
        </AuthenticatedLayout>
    );
}

function LayoutThumbnail({
    headerColor,
    tableColor,
}: {
    headerColor: string;
    tableColor: string;
}) {
    return (
        <div
            className="relative h-32 overflow-hidden border-b border-border bg-slate-100 p-3 dark:bg-slate-950"
            aria-hidden="true"
        >
            <div className="mx-auto h-28 max-w-[13rem] rounded-md border border-slate-200 bg-white p-2 shadow-sm transition-transform duration-300 group-hover:scale-[1.03] dark:border-slate-800">
                <div
                    className="h-8 rounded-sm px-2 py-1.5"
                    style={{ backgroundColor: headerColor }}
                >
                    <div className="h-1 w-12 rounded bg-white/80" />
                    <div className="mt-1 h-1.5 w-20 rounded bg-white/60" />
                </div>
                <div className="mt-2 flex gap-1">
                    <div className="h-1 w-10 rounded bg-slate-200" />
                    <div className="h-1 w-16 rounded bg-slate-100" />
                </div>
                <div className="mt-2 overflow-hidden rounded-sm border border-slate-200">
                    <div
                        className="flex h-3 items-center gap-1 px-1"
                        style={{ backgroundColor: tableColor }}
                    >
                        <div className="h-0.5 w-7 rounded bg-white/80" />
                        <div className="h-0.5 w-5 rounded bg-white/60" />
                        <div className="h-0.5 w-6 rounded bg-white/50" />
                    </div>
                    {[0, 1].map((row) => (
                        <div
                            key={row}
                            className="flex h-3 items-center gap-1 border-t border-slate-100 px-1"
                        >
                            <div className="h-0.5 w-7 rounded bg-slate-200" />
                            <div className="h-0.5 w-5 rounded bg-slate-100" />
                            <div className="h-0.5 w-6 rounded bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                Layout
            </div>
        </div>
    );
}

function DocumentPreview({
    documentLabel,
    textCase,
    headerColor,
    tableHeaderColor,
    columns,
    elements,
    controller,
    fields,
    zoneColors,
    fullPage = false,
}: {
    zoneColors?: ZoneColors;
    documentLabel: string;
    textCase: TextCase;
    headerColor: string;
    tableHeaderColor: string;
    columns: string[];
    elements: LayoutElement[];
    controller?: LayoutElementsController;
    fields?: MergeField[];
    fullPage?: boolean;
}) {
    const headerText = contrastColor(headerColor);
    const tableText = contrastColor(tableHeaderColor);
    const caseText = (value: string) => applyTextCase(value, textCase);
    const previewRows = [
        ['Automatic entrance system', 'A-01', '$2,500.00'],
        ['Fire-rated door assembly', 'B-14', '$1,840.00'],
        ['Installation and commissioning', 'S-02', '$680.00'],
    ];

    return (
        <article
            className={cn(
                'overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/10 dark:border-slate-700',
                fullPage && 'mx-auto max-w-4xl',
            )}
        >
            <header
                className={cn(
                    'px-5 py-5 sm:px-8 sm:py-7',
                    fullPage && 'sm:px-12 sm:py-10',
                )}
                style={{ backgroundColor: headerColor, color: headerText }}
            >
                {controller ? (
                    <PreviewZone
                        controller={controller}
                        zone="header"
                        applyCase={caseText}
                    />
                ) : (
                    <ElementsReadOnly
                        elements={elements}
                        zone="header"
                        fields={fields}
                        inBanner
                    />
                )}
            </header>

            {controller &&
            !elements.some((element) => element.zone === 'body') ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-emerald-300 bg-emerald-50 px-5 py-2 text-xs text-emerald-900">
                    <span>
                        The sections below are generated by the system. To edit
                        them, turn them into components.
                    </span>
                    <button
                        type="button"
                        onClick={() => controller.seedStandardSections()}
                        className="rounded-md bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700"
                    >
                        Make body editable
                    </button>
                </div>
            ) : null}

            {controller || elements.some((element) => element.zone === 'body') ? (
                <div className={cn('p-5 sm:p-8', fullPage && 'sm:p-12')}>
                    {controller ? (
                        <PreviewZone
                            controller={controller}
                            zone="body"
                            applyCase={caseText}
                        />
                    ) : (
                        <ElementsReadOnly
                            elements={elements}
                            zone="body"
                            background={zoneColors?.body}
                            fields={fields}
                        />
                    )}
                </div>
            ) : null}

            <div
                className={cn(
                    'space-y-6 p-5 sm:p-8',
                    fullPage && 'sm:p-12',
                    elements.some((element) => element.zone === 'body') &&
                        'hidden',
                )}
            >
                <div className="grid gap-5 border-b border-slate-200 pb-5 sm:grid-cols-2">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {caseText('Prepared for')}
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                            {caseText('Northwest Commercial Properties')}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {caseText('245 Market Street, Portland, OR')}
                        </p>
                    </div>
                    <div className="sm:text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {caseText('Prepared on')}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                            {caseText('October 7, 2025')}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {caseText('Valid for 30 days')}
                        </p>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                        {caseText('Scope and pricing')}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {caseText(
                            'The following items are included in this project proposal.',
                        )}
                    </p>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[28rem] text-left text-xs sm:text-sm">
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
                                            className="px-3 py-2.5 font-semibold first:rounded-l-md last:rounded-r-md sm:px-4"
                                        >
                                            {caseText(column)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewRows.map((row, index) => (
                                    <tr
                                        key={row[0]}
                                        className="border-b border-slate-100"
                                    >
                                        <td className="px-3 py-3 font-medium sm:px-4">
                                            {caseText(row[0])}
                                        </td>
                                        <td className="px-3 py-3 text-slate-500 sm:px-4">
                                            {row[1]}
                                        </td>
                                        <td className="px-3 py-3 text-right font-medium sm:px-4">
                                            {index === 0
                                                ? row[2]
                                                : caseText(row[2])}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="max-w-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {caseText('Notes')}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            {caseText(
                                'Pricing includes materials, delivery, and professional installation.',
                            )}
                        </p>
                    </div>
                    <div className="w-full max-w-xs border-t-2 border-slate-900 pt-3 sm:text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {caseText('Estimated total')}
                        </p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                            $5,020.00
                        </p>
                    </div>
                </div>

                <footer className="flex flex-col gap-1 border-t border-slate-200 pt-4 text-[10px] text-slate-400 sm:flex-row sm:justify-between">
                    <span>{caseText('Gateway Door Systems')}</span>
                    <span>{caseText('Thank you for your business')}</span>
                </footer>
            </div>
            {controller ? (
                <PreviewZone
                    controller={controller}
                    zone="footer"
                    applyCase={caseText}
                />
            ) : (
                <ElementsReadOnly
                    elements={elements}
                    zone="footer"
                    background={zoneColors?.footer}
                    fields={fields}
                />
            )}
        </article>
    );
}
