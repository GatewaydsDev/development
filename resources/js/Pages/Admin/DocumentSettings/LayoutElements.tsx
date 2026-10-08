import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import {
    AlignCenterIcon,
    AlignLeftIcon,
    AlignRightIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    BoldIcon,
    CalendarIcon,
    CopyIcon,
    ImageIcon,
    ItalicIcon,
    MinusIcon,
    MoveVerticalIcon,
    Trash2Icon,
    TypeIcon,
    FileUpIcon,
    UploadIcon,
} from 'lucide-react';
import {
    DragEvent,
    PointerEvent as ReactPointerEvent,
    useRef,
    useState,
} from 'react';

export type ElementType = 'text' | 'image' | 'divider' | 'spacer' | 'date';
export type ElementZone = 'header' | 'body' | 'footer';
export type ElementCase = 'original' | 'camel' | 'uppercase' | 'lowercase';

export function transformCase(value: string, textCase: ElementCase): string {
    if (textCase === 'uppercase') {
        return value.toUpperCase();
    }

    if (textCase === 'lowercase') {
        return value.toLowerCase();
    }

    if (textCase === 'camel') {
        return value
            .split(/[\s_-]+/u)
            .filter(Boolean)
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

export type MergeField = {
    key: string;
    label: string;
    group: string;
    sample: string;
};

export function fillFields(value: string, fields: MergeField[]): string {
    return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, key: string) => {
        return fields.find((field) => field.key === key)?.sample ?? '';
    });
}

const caseChoices: Array<{ id: ElementCase; label: string }> = [
    { id: 'original', label: 'As entered' },
    { id: 'camel', label: 'camelCase' },
    { id: 'uppercase', label: 'UPPERCASE' },
    { id: 'lowercase', label: 'lowercase' },
];
export type ElementAlign = 'left' | 'center' | 'right';

export type LayoutElement = {
    id: string;
    type: ElementType;
    zone: ElementZone;
    content: string;
    src: string;
    align: ElementAlign;
    width: number;
    height: number;
    font_size: number;
    bold: boolean;
    italic: boolean;
    text_case: ElementCase;
    color: string;
};

const tools: Array<{
    type: ElementType;
    label: string;
    icon: typeof TypeIcon;
}> = [
    { type: 'text', label: 'Text', icon: TypeIcon },
    { type: 'image', label: 'Image', icon: ImageIcon },
    { type: 'date', label: 'Date', icon: CalendarIcon },
    { type: 'divider', label: 'Divider', icon: MinusIcon },
    { type: 'spacer', label: 'Spacer', icon: MoveVerticalIcon },
];

const zones: Array<{ id: ElementZone; label: string; hint: string }> = [
    {
        id: 'header',
        label: 'Header',
        hint: 'Top of the page, on the header color. Replaces the standard header.',
    },
    {
        id: 'body',
        label: 'Body',
        hint: 'The page content. Adding anything here replaces the generated document content.',
    },
    {
        id: 'footer',
        label: 'Footer',
        hint: 'Appears below the generated document.',
    },
];

function newId(): string {
    return `el-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function handleStyle(element: LayoutElement) {
    if (element.align === 'right') {
        return { right: `calc(${element.width}% - 4px)` };
    }

    if (element.align === 'center') {
        return { left: `calc(${50 + element.width / 2}% - 4px)` };
    }

    return { left: `calc(${element.width}% - 4px)` };
}

function createElement(type: ElementType, zone: ElementZone): LayoutElement {
    return {
        id: newId(),
        type,
        zone,
        content: type === 'text' ? 'New text' : '',
        src: '',
        align: 'left',
        width: type === 'image' ? 30 : 100,
        height: type === 'divider' ? 2 : 24,
        font_size: 12,
        bold: false,
        italic: false,
        text_case: 'original',
        color: zone === 'header' ? '#ffffff' : '#111827',
    };
}

const elementLabel = (element: LayoutElement) =>
    ({
        text: 'Text',
        image: 'Image',
        divider: 'Divider',
        spacer: 'Spacer',
        date: 'Date',
    })[element.type];

export function ElementPreview({
    element,
    fields = [],
}: {
    element: LayoutElement;
    fields?: MergeField[];
    applyCase?: (value: string) => string;
}) {
    const margin =
        element.align === 'center'
            ? '0 auto'
            : element.align === 'right'
              ? '0 0 0 auto'
              : '0';
    const box = {
        width: `${element.width}%`,
        margin,
        textAlign: element.align,
    } as const;

    if (element.type === 'spacer') {
        return <div style={{ height: element.height }} />;
    }

    if (element.type === 'divider') {
        return (
            <div
                style={{
                    ...box,
                    borderTop: `${element.height}px solid ${element.color}`,
                    marginTop: 6,
                    marginBottom: 6,
                }}
            />
        );
    }

    if (element.type === 'image') {
        return element.src ? (
            <div style={{ ...box, padding: '4px 0' }}>
                <img
                    src={element.src}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: 'auto' }}
                />
            </div>
        ) : null;
    }

    const content =
        element.type === 'date'
            ? new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
              })
            : fillFields(element.content, fields);

    return content.trim() === '' ? null : (
        <div
            style={{
                ...box,
                fontSize: element.font_size,
                color: element.color,
                fontWeight: element.bold ? 700 : 400,
                fontStyle: element.italic ? 'italic' : 'normal',
                lineHeight: 1.35,
                padding: '2px 0',
                whiteSpace: 'pre-line',
            }}
        >
            {transformCase(content, element.text_case)}
        </div>
    );
}

export function ElementsReadOnly({
    elements,
    zone,
    fields = [],
    inBanner = false,
    background = '',
}: {
    elements: LayoutElement[];
    zone: ElementZone;
    fields?: MergeField[];
    applyCase?: (value: string) => string;
    inBanner?: boolean;
    background?: string;
}) {
    const items = elements.filter((element) => element.zone === zone);

    if (items.length === 0) {
        return null;
    }

    return (
        <div
            className={inBanner ? 'mt-4' : 'px-5 py-3 sm:px-8'}
            style={background ? { backgroundColor: background } : undefined}
        >
            {items.map((element) => (
                <ElementPreview
                    key={element.id}
                    element={element}
                    fields={fields}
                />
            ))}
        </div>
    );
}

async function uploadImage(file: File): Promise<string> {
    const token = decodeURIComponent(
        document.cookie
            .split('; ')
            .find((row) => row.startsWith('XSRF-TOKEN='))
            ?.slice('XSRF-TOKEN='.length) ?? '',
    );
    const body = new FormData();
    body.append('image', file);
    const response = await fetch(route('admin.document-settings.images'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': token,
        },
        body,
    });
    const payload = (await response.json().catch(() => null)) as {
        url?: string;
        message?: string;
        errors?: { image?: string[] };
    } | null;

    if (!response.ok || !payload?.url) {
        throw new Error(
            payload?.errors?.image?.[0] ??
                payload?.message ??
                'Could not upload that image.',
        );
    }

    return payload.url;
}

export function useLayoutElements(
    elements: LayoutElement[],
    onChange: (elements: LayoutElement[]) => void,
    fields: MergeField[] = [],
    zoneColors: Record<ElementZone, string> = {
        header: '',
        body: '',
        footer: '',
    },
    setZoneColor: (zone: ElementZone, color: string) => void = () => {},
) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [targetZone, setTargetZone] = useState<ElementZone>('header');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingImageFor = useRef<string | null>(null);

    const selected = elements.find((element) => element.id === selectedId);

    const update = (id: string, patch: Partial<LayoutElement>) =>
        onChange(
            elements.map((element) =>
                element.id === id ? { ...element, ...patch } : element,
            ),
        );

    const add = (type: ElementType, zone: ElementZone = targetZone) => {
        const element = createElement(type, zone);
        setTargetZone(zone);
        onChange([...elements, element]);
        setSelectedId(element.id);

        if (type === 'image') {
            pendingImageFor.current = element.id;
            fileInputRef.current?.click();
        }
    };

    const remove = (id: string) => {
        onChange(elements.filter((element) => element.id !== id));
        setSelectedId(null);
    };

    const duplicate = (element: LayoutElement) => {
        const copy = { ...element, id: newId() };
        const index = elements.findIndex((item) => item.id === element.id);
        const next = [...elements];
        next.splice(index + 1, 0, copy);
        onChange(next);
        setSelectedId(copy.id);
    };

    const move = (id: string, direction: -1 | 1) => {
        const element = elements.find((item) => item.id === id);

        if (!element) {
            return;
        }

        const siblings = elements.filter((item) => item.zone === element.zone);
        const siblingIndex = siblings.findIndex((item) => item.id === id);
        const other = siblings[siblingIndex + direction];

        if (!other) {
            return;
        }

        const next = [...elements];
        const from = next.findIndex((item) => item.id === id);
        const to = next.findIndex((item) => item.id === other.id);
        [next[from], next[to]] = [next[to], next[from]];
        onChange(next);
    };

    const dropOn = (zone: ElementZone, beforeId: string | null) => {
        if (!dragId) {
            return;
        }

        const dragged = elements.find((element) => element.id === dragId);

        if (!dragged || dragId === beforeId) {
            setDragId(null);

            return;
        }

        const rest = elements.filter((element) => element.id !== dragId);
        const moved = { ...dragged, zone };
        const index =
            beforeId === null
                ? -1
                : rest.findIndex((element) => element.id === beforeId);

        if (index === -1) {
            const lastInZone = rest.map((e) => e.zone).lastIndexOf(zone);
            rest.splice(lastInZone + 1, 0, moved);
        } else {
            rest.splice(index, 0, moved);
        }

        onChange(rest);
        setDragId(null);
    };

    const handleFile = async (file: File | undefined) => {
        const id = pendingImageFor.current;
        pendingImageFor.current = null;

        if (!file || !id) {
            return;
        }

        setUploading(true);
        setUploadError(null);

        try {
            update(id, { src: await uploadImage(file) });
        } catch (caught) {
            setUploadError(
                caught instanceof Error
                    ? caught.message
                    : 'Could not upload that image.',
            );
        } finally {
            setUploading(false);
        }
    };

    const startResize = (
        event: ReactPointerEvent<HTMLElement>,
        element: LayoutElement,
        axis: 'width' | 'height',
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const handle = event.currentTarget;
        const box = handle.parentElement;

        if (!box) {
            return;
        }

        handle.setPointerCapture(event.pointerId);
        const containerWidth = box.getBoundingClientRect().width;
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = element.width;
        const startHeight = element.height;
        const factor = element.align === 'center' ? 2 : 1;
        const direction = element.align === 'right' ? -1 : 1;

        const onMove = (moveEvent: PointerEvent) => {
            if (axis === 'width') {
                const delta =
                    ((moveEvent.clientX - startX) / containerWidth) *
                    100 *
                    factor *
                    direction;
                update(element.id, {
                    width: Math.round(
                        Math.max(5, Math.min(100, startWidth + delta)),
                    ),
                });
            } else {
                update(element.id, {
                    height: Math.round(
                        Math.max(
                            1,
                            Math.min(
                                400,
                                startHeight + (moveEvent.clientY - startY),
                            ),
                        ),
                    ),
                });
            }
        };
        const onUp = () => {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
    };

    const importElements = (incoming: LayoutElement[], replace: boolean) => {
        const next = replace ? incoming : [...elements, ...incoming];
        onChange(next);
        setSelectedId(incoming[0]?.id ?? null);
    };

    const seedStandardSections = () => {
        const text = (
            content: string,
            patch: Partial<LayoutElement> = {},
        ): LayoutElement => ({
            ...createElement('text', 'body'),
            content,
            ...patch,
        });
        const muted = { font_size: 10, color: '#64748b', bold: true };
        const seeded: LayoutElement[] = [
            text('PREPARED FOR', muted),
            text('{{project_name}}', { bold: true, font_size: 14 }),
            text('{{project_address}}', { color: '#64748b' }),
            text('PREPARED ON', muted),
            text('{{document_date}}', { bold: true, font_size: 14 }),
            { ...createElement('divider', 'body'), color: '#e2e8f0' },
            text('Scope and pricing', { bold: true, font_size: 16 }),
            text('The following items are included in this document.'),
            text('Item 1 - description and price'),
            text('Item 2 - description and price'),
            text('Total', { bold: true, font_size: 18, align: 'right' }),
        ];
        onChange([...elements, ...seeded]);
        setTargetZone('body');
        setSelectedId(seeded[0].id);
    };

    return {
        zoneColors,
        setZoneColor,
        seedStandardSections,
        importElements,
        elements,
        fields,
        selectedId,
        setSelectedId,
        selected,
        targetZone,
        setTargetZone,
        uploading,
        uploadError,
        dragId,
        setDragId,
        fileInputRef,
        pendingImageFor,
        update,
        add,
        remove,
        duplicate,
        move,
        dropOn,
        handleFile,
        startResize,
    };
}

export type LayoutElementsController = ReturnType<typeof useLayoutElements>;

export function LayoutElementsFileInput({
    controller,
}: {
    controller: LayoutElementsController;
}) {
    return (
        <input
            ref={controller.fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
                void controller.handleFile(event.target.files?.[0]);
                event.target.value = '';
            }}
        />
    );
}

type ImportMode = 'text' | 'layout';

function xsrfToken(): string {
    return decodeURIComponent(
        document.cookie
            .split('; ')
            .find((row) => row.startsWith('XSRF-TOKEN='))
            ?.slice('XSRF-TOKEN='.length) ?? '',
    );
}

export function ImportPanel({
    controller,
}: {
    controller: LayoutElementsController;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<ImportMode>('text');
    const [replace, setReplace] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{
        tone: 'ok' | 'error';
        lines: string[];
    } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const run = async () => {
        if (!file) {
            return;
        }

        setBusy(true);
        setMessage(null);

        try {
            const body = new FormData();
            body.append('file', file);
            body.append('mode', mode);
            const response = await fetch(route('admin.document-settings.import'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body,
            });
            const payload = (await response.json().catch(() => null)) as {
                elements?: LayoutElement[];
                notes?: string[];
                message?: string;
                errors?: { file?: string[] };
            } | null;

            if (!response.ok || !payload?.elements) {
                throw new Error(
                    payload?.errors?.file?.[0] ??
                        payload?.message ??
                        'Could not import that file.',
                );
            }

            controller.importElements(payload.elements, replace);
            const count = payload.elements.length;
            setMessage({
                tone: count > 0 ? 'ok' : 'error',
                lines: [
                    count > 0
                        ? `Added ${count} ${count === 1 ? 'component' : 'components'} to the header and footer. Review them, then save the layout.`
                        : 'Nothing was added.',
                    ...(payload.notes ?? []),
                ],
            });
        } catch (caught) {
            setMessage({
                tone: 'error',
                lines: [
                    caught instanceof Error
                        ? caught.message
                        : 'Could not import that file.',
                ],
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mb-4 rounded-xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
                <FileUpIcon className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                        Import from an existing document
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Choose a PDF or Word file. The header and footer
                        sections are generated for you as components.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="sr-only"
                            aria-label="PDF or Word file"
                            onChange={(event) => {
                                setFile(event.target.files?.[0] ?? null);
                                setMessage(null);
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => inputRef.current?.click()}
                        >
                            <UploadIcon />
                            Choose PDF or Word file
                        </Button>
                        <span className="max-w-xs truncate text-xs text-muted-foreground">
                            {file ? file.name : 'No file selected'}
                        </span>
                    </div>

                    <fieldset className="mt-3">
                        <legend className="text-xs font-medium text-foreground">
                            What to copy
                        </legend>
                        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="import-mode"
                                    checked={mode === 'text'}
                                    onChange={() => setMode('text')}
                                    className="accent-emerald-700"
                                />
                                All text and sections
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="import-mode"
                                    checked={mode === 'layout'}
                                    onChange={() => setMode('layout')}
                                    className="accent-emerald-700"
                                />
                                Section layout only (no text)
                            </label>
                        </div>
                    </fieldset>

                    <label className="mt-3 inline-flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={replace}
                            onChange={(event) => setReplace(event.target.checked)}
                            className="size-4 rounded accent-emerald-700"
                        />
                        Replace the whole layout (header, body and footer)
                    </label>

                    <div className="mt-3">
                        <Button
                            type="button"
                            size="sm"
                            disabled={!file || busy}
                            onClick={() => void run()}
                            className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                            <FileUpIcon />
                            {busy ? 'Reading file…' : 'Generate sections'}
                        </Button>
                    </div>

                    {message ? (
                        <ul
                            role="status"
                            className={cn(
                                'mt-3 space-y-1 text-xs',
                                message.tone === 'ok'
                                    ? 'text-emerald-800 dark:text-emerald-300'
                                    : 'text-red-600',
                            )}
                        >
                            {message.lines.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function LayoutElementsEditor({
    controller,
    applyCase,
    error,
}: {
    controller: LayoutElementsController;
    applyCase: (value: string) => string;
    error?: string;
}) {
    const {
        elements,
        selectedId,
        setSelectedId,
        selected,
        targetZone,
        setTargetZone,
        uploading,
        uploadError,
        dragId,
        setDragId,
        fileInputRef,
        pendingImageFor,
        update,
        add,
        remove,
        duplicate,
        move,
        dropOn,
        startResize,
    } = controller;

    const renderZone = (zone: (typeof zones)[number]) => {
        const items = elements.filter((element) => element.zone === zone.id);

        return (
            <div
                key={zone.id}
                onDragOver={(event: DragEvent) => {
                    if (dragId) {
                        event.preventDefault();
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    dropOn(zone.id, null);
                }}
                className={cn(
                    'rounded-lg border-2 border-dashed p-3 transition',
                    targetZone === zone.id
                        ? 'border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-border bg-muted/20',
                )}
            >
                <button
                    type="button"
                    onClick={() => setTargetZone(zone.id)}
                    className="mb-2 flex w-full items-baseline justify-between gap-3 text-left"
                    aria-pressed={targetZone === zone.id}
                >
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        {zone.label}
                        {targetZone === zone.id ? (
                            <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
                                Adding here
                            </span>
                        ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {zone.hint}
                    </span>
                </button>

                <div className="min-h-16 rounded-md bg-white p-3 text-slate-800 shadow-sm">
                    {items.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-400">
                            Nothing here yet. Use the toolbar to add an element.
                        </p>
                    ) : null}
                    {items.map((element) => {
                        const isSelected = element.id === selectedId;

                        return (
                            <div
                                key={element.id}
                                role="button"
                                tabIndex={0}
                                draggable
                                aria-label={`${elementLabel(element)} element`}
                                aria-pressed={isSelected}
                                onClick={() => setSelectedId(element.id)}
                                onKeyDown={(event) => {
                                    if (
                                        (event.key === 'Delete' ||
                                            event.key === 'Backspace') &&
                                        event.target === event.currentTarget
                                    ) {
                                        event.preventDefault();
                                        remove(element.id);
                                    }
                                }}
                                onDragStart={() => setDragId(element.id)}
                                onDragEnd={() => setDragId(null)}
                                onDragOver={(event) => {
                                    if (dragId) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    dropOn(zone.id, element.id);
                                }}
                                className={cn(
                                    'group relative cursor-grab rounded outline-offset-2 transition',
                                    isSelected
                                        ? 'outline outline-2 outline-emerald-600'
                                        : 'hover:outline hover:outline-1 hover:outline-slate-300',
                                    dragId === element.id && 'opacity-40',
                                )}
                            >
                                {(element.type === 'image' && !element.src) ||
                                (element.type === 'text' &&
                                    element.content.trim() === '') ? (
                                    <div className="rounded border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">
                                        {element.type === 'image'
                                            ? 'Empty image'
                                            : 'Empty text'}
                                    </div>
                                ) : (
                                    <ElementPreview
                                        element={element}
                                        fields={controller.fields}
                                    />
                                )}
                                {isSelected && element.type !== 'spacer' ? (
                                    <span
                                        role="separator"
                                        aria-label="Drag to resize width"
                                        onPointerDown={(event) =>
                                            startResize(event, element, 'width')
                                        }
                                        onDragStart={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                        }}
                                        style={handleStyle(element)}
                                        className="absolute top-1/2 z-10 h-6 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-emerald-600 shadow"
                                    />
                                ) : null}
                                {isSelected &&
                                (element.type === 'spacer' ||
                                    element.type === 'divider') ? (
                                    <span
                                        role="separator"
                                        aria-label="Drag to resize height"
                                        onPointerDown={(event) =>
                                            startResize(
                                                event,
                                                element,
                                                'height',
                                            )
                                        }
                                        onDragStart={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                        }}
                                        className="absolute -bottom-1 left-1/2 z-10 h-2 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-white bg-emerald-600 shadow"
                                    />
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div
                role="toolbar"
                aria-label="Layout elements"
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2"
            >
                <span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Add
                </span>
                {tools.map((tool) => (
                    <Button
                        key={tool.type}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => add(tool.type)}
                        disabled={uploading}
                    >
                        <tool.icon />
                        {tool.label}
                    </Button>
                ))}
                <span
                    className="mx-1 hidden h-6 w-px bg-border sm:block"
                    aria-hidden="true"
                />
                <div
                    role="group"
                    aria-label="Add to"
                    className="inline-flex rounded-md border border-border p-0.5"
                >
                    {zones.map((zone) => (
                        <button
                            key={zone.id}
                            type="button"
                            aria-pressed={targetZone === zone.id}
                            onClick={() => setTargetZone(zone.id)}
                            className={cn(
                                'rounded px-2.5 py-1 text-xs font-medium transition',
                                targetZone === zone.id
                                    ? 'bg-emerald-700 text-white'
                                    : 'text-muted-foreground hover:bg-muted',
                            )}
                        >
                            {zone.label}
                        </button>
                    ))}
                </div>
                <span className="ml-auto flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Move up"
                        disabled={!selected}
                        onClick={() => selected && move(selected.id, -1)}
                    >
                        <ArrowUpIcon />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Move down"
                        disabled={!selected}
                        onClick={() => selected && move(selected.id, 1)}
                    >
                        <ArrowDownIcon />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Duplicate element"
                        disabled={!selected}
                        onClick={() => selected && duplicate(selected)}
                    >
                        <CopyIcon />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove element"
                        disabled={!selected}
                        className="text-red-600 hover:text-red-700"
                        onClick={() => selected && remove(selected.id)}
                    >
                        <Trash2Icon />
                    </Button>
                </span>
            </div>

            {uploadError ? (
                <p role="alert" className="text-sm text-red-600">
                    {uploadError}
                </p>
            ) : null}
            {error ? (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-3">
                    {renderZone(zones[0])}
                    {renderZone(zones[1])}
                    {renderZone(zones[2])}
                </div>

                <aside
                    aria-label="Element properties"
                    className="h-fit rounded-xl border border-border bg-background p-4"
                >
                    {selected ? (
                        <ElementInspector
                            element={selected}
                            uploading={uploading}
                            fields={controller.fields}
                            onChange={(patch) => update(selected.id, patch)}
                            onPickImage={() => {
                                pendingImageFor.current = selected.id;
                                fileInputRef.current?.click();
                            }}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Select an element to edit its text, size, and
                            alignment. Drag elements to reorder them or move
                            them between the top and bottom of the page.
                        </p>
                    )}
                </aside>
            </div>
        </div>
    );
}

function ElementInspector({
    element,
    uploading,
    fields,
    onChange,
    onPickImage,
}: {
    element: LayoutElement;
    fields: MergeField[];
    uploading: boolean;
    onChange: (patch: Partial<LayoutElement>) => void;
    onPickImage: () => void;
}) {
    const isText = element.type === 'text' || element.type === 'date';
    const hasHeight = element.type === 'spacer' || element.type === 'divider';
    const fieldClass =
        'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';
    const labelClass = 'block text-xs font-medium text-foreground';

    return (
        <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">
                {elementLabel(element)} properties
            </p>

            {element.type === 'text' ? (
                <label className={labelClass}>
                    Text
                    <textarea
                        rows={4}
                        maxLength={1000}
                        value={element.content}
                        onChange={(event) =>
                            onChange({ content: event.target.value })
                        }
                        className={fieldClass}
                    />
                    <span className="mt-2 block">Insert a field</span>
                    <select
                        value=""
                        aria-label="Insert a field"
                        onChange={(event) => {
                            if (event.target.value) {
                                onChange({
                                    content: `${element.content}{{${event.target.value}}}`,
                                });
                            }
                        }}
                        className={fieldClass}
                    >
                        <option value="">Choose a field…</option>
                        {Array.from(
                            new Set(fields.map((field) => field.group)),
                        ).map((group) => (
                            <optgroup key={group} label={group}>
                                {fields
                                    .filter((field) => field.group === group)
                                    .map((field) => (
                                        <option
                                            key={field.key}
                                            value={field.key}
                                        >
                                            {field.label}
                                        </option>
                                    ))}
                            </optgroup>
                        ))}
                    </select>
                    <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        Fields appear as {'{{field_name}}'} and are replaced
                        with real values when the document is generated.
                    </span>
                </label>
            ) : null}

            {element.type === 'date' ? (
                <p className="text-xs text-muted-foreground">
                    Shows the date the document is generated.
                </p>
            ) : null}

            {element.type === 'image' ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={uploading}
                    onClick={onPickImage}
                >
                    <UploadIcon />
                    {uploading
                        ? 'Uploading…'
                        : element.src
                          ? 'Replace image'
                          : 'Upload image'}
                </Button>
            ) : null}

            {element.type !== 'spacer' ? (
                <div>
                    <p className={labelClass}>Alignment</p>
                    <div
                        role="group"
                        aria-label="Alignment"
                        className="mt-1 inline-flex rounded-md border border-border p-0.5"
                    >
                        {(
                            [
                                ['left', AlignLeftIcon],
                                ['center', AlignCenterIcon],
                                ['right', AlignRightIcon],
                            ] as const
                        ).map(([value, Icon]) => (
                            <button
                                key={value}
                                type="button"
                                aria-label={`Align ${value}`}
                                aria-pressed={element.align === value}
                                onClick={() => onChange({ align: value })}
                                className={cn(
                                    'rounded p-1.5 transition',
                                    element.align === value
                                        ? 'bg-emerald-700 text-white'
                                        : 'text-muted-foreground hover:bg-muted',
                                )}
                            >
                                <Icon className="size-4" />
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {element.type !== 'spacer' ? (
                <label className={labelClass}>
                    Width ({element.width}%)
                    <input
                        type="range"
                        min={5}
                        max={100}
                        value={element.width}
                        onChange={(event) =>
                            onChange({ width: Number(event.target.value) })
                        }
                        className="mt-1 w-full accent-emerald-700"
                    />
                </label>
            ) : null}

            {hasHeight ? (
                <label className={labelClass}>
                    {element.type === 'divider'
                        ? `Thickness (${element.height}px)`
                        : `Height (${element.height}px)`}
                    <input
                        type="range"
                        min={1}
                        max={element.type === 'divider' ? 12 : 200}
                        value={element.height}
                        onChange={(event) =>
                            onChange({ height: Number(event.target.value) })
                        }
                        className="mt-1 w-full accent-emerald-700"
                    />
                </label>
            ) : null}

            {isText ? (
                <>
                    <div className="flex items-end gap-3">
                        <label className={cn(labelClass, 'flex-1')}>
                            Size (px)
                            <input
                                type="number"
                                min={8}
                                max={48}
                                value={element.font_size}
                                onChange={(event) =>
                                    onChange({
                                        font_size: Math.max(
                                            8,
                                            Math.min(
                                                48,
                                                Number(event.target.value) ||
                                                    12,
                                            ),
                                        ),
                                    })
                                }
                                className={fieldClass}
                            />
                        </label>
                        <div className="flex gap-1 pb-0.5">
                            <button
                                type="button"
                                aria-label="Bold"
                                aria-pressed={element.bold}
                                onClick={() =>
                                    onChange({ bold: !element.bold })
                                }
                                className={cn(
                                    'rounded-md border p-2 transition',
                                    element.bold
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                        : 'border-border hover:bg-muted',
                                )}
                            >
                                <BoldIcon className="size-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="Italic"
                                aria-pressed={element.italic}
                                onClick={() =>
                                    onChange({ italic: !element.italic })
                                }
                                className={cn(
                                    'rounded-md border p-2 transition',
                                    element.italic
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                        : 'border-border hover:bg-muted',
                                )}
                            >
                                <ItalicIcon className="size-4" />
                            </button>
                        </div>
                    </div>
                </>
            ) : null}

            {isText ? (
                <label className={labelClass}>
                    Text case
                    <select
                        value={element.text_case}
                        onChange={(event) =>
                            onChange({
                                text_case: event.target.value as ElementCase,
                            })
                        }
                        className={fieldClass}
                    >
                        {caseChoices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                                {choice.label}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}

            {isText || element.type === 'divider' ? (
                <label className={labelClass}>
                    Color
                    <input
                        type="color"
                        value={element.color}
                        onChange={(event) =>
                            onChange({ color: event.target.value })
                        }
                        className="mt-1 block h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1"
                    />
                </label>
            ) : null}
        </div>
    );
}

export function PreviewZone({
    controller,
    zone,
    applyCase,
}: {
    controller: LayoutElementsController;
    zone: ElementZone;
    applyCase: (value: string) => string;
}) {
    const {
        elements,
        selectedId,
        setSelectedId,
        targetZone,
        setTargetZone,
        zoneColors,
        setZoneColor,
    } = controller;
    const zoneColor = zoneColors[zone];
    const meta = zones.find((item) => item.id === zone)!;
    const items = elements.filter((element) => element.zone === zone);
    const active = targetZone === zone;
    const selectedHere = items.some((element) => element.id === selectedId);

    return (
        <section
            aria-label={meta.label}
            onClick={() => setTargetZone(zone)}
            style={
                zone !== 'header' && zoneColor
                    ? { backgroundColor: zoneColor }
                    : undefined
            }
            className={cn(
                'relative border-2 border-dashed px-3 py-2 transition',
                zone === 'header'
                    ? 'min-h-24 border-white/40 bg-white/10 hover:border-white'
                    : 'px-5 py-3 sm:px-8',
                active &&
                    (zone === 'header'
                        ? 'border-white bg-white/20'
                        : 'border-emerald-400 bg-emerald-50/50'),
                !active &&
                    zone !== 'header' &&
                    'border-slate-300 bg-slate-50/40 hover:border-emerald-300',
            )}
        >
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        active
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600',
                    )}
                >
                    {meta.label}
                </span>
                {active ? (
                    <span
                        role="toolbar"
                        aria-label={`${meta.label} components`}
                        className="flex flex-wrap items-center gap-1"
                    >
                        {tools.map((tool) => (
                            <button
                                key={tool.type}
                                type="button"
                                title={`Add ${tool.label.toLowerCase()}`}
                                aria-label={`Add ${tool.label.toLowerCase()} to ${meta.label.toLowerCase()}`}
                                disabled={controller.uploading}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    controller.add(tool.type, zone);
                                }}
                                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-800 disabled:opacity-50"
                            >
                                <tool.icon className="size-3" />
                                {tool.label}
                            </button>
                        ))}
                        <label
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                            onClick={(event) => event.stopPropagation()}
                        >
                            Background
                            <input
                                type="color"
                                aria-label={`${meta.label} background color`}
                                value={zoneColor || '#ffffff'}
                                onChange={(event) =>
                                    setZoneColor(zone, event.target.value)
                                }
                                className="h-4 w-6 cursor-pointer border-0 bg-transparent p-0"
                            />
                            {zone !== 'header' && zoneColor ? (
                                <button
                                    type="button"
                                    aria-label={`Clear ${meta.label} background`}
                                    onClick={() => setZoneColor(zone, '')}
                                    className="text-slate-500 hover:text-red-600"
                                >
                                    ×
                                </button>
                            ) : null}
                        </label>
                        {selectedHere ? (
                            <button
                                type="button"
                                aria-label="Remove selected component"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (selectedId) {
                                        controller.remove(selectedId);
                                    }
                                }}
                                className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50"
                            >
                                <Trash2Icon className="size-3" />
                                Remove
                            </button>
                        ) : null}
                    </span>
                ) : (
                    <span
                        className={cn(
                            'text-[11px]',
                            zone === 'header' ? 'opacity-80' : 'text-slate-500',
                        )}
                    >
                        Click to edit this section
                    </span>
                )}
            </div>
            {items.length === 0 ? (
                <p
                    className={cn(
                        'py-2 text-center text-[11px]',
                        zone === 'header' ? 'opacity-80' : 'text-slate-400',
                    )}
                >
                    {zone === 'header'
                        ? 'Empty header. The standard header is used until you add a component.'
                        : 'Empty footer'}
                </p>
            ) : null}
            {items.map((element) => {
                const isSelected = element.id === selectedId;

                return (
                    <div
                        key={element.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`${elementLabel(element)} component`}
                        onClick={(event) => {
                            event.stopPropagation();
                            setTargetZone(zone);
                            setSelectedId(element.id);
                        }}
                        onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) {
                                return;
                            }
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedId(element.id);
                            }
                            if (
                                event.key === 'Delete' ||
                                event.key === 'Backspace'
                            ) {
                                event.preventDefault();
                                controller.remove(element.id);
                            }
                        }}
                        className={cn(
                            'cursor-pointer rounded outline-offset-2',
                            isSelected
                                ? 'outline outline-2 outline-emerald-600'
                                : 'hover:outline hover:outline-1 hover:outline-slate-300',
                        )}
                    >
                        {(element.type === 'image' && !element.src) ||
                        (element.type === 'text' &&
                            element.content.trim() === '') ? (
                            <div className="rounded border border-dashed border-slate-300 px-3 py-3 text-center text-[11px] text-slate-400">
                                {element.type === 'image'
                                    ? 'Empty image'
                                    : 'Empty text'}
                            </div>
                        ) : (
                            <ElementPreview
                                element={element}
                                fields={controller.fields}
                            />
                        )}
                    </div>
                );
            })}
        </section>
    );
}
