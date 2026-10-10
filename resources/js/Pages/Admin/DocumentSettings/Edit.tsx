import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ColorPalettePicker from "@/Components/ColorPalettePicker";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import TextInput from "@/Components/TextInput";
import { Button } from "@/Components/ui/button";
import PrintLayoutThumbnail from "@/Components/PrintLayoutThumbnail";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import FormActionFab from "@/Components/FormActionFab";
import { cn } from "@/lib/utils";
import { PRINT_LAYOUT_WIDTH } from "@/lib/printLayoutGeometry";
import LayoutElementsEditor, {
    ElementsReadOnly,
    ImportPanel,
    LayoutElement,
    LayoutElementsController,
    LayoutElementsFileInput,
    MergeField,
    PreviewZone,
    useLayoutElements,
} from "./LayoutElements";
import { Head, useForm } from "@inertiajs/react";
import { toast } from "sonner";
import {
    CheckIcon,
    FilePlus2Icon,
    FileTextIcon,
    LayoutTemplateIcon,
    SearchIcon,
    XIcon,
} from "lucide-react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { FormEventHandler, useMemo, useRef, useState } from "react";

type TextCase = "original" | "camel" | "uppercase" | "lowercase";

type ZoneColors = { body: string; footer: string; header_height?: number };

const defaultElements = (): LayoutElement[] => [];

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
        id: "original",
        label: "As entered",
        description: "Keep the original text casing.",
    },
    {
        id: "camel",
        label: "camelCase",
        description: "Join words and capitalize each word after the first.",
    },
    {
        id: "uppercase",
        label: "UPPERCASE",
        description: "Convert all text to uppercase.",
    },
    {
        id: "lowercase",
        label: "lowercase",
        description: "Convert all text to lowercase.",
    },
];

const styleItems: Array<{
    id: "header_background_color" | "table_header_background_color";
    label: string;
    hint: string;
}> = [
    {
        id: "header_background_color",
        label: "Header background",
        hint: "Banner at the top of the report.",
    },
    {
        id: "table_header_background_color",
        label: "Table header background",
        hint: "Column headings in scope, pricing, and list tables.",
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
    const value = hex.replace("#", "");
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

    return luminance > 0.55 ? "#111827" : "#ffffff";
}

function applyTextCase(value: string, textCase: TextCase): string {
    if (textCase === "uppercase") {
        return value.toUpperCase();
    }

    if (textCase === "lowercase") {
        return value.toLowerCase();
    }

    if (textCase === "camel") {
        const words = value.split(/[\s_-]+/u).filter(Boolean);

        return words
            .map((word, index) => {
                const lower = word.toLowerCase();

                return index === 0
                    ? lower
                    : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
            })
            .join("");
    }

    return value;
}

function emptyLayout(defaults: DocumentSettings): LayoutForm {
    return {
        layout_id: null,
        name: "New print layout",
        assignments: [],
        elements: defaultElements(),
        zone_colors: { body: "", footer: "" },
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
    } = useForm<LayoutForm>(
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
                  name: "New print layout",
                  assignments: [],
                  elements: defaultElements(),
                  zone_colors: { body: "", footer: "" },
                  ...settings,
              },
    );
    const elementsController = useLayoutElements(
        data.elements,
        (elements) => setData("elements", elements),
        fields,
        {
            header: data.header_background_color,
            intro: "",
            body: data.zone_colors?.body ?? "",
            footer: data.zone_colors?.footer ?? "",
        },
        (zone, color) => {
            if (zone === "header") {
                setData("header_background_color", color);
            } else {
                setData("zone_colors", {
                    ...data.zone_colors,
                    body: data.zone_colors?.body ?? "",
                    footer: data.zone_colors?.footer ?? "",
                    [zone]: color,
                });
            }
        },
        data.zone_colors?.header_height ?? 160,
        (height) =>
            setData("zone_colors", {
                body: data.zone_colors?.body ?? "",
                footer: data.zone_colors?.footer ?? "",
                header_height: height,
            }),
    );
    const [search, setSearch] = useState("");
    const [previewLayout, setPreviewLayout] = useState<
        LayoutRecord | LayoutForm | null
    >(null);
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
                .map((key) =>
                    assignmentOptions.find((option) => option.id === key),
                )
                .filter(
                    (option): option is AssignmentOption =>
                        option !== undefined,
                )
                .map((option) => `${option.document} ${option.format}`)
                .join(" ");

            return `${layout.name} ${assignments}`
                .toLowerCase()
                .includes(query);
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

        if (currentDocument === "catalog") {
            return ["Model", "Type", "Price"];
        }

        if (currentDocument.endsWith("_list")) {
            return ["Name", "Number", "Status"];
        }

        if (currentDocument === "quotation") {
            return ["Item", "Qty", "Amount"];
        }

        return ["Service", "Product", "Total"];
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
        setNewLayoutPdfNotes([]);
    };

    const [pendingLayoutChange, setPendingLayoutChange] = useState<
        { kind: "select"; layout: LayoutRecord } | { kind: "new" } | null
    >(null);
    const [newLayoutDialog, setNewLayoutDialog] = useState(false);
    const [newLayoutImportBusy, setNewLayoutImportBusy] = useState(false);
    const [newLayoutPdfNotes, setNewLayoutPdfNotes] = useState<string[]>([]);

    const scrollToEditor = () => {
        window.requestAnimationFrame(() =>
            editorSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            }),
        );
    };

    const selectLayout = (layout: LayoutRecord) => {
        if (isDirty) {
            setPendingLayoutChange({ kind: "select", layout });
            return;
        }
        loadLayout(layout);
        scrollToEditor();
    };

    const startNewLayout = () => {
        const values = emptyLayout(defaults);
        setData(values);
        setDefaults(values);
        clearErrors();
        setNewLayoutPdfNotes([]);
        setNewLayoutDialog(false);
        scrollToEditor();
    };

    const addLayout = () => {
        if (isDirty) {
            setPendingLayoutChange({ kind: "new" });
            return;
        }
        setNewLayoutDialog(true);
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

        const onError = (errors: Record<string, string>) => {
            const first = Object.values(errors)[0];
            toast.error(first ?? "The layout could not be saved.");
        };

        if (data.layout_id === null) {
            post(route("admin.document-settings.store"), {
                preserveScroll: true,
                onSuccess,
                onError,
            });

            return;
        }

        patch(route("admin.document-settings.update", data.layout_id), {
            preserveScroll: true,
            onSuccess,
            onError,
        });
    };

    const toggleAssignment = (key: string) => {
        const assignments = data.assignments.includes(key)
            ? data.assignments.filter((assignment) => assignment !== key)
            : [...data.assignments, key];

        setData("assignments", assignments);
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
                                {layouts.length}{" "}
                                {layouts.length === 1
                                    ? "saved layout"
                                    : "saved layouts"}
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
                                            "group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                                            data.layout_id === layout.id
                                                ? "border-emerald-600 ring-2 ring-emerald-600/20 dark:border-emerald-400"
                                                : "border-border",
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
                                            <PrintLayoutThumbnail
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
                                                            {layout.assignments
                                                                .length === 0
                                                                ? "Not assigned to an output"
                                                                : `${layout.assignments.length} assigned ${
                                                                      layout
                                                                          .assignments
                                                                          .length ===
                                                                      1
                                                                          ? "output"
                                                                          : "outputs"
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
                                                )?.label ?? "As entered"}
                                                {" · "}
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
                                                    .join(", ")}
                                                {layout.assignments.length > 2
                                                    ? ` +${layout.assignments.length - 2}`
                                                    : ""}
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
                                        ? "Create a new layout"
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
                                            zone_colors: {
                                                body: "",
                                                footer: "",
                                            },
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
                                    {processing ? "Saving…" : "Save layout"}
                                </Button>
                            </div>
                        </div>

                        <form
                            id="print-layouts-form"
                            onSubmit={submit}
                            className="space-y-6"
                        >
                            <FormActionFab
                                form="print-layouts-form"
                                cancelHref={route(
                                    "admin.document-settings.edit",
                                )}
                                saveLabel={processing ? "Saving…" : "Save layout"}
                                disabled={processing}
                            />
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
                                                        "name",
                                                        event.target.value,
                                                    )
                                                }
                                                maxLength={120}
                                                required
                                                className="mt-1.5 h-11 w-full"
                                                placeholder="e.g. Modern proposal"
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <fieldset>
                                            <legend className="text-sm font-medium text-foreground">
                                                Assign to documents and outputs
                                            </legend>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                The same layout can be shared
                                                across multiple combinations.
                                            </p>
                                            {data.assignments.length === 0 ? (
                                                <p
                                                    role="alert"
                                                    className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
                                                >
                                                    This layout is not assigned
                                                    to any document, so your
                                                    changes will not appear on
                                                    printed documents. Tick at
                                                    least one document below,
                                                    then save.
                                                </p>
                                            ) : null}
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

                                <Card className="overflow-hidden shadow-sm">
                                    <CardHeader className="border-b border-border">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <CardTitle>
                                                    Live preview
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    Use the toolbar to add
                                                    components to the header,
                                                    then select one in the
                                                    preview to edit or drag it.
                                                </CardDescription>
                                            </div>
                                            <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                                Sample
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 p-4 sm:p-6">
                                        {newLayoutPdfNotes.length ? <ul role="status" className="space-y-1 text-sm text-muted-foreground">
                                            {newLayoutPdfNotes.map((note) => <li key={note}>{note}</li>)}
                                        </ul> : null}
                                        <LayoutElementsFileInput
                                            controller={elementsController}
                                        />
                                        <ImportPanel controller={elementsController} />
                                        <LayoutElementsEditor
                                            controller={elementsController}
                                            error={errors.elements}
                                        >
                                            <div className="rounded-xl bg-muted/40 p-4 sm:p-6">
                                                <DocumentPreview
                                                    fullPage
                                                    documentLabel={
                                                        data.assignments[0]
                                                            ? (assignmentOptions.find(
                                                                  (option) =>
                                                                      option.id ===
                                                                      data
                                                                          .assignments[0],
                                                              )?.document ??
                                                              "Bid")
                                                            : "Bid"
                                                    }
                                                    textCase={data.text_case}
                                                    headerColor={headerColor}
                                                    tableHeaderColor={
                                                        tableHeaderColor
                                                    }
                                                    columns={previewColumns}
                                                    elements={data.elements}
                                                    zoneColors={
                                                        data.zone_colors
                                                    }
                                                    controller={
                                                        elementsController
                                                    }
                                                />
                                            </div>
                                        </LayoutElementsEditor>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle>Style and text</CardTitle>
                                        <CardDescription>
                                            These settings apply to generated
                                            document text. Layout components use
                                            their own text-case controls.
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
                                                                    "text_case",
                                                                    option.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                "rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                                                data.text_case ===
                                                                    option.id
                                                                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-100"
                                                                    : "border-border bg-background hover:bg-muted/50",
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
                        </form>
                    </section>
                </div>
            </div>

            <AlertDialog
                open={pendingLayoutChange !== null}
                onOpenChange={(open) => { if (!open) setPendingLayoutChange(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingLayoutChange?.kind === "select"
                                ? `Switching to “${pendingLayoutChange.layout.name}” will discard your unsaved layout changes.`
                                : "Creating a new layout will discard your unsaved layout changes."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (pendingLayoutChange?.kind === "select") {
                                loadLayout(pendingLayoutChange.layout);
                                scrollToEditor();
                            } else if (pendingLayoutChange?.kind === "new") {
                                setNewLayoutDialog(true);
                            }
                            setPendingLayoutChange(null);
                        }}>
                            Discard changes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={newLayoutDialog} onClose={() => { if (!newLayoutImportBusy) setNewLayoutDialog(false); }} className="relative z-50">
                <div className="fixed inset-0 bg-slate-950/70" aria-hidden="true" />
                <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                        <DialogPanel className="w-full max-w-2xl space-y-5 rounded-xl border border-border bg-background p-5 shadow-xl sm:p-6">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <DialogTitle className="text-lg font-semibold">Add new layout</DialogTitle>
                                    <p className="mt-1 text-sm text-muted-foreground">Start blank or upload a PDF to reuse its design with blank editable text on every page.</p>
                                </div>
                                <Button type="button" variant="ghost" size="icon" aria-label="Cancel new layout" disabled={newLayoutImportBusy}
                                    onClick={() => setNewLayoutDialog(false)}><XIcon /></Button>
                            </div>
                            <ImportPanel controller={elementsController} pdfOnly onBusyChange={setNewLayoutImportBusy}
                                onImported={(elements, filename, notes) => {
                                    const blank = emptyLayout(defaults);
                                    setDefaults(blank);
                                    setData({ ...blank, name: filename.replace(/\.pdf$/i, "").slice(0, 120), elements });
                                    clearErrors();
                                    setNewLayoutPdfNotes(notes);
                                    elementsController.setSelectedId(elements.find((element) => element.type === "text")?.id ?? null);
                                    setNewLayoutDialog(false);
                                    scrollToEditor();
                                }} />
                            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
                                <Button type="button" variant="outline" disabled={newLayoutImportBusy}
                                    onClick={() => setNewLayoutDialog(false)}>Cancel</Button>
                                <Button type="button" disabled={newLayoutImportBusy} onClick={startNewLayout}>Start blank</Button>
                            </div>
                        </DialogPanel>
                    </div>
                </div>
            </Dialog>

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
                                        {previewLayout?.name ??
                                            "Layout preview"}
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
                                                    ? (assignmentOptions.find(
                                                          (option) =>
                                                              option.id ===
                                                              previewLayout
                                                                  .assignments[0],
                                                      )?.document ?? "Bid")
                                                    : "Bid"
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
                                            zoneColors={
                                                previewLayout.zone_colors
                                            }
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
        ["Automatic entrance system", "A-01", "$2,500.00"],
        ["Fire-rated door assembly", "B-14", "$1,840.00"],
        ["Installation and commissioning", "S-02", "$680.00"],
    ];

    return (
        <article
            className={cn(
                "overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/10 dark:border-slate-700",
                fullPage && "mx-auto max-w-4xl",
            )}
        >
            <div className="overflow-x-auto">
                <header style={{ width: PRINT_LAYOUT_WIDTH + (controller ? 52 : 0), backgroundColor: headerColor, color: headerText }}>
                    {controller ? (
                        <PreviewZone
                            controller={controller}
                            zone="header"
                            applyCase={caseText}
                            textCase={textCase}
                        />
                    ) : (
                        <ElementsReadOnly
                            elements={elements}
                            zone="header"
                            fields={fields}
                            inBanner
                            textCase={textCase}
                            headerHeight={zoneColors?.header_height ?? 160}
                        />
                    )}
                </header>
            </div>

            <div
                aria-hidden="true"
                className={cn("space-y-3 p-5 sm:p-8", fullPage && "sm:p-12")}
            >
                <div className="h-2 w-1/3 rounded bg-slate-100" />
                <div className="h-2 w-2/3 rounded bg-slate-100" />
                <div className="h-2 w-1/2 rounded bg-slate-100" />
                <p className="pt-2 text-center text-[11px] text-slate-400">
                    The rest of the document is added by the system.
                </p>
            </div>
        </article>
    );
}
