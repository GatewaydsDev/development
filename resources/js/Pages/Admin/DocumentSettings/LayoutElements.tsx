import { Button } from "@/Components/ui/button";
import StickyDocumentToolbar from "@/Components/StickyDocumentToolbar";
import { ToggleGroup, ToggleGroupItem } from "@/Components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
    AlignCenterIcon,
    AlignLeftIcon,
    AlignJustifyIcon,
    AlignRightIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    BoldIcon,
    BuildingIcon,
    TableIcon,
    CalendarIcon,
    CopyIcon,
    ImageIcon,
    ItalicIcon,
    ListIcon,
    ListOrderedIcon,
    UnderlineIcon,
    MinusIcon,
    MoveVerticalIcon,
    Trash2Icon,
    TypeIcon,
    FileUpIcon,
    UploadIcon,
} from "lucide-react";
import {
    DragEvent,
    Fragment,
    PointerEvent as ReactPointerEvent,
    ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";

export type ElementType =
    "text" | "image" | "divider" | "spacer" | "date" | "company" | "table";
export type ElementZone = "header" | "intro" | "body" | "footer";
export type ElementCase = "original" | "camel" | "uppercase" | "lowercase";

export function transformCase(value: string, textCase: ElementCase): string {
    if (textCase === "uppercase") {
        return value.toUpperCase();
    }

    if (textCase === "lowercase") {
        return value.toLowerCase();
    }

    if (textCase === "camel") {
        return value
            .split(/[\s_-]+/u)
            .filter(Boolean)
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

export type MergeField = {
    key: string;
    label: string;
    group: string;
    sample: string;
};

export function fillFields(value: string, fields: MergeField[]): string {
    return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, key: string) => {
        return fields.find((field) => field.key === key)?.sample ?? "";
    });
}

const caseChoices: Array<{ id: ElementCase; label: string }> = [
    { id: "original", label: "As entered" },
    { id: "camel", label: "camelCase" },
    { id: "uppercase", label: "UPPERCASE" },
    { id: "lowercase", label: "lowercase" },
];
export type ElementAlign = "left" | "center" | "right" | "justify";

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
    font_family?: string;
    bold: boolean;
    italic: boolean;
    underline?: boolean;
    line_height?: number;
    list_style?: "none" | "bullet" | "numbered";
    text_case: ElementCase;
    inline?: boolean;
    x?: number;
    y?: number;
    color: string;
    fields?: string[];
    layout?: "lines" | "table";
    border?: boolean;
    show_labels?: boolean;
    columns?: number;
    items?: Array<{ label: string; value: string }>;
    cells?: string[][];
    header_row?: boolean;
    header_color?: string;
    label_bg?: string;
    border_color?: string;
    label_width?: number;
};

export const DEFAULT_COMPANY_FIELDS = [
    "company_name",
    "company_address",
    "company_phone",
    "company_email",
];

const tools: Array<{
    type: ElementType;
    label: string;
    icon: typeof TypeIcon;
}> = [
    { type: "text", label: "Text", icon: TypeIcon },
    { type: "image", label: "Image", icon: ImageIcon },
    { type: "table", label: "Info table", icon: TableIcon },
    { type: "company", label: "Company info", icon: BuildingIcon },
    { type: "date", label: "Date", icon: CalendarIcon },
    { type: "divider", label: "Divider", icon: MinusIcon },
    { type: "spacer", label: "Spacer", icon: MoveVerticalIcon },
];

const zones: Array<{ id: ElementZone; label: string; hint: string }> = [
    {
        id: "header",
        label: "Header",
        hint: "Top of the page, on the header color. Replaces the standard header.",
    },
];

export function groupRows(list: LayoutElement[]): LayoutElement[][] {
    const rows: LayoutElement[][] = [];

    list.forEach((element) => {
        if (element.inline && rows.length > 0) {
            rows[rows.length - 1].push(element);
        } else {
            rows.push([element]);
        }
    });

    return rows;
}

function newId(): string {
    return `el-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function handleStyle(element: LayoutElement) {
    if (element.align === "right") {
        return { right: `calc(${element.width}% - 4px)` };
    }

    if (element.align === "center") {
        return { left: `calc(${50 + element.width / 2}% - 4px)` };
    }

    return { left: `calc(${element.width}% - 4px)` };
}

const defaultWidth: Partial<Record<ElementType, number>> = {
    text: 50,
    date: 30,
    company: 50,
    table: 60,
    image: 30,
    divider: 94,
    spacer: 30,
};

function createElement(type: ElementType, zone: ElementZone): LayoutElement {
    return {
        id: newId(),
        type,
        zone,
        content: type === "text" ? "New text" : "",
        src: "",
        align: "left",
        x: 3,
        y: 10,
        width: defaultWidth[type] ?? 40,
        height: type === "divider" ? 2 : 24,
        font_size: 12,
        bold: false,
        italic: false,
        text_case: "original",
        color: "#000000",
        ...(type === "table"
            ? {
                  items: [
                      { label: "Project", value: "{{project_name}}" },
                      { label: "Date", value: "{{generated_date}}" },
                      { label: "Location", value: "{{project_address}}" },
                      { label: "Number", value: "{{document_number}}" },
                  ],
                  columns: 2,
                  border: true,
                  label_bg: "#e5e9f0",
                  border_color: "#cbd5e1",
                  label_width: 30,
              }
            : {}),
        ...(type === "company"
            ? {
                  fields: DEFAULT_COMPANY_FIELDS,
                  layout: "table" as const,
                  border: true,
                  show_labels: true,
                  columns: 2,
              }
            : {}),
    };
}

const elementLabel = (element: LayoutElement) =>
    ({
        text: "Text",
        image: "Image",
        divider: "Divider",
        spacer: "Spacer",
        date: "Date",
        company: "Company info",
        table: "Info table",
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
        element.align === "center"
            ? "0 auto"
            : element.align === "right"
              ? "0 0 0 auto"
              : "0";
    const box = {
        width: `${element.width}%`,
        margin,
        textAlign: element.align,
    } as const;

    if (element.type === "spacer") {
        return <div style={{ height: element.height }} />;
    }

    if (element.type === "divider") {
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

    if (element.type === "image") {
        return element.src ? (
            <div style={{ ...box, padding: "4px 0" }}>
                <img
                    src={element.src}
                    alt=""
                    draggable={false}
                    style={{ width: "100%", height: "auto" }}
                />
            </div>
        ) : null;
    }

    if (element.type === "table") {
        if (element.cells) {
            return (
                <table style={{ ...box, borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                        {element.cells.map((row, r) => (
                            <tr key={r}>
                                {row.map((cell, c) => (
                                    <td key={c} style={{
                                        padding: "6px 10px",
                                        border: element.border ? `1px solid ${element.border_color ?? "#cbd5e1"}` : "none",
                                        fontFamily: fontStack(element.font_family),
                                        fontSize: element.font_size,
                                        color: r === 0 && element.header_row ? element.header_color || "#ffffff" : element.color,
                                        backgroundColor: r === 0 && element.header_row ? element.label_bg || "#065f46" : undefined,
                                        fontWeight: r === 0 && element.header_row ? 700 : element.bold ? 700 : 400,
                                        fontStyle: element.italic ? "italic" : "normal",
                                        textAlign: element.align,
                                        textDecoration: element.underline ? "underline" : undefined,
                                        lineHeight: element.line_height ?? 1.35,
                                    }}>
                                        {transformCase(fillFields(cell, fields), element.text_case) || "\u00a0"}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        const pairs = Math.min(3, Math.max(1, element.columns ?? 2));
        const labelWidth = element.label_width ?? 30;
        const rows = (element.items ?? [])
            .map((item) => ({
                label: fillFields(item.label, fields).trim(),
                value: fillFields(item.value, fields).trim(),
                dynamic: item.value.includes("{{"),
            }))
            .filter(
                (row) =>
                    !(row.value === "" && row.dynamic) &&
                    (row.label !== "" || row.value !== ""),
            );

        if (rows.length === 0) {
            return null;
        }

        const line = element.border
            ? `1px solid ${element.border_color ?? "#cbd5e1"}`
            : undefined;
        const base = {
            fontFamily: fontStack(element.font_family),
            fontSize: element.font_size,
            color: element.color,
            lineHeight: element.line_height ?? 1.35,
            textDecoration: element.underline ? "underline" : undefined,
            padding: "6px 10px",
            border: line,
        } as const;
        const chunks: (typeof rows)[] = [];

        for (let i = 0; i < rows.length; i += pairs) {
            chunks.push(rows.slice(i, i + pairs));
        }

        return (
            <table
                style={{
                    ...box,
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                }}
            >
                <tbody>
                    {chunks.map((chunk, rowIndex) => (
                        <tr key={rowIndex}>
                            {Array.from({ length: pairs }).map((_, index) => (
                                <Fragment key={index}>
                                    <td
                                        style={{
                                            ...base,
                                            width: `${labelWidth / pairs}%`,
                                            fontWeight: 700,
                                            background:
                                                element.label_bg || undefined,
                                        }}
                                    >
                                        {transformCase(
                                            chunk[index]?.label ?? "",
                                            element.text_case,
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            ...base,
                                            width: `${(100 - labelWidth) / pairs}%`,
                                            fontWeight: element.bold
                                                ? 700
                                                : 400,
                                            fontStyle: element.italic
                                                ? "italic"
                                                : "normal",
                                        }}
                                    >
                                        {transformCase(
                                            chunk[index]?.value ?? "",
                                            element.text_case,
                                        )}
                                    </td>
                                </Fragment>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (element.type === "company") {
        const rows = (element.fields ?? DEFAULT_COMPANY_FIELDS)
            .map((key) => {
                const field = fields.find((item) => item.key === key);

                return field && field.sample.trim() !== ""
                    ? {
                          label: field.label.replace("Company ", ""),
                          value: field.sample,
                      }
                    : null;
            })
            .filter((row): row is { label: string; value: string } => !!row);

        if (rows.length === 0) {
            return null;
        }

        const textStyle = {
            fontFamily: fontStack(element.font_family),
            fontSize: element.font_size,
            color: element.color,
            fontWeight: element.bold ? 700 : 400,
            fontStyle: element.italic ? "italic" : "normal",
            lineHeight: element.line_height ?? 1.35,
            textDecoration: element.underline ? "underline" : undefined,
        } as const;
        const cell = (row: { label: string; value: string }) => (
            <>
                {element.show_labels ? (
                    <span style={{ opacity: 0.65 }}>
                        {transformCase(row.label, element.text_case)}:{" "}
                    </span>
                ) : null}
                {transformCase(row.value, element.text_case)}
            </>
        );

        if (element.layout === "table") {
            const columns = element.columns ?? 2;
            const chunks: (typeof rows)[] = [];

            for (let i = 0; i < rows.length; i += columns) {
                chunks.push(rows.slice(i, i + columns));
            }

            const border = element.border
                ? `1px solid ${element.color}`
                : undefined;

            return (
                <table
                    style={{
                        ...box,
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                    }}
                >
                    <tbody>
                        {chunks.map((chunk, rowIndex) => (
                            <tr key={rowIndex}>
                                {Array.from({ length: columns }).map(
                                    (_, index) => (
                                        <td
                                            key={index}
                                            style={{
                                                ...textStyle,
                                                border,
                                                padding: "4px 8px",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            {chunk[index]
                                                ? cell(chunk[index])
                                                : null}
                                        </td>
                                    ),
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        return (
            <div style={box}>
                {rows.map((row) => (
                    <div
                        key={row.label}
                        style={{ ...textStyle, padding: "1px 0" }}
                    >
                        {cell(row)}
                    </div>
                ))}
            </div>
        );
    }

    const content =
        element.type === "date"
            ? new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
              })
            : fillFields(element.content, fields);

    return content.trim() === "" ? null : (
        <div
            style={{
                ...box,
                fontFamily: fontStack(element.font_family),
                fontSize: element.font_size,
                color: element.color,
                fontWeight: element.bold ? 700 : 400,
                fontStyle: element.italic ? "italic" : "normal",
                lineHeight: element.line_height ?? 1.35,
                textDecoration: element.underline ? "underline" : undefined,
                padding: element.type === "text" && element.list_style && element.list_style !== "none" ? 0 : "2px 0",
                whiteSpace: "pre-line",
            }}
        >
            {element.type === "text" && element.list_style && element.list_style !== "none" ? (
                element.list_style === "numbered" ? (
                    <ol style={{ margin: 0, paddingLeft: 20, listStyleType: "decimal" }}>
                        {content.split(/\r?\n/).map((line, index) => (
                            <li key={index} style={{ padding: "2px 0" }}>{transformCase(line, element.text_case) || "\u00a0"}</li>
                        ))}
                    </ol>
                ) : (
                    <ul style={{ margin: 0, paddingLeft: 20, listStyleType: "disc" }}>
                        {content.split(/\r?\n/).map((line, index) => (
                            <li key={index} style={{ padding: "2px 0" }}>{transformCase(line, element.text_case) || "\u00a0"}</li>
                        ))}
                    </ul>
                )
            ) : transformCase(content, element.text_case)}
        </div>
    );
}

export function ElementsReadOnly({
    elements,
    zone,
    fields = [],
    inBanner = false,
    background = "",
    headerHeight = 160,
}: {
    headerHeight?: number;
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

    if (zone === "header") {
        return (
            <div className="relative" style={{ height: headerHeight }}>
                {items.map((element) => (
                    <div
                        key={element.id}
                        style={{
                            position: "absolute",
                            left: `${element.x ?? 0}%`,
                            top: element.y ?? 0,
                            width: `${element.width}%`,
                        }}
                    >
                        <ElementPreview
                            element={{ ...element, width: 100 }}
                            fields={fields}
                        />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div
            className={inBanner ? "mt-4" : "px-5 py-3 sm:px-8"}
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
            .split("; ")
            .find((row) => row.startsWith("XSRF-TOKEN="))
            ?.slice("XSRF-TOKEN=".length) ?? "",
    );
    const body = new FormData();
    body.append("image", file);
    const response = await fetch(route("admin.document-settings.images"), {
        method: "POST",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": token,
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
                "Could not upload that image.",
        );
    }

    return payload.url;
}

export function useLayoutElements(
    elements: LayoutElement[],
    onChange: (elements: LayoutElement[]) => void,
    fields: MergeField[] = [],
    zoneColors: Record<ElementZone, string> = {
        header: "",
        intro: "",
        body: "",
        footer: "",
    },
    setZoneColor: (zone: ElementZone, color: string) => void = () => {},
    headerHeight = 160,
    setHeaderHeight: (height: number) => void = () => {},
) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [targetZone, setTargetZone] = useState<ElementZone>("header");
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingImageFor = useRef<string | null>(null);
    const canvasRefs = useRef<Partial<Record<ElementZone, HTMLDivElement | null>>>({});

    const selected = elements.find((element) => element.id === selectedId);

    const update = (id: string, patch: Partial<LayoutElement>) =>
        onChange(
            elements.map((element) =>
                element.id === id ? { ...element, ...patch } : element,
            ),
        );

    const visibleToolbarBottom = () => Math.max(
        0,
        ...Array.from(document.querySelectorAll<HTMLElement>(
            'nav.sticky, [data-sticky-page-title], [data-document-toolbar][data-pinned="true"]',
        )).map((node) => node.getBoundingClientRect().bottom),
    );

    const add = (type: ElementType, zone: ElementZone = targetZone, grid = false) => {
        const element = createElement(type, zone);
        if (grid) {
            element.cells = [["", ""], ["", ""]];
            element.width = 94;
        }
        const canvas = canvasRefs.current[zone];
        if (canvas) {
            const box = canvas.getBoundingClientRect();
            const scale = box.height > 0 ? canvas.offsetHeight / box.height : 1;
            const toolbarBottom = visibleToolbarBottom();
            const visibleTop = Math.max(box.top, toolbarBottom);
            element.y = Math.round(Math.max(0, Math.min(2000, (visibleTop + 24 - box.top) * scale)));
            if (zone === "header") {
                setHeaderHeight(Math.max(headerHeight, element.y + 120));
            }
        } else {
            element.y = 24;
        }
        setTargetZone(zone);
        onChange([...elements, element]);
        setSelectedId(element.id);
        requestAnimationFrame(() => {
            const node = canvasRefs.current[zone]?.querySelector<HTMLElement>(
                `[data-element-id="${element.id}"]`,
            );
            if (node) {
                const rect = node.getBoundingClientRect();
                const obscuredTop = visibleToolbarBottom();
                if (rect.top < obscuredTop || rect.top >= window.innerHeight) {
                    window.scrollBy({ top: rect.top - obscuredTop - 24 });
                }
            }
        });

        if (type === "image") {
            pendingImageFor.current = element.id;
            fileInputRef.current?.click();
        }
    };

    const remove = (id: string) => {
        const index = elements.findIndex((element) => element.id === id);
        const next = elements.filter((element) => element.id !== id);
        const following = elements[index + 1];

        if (
            index >= 0 &&
            !elements[index].inline &&
            following?.inline &&
            following.zone === elements[index].zone
        ) {
            const at = next.findIndex((element) => element.id === following.id);
            next[at] = { ...following, inline: false };
        }

        onChange(next);
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
        const seen = new Set<string>();
        onChange(
            next.map((item) => {
                if (seen.has(item.zone)) {
                    return item;
                }

                seen.add(item.zone);

                return item.inline ? { ...item, inline: false } : item;
            }),
        );
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
                    : "Could not upload that image.",
            );
        } finally {
            setUploading(false);
        }
    };

    const startResize = (
        event: ReactPointerEvent<HTMLElement>,
        element: LayoutElement,
        axis: "width" | "height",
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const handle = event.currentTarget;
        const box = handle.parentElement;

        if (!box) {
            return;
        }

        handle.setPointerCapture(event.pointerId);
        const containerWidth = (
            box.parentElement ?? box
        ).getBoundingClientRect().width;
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = element.width;
        const startHeight = element.height;
        const factor = 1;
        const direction = 1;

        const onMove = (moveEvent: PointerEvent) => {
            if (axis === "width") {
                const delta =
                    ((moveEvent.clientX - startX) / containerWidth) *
                    100 *
                    factor *
                    direction;
                update(element.id, {
                    width: Math.round(
                        Math.max(
                            5,
                            Math.min(
                                100 - (element.x ?? 0),
                                startWidth + delta,
                            ),
                        ),
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
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
    };

    const startMove = (
        event: ReactPointerEvent<HTMLElement>,
        element: LayoutElement,
    ) => {
        if (
            event.button !== 0 ||
            (event.target as HTMLElement).closest("[data-resize-handle]")
        ) {
            return;
        }

        const node = event.currentTarget;
        const canvas = node.closest<HTMLElement>("[data-canvas]");

        if (!canvas) {
            return;
        }

        const box = canvas.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = element.x ?? 0;
        const originY = element.y ?? 0;
        let dragging = false;

        const onMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            if (!dragging && Math.hypot(dx, dy) < 3) {
                return;
            }

            if (!dragging) {
                dragging = true;
                node.setPointerCapture(event.pointerId);
            }

            update(element.id, {
                x:
                    Math.round(
                        Math.max(
                            0,
                            Math.min(
                                100 - element.width,
                                originX + (dx / box.width) * 100,
                            ),
                        ) * 2,
                    ) / 2,
                y: Math.round(Math.max(0, Math.min(2000, originY + dy))),
            });
        };
        const onUp = () => {
            node.removeEventListener("pointermove", onMove);
            node.removeEventListener("pointerup", onUp);
            node.removeEventListener("pointercancel", onUp);
        };

        node.addEventListener("pointermove", onMove);
        node.addEventListener("pointerup", onUp);
        node.addEventListener("pointercancel", onUp);
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
            ...createElement("text", "body"),
            content,
            ...patch,
        });
        const muted = { font_size: 10, color: "#64748b", bold: true };
        const seeded: LayoutElement[] = [
            text("PREPARED FOR", muted),
            text("{{project_name}}", { bold: true, font_size: 14 }),
            text("{{project_address}}", { color: "#64748b" }),
            text("PREPARED ON", muted),
            text("{{document_date}}", { bold: true, font_size: 14 }),
            { ...createElement("divider", "body"), color: "#e2e8f0" },
            text("Scope and pricing", { bold: true, font_size: 16 }),
            text("The following items are included in this document."),
            text("Item 1 - description and price"),
            text("Item 2 - description and price"),
            text("Total", { bold: true, font_size: 18, align: "right" }),
        ];
        onChange([...elements, ...seeded]);
        setTargetZone("body");
        setSelectedId(seeded[0].id);
    };

    return {
        zoneColors,
        canvasRefs,
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
        startMove,
        headerHeight,
        setHeaderHeight,
        evenSpacing: () => {
            const rows: Array<{ top: number; bottom: number; items: LayoutElement[] }> = [];
            const sorted = elements.filter((item) => item.zone === "header")
                .map((item) => {
                    const node = Array.from(document.querySelectorAll<HTMLElement>("[data-element-id]"))
                        .find((node) => node.dataset.elementId === item.id);
                    return { item, height: node?.offsetHeight ?? item.height };
                })
                .sort((a, b) => (a.item.y ?? 0) - (b.item.y ?? 0));
            sorted.forEach(({ item, height }) => {
                const y = item.y ?? 0;
                const row = rows[rows.length - 1];
                if (row && y < row.bottom) {
                    row.items.push(item);
                    row.bottom = Math.max(row.bottom, y + height);
                } else {
                    rows.push({ top: y, bottom: y + height, items: [item] });
                }
            });
            const positions = new Map<string, number>();
            let bottom = rows[0]?.top ?? 0;
            rows.forEach((row, index) => {
                const top = index === 0 ? row.top : bottom + 16;
                row.items.forEach((item) => positions.set(item.id, (item.y ?? 0) + top - row.top));
                bottom = top + row.bottom - row.top;
            });
            onChange(elements.map((item) => positions.has(item.id) ? { ...item, y: positions.get(item.id) } : item));
            setHeaderHeight(Math.max(160, Math.ceil(bottom + 24)));
        },
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
                event.target.value = "";
            }}
        />
    );
}

type ImportMode = "text" | "layout";

function xsrfToken(): string {
    return decodeURIComponent(
        document.cookie
            .split("; ")
            .find((row) => row.startsWith("XSRF-TOKEN="))
            ?.slice("XSRF-TOKEN=".length) ?? "",
    );
}

export function ImportPanel({
    controller,
}: {
    controller: LayoutElementsController;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<ImportMode>("text");
    const [replace, setReplace] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{
        tone: "ok" | "error";
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
            body.append("file", file);
            body.append("mode", mode);
            const response = await fetch(
                route("admin.document-settings.import"),
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                        "X-XSRF-TOKEN": xsrfToken(),
                    },
                    body,
                },
            );
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
                        "Could not import that file.",
                );
            }

            controller.importElements(payload.elements, replace);
            const count = payload.elements.length;
            setMessage({
                tone: count > 0 ? "ok" : "error",
                lines: [
                    count > 0
                        ? `Added ${count} ${count === 1 ? "component" : "components"} to the header and footer. Review them, then save the layout.`
                        : "Nothing was added.",
                    ...(payload.notes ?? []),
                ],
            });
        } catch (caught) {
            setMessage({
                tone: "error",
                lines: [
                    caught instanceof Error
                        ? caught.message
                        : "Could not import that file.",
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
                            {file ? file.name : "No file selected"}
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
                                    checked={mode === "text"}
                                    onChange={() => setMode("text")}
                                    className="accent-emerald-700"
                                />
                                All text and sections
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="import-mode"
                                    checked={mode === "layout"}
                                    onChange={() => setMode("layout")}
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
                            onChange={(event) =>
                                setReplace(event.target.checked)
                            }
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
                            {busy ? "Reading file…" : "Generate sections"}
                        </Button>
                    </div>

                    {message ? (
                        <ul
                            role="status"
                            className={cn(
                                "mt-3 space-y-1 text-xs",
                                message.tone === "ok"
                                    ? "text-emerald-800 dark:text-emerald-300"
                                    : "text-red-600",
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
    error,
    children,
}: {
    controller: LayoutElementsController;
    error?: string;
    children: ReactNode;
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
    const editorRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={editorRef} className="flex flex-col gap-4">
            <StickyDocumentToolbar scopeRef={editorRef} className="rounded-xl border border-border">
            <div role="toolbar" aria-label="Print layout tools" className="flex flex-col">
            <div
                role="group"
                aria-label="Add and arrange components"
                className="flex flex-wrap items-center gap-2 p-2"
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
                <Button type="button" variant="outline" size="sm" disabled={uploading}
                    onClick={() => add("table", targetZone, true)}>
                    <TableIcon data-icon="inline-start" />
                    Table
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!elements.length}
                    onClick={() => controller.evenSpacing()}>
                    <MoveVerticalIcon data-icon="inline-start" />
                    Even spacing
                </Button>
                <label className="flex items-center gap-2 text-xs font-medium">
                    Background
                    <input type="color" aria-label="Layout background color"
                        value={controller.zoneColors[targetZone] || "#ffffff"}
                        onChange={(event) => controller.setZoneColor(targetZone, event.target.value)}
                        className="h-8 w-10 rounded border border-input bg-background p-1" />
                </label>
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

            <LayoutTextToolbar
                element={selected}
                onChange={(patch) => selected && update(selected.id, patch)}
            />
            </div>
            </StickyDocumentToolbar>

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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0">{children}</div>

                <aside
                    aria-label="Element properties"
                    className="h-fit rounded-xl border border-border bg-background p-4 xl:sticky xl:top-4"
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
                            alignment. Drag a selected element in the preview to
                            move it.
                        </p>
                    )}
                </aside>
            </div>
        </div>
    );
}

function LayoutTextToolbar({
    element,
    onChange,
}: {
    element?: LayoutElement;
    onChange: (patch: Partial<LayoutElement>) => void;
}) {
    const enabled = element && ["text", "date", "company", "table"].includes(element.type);
    const fieldClass = "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
    const labelClass = "flex flex-col gap-1 text-xs font-medium text-foreground";

    return (
        <div className="flex flex-col gap-2 border-t border-border p-3">
            <div role="group" aria-label="Layout text formatting" className="flex flex-wrap items-end gap-3">
                <label className={labelClass}>
                    Font
                    <select aria-label="Layout font" disabled={!enabled} className={fieldClass}
                        value={element?.font_family ?? "default"}
                        onChange={(event) => onChange({ font_family: event.target.value })}>
                        {fontChoices.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
                    </select>
                </label>
                <label className={labelClass}>
                    Font size (px)
                    <input aria-label="Layout font size" type="number" min={8} max={48}
                        disabled={!enabled} className={cn(fieldClass, "w-24")} value={element?.font_size ?? 12}
                        onChange={(event) => {
                            const size = event.target.valueAsNumber;
                            if (Number.isInteger(size) && size >= 8 && size <= 48) onChange({ font_size: size });
                        }} />
                </label>
                <label className={labelClass}>
                    Font color
                    <input aria-label="Layout font color" type="color" disabled={!enabled}
                        className={cn(fieldClass, "w-14 p-1")} value={element?.color ?? "#111827"}
                        onChange={(event) => onChange({ color: event.target.value })} />
                </label>
                <label className={labelClass}>
                    Line spacing
                    <select aria-label="Layout line spacing" disabled={!enabled} className={fieldClass}
                        value={element?.line_height ?? 1.35}
                        onChange={(event) => onChange({ line_height: Number(event.target.value) })}>
                        <option value={1}>Single</option>
                        <option value={1.15}>1.15</option>
                        <option value={1.35}>Default (1.35)</option>
                        <option value={1.5}>1.5</option>
                        <option value={2}>Double</option>
                    </select>
                </label>
                <ToggleGroup type="multiple" variant="outline" size="sm" aria-label="Layout text emphasis"
                    disabled={!enabled}
                    value={["bold", "italic", "underline"].filter((key) => element?.[key as "bold" | "italic" | "underline"])}
                    onValueChange={(values) => onChange({
                        bold: values.includes("bold"), italic: values.includes("italic"), underline: values.includes("underline"),
                    })}>
                    <ToggleGroupItem value="bold" aria-label="Layout bold" title="Bold"><BoldIcon /></ToggleGroupItem>
                    <ToggleGroupItem value="italic" aria-label="Layout italic" title="Italic"><ItalicIcon /></ToggleGroupItem>
                    <ToggleGroupItem value="underline" aria-label="Layout underline" title="Underline"><UnderlineIcon /></ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup type="single" variant="outline" size="sm" aria-label="Layout alignment"
                    disabled={!enabled} value={element?.align ?? "left"}
                    onValueChange={(value) => { if (value) onChange({ align: value as ElementAlign }); }}>
                    <ToggleGroupItem value="left" aria-label="Layout align left" title="Align left"><AlignLeftIcon /></ToggleGroupItem>
                    <ToggleGroupItem value="center" aria-label="Layout align center" title="Align center"><AlignCenterIcon /></ToggleGroupItem>
                    <ToggleGroupItem value="right" aria-label="Layout align right" title="Align right"><AlignRightIcon /></ToggleGroupItem>
                    <ToggleGroupItem value="justify" aria-label="Layout justify" title="Justify"><AlignJustifyIcon /></ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup type="single" variant="outline" size="sm" aria-label="Layout lists"
                    disabled={element?.type !== "text"} value={element?.list_style ?? "none"}
                    onValueChange={(value) => onChange({ list_style: (value || "none") as LayoutElement["list_style"] })}>
                    <ToggleGroupItem value="bullet" aria-label="Layout bullets" title="Bullets"><ListIcon /></ToggleGroupItem>
                    <ToggleGroupItem value="numbered" aria-label="Layout numbered list" title="Numbered list"><ListOrderedIcon /></ToggleGroupItem>
                </ToggleGroup>
                <label className={labelClass}>
                    Text case
                    <select aria-label="Layout text case" disabled={!enabled} className={fieldClass}
                        value={element?.text_case ?? "original"}
                        onChange={(event) => onChange({ text_case: event.target.value as ElementCase })}>
                        {caseChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
                    </select>
                </label>
            </div>
            <p className="text-xs text-muted-foreground">
                {enabled ? `Formatting ${elementLabel(element)}. Changes apply to the entire element.`
                    : "Select a text, date, company info, or table element to enable formatting. Bullets and numbering use one item per line."}
            </p>
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
    const isText =
        element.type === "text" ||
        element.type === "table" ||
        element.type === "date" ||
        element.type === "company";
    const hasHeight = element.type === "spacer" || element.type === "divider";
    const fieldClass =
        "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
    const labelClass = "block text-xs font-medium text-foreground";

    return (
        <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">
                {elementLabel(element)} properties
            </p>

            {element.type === "table" && element.cells ? (
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={element.border ?? true}
                            onChange={(event) => onChange({ border: event.target.checked })} />
                        Show table borders
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={element.header_row ?? false}
                            onChange={(event) => onChange({
                                header_row: event.target.checked,
                                label_bg: element.header_row ? element.label_bg : "#065f46",
                                header_color: element.header_color || "#ffffff",
                            })} />
                        Use first row as header
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {element.header_row ? (
                            <>
                                <label className={labelClass}>Header background
                                    <input type="color" className={fieldClass} value={element.label_bg || "#065f46"}
                                        onChange={(event) => onChange({ label_bg: event.target.value })} />
                                </label>
                                <label className={labelClass}>Header text color
                                    <input type="color" className={fieldClass} value={element.header_color || "#ffffff"}
                                        onChange={(event) => onChange({ header_color: event.target.value })} />
                                </label>
                            </>
                        ) : null}
                        <label className={labelClass}>Border color
                            <input type="color" className={fieldClass} value={element.border_color || "#cbd5e1"}
                                onChange={(event) => onChange({ border_color: event.target.value })} />
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={element.cells.length >= 20}
                            onClick={() => onChange({ cells: [...element.cells!, Array(element.cells![0].length).fill("")] })}>
                            Add row
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={element.cells[0].length >= 4}
                            onClick={() => onChange({ cells: element.cells!.map((row) => [...row, ""]) })}>
                            Add column
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {(["Rows", "Columns"] as const).map((label) => (
                            <label key={label} className={labelClass}>
                                {label}
                                <input type="number" min={1} max={label === "Rows" ? 20 : 4}
                                    value={label === "Rows" ? element.cells!.length : element.cells![0].length}
                                    className={fieldClass}
                                    onChange={(event) => {
                                        const value = event.target.valueAsNumber;
                                        if (!Number.isInteger(value) || value < 1 || value > (label === "Rows" ? 20 : 4)) return;
                                        const rows = label === "Rows" ? value : element.cells!.length;
                                        const cols = label === "Columns" ? value : element.cells![0].length;
                                        onChange({ cells: Array.from({ length: rows }, (_, r) =>
                                            Array.from({ length: cols }, (_, c) => element.cells?.[r]?.[c] ?? "")) });
                                    }} />
                            </label>
                        ))}
                    </div>
                    {element.cells.map((row, r) => (
                        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                            {row.map((cell, c) => (
                                <input key={c} aria-label={`Row ${r + 1}, column ${c + 1}`} maxLength={300}
                                    placeholder={`R${r + 1} C${c + 1}`} value={cell} className={fieldClass}
                                    onChange={(event) => onChange({ cells: element.cells!.map((row, ri) => row.map((value, ci) => ri === r && ci === c ? event.target.value : value)) })} />
                            ))}
                        </div>
                    ))}
                </div>
            ) : null}
            {element.type === "table" && !element.cells ? (
                <TableEditor
                    element={element}
                    fields={fields}
                    onChange={onChange}
                    labelClass={labelClass}
                    fieldClass={fieldClass}
                />
            ) : null}

            {element.type === "company" ? (
                <CompanyFieldsEditor
                    element={element}
                    fields={fields}
                    onChange={onChange}
                    labelClass={labelClass}
                    fieldClass={fieldClass}
                />
            ) : null}

            {element.type === "text" ? (
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
                        Fields appear as {"{{field_name}}"} and are replaced
                        with real values when the document is generated.
                    </span>
                </label>
            ) : null}

            {element.type === "date" ? (
                <p className="text-xs text-muted-foreground">
                    Shows the date the document is generated.
                </p>
            ) : null}

            {element.type === "image" ? (
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
                        ? "Uploading…"
                        : element.src
                          ? "Replace image"
                          : "Upload image"}
                </Button>
            ) : null}

            {element.type !== "spacer" ? (
                <div>
                    <p className={labelClass}>Alignment</p>
                    <div
                        role="group"
                        aria-label="Alignment"
                        className="mt-1 inline-flex rounded-md border border-border p-0.5"
                    >
                        {(
                            [
                                ["left", AlignLeftIcon],
                                ["center", AlignCenterIcon],
                                ["right", AlignRightIcon],
                                ...(isText ? [["justify", AlignJustifyIcon] as const] : []),
                            ] as const
                        ).map(([value, Icon]) => (
                            <button
                                key={value}
                                type="button"
                                aria-label={`Align ${value}`}
                                aria-pressed={element.align === value}
                                onClick={() => onChange({ align: value })}
                                className={cn(
                                    "rounded p-1.5 transition",
                                    element.align === value
                                        ? "bg-emerald-700 text-white"
                                        : "text-muted-foreground hover:bg-muted",
                                )}
                            >
                                <Icon className="size-4" />
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {element.type !== "spacer" ? (
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
                    {element.type === "divider"
                        ? `Thickness (${element.height}px)`
                        : `Height (${element.height}px)`}
                    <input
                        type="range"
                        min={1}
                        max={element.type === "divider" ? 12 : 200}
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
                    <label className={labelClass}>
                        Font family
                        <select
                            value={element.font_family ?? "default"}
                            onChange={(event) =>
                                onChange({ font_family: event.target.value })
                            }
                            className={fieldClass}
                            style={{
                                fontFamily: fontStack(element.font_family),
                            }}
                        >
                            {fontChoices.map((choice) => (
                                <option
                                    key={choice.id}
                                    value={choice.id}
                                    style={{ fontFamily: choice.stack }}
                                >
                                    {choice.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-end gap-3">
                        <label className={cn(labelClass, "flex-1")}>
                            Font size (px)
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
                                    "rounded-md border p-2 transition",
                                    element.bold
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                                        : "border-border hover:bg-muted",
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
                                    "rounded-md border p-2 transition",
                                    element.italic
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                                        : "border-border hover:bg-muted",
                                )}
                            >
                                <ItalicIcon className="size-4" />
                            </button>
                            <Button
                                type="button"
                                variant={element.underline ? "secondary" : "outline"}
                                size="icon-sm"
                                aria-label="Underline"
                                aria-pressed={element.underline ?? false}
                                onClick={() => onChange({ underline: !element.underline })}
                            >
                                <UnderlineIcon />
                            </Button>
                        </div>
                    </div>
                    <label className={labelClass}>
                        Line spacing
                        <select
                            value={element.line_height ?? 1.35}
                            onChange={(event) => onChange({ line_height: Number(event.target.value) })}
                            className={fieldClass}
                        >
                            <option value={1}>Single</option>
                            <option value={1.15}>1.15</option>
                            <option value={1.35}>Default (1.35)</option>
                            <option value={1.5}>1.5</option>
                            <option value={2}>Double</option>
                        </select>
                    </label>
                </>
            ) : null}

            {element.type === "text" ? (
                <label className={labelClass}>
                    List style
                    <select
                        value={element.list_style ?? "none"}
                        onChange={(event) => onChange({
                            list_style: event.target.value as LayoutElement["list_style"],
                        })}
                        className={fieldClass}
                    >
                        <option value="none">Plain text</option>
                        <option value="bullet">Bullets</option>
                        <option value="numbered">Numbered list</option>
                    </select>
                    <span className="mt-1 block font-normal text-muted-foreground">
                        Each line of text becomes one list item.
                    </span>
                </label>
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

            {isText || element.type === "divider" ? (
                <div className={labelClass}>
                    {isText ? "Font color" : "Color"}
                    <ColorSelect
                        value={element.color}
                        onChange={(color) => onChange({ color })}
                    />
                </div>
            ) : null}
        </div>
    );
}

const fontChoices = [
    { id: "default", label: "Default", stack: undefined },
    {
        id: "helvetica",
        label: "Helvetica",
        stack: "Helvetica, Arial, sans-serif",
    },
    { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
    { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
    { id: "tahoma", label: "Tahoma", stack: "Tahoma, Geneva, sans-serif" },
    {
        id: "trebuchet",
        label: "Trebuchet MS",
        stack: '"Trebuchet MS", Helvetica, sans-serif',
    },
    { id: "georgia", label: "Georgia", stack: "Georgia, serif" },
    {
        id: "times",
        label: "Times New Roman",
        stack: '"Times New Roman", Times, serif',
    },
    {
        id: "courier",
        label: "Courier New",
        stack: '"Courier New", Courier, monospace',
    },
];

const colorChoices = [
    { value: "#000000", label: "Black" },
    { value: "#ffffff", label: "White" },
    { value: "#64748b", label: "Gray" },
    { value: "#dc2626", label: "Red" },
    { value: "#ea580c", label: "Orange" },
    { value: "#ca8a04", label: "Gold" },
    { value: "#16a34a", label: "Green" },
    { value: "#065f46", label: "Dark green" },
    { value: "#0891b2", label: "Teal" },
    { value: "#2563eb", label: "Blue" },
    { value: "#1e3a8a", label: "Navy" },
    { value: "#7c3aed", label: "Purple" },
    { value: "#db2777", label: "Pink" },
];

function ColorSelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (color: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const current = value.toLowerCase();
    const known = colorChoices.find((choice) => choice.value === current);
    const options = known
        ? colorChoices
        : [{ value: current, label: `Custom (${current})` }, ...colorChoices];
    const label = known?.label ?? `Custom (${current})`;

    useEffect(() => {
        if (!open) {
            return;
        }

        const close = (event: Event) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("pointerdown", close);

        return () => document.removeEventListener("pointerdown", close);
    }, [open]);

    const swatch = (color: string) => (
        <span
            className="size-5 shrink-0 rounded border border-slate-400/70"
            style={{ backgroundColor: color }}
        />
    );

    return (
        <div ref={rootRef} className="relative mt-1">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((state) => !state)}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        setOpen(false);
                    }
                }}
                className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
                {swatch(current)}
                <span className="flex-1 truncate">{label}</span>
                <span
                    aria-hidden="true"
                    className="text-xs text-muted-foreground"
                >
                    ▾
                </span>
            </button>
            {open ? (
                <ul
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-lg"
                >
                    {options.map((choice) => (
                        <li
                            key={choice.value}
                            role="option"
                            aria-selected={choice.value === current}
                            onClick={() => {
                                onChange(choice.value);
                                setOpen(false);
                            }}
                            className={cn(
                                "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted",
                                choice.value === current &&
                                    "bg-emerald-50 font-medium dark:bg-emerald-950/30",
                            )}
                        >
                            {swatch(choice.value)}
                            {choice.label}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

function fontStack(id?: string) {
    return fontChoices.find((choice) => choice.id === id)?.stack;
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
    } = controller;
    const zoneColor = zoneColors[zone];
    const meta = zones.find((item) => item.id === zone)!;
    const items = elements.filter((element) => element.zone === zone);
    const active = targetZone === zone;

    return (
        <section
            aria-label={meta.label}
            onClick={() => setTargetZone(zone)}
            style={
                zone !== "header" && zoneColor
                    ? { backgroundColor: zoneColor }
                    : undefined
            }
            className={cn(
                "relative transition",
                zone === "header" ? "pb-3" : "px-5 py-3 sm:px-8",
                active &&
                    (zone === "header"
                        ? "border-white bg-white/20"
                        : "border-emerald-400 bg-emerald-50/50"),
                !active &&
                    zone !== "header" &&
                    "border-slate-300 bg-slate-50/40 hover:border-emerald-300",
            )}
        >
            <div
                ref={(node) => { controller.canvasRefs.current[zone] = node; }}
                data-canvas
                className="relative"
                style={{ height: controller.headerHeight }}
            >
                {items.length === 0 ? (
                    <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] opacity-80">
                        Use the toolbar to add a component to the visible area,
                        then drag it anywhere in the layout.
                    </p>
                ) : null}
                {items.map((element) => {
                    const isSelected = element.id === selectedId;

                    return (
                        <div
                            key={element.id}
                            role="button"
                            tabIndex={0}
                            data-element-id={element.id}
                            aria-pressed={isSelected}
                            aria-label={`${elementLabel(element)} component`}
                            style={{
                                position: "absolute",
                                left: `${element.x ?? 0}%`,
                                top: element.y ?? 0,
                                width: `${element.width}%`,
                                zIndex: isSelected ? 10 : 1,
                            }}
                            onPointerDown={(event) => {
                                event.stopPropagation();
                                setTargetZone(zone);
                                setSelectedId(element.id);
                                controller.startMove(event, element);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                                if (event.target !== event.currentTarget) {
                                    return;
                                }

                                const step = event.shiftKey ? 10 : 1;
                                const nudge: Record<
                                    string,
                                    Partial<LayoutElement>
                                > = {
                                    ArrowLeft: {
                                        x: Math.max(
                                            0,
                                            (element.x ?? 0) - step / 4,
                                        ),
                                    },
                                    ArrowRight: {
                                        x: Math.min(
                                            100 - element.width,
                                            (element.x ?? 0) + step / 4,
                                        ),
                                    },
                                    ArrowUp: {
                                        y: Math.max(0, (element.y ?? 0) - step),
                                    },
                                    ArrowDown: { y: (element.y ?? 0) + step },
                                };

                                if (nudge[event.key]) {
                                    event.preventDefault();
                                    controller.update(
                                        element.id,
                                        nudge[event.key],
                                    );
                                } else if (
                                    event.key === "Delete" ||
                                    event.key === "Backspace"
                                ) {
                                    event.preventDefault();
                                    controller.remove(element.id);
                                }
                            }}
                            className={cn(
                                "group select-none touch-none rounded-sm",
                                isSelected
                                    ? "cursor-move shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#059669]"
                                    : "cursor-pointer hover:shadow-[0_0_0_1px_rgba(255,255,255,0.8),0_0_0_2px_rgba(5,150,105,0.5)]",
                            )}
                        >
                            {(element.type === "image" && !element.src) ||
                            (element.type === "text" &&
                                element.content.trim() === "") ? (
                                <div className="rounded border border-dashed border-slate-300 px-3 py-3 text-center text-[11px] text-slate-400">
                                    {element.type === "image"
                                        ? "Empty image"
                                        : "Empty text"}
                                </div>
                            ) : (
                                <ElementPreview
                                    element={{ ...element, width: 100 }}
                                    fields={controller.fields}
                                />
                            )}
                            {isSelected && element.type !== "spacer" ? (
                                <span
                                    role="separator"
                                    data-resize-handle
                                    aria-label="Drag to resize width"
                                    onPointerDown={(event) =>
                                        controller.startResize(
                                            event,
                                            element,
                                            "width",
                                        )
                                    }
                                    className="absolute -right-2 top-1/2 z-10 h-8 w-3 -translate-y-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-emerald-600 shadow"
                                />
                            ) : null}
                            {isSelected &&
                            (element.type === "spacer" ||
                                element.type === "divider") ? (
                                <span
                                    role="separator"
                                    data-resize-handle
                                    aria-label="Drag to resize height"
                                    onPointerDown={(event) =>
                                        controller.startResize(
                                            event,
                                            element,
                                            "height",
                                        )
                                    }
                                    className="absolute -bottom-2 left-1/2 z-10 h-3 w-8 -translate-x-1/2 cursor-ns-resize touch-none rounded-full border-2 border-white bg-emerald-600 shadow"
                                />
                            ) : null}
                        </div>
                    );
                })}
                <span
                    role="separator"
                    aria-label="Drag to change header height"
                    title="Drag to change header height"
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const handle = event.currentTarget;
                        handle.setPointerCapture(event.pointerId);
                        const startY = event.clientY;
                        const startHeight = controller.headerHeight;
                        const onMove = (moveEvent: PointerEvent) =>
                            controller.setHeaderHeight(
                                Math.round(
                                    Math.max(
                                        60,
                                        startHeight + moveEvent.clientY - startY,
                                    ),
                                ),
                            );
                        const onUp = () => {
                            handle.removeEventListener("pointermove", onMove);
                            handle.removeEventListener("pointerup", onUp);
                        };
                        handle.addEventListener("pointermove", onMove);
                        handle.addEventListener("pointerup", onUp);
                    }}
                    className="absolute -bottom-3 left-1/2 z-20 h-2 w-16 -translate-x-1/2 cursor-ns-resize touch-none rounded-full bg-white/80 shadow ring-1 ring-black/20"
                />
            </div>
        </section>
    );
}

function CompanyFieldsEditor({
    element,
    fields,
    onChange,
    labelClass,
    fieldClass,
}: {
    element: LayoutElement;
    fields: MergeField[];
    onChange: (patch: Partial<LayoutElement>) => void;
    labelClass: string;
    fieldClass: string;
}) {
    const current = element.fields ?? DEFAULT_COMPANY_FIELDS;
    const companyFields = fields.filter((field) => field.group === "Company");
    const available = companyFields.filter(
        (field) => !current.includes(field.key),
    );
    const layout = element.layout ?? "lines";
    const small =
        "rounded border border-input px-1.5 text-xs hover:bg-muted disabled:opacity-40";

    const moveField = (index: number, direction: -1 | 1) => {
        const next = [...current];
        const target = index + direction;

        if (target < 0 || target >= next.length) {
            return;
        }

        [next[index], next[target]] = [next[target], next[index]];
        onChange({ fields: next });
    };

    return (
        <div className="space-y-3">
            <div>
                <p className="text-xs font-medium text-foreground">
                    Company fields
                </p>
                <ul className="mt-2 space-y-1">
                    {current.map((key, index) => (
                        <li
                            key={key}
                            className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-sm"
                        >
                            <span className="flex-1 truncate">
                                {companyFields
                                    .find((field) => field.key === key)
                                    ?.label.replace("Company ", "") ?? key}
                            </span>
                            <button
                                type="button"
                                aria-label="Move field up"
                                disabled={index === 0}
                                onClick={() => moveField(index, -1)}
                                className={small}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                aria-label="Move field down"
                                disabled={index === current.length - 1}
                                onClick={() => moveField(index, 1)}
                                className={small}
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                aria-label="Remove field"
                                onClick={() =>
                                    onChange({
                                        fields: current.filter(
                                            (item) => item !== key,
                                        ),
                                    })
                                }
                                className={cn(small, "text-red-600")}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                    {current.length === 0 ? (
                        <li className="text-xs text-muted-foreground">
                            No fields selected.
                        </li>
                    ) : null}
                </ul>
                {available.length > 0 ? (
                    <select
                        aria-label="Add a company field"
                        value=""
                        onChange={(event) => {
                            if (event.target.value) {
                                onChange({
                                    fields: [...current, event.target.value],
                                });
                            }
                        }}
                        className={fieldClass}
                    >
                        <option value="">+ Add a field…</option>
                        {available.map((field) => (
                            <option key={field.key} value={field.key}>
                                {field.label.replace("Company ", "")}
                            </option>
                        ))}
                    </select>
                ) : null}
            </div>

            <label className={labelClass}>
                Display as
                <select
                    value={layout}
                    onChange={(event) =>
                        onChange({
                            layout: event.target.value as "lines" | "table",
                        })
                    }
                    className={fieldClass}
                >
                    <option value="lines">Lines of text</option>
                    <option value="table">Table</option>
                </select>
            </label>

            {layout === "table" ? (
                <div className="flex items-end gap-3">
                    <label className={cn(labelClass, "flex-1")}>
                        Columns
                        <select
                            value={element.columns ?? 2}
                            onChange={(event) =>
                                onChange({
                                    columns: Number(event.target.value),
                                })
                            }
                            className={fieldClass}
                        >
                            {[1, 2, 3, 4].map((count) => (
                                <option key={count} value={count}>
                                    {count}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                        <input
                            type="checkbox"
                            checked={element.border ?? true}
                            onChange={(event) =>
                                onChange({ border: event.target.checked })
                            }
                        />
                        Borders
                    </label>
                </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={element.show_labels ?? false}
                    onChange={(event) =>
                        onChange({ show_labels: event.target.checked })
                    }
                />
                Show field names
            </label>
        </div>
    );
}

function TableEditor({
    element,
    fields,
    onChange,
    labelClass,
    fieldClass,
}: {
    element: LayoutElement;
    fields: MergeField[];
    onChange: (patch: Partial<LayoutElement>) => void;
    labelClass: string;
    fieldClass: string;
}) {
    const items = element.items ?? [];
    const small =
        "rounded border border-input px-1.5 text-xs hover:bg-muted disabled:opacity-40";
    const setItems = (next: typeof items) => onChange({ items: next });
    const patchItem = (index: number, patch: Partial<(typeof items)[number]>) =>
        setItems(
            items.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );
    const moveItem = (index: number, direction: -1 | 1) => {
        const target = index + direction;

        if (target < 0 || target >= items.length) {
            return;
        }

        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        setItems(next);
    };

    return (
        <div className="space-y-3">
            <div>
                <p className="text-xs font-medium text-foreground">
                    Table rows
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                    Each row is a name and a value. Values can use fields; rows
                    whose field is empty are skipped.
                </p>
                <ul className="mt-2 space-y-2">
                    {items.map((item, index) => (
                        <li
                            key={index}
                            className="space-y-1 rounded-md border border-border bg-muted/30 p-2"
                        >
                            <input
                                aria-label="Name"
                                value={item.label}
                                placeholder="Name"
                                onChange={(event) =>
                                    patchItem(index, {
                                        label: event.target.value,
                                    })
                                }
                                className={fieldClass}
                            />
                            <input
                                aria-label="Value"
                                value={item.value}
                                placeholder="Value or {{field}}"
                                onChange={(event) =>
                                    patchItem(index, {
                                        value: event.target.value,
                                    })
                                }
                                className={fieldClass}
                            />
                            <div className="flex items-center gap-1">
                                <select
                                    aria-label="Insert a field into the value"
                                    value=""
                                    onChange={(event) => {
                                        if (event.target.value) {
                                            patchItem(index, {
                                                value: `${item.value}{{${event.target.value}}}`,
                                            });
                                        }
                                    }}
                                    className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs"
                                >
                                    <option value="">Insert field…</option>
                                    {fields.map((field) => (
                                        <option
                                            key={field.key}
                                            value={field.key}
                                        >
                                            {field.group}: {field.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    aria-label="Move row up"
                                    disabled={index === 0}
                                    onClick={() => moveItem(index, -1)}
                                    className={small}
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    aria-label="Move row down"
                                    disabled={index === items.length - 1}
                                    onClick={() => moveItem(index, 1)}
                                    className={small}
                                >
                                    ↓
                                </button>
                                <button
                                    type="button"
                                    aria-label="Remove row"
                                    onClick={() =>
                                        setItems(
                                            items.filter((_, i) => i !== index),
                                        )
                                    }
                                    className={cn(small, "text-red-600")}
                                >
                                    ×
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                <button
                    type="button"
                    disabled={items.length >= 40}
                    onClick={() =>
                        setItems([...items, { label: "", value: "" }])
                    }
                    className="mt-2 w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                    + Add row
                </button>
            </div>

            <div className="flex items-end gap-3">
                <label className={cn(labelClass, "flex-1")}>
                    Pairs per row
                    <select
                        value={element.columns ?? 2}
                        onChange={(event) =>
                            onChange({ columns: Number(event.target.value) })
                        }
                        className={fieldClass}
                    >
                        {[1, 2, 3].map((count) => (
                            <option key={count} value={count}>
                                {count}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                        type="checkbox"
                        checked={element.border ?? true}
                        onChange={(event) =>
                            onChange({ border: event.target.checked })
                        }
                    />
                    Borders
                </label>
            </div>

            <label className={labelClass}>
                Name column width (%)
                <input
                    type="number"
                    min={10}
                    max={70}
                    value={element.label_width ?? 30}
                    onChange={(event) =>
                        onChange({
                            label_width: Math.max(
                                10,
                                Math.min(70, Number(event.target.value) || 30),
                            ),
                        })
                    }
                    className={fieldClass}
                />
            </label>

            <div className="flex items-end gap-3">
                <label className={cn(labelClass, "flex-1")}>
                    Name shading
                    <input
                        type="color"
                        value={element.label_bg || "#ffffff"}
                        onChange={(event) =>
                            onChange({ label_bg: event.target.value })
                        }
                        className="mt-1 block h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1"
                    />
                </label>
                <label className={cn(labelClass, "flex-1")}>
                    Border color
                    <input
                        type="color"
                        value={element.border_color ?? "#cbd5e1"}
                        onChange={(event) =>
                            onChange({ border_color: event.target.value })
                        }
                        className="mt-1 block h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1"
                    />
                </label>
                <button
                    type="button"
                    onClick={() => onChange({ label_bg: "" })}
                    className="pb-2 text-xs text-muted-foreground hover:text-red-600"
                >
                    No shading
                </button>
            </div>
        </div>
    );
}
