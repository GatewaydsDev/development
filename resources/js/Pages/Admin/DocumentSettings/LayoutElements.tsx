import { Button } from "@/Components/ui/button";
import StickyDocumentToolbar from "@/Components/StickyDocumentToolbar";
import InsertBidTextFieldMenu from "@/Components/InsertBidTextFieldMenu";
import { BID_TEXT_PLACEHOLDERS, BID_TEXT_FIELD_GROUP_ORDER, placeholderToken } from "@/Pages/Admin/Bids/bidText";
import { ToggleGroup, ToggleGroupItem } from "@/Components/ui/toggle-group";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
    DropdownMenuItem, DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { layoutColumnWidths, resizedLayoutColumns, tableEdgeBorder } from "@/lib/printLayoutGeometry";
import { layoutTableCell, layoutTableDimensions, layoutTableField, resolveLayoutTableFields } from "@/lib/printLayoutTableFields";
import { layoutPages, loadPdfFont, pdfTextFont, pdfTextLines, pdfTextLineHeight, pdfRunText, pdfRunY, pdfFontSources, type PdfLayoutElement } from "@/lib/printLayoutPdf";
import { PRINT_LAYOUT_FONTS, PRINT_LAYOUT_FONT_CHOICES, PRINT_LAYOUT_WIDTH, printLayoutTextCase, tableStripeColor, tableTextStyle, TABLE_TEXT_STYLE_KEYS, type TableStriping, type TableTextStyle, type TextCaseState } from "@/lib/printLayoutGeometry";
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
    Fragment,
    PointerEvent as ReactPointerEvent,
    ReactNode,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";

export type ElementType =
    "text" | "image" | "divider" | "spacer" | "date" | "validity" | "company" | "table";
export type ElementZone = "header" | "intro" | "body" | "footer";
export type ElementCase = "original" | "camel" | "uppercase" | "lowercase";

export function transformCase(value: string, textCase: ElementCase): string {
    return printLayoutTextCase(value, textCase);
}

export type MergeField = {
    key: string;
    label: string;
    group: string;
    sample: string;
    source?: string;
    sourceLabel?: string;
};

export function fillFields(value: string, fields: MergeField[]): string {
    return value.replace(/\{\{\s*([a-z0-9_]+)\s*}}/g, (_match, key: string) => {
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

export type LayoutElement = TableStriping & PdfLayoutElement & {
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
    validity_days?: 30 | 60 | 90;
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
    { type: "validity", label: "Validity", icon: CalendarIcon },
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

const defaultWidth: Partial<Record<ElementType, number>> = {
    text: 50,
    date: 30,
    validity: 30,
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
        validity: "Validity",
        company: "Company info",
        table: "Info table",
    })[element.type];

function TableRowSelector({ row, onSelect }: { row: number; onSelect: (row: number) => void }) {
    return <button type="button" className="table-row-selector"
        aria-label={`Select row ${row + 1}`} title={`Select row ${row + 1} to format its text`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onSelect(row); }} />;
}

function previewTableItems(element: LayoutElement, fields: MergeField[]) {
    return (element.items ?? []).map((item, index) => ({
        index,
        label: fillFields(item.label, fields).trim(),
        value: fillFields(item.value, fields).trim(),
        dynamic: item.value.includes("{{"),
    })).filter((row) => !(row.value === "" && row.dynamic) && (row.label !== "" || row.value !== ""));
}

function tableCellPosition(element: LayoutElement, cell: { row: number; column: number }, fields: MergeField[]) {
    if (element.cells) return { row: cell.row + 1, column: cell.column + 1 };
    const pairs = Math.min(3, Math.max(1, element.columns ?? 2));
    const visibleIndex = previewTableItems(element, fields).findIndex((item) => item.index === cell.row);
    const position = Math.max(0, visibleIndex === -1 ? cell.row : visibleIndex);
    return { row: Math.floor(position / pairs) + 1, column: position % pairs * 2 + cell.column + 1 };
}

export function ElementPreview({
    element,
    fields = [],
    selectedColumn,
    selectedRow,
    onSelectRow,
    selectedCell,
    onSelectCell,
    sourceElements = [],
}: {
    sourceElements?: LayoutElement[];
    selectedCell?: { row: number; column: number };
    onSelectCell?: (row: number, column: number) => void;
    selectedRow?: number;
    onSelectRow?: (row: number) => void;
    selectedColumn?: number;
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
            <div style={{ ...box, padding: element.pdf_background ? 0 : "4px 0" }}>
                <img
                    src={element.src}
                    alt=""
                    draggable={false}
                    style={{
                        width: "100%",
                        height: element.pdf_background ? "100%" : "auto",
                        objectFit: element.pdf_background ? "fill" : undefined,
                        display: "block",
                    }}
                />
            </div>
        ) : null;
    }

    if (element.type === "table") {
        const widths = layoutColumnWidths(element);
        if (element.cells) {
            return (
                <table style={{ ...box, backgroundColor: element.table_background, borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                        {element.cells.map((row, r) => (
                            <tr key={r}>
                                {row.map((cell, c) => {
                                    const span = element.cell_spans?.[r]?.[c];
                                    if (span && (!span.rows || !span.columns)) return null;
                                    const style = tableTextStyle(element, r, c, r === 0 && element.header_row);
                                    return (
                                    <td key={c}
                                        colSpan={span?.columns}
                                        rowSpan={span?.rows}
                                        data-table-row={onSelectCell ? r : undefined}
                                        data-table-column={onSelectCell ? c : undefined}
                                        tabIndex={onSelectCell ? 0 : undefined}
                                        aria-label={onSelectCell ? `Row ${r + 1}, column ${c + 1} cell` : undefined}
                                        onClick={onSelectCell ? (event) => { event.stopPropagation(); onSelectCell(r, c); } : undefined}
                                        onKeyDown={onSelectCell ? (event) => {
                                            if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                                event.preventDefault(); event.stopPropagation(); onSelectCell(r, c);
                                            }
                                        } : undefined}
                                        style={{
                                        width: `${widths.slice(c, c + (span?.columns ?? 1)).reduce((sum, value) => sum + value, 0)}%`,
                                        height: element.row_heights?.slice(r, r + (span?.rows ?? 1)).reduce((sum, value) => sum + value, 0),
                                        position: "relative",
                                        padding: element.row_heights?.length ? "2px 6px" : "6px 10px",
                                        borderTop: tableEdgeBorder(element, r, c, "top"),
                                        borderRight: tableEdgeBorder(element, r, c, "right"),
                                        borderBottom: tableEdgeBorder(element, r, c, "bottom"),
                                        borderLeft: tableEdgeBorder(element, r, c, "left"),
                                        fontFamily: fontStack(style.font_family),
                                        fontSize: style.font_size,
                                        color: style.color,
                                        backgroundColor: r === 0 && element.header_row
                                            ? element.label_bg || "#065f46"
                                            : tableStripeColor(element, r - (element.header_row ? 1 : 0), c, r),
                                        fontWeight: style.bold ? 700 : 400,
                                        fontStyle: style.italic ? "italic" : "normal",
                                        textAlign: style.align,
                                        textDecoration: style.underline ? "underline" : undefined,
                                        lineHeight: style.line_height ?? 1.35,
                                        whiteSpace: "pre-line",
                                        overflowWrap: "anywhere",
                                        outline: c === selectedColumn || r === selectedRow || (selectedCell?.row === r && selectedCell.column === c) ? "2px solid #059669" : undefined,
                                        outlineOffset: -2,
                                    }}>
                                        {c === 0 && onSelectRow ? <TableRowSelector row={r} onSelect={onSelectRow} /> : null}
                                        {transformCase(fillFields(cell, fields), style.text_case ?? element.text_case) || "\u00a0"}
                                    </td>
                                ); })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        const pairs = Math.min(3, Math.max(1, element.columns ?? 2));
        const rows = previewTableItems(element, fields);

        if (rows.length === 0) {
            return null;
        }

        const line = element.border
            ? `1px solid ${element.border_color ?? "#cbd5e1"}`
            : undefined;
        const base = {
            fontFamily: pdfTextFont(element),
            fontSize: element.font_size,
            color: element.color,
            fontSynthesis: element.pdf_font_src ? "none" : undefined,
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
                            {Array.from({ length: pairs }).map((_, index) => {
                                const row = chunk[index]?.index;
                                const labelStyle = tableTextStyle(element, row ?? -1, index * 2, false, true, 0);
                                const valueStyle = tableTextStyle(element, row ?? -1, index * 2 + 1, false, false, 1);
                                const cellProps = (column: number) => row !== undefined && onSelectCell ? {
                                    "data-table-row": row,
                                    "data-table-column": column,
                                    tabIndex: 0,
                                    "aria-label": `Row ${row + 1}, ${column === 0 ? "name" : "value"} cell`,
                                    onClick: (event: React.MouseEvent<HTMLTableCellElement>) => {
                                        event.stopPropagation(); onSelectCell(row, column);
                                    },
                                    onKeyDown: (event: React.KeyboardEvent<HTMLTableCellElement>) => {
                                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                            event.preventDefault(); event.stopPropagation(); onSelectCell(row, column);
                                        }
                                    },
                                } : {};
                                const cellStyle = (style: TableTextStyle) => ({
                                    fontFamily: fontStack(style.font_family),
                                    fontSize: style.font_size, color: style.color,
                                    fontWeight: style.bold ? 700 : 400,
                                    fontStyle: style.italic ? "italic" : "normal",
                                    textDecoration: style.underline ? "underline" : undefined,
                                    textAlign: style.align, lineHeight: style.line_height ?? 1.35,
                                });
                                return (
                                <Fragment key={index}>
                                    <td
                                        {...cellProps(0)}
                                        style={{
                                            ...base,
                                            ...cellStyle(labelStyle),
                                            position: "relative",
                                            width: `${widths[index * 2]}%`,
                                            outline: index * 2 === selectedColumn || (selectedRow !== undefined && row === selectedRow) || (selectedCell?.row === row && selectedCell?.column === 0) ? "2px solid #059669" : undefined,
                                            outlineOffset: -2,
                                            background:
                                                tableStripeColor(element, rowIndex, index * 2) ?? (element.label_bg || undefined),
                                        }}
                                    >
                                        {row !== undefined && onSelectRow ? <TableRowSelector row={row} onSelect={onSelectRow} /> : null}
                                        {transformCase(
                                            chunk[index]?.label ?? "",
                                            labelStyle.text_case ?? element.text_case,
                                        )}
                                    </td>
                                    <td
                                        {...cellProps(1)}
                                        style={{
                                            ...base,
                                            ...cellStyle(valueStyle),
                                            width: `${widths[index * 2 + 1]}%`,
                                            background: tableStripeColor(element, rowIndex, index * 2 + 1),
                                            outline: index * 2 + 1 === selectedColumn || (selectedRow !== undefined && row === selectedRow) || (selectedCell?.row === row && selectedCell?.column === 1) ? "2px solid #059669" : undefined,
                                            outlineOffset: -2,
                                        }}
                                    >
                                        {transformCase(
                                            chunk[index]?.value ?? "",
                                            valueStyle.text_case ?? element.text_case,
                                        )}
                                    </td>
                                </Fragment>
                            ); })}
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
            fontFamily: pdfTextFont(element),
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

    const validityDate = new Date();
    validityDate.setDate(validityDate.getDate() + (element.validity_days ?? 30));
    const content =
        element.type === "validity"
            ? validityDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            :
        element.type === "date"
            ? new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
              })
            : fillFields(resolveLayoutTableFields(element.content, sourceElements), fields);

    const lines = pdfTextLines(content, element);
    const runCaseStates: Record<number, TextCaseState> = {};
    return content.trim() === "" && !element.pdf_line_count ? null : (
        <div
            style={{
                ...box,
                fontFamily: pdfTextFont(element),
                fontSize: element.font_size,
                color: element.color,
                fontWeight: element.bold ? 700 : 400,
                fontStyle: element.italic ? "italic" : "normal",
                lineHeight: pdfTextLineHeight(element),
                textDecoration: element.underline ? "underline" : undefined,
                padding: element.pdf_page || (element.type === "text" && element.list_style && element.list_style !== "none") ? 0 : "2px 0",
                fontSynthesis: element.pdf_font_src ? "none" : undefined,
                whiteSpace: "pre-line",
            }}
        >
            {element.type === "text" && element.list_style && element.list_style !== "none" ? (
                element.list_style === "numbered" ? (
                    <ol style={{ margin: 0, paddingLeft: 20, listStyleType: "decimal" }}>
                        {lines.map((line, index) => (
                            <li key={index} style={{ padding: element.pdf_page ? 0 : "2px 0" }}>{transformCase(line, element.text_case) || "\u00a0"}</li>
                        ))}
                    </ol>
                ) : (
                    <ul style={{ margin: 0, paddingLeft: 20, listStyleType: element.pdf_bullet_style ?? "disc" }}>
                        {lines.map((line, index) => (
                            <li key={index} style={{ padding: element.pdf_page ? 0 : "2px 0" }}>{transformCase(line, element.text_case) || "\u00a0"}</li>
                        ))}
                    </ul>
                )
            ) : content.trim() === "" && element.pdf_line_count ? (
                <div aria-label={`Blank imported paragraph, ${element.pdf_line_count} lines`}>
                    {lines.map((_, index) => <div key={index} className="border-b border-dashed border-slate-300 text-[10px] text-slate-400"
                        style={{ height: index === lines.length - 1 ? element.font_size : element.pdf_line_spacing ?? element.font_size }}>Empty line {index + 1}</div>)}
                </div>
            ) : element.pdf_text_runs?.length ? (
                <div style={{ position: "relative", height: element.height }}>
                    {element.pdf_text_runs.map((run, index) => <span key={index} style={{
                        position: "absolute", left: run.x, top: pdfRunY(run, element), width: run.width, minHeight: run.height,
                        fontFamily: pdfTextFont(run), fontSize: run.font_size, color: run.color,
                        fontWeight: run.bold ? 700 : 400, fontStyle: run.italic ? "italic" : "normal",
                        fontSynthesis: run.pdf_font_src ? "none" : undefined, lineHeight: 1, whiteSpace: "pre",
                    }}>{printLayoutTextCase(pdfRunText(lines, element.pdf_text_runs!, index), element.text_case,
                        runCaseStates[run.line] ??= { hasWord: false, capitalizeNext: false })}</span>)}
                </div>
            ) : transformCase(lines.join("\n"), element.text_case)}
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
    textCase?: ElementCase;
    headerHeight?: number;
    elements: LayoutElement[];
    zone: ElementZone;
    fields?: MergeField[];
    applyCase?: (value: string) => string;
    inBanner?: boolean;
    background?: string;
}) {
    const [fontError, setFontError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        Promise.all(pdfFontSources(elements).map(loadPdfFont))
            .catch(() => { if (active) setFontError("An imported font could not be loaded. Review the font assets before printing."); });
        return () => { active = false; };
    }, [elements]);
    const items = elements.filter((element) => element.zone === zone);

    if (items.length === 0) {
        return null;
    }

    if (zone === "header") {
        return (
            <div>
            {fontError ? <p role="alert" className="text-sm text-destructive">{fontError}</p> : null}
            {layoutPages(items, headerHeight).map((page) => <div key={page.id} className="relative" style={{ width: PRINT_LAYOUT_WIDTH, height: page.height }}>
                {page.elements.map((element) => (
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
                            sourceElements={elements}
                        />
                    </div>
                ))}
            </div>)}
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
                    sourceElements={elements}
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
    const [selectedColumn, setSelectedColumn] = useState<{ id: string; index: number } | null>(null);
    const [selectedRow, setSelectedRow] = useState<{ id: string; index: number } | null>(null);
    const [selectedCell, setSelectedCell] = useState<{ id: string; row: number; column: number } | null>(null);
    const [targetZone, setTargetZone] = useState<ElementZone>("header");
    const [targetPage, setTargetPage] = useState<string | undefined>();
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingImageFor = useRef<string | null>(null);
    const canvasRefs = useRef<Partial<Record<ElementZone, HTMLDivElement | null>>>({});

    const selected = elements.find((element) => element.id === selectedId);
    useEffect(() => {
        let active = true;
        Promise.all(pdfFontSources(elements).map(loadPdfFont))
            .catch(() => { if (active) setUploadError("An imported font could not be loaded. Choose another font or restore its asset."); });
        return () => { active = false; };
    }, [elements]);
    const rowCount = selected?.type === "table" ? (selected.cells?.length ?? selected.items?.length ?? 0) : 0;
    const activeRow = selectedRow?.id === selectedId && selectedRow.index < rowCount ? selectedRow : null;
    const activeCell = selectedCell?.id === selectedId && selectedCell.row < rowCount &&
        selectedCell.column < (selected?.cells?.[selectedCell.row]?.length ?? 2) ? selectedCell : null;
    useEffect(() => {
        if (selectedRow && (selectedRow.id !== selectedId || selectedRow.index >= rowCount)) {
            setSelectedRow(null);
        }
    }, [selectedId, selectedRow, rowCount]);
    useEffect(() => {
        if (selectedCell && !activeCell) setSelectedCell(null);
    }, [selectedCell, activeCell]);
    const selectRow = (id: string, index: number | null) => {
        setSelectedId(id);
        setSelectedColumn(null);
        setSelectedCell(null);
        setSelectedRow(index === null ? null : { id, index });
    };
    const selectColumn = (column: typeof selectedColumn) => {
        setSelectedRow(null);
        setSelectedCell(null);
        setSelectedColumn(column);
    };
    const selectCell = (id: string, row: number, column: number) => {
        setSelectedId(id);
        setSelectedRow(null);
        setSelectedColumn(null);
        setSelectedCell({ id, row, column });
    };

    const update = (id: string, patch: Partial<LayoutElement>) =>
        onChange(
            elements.map((element) => {
                if (element.id !== id) return element;
                if (activeCell?.id === id || activeRow?.id === id) {
                    const style: TableTextStyle = Object.fromEntries(
                        TABLE_TEXT_STYLE_KEYS.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]),
                    );
                    const rest = Object.fromEntries(Object.entries(patch).filter(([key]) =>
                        !TABLE_TEXT_STYLE_KEYS.some((styleKey) => styleKey === key)));
                    if (!Object.keys(style).length) return { ...element, ...patch };
                    if (activeCell?.id === id) {
                        return { ...element, ...rest, cell_styles: Array.from({ length: rowCount }, (_, row) =>
                            row === activeCell.row
                                ? Array.from({ length: element.cells?.[row]?.length ?? 2 }, (_, column) =>
                                    column === activeCell.column
                                        ? { ...element.cell_styles?.[row]?.[column], ...style }
                                        : element.cell_styles?.[row]?.[column] ?? null)
                                : element.cell_styles?.[row] ?? null) };
                    }
                    return { ...element, ...rest, row_styles: Array.from({ length: rowCount }, (_, index) =>
                        index === activeRow?.index ? { ...element.row_styles?.[index], ...style } : element.row_styles?.[index] ?? null) };
                }
                if (patch.font_family && element.pdf_font_src) {
                    return { ...element, ...patch, pdf_font_src: undefined, pdf_font_name: undefined,
                        pdf_text_runs: element.pdf_text_runs?.map(run => ({ ...run, font_family: patch.font_family, pdf_font_src: undefined, pdf_font_name: undefined })) };
                }
                if (element.pdf_text_runs) {
                    const runStyle = Object.fromEntries(["font_size", "font_family", "color", "bold", "italic"]
                        .filter(key => Object.prototype.hasOwnProperty.call(patch, key))
                        .map(key => [key, patch[key as keyof LayoutElement]]));
                    if (Object.keys(runStyle).length) return { ...element, ...patch,
                        pdf_text_runs: element.pdf_text_runs.map(run => ({ ...run, ...runStyle,
                            ...(patch.bold !== undefined || patch.italic !== undefined ? { pdf_font_src: undefined, pdf_font_name: undefined } : {}) })) };
                }
                return selectedColumn?.id === id && patch.color
                        ? { ...element, ...Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "color")),
                            column_colors: Array.from({ length: element.cells?.[0]?.length ?? (element.columns ?? 2) * 2 },
                                (_, index) => index === selectedColumn.index ? patch.color! : element.column_colors?.[index] ?? null) }
                        : { ...element, ...patch };
            }),
        );

    const visibleToolbarBottom = () => Math.max(
        0,
        ...Array.from(document.querySelectorAll<HTMLElement>(
            'nav.sticky, [data-sticky-page-title], [data-document-toolbar][data-pinned="true"]',
        )).map((node) => node.getBoundingClientRect().bottom),
    );

    const add = (type: ElementType, zone: ElementZone = targetZone, grid = false) => {
        const element = createElement(type, zone);
        const pageElement = elements.find((item) => item.pdf_page === targetPage && targetPage);
        if (pageElement) {
            element.pdf_page = pageElement.pdf_page;
            element.pdf_page_height = pageElement.pdf_page_height;
        }
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

        const siblings = elements.filter((item) => item.zone === element.zone && item.pdf_page === element.pdf_page && !item.pdf_background);
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

    const startColumnResize = (event: ReactPointerEvent<HTMLElement>, element: LayoutElement, column: number) => {
        event.preventDefault();
        event.stopPropagation();
        const handle = event.currentTarget;
        const width = handle.parentElement?.getBoundingClientRect().width;
        if (!width) return;
        const start = event.clientX;
        const widths = layoutColumnWidths(element);
        setSelectedId(element.id);
        handle.setPointerCapture(event.pointerId);
        const move = (event: PointerEvent) => update(element.id, {
            column_widths: resizedLayoutColumns(widths, column, widths[column] + (event.clientX - start) / width * 100),
        });
        const stop = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", stop);
            handle.removeEventListener("pointercancel", stop);
            handle.removeEventListener("lostpointercapture", stop);
            if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", stop);
        handle.addEventListener("pointercancel", stop);
        handle.addEventListener("lostpointercapture", stop);
    };

    const startResize = (
        event: ReactPointerEvent<HTMLElement>,
        element: LayoutElement,
        edge: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
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
        const originX = element.x ?? 0;
        const originY = element.y ?? 0;
        const startWidth = element.width;
        const startHeight = element.height;
        const west = edge.includes("w");
        const east = edge.includes("e");
        const north = edge.includes("n");
        const south = edge.includes("s");
        const minWidth = element.pdf_page ? 0.1 : 5;
        const maxHeight = element.pdf_page ? 4000 : 400;
        const round = (value: number) =>
            element.pdf_page
                ? Math.round(value * 100) / 100
                : Math.round(value);

        const onMove = (moveEvent: PointerEvent) => {
            if (containerWidth <= 0) {
                return;
            }

            const dx = ((moveEvent.clientX - startX) / containerWidth) * 100;
            const dy = moveEvent.clientY - startY;
            const patch: Partial<LayoutElement> = {};
            const right = originX + startWidth;
            const bottom = originY + startHeight;

            if (west) {
                const nextX = Math.max(0, Math.min(right - minWidth, originX + dx));
                patch.x = round(nextX);
                patch.width = round(right - nextX);
            } else if (east) {
                patch.width = round(
                    Math.max(minWidth, Math.min(100 - originX, startWidth + dx)),
                );
            }

            if (north) {
                const nextY = Math.max(0, Math.min(bottom - 1, originY + dy));
                patch.y = round(nextY);
                patch.height = round(Math.max(1, Math.min(maxHeight, bottom - nextY)));
            } else if (south) {
                patch.height = round(
                    Math.max(1, Math.min(maxHeight, startHeight + dy)),
                );
            }

            update(element.id, patch);
        };
        const onUp = () => {
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            handle.removeEventListener("pointercancel", onUp);
            handle.removeEventListener("lostpointercapture", onUp);
            if (handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
        handle.addEventListener("lostpointercapture", onUp);
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
        if (box.width <= 0) return;
        event.preventDefault();
        node.setPointerCapture(event.pointerId);
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
            node.removeEventListener("lostpointercapture", onUp);
            if (node.hasPointerCapture(event.pointerId)) {
                node.releasePointerCapture(event.pointerId);
            }
        };

        node.addEventListener("pointermove", onMove);
        node.addEventListener("pointerup", onUp);
        node.addEventListener("pointercancel", onUp);
        node.addEventListener("lostpointercapture", onUp);
    };

    const importElements = (incoming: LayoutElement[], replace: boolean) => {
        const next = replace ? incoming : [...elements, ...incoming];
        onChange(next);
        setSelectedId(incoming.find((element) => !element.pdf_background)?.id ?? null);
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
        removePage: (id: string) => {
            onChange(elements.filter((element) => (element.pdf_page ?? "layout") !== id));
            setSelectedId(null);
            setTargetPage(undefined);
        },
        elements,
        fields,
        selectedId,
        selectedColumn,
        setSelectedColumn: selectColumn,
        selectedRow: activeRow,
        selectedCell: activeCell,
        selectCell,
        selectRow,
        rowCount,
        setSelectedId,
        selected,
        targetZone,
        setTargetZone,
        targetPage,
        setTargetPage,
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
        startColumnResize,
        startMove,
        headerHeight,
        setHeaderHeight,
        evenSpacing: () => {
            const rows: Array<{ top: number; bottom: number; items: LayoutElement[] }> = [];
            const sorted = elements.filter((item) => item.zone === "header" && item.pdf_page === targetPage && !item.pdf_background)
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

type ImportMode = "text" | "layout" | "pdf";

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
    pdfOnly = false,
    onImported,
    onBusyChange,
}: {
    controller: LayoutElementsController;
    pdfOnly?: boolean;
    onImported?: (elements: LayoutElement[], filename: string, notes: string[]) => void;
    onBusyChange?: (busy: boolean) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<ImportMode>("pdf");
    const [pdfText, setPdfText] = useState<"keep" | "clean">("keep");
    const [replace, setReplace] = useState(pdfOnly);
    const pdfTextChoice = useId();
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
        onBusyChange?.(true);
        setMessage(null);

        try {
            if (mode === "pdf") {
                if (!file.name.toLowerCase().endsWith(".pdf")) {
                    setMessage({ tone: "error", lines: ["Choose a PDF for the faithful page import, or select a Word/text import mode."] });
                    return;
                }
                const { readPdfLayout } = await import("@/lib/importPdfLayout");
                const imported = await readPdfLayout(file, { text: pdfText });
                const incoming = imported.pages.flatMap((page) => page.elements);
                if (incoming.length + (replace ? 0 : controller.elements.length) > 1000) {
                    setMessage({ tone: "error", lines: ["The resulting layout exceeds 1,000 components. Replace the existing layout or use a smaller PDF."] });
                    return;
                }
                const upload = async (name: "image" | "font", blob: Blob, filename: string) => {
                    const body = new FormData();
                    body.append(name, blob, filename);
                    if (name === "image") body.append("lossless", "1");
                    const response = await fetch(route(name === "image" ? "admin.document-settings.images" : "admin.document-settings.pdf-fonts"), {
                        method: "POST", credentials: "same-origin",
                        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", "X-XSRF-TOKEN": xsrfToken() }, body,
                    });
                    const payload = await response.json();
                    if (!response.ok || typeof payload.url !== "string") throw new Error(payload.errors?.[name]?.[0] ?? payload.message ?? `Could not store imported ${name}.`);
                    return payload.url as string;
                };
                const fontUrls = new Map<string, string>();
                for (const [name, data] of imported.fonts) {
                    fontUrls.set(name, await upload("font", new Blob([new Uint8Array(data).buffer], { type: "application/octet-stream" }), "font.ttf"));
                }
                for (const page of imported.pages) page.elements[0].src = await upload("image", page.background, "page.png");
                incoming.forEach((element) => {
                    if (element.pdf_font_src) element.pdf_font_src = fontUrls.get(element.pdf_font_src);
                    for (const run of element.pdf_text_runs ?? []) {
                        if (run.pdf_font_src) run.pdf_font_src = fontUrls.get(run.pdf_font_src);
                    }
                });
                await Promise.all([...fontUrls.values()].map(loadPdfFont));
                if (onImported) onImported(incoming, file.name, imported.notes);
                else controller.importElements(incoming, replace);
                controller.setTargetPage(incoming[0]?.pdf_page);
                setMessage({ tone: "ok", lines: [`Imported ${imported.pages.length} pages. ${pdfText === "clean" ? "The original wording was removed and the text positions are blank." : "Tables, lists, text, and images are editable components."} Review each page, then save.`, ...imported.notes] });
                return;
            }
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
                setMessage({
                    tone: "error",
                    lines: [
                        payload?.errors?.file?.[0] ??
                            payload?.message ??
                            "Could not import that file.",
                    ],
                });
                return;
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
            onBusyChange?.(false);
        }
    };

    return (
        <div className="mb-4 rounded-xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
                <FileUpIcon className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                        {pdfOnly ? "Upload a PDF to create your layout" : "Import from an existing document"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Import every PDF page with editable tables and the original colors.
                        Keep the wording, or clean it and leave blank text in the same positions.{!pdfOnly ? " Word/text import is also available." : ""}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                            ref={inputRef}
                            type="file"
                            accept={pdfOnly ? ".pdf,application/pdf" : ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                            className="sr-only"
                            disabled={busy}
                            aria-label={pdfOnly ? "PDF file for new layout" : "PDF or Word file"}
                            onChange={(event) => {
                                setFile(event.target.files?.[0] ?? null);
                                setMessage(null);
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="gap-1.5"
                            onClick={() => inputRef.current?.click()}
                        >
                            <UploadIcon />
                            {pdfOnly ? "Choose PDF file" : "Choose PDF or Word file"}
                        </Button>
                        <span className="max-w-xs truncate text-xs text-muted-foreground">
                            {file ? file.name : "No file selected"}
                        </span>
                    </div>

                    {mode === "pdf" ? <fieldset className="mt-3">
                        <legend className="text-xs font-medium text-foreground">
                            PDF text
                        </legend>
                        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                            <label className="inline-flex items-center gap-2">
                                <input type="radio" name={pdfTextChoice} disabled={busy} checked={pdfText === "keep"} onChange={() => setPdfText("keep")} className="accent-emerald-700" />
                                Import with text
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input type="radio" name={pdfTextChoice} disabled={busy} checked={pdfText === "clean"} onChange={() => setPdfText("clean")} className="accent-emerald-700" />
                                Clean the text
                            </label>
                        </div>
                    </fieldset> : null}

                    {!pdfOnly ? <fieldset className="mt-3">
                        <legend className="text-xs font-medium text-foreground">
                            What to copy
                        </legend>
                        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                            <label className="inline-flex items-center gap-2">
                                <input type="radio" name="import-mode" disabled={busy} checked={mode === "pdf"} onChange={() => setMode("pdf")} className="accent-emerald-700" />
                                PDF pages: editable tables and original colors
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="import-mode"
                                    disabled={busy}
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
                                    disabled={busy}
                                    checked={mode === "layout"}
                                    onChange={() => setMode("layout")}
                                    className="accent-emerald-700"
                                />
                                Section layout only (no text)
                            </label>
                        </div>
                    </fieldset> : null}

                    {!pdfOnly ? <label className="mt-3 inline-flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            disabled={busy}
                            checked={replace}
                            onChange={(event) =>
                                setReplace(event.target.checked)
                            }
                            className="size-4 rounded accent-emerald-700"
                        />
                        Replace the whole layout (header, body and footer)
                    </label> : null}

                    <div className="mt-3">
                        <Button
                            type="button"
                            size="sm"
                            disabled={!file || busy}
                            onClick={() => void run()}
                            className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                            <FileUpIcon />
                            {busy ? "Importing pages…" : pdfOnly ? "Create layout from PDF" : "Import document"}
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

type TableFieldSelection = { elementId: string; tableId: string; row: number; column: number };

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
        selected,
        targetZone,
        uploading,
        uploadError,
        fileInputRef,
        pendingImageFor,
        update,
        add,
        remove,
        duplicate,
        move,
    } = controller;
    const editorRef = useRef<HTMLDivElement>(null);
    const [tableFieldSelection, setTableFieldSelection] = useState<TableFieldSelection | null>(null);
    const selectedCellPosition = selected && controller.selectedCell
        ? tableCellPosition(selected, controller.selectedCell, controller.fields) : null;
    const visiblePairIndex = selected && controller.selectedCell && !selected.cells
        ? previewTableItems(selected, controller.fields).findIndex((item) => item.index === controller.selectedCell?.row)
        : 0;
    const formattingElement = selected && controller.selectedCell?.id === selected.id
        ? { ...selected, ...tableTextStyle(selected, controller.selectedCell.row,
            selected.cells ? controller.selectedCell.column : Math.max(0, visiblePairIndex) % Math.min(3, selected.columns ?? 2) * 2 + controller.selectedCell.column,
            !!selected.cells && controller.selectedCell.row === 0 && selected.header_row,
            !selected.cells && controller.selectedCell.column === 0, controller.selectedCell.column) }
        : selected && controller.selectedRow?.id === selected.id
        ? { ...selected, ...tableTextStyle(selected, controller.selectedRow.index, 0,
            !!selected.cells && controller.selectedRow.index === 0 && selected.header_row) }
        : selected && controller.selectedColumn?.id === selected.id
            ? { ...selected, color: selected.column_colors?.[controller.selectedColumn.index] || selected.color }
            : selected;

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

            {selected?.type === "table" ? (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs font-medium">
                    <label htmlFor="table-text-scope">Format text in</label>
                    <select aria-label="Table text formatting scope"
                        id="table-text-scope"
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={controller.selectedCell ? `cell-${controller.selectedCell.row}-${controller.selectedCell.column}` : controller.selectedRow?.index ?? ""}
                        onChange={(event) => {
                            if (event.target.value.startsWith("cell-")) {
                                const [, row, column] = event.target.value.split("-");
                                controller.selectCell(selected.id, Number(row), Number(column));
                            } else {
                                controller.selectRow(selected.id, event.target.value === "" ? null : Number(event.target.value));
                            }
                        }}>
                        <option value="">Whole table</option>
                        {Array.from({ length: controller.rowCount }, (_, index) =>
                            <option key={index} value={index}>{selected.cells ? "Row" : "Name/value pair"} {index + 1}</option>)}
                        {Array.from({ length: controller.rowCount }, (_, row) =>
                            <optgroup key={row} label={`${selected.cells ? "Row" : "Name/value pair"} ${row + 1} cells`}>
                                {Array.from({ length: selected.cells?.[row]?.length ?? 2 }, (_, column) => {
                                    if (selected.cell_spans?.[row]?.[column]?.columns === 0) return null;
                                    const position = tableCellPosition(selected, { row, column }, controller.fields);
                                    return <option key={column} value={`cell-${row}-${column}`}>
                                        Row {position.row}, column {position.column}{!selected.cells ? column === 0 ? " (name)" : " (value)" : ""}
                                    </option>;
                                })}
                            </optgroup>)}
                    </select>
                    {controller.selectedCell ? (
                        <Button type="button" variant="outline" size="sm"
                            onClick={() => update(selected.id, { cell_styles: selected.cell_styles?.map((row, r) =>
                                r === controller.selectedCell?.row ? row?.map((style, c) =>
                                    c === controller.selectedCell?.column ? null : style) ?? null : row) })}>
                            Reset cell formatting
                        </Button>
                    ) : null}
                    {controller.selectedRow ? (
                        <Button type="button" variant="outline" size="sm"
                            onClick={() => update(selected.id, { row_styles: selected.row_styles?.map((style, index) =>
                                index === controller.selectedRow?.index ? null : style) })}>
                            Reset row formatting
                        </Button>
                    ) : null}
                </div>
            ) : null}
            <LayoutTextToolbar
                element={formattingElement}
                scope={selectedCellPosition ? `Row ${selectedCellPosition.row}, column ${selectedCellPosition.column}. Text changes apply only to this cell.`
                    : controller.selectedRow ? `${selected?.cells ? "Row" : "Name/value pair"} ${controller.selectedRow.index + 1}. Text changes apply only to this ${selected?.cells ? "row" : "pair"}.`
                    : controller.selectedColumn ? `Column ${controller.selectedColumn.index + 1}. Font color applies only to this column.`
                    : undefined}
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

                <div className="min-w-0">
                <StickyDocumentToolbar scopeRef={editorRef} propertiesPanel>
                <aside
                    aria-label="Element properties"
                    className="rounded-xl border border-border bg-background p-4"
                >
                    {selected && controller.selectedColumn?.id === selected.id ? (
                        <div className="mb-3 flex items-center gap-2 text-sm">
                            <span>Column {controller.selectedColumn.index + 1}: font color applies unless a row or cell overrides it.</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => controller.setSelectedColumn(null)}>Whole table</Button>
                        </div>
                    ) : null}
                    {selected ? (
                        <ElementInspector
                            tableFieldSelection={tableFieldSelection}
                            onTableFieldSelection={setTableFieldSelection}
                            elements={elements}
                            element={formattingElement ?? selected}
                            onSelectRow={(row) => controller.selectRow(selected.id, row)}
                            onSelectCell={(row, column) => controller.selectCell(selected.id, row, column)}
                            selectedRow={controller.selectedRow?.index}
                            selectedCell={controller.selectedCell}
                            selectedColumn={controller.selectedColumn?.id === selected.id ? controller.selectedColumn.index : undefined}
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
                </StickyDocumentToolbar>
                </div>
            </div>
        </div>
    );
}

function LayoutTextToolbar({
    element,
    onChange,
    scope,
}: {
    scope?: string;
    element?: LayoutElement;
    onChange: (patch: Partial<LayoutElement>) => void;
}) {
    const enabled = element && ["text", "date", "validity", "company", "table"].includes(element.type);
    const fieldClass = "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
    const labelClass = "flex flex-col gap-1 text-xs font-medium text-foreground";

    return (
        <div className="flex flex-col gap-2 border-t border-border p-3">
            <div role="group" aria-label="Layout text formatting" className="flex flex-wrap items-end gap-3">
                <label className={labelClass}>
                    Font
                    <select aria-label="Layout font" disabled={!enabled} className={fieldClass}
                        value={element?.pdf_font_src ? "pdf-imported" : element?.font_family ?? "default"}
                        onChange={(event) => onChange({ font_family: event.target.value })}>
                        {element?.pdf_font_src ? <option value="pdf-imported">Imported: {element.pdf_font_name}</option> : null}
                        {fontChoices.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
                    </select>
                </label>
                <label className={labelClass}>
                    Font size (px)
                    <input aria-label="Layout font size" type="number" min={element?.pdf_page ? 1 : 8} max={element?.pdf_page ? 200 : 48} step={element?.pdf_page ? "any" : 1}
                        disabled={!enabled} className={cn(fieldClass, "w-24")} value={element?.font_size ?? 12}
                        onChange={(event) => {
                            const size = event.target.valueAsNumber;
                            if (Number.isFinite(size) && size >= (element?.pdf_page ? 1 : 8) && size <= (element?.pdf_page ? 200 : 48)) onChange({ font_size: size });
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
                        value={element?.pdf_line_spacing ? "pdf-original" : element?.line_height ?? 1.35}
                        onChange={(event) => { if (event.target.value !== "pdf-original") onChange({ line_height: Number(event.target.value), pdf_line_spacing: undefined }); }}>
                        {element?.pdf_line_spacing ? <option value="pdf-original">Original PDF ({Number(element.pdf_line_spacing.toFixed(2))}px)</option> : null}
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
                {enabled ? scope ?? `Formatting ${elementLabel(element)}. Changes apply to the entire element.`
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
    onSelectRow,
    selectedRow,
    selectedCell,
    selectedColumn,
    onSelectCell,
    elements,
    tableFieldSelection,
    onTableFieldSelection,
}: {
    selectedColumn?: number;
    tableFieldSelection: TableFieldSelection | null;
    onTableFieldSelection: (selection: TableFieldSelection) => void;
    elements: LayoutElement[];
    onSelectCell: (row: number, column: number) => void;
    onSelectRow: (row: number) => void;
    selectedRow?: number;
    selectedCell?: { row: number; column: number } | null;
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
        element.type === "validity" ||
        element.type === "company";
    const hasHeight = element.type === "spacer" || element.type === "divider";
    const fieldClass =
        "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
    const labelClass = "block text-xs font-medium text-foreground";
    const inspectorRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const insertableFields = fields.filter((field) =>
        field.key !== "contractor_name" && field.key !== "contractor_contact_name",
    ).map((field) => {
        const bidField = BID_TEXT_PLACEHOLDERS.find((item) => item.key === field.key);
        return bidField ? { ...field, label: bidField.label, group: bidField.group } : field;
    });
    const focusTarget = element.type !== "table"
        ? null
        : selectedCell
            ? `[data-focus-cell="${selectedCell.row}-${selectedCell.column}"]`
            : selectedRow !== undefined
                ? `[data-focus-row="${selectedRow}"]`
                : selectedColumn !== undefined && element.cells
                    ? `[data-focus-cell="0-${selectedColumn}"]`
                    : null;

    useEffect(() => {
        const container = inspectorRef.current;
        if (!focusTarget || !container || container.contains(document.activeElement)) return;
        const target = container.querySelector<HTMLElement>(focusTarget);
        if (!target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
        if (target instanceof HTMLInputElement) target.select();
    }, [focusTarget, element.id]);

    return (
        <div ref={inspectorRef} className="space-y-4">
            <p className="text-sm font-semibold text-foreground">
                {elementLabel(element)} properties
            </p>

            {element.type === "table" ? (
                selectedCell ? <TableCellFields element={element} cell={selectedCell} fields={fields}
                    onChange={onChange} fieldClass={fieldClass} labelClass={labelClass} />
                    : <p className="text-xs text-muted-foreground">Select a specific table cell to add or remove its document fields.</p>
            ) : null}

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
                                label_bg: element.label_bg || "#065f46",
                                header_color: element.header_color || "#ffffff",
                            })} />
                        Use first row as header
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {element.header_row ? (
                            <>
                                <div className={labelClass}>Header background
                                    <ColorSelect label="Header background" value={element.label_bg || "#065f46"}
                                        onChange={(color) => onChange({ label_bg: color })} />
                                </div>
                                <div className={labelClass}>Header text color
                                    <ColorSelect label="Header text color" value={element.header_color || "#ffffff"}
                                        onChange={(color) => onChange({ header_color: color })} />
                                </div>
                            </>
                        ) : null}
                        <label className={labelClass}>Border color
                            <input type="color" className={fieldClass} value={element.border_color || "#cbd5e1"}
                                onChange={(event) => onChange({ border_color: event.target.value })} />
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={element.cells.length >= 60}
                            onClick={() => onChange({ cells: [...element.cells!, Array(element.cells![0].length).fill("")] })}>
                            Add row
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={element.cells[0].length >= 12}
                            onClick={() => onChange({ cells: element.cells!.map((row) => [...row, ""]) })}>
                            Add column
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {(["Rows", "Columns"] as const).map((label) => (
                            <label key={label} className={labelClass}>
                                {label}
                                <input type="number" min={1} max={label === "Rows" ? 60 : 12}
                                    value={label === "Rows" ? element.cells!.length : element.cells![0].length}
                                    className={fieldClass}
                                    onChange={(event) => {
                                        const value = event.target.valueAsNumber;
                                        if (!Number.isInteger(value) || value < 1 || value > (label === "Rows" ? 60 : 12)) return;
                                        const rows = label === "Rows" ? value : element.cells!.length;
                                        const cols = label === "Columns" ? value : element.cells![0].length;
                                        onChange({
                                            row_styles: element.row_styles?.slice(0, rows),
                                            cell_styles: element.cell_styles?.slice(0, rows).map((row) => row?.slice(0, cols) ?? null),
                                            cell_backgrounds: element.cell_backgrounds?.slice(0, rows).map(row => row.slice(0, cols)),
                                            cell_borders: element.cell_borders?.slice(0, rows).map(row => row.slice(0, cols)),
                                            cell_spans: element.cell_spans?.slice(0, rows).map((row, r) => row.slice(0, cols).map((span, c) => ({
                                                rows: Math.min(span.rows, rows - r), columns: Math.min(span.columns, cols - c),
                                            }))),
                                            row_heights: element.row_heights?.slice(0, rows),
                                            cells: Array.from({ length: rows }, (_, r) =>
                                            Array.from({ length: cols }, (_, c) => element.cells?.[r]?.[c] ?? "")) });
                                    }} />
                            </label>
                        ))}
                    </div>
                    {element.cells.map((row, r) => (
                        <div key={r} className="flex flex-col gap-1">
                        <button type="button" aria-pressed={selectedRow === r} data-focus-row={r}
                            className="self-start text-xs font-medium underline underline-offset-2"
                            onClick={() => onSelectRow(r)}>Row {r + 1}</button>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                            {row.map((cell, c) => element.cell_spans?.[r]?.[c]?.columns === 0 ? null : (
                                <input key={c} data-focus-cell={`${r}-${c}`} aria-label={`Row ${r + 1}, column ${c + 1}`} maxLength={300}
                                    placeholder={`R${r + 1} C${c + 1}`} value={cell} className={fieldClass}
                                    onFocus={() => onSelectCell(r, c)}
                                    onChange={(event) => onChange({ cells: element.cells!.map((row, ri) => row.map((value, ci) => ri === r && ci === c ? event.target.value : value)) })} />
                            ))}
                        </div>
                        </div>
                    ))}
                </div>
            ) : null}
            {element.type === "table" ? (
                <div className="space-y-3">
                    <div className={labelClass}>Table background
                        <ColorSelect label="Table background" allowNone value={element.table_background || ""}
                            onChange={(color) => onChange({ table_background: color })} />
                    </div>
                    <label className={labelClass}>
                        Alternating background
                        <select className={fieldClass} value={element.stripe_direction ?? "none"}
                            onChange={(event) => onChange({
                                stripe_direction: event.target.value as NonNullable<LayoutElement["stripe_direction"]>,
                                ...(event.target.value === "columns" && (!element.stripe_color_a || element.stripe_color_a.toLowerCase() === "#ffffff")
                                    ? {
                                        stripe_color_a: "#f3f4f6",
                                        stripe_color_b: !element.stripe_color_b || element.stripe_color_b.toLowerCase() === "#f3f4f6" ? "#ffffff" : element.stripe_color_b,
                                    } : {}),
                            })}>
                            <option value="none">None</option>
                            <option value="rows">Horizontal — alternate rows</option>
                            <option value="columns">Vertical — alternate columns</option>
                        </select>
                    </label>
                    {element.stripe_direction && element.stripe_direction !== "none" ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div className={labelClass}>First color
                                <ColorSelect label="First color" value={element.stripe_color_a || "#ffffff"}
                                    onChange={(color) => onChange({ stripe_color_a: color })} />
                            </div>
                            <div className={labelClass}>Second color
                                <ColorSelect label="Second color" value={element.stripe_color_b || "#f3f4f6"}
                                    onChange={(color) => onChange({ stripe_color_b: color })} />
                            </div>
                        </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                        The header keeps its own background. Alternating colors override the table background when enabled.
                    </p>
                </div>
            ) : null}
            {element.type === "table" && !element.cells ? (
                <TableEditor
                    element={element}
                    fields={fields}
                    onChange={onChange}
                    onSelectRow={onSelectRow}
                    onSelectCell={onSelectCell}
                    selectedRow={selectedRow}
                    labelClass={labelClass}
                    fieldClass={fieldClass}
                />
            ) : null}
            {element.type === "table" ? (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">Drag a column boundary in the preview or enter its width. The adjacent column adjusts; the table stays the same size.</p>
                    {layoutColumnWidths(element).map((width, column) => (
                        <label key={column} className={labelClass}>
                            Column {column + 1} width (%)
                            <input type="number" min={1} max={99} step={0.1}
                                aria-label={`Column ${column + 1} width (%)`}
                                className={fieldClass} value={Number(width.toFixed(2))}
                                disabled={layoutColumnWidths(element).length === 1}
                                onChange={(event) => {
                                    const value = event.currentTarget.valueAsNumber;
                                    if (Number.isFinite(value)) onChange({
                                        column_widths: resizedLayoutColumns(layoutColumnWidths(element), column, value),
                                    });
                                }} />
                        </label>
                    ))}
                </div>
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
                <div className={labelClass}>
                    <label>
                        Text
                        <textarea
                            ref={textRef}
                            rows={element.pdf_line_count ?? 4}
                            maxLength={20000}
                            value={element.content}
                            onChange={(event) =>
                                onChange({ content: event.target.value })
                            }
                            className={fieldClass}
                        />
                    </label>
                    {element.pdf_text_runs?.length ? <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Imported paragraph: {element.pdf_line_count} lines. Enter one replacement line per original line. Original positions and inline font styles are retained; formatting controls can override them.
                    </span> : null}
                    <span className="mt-2 block">Insert a field</span>
                    <InsertBidTextFieldMenu
                        triggerLabel="Choose a field"
                        fields={insertableFields}
                        allowCreate={false}
                        intro="Insert a field that fills in when this layout is used"
                        searchPlaceholder="Search totals, project, contractor, company…"
                        groupOrder={[...BID_TEXT_FIELD_GROUP_ORDER, "Document"]}
                        onInsert={(key) => {
                            const textarea = textRef.current;
                            const start = textarea?.selectionStart ?? element.content.length;
                            const end = textarea?.selectionEnd ?? start;
                            const token = placeholderToken(key);
                            onChange({ content: element.content.slice(0, start) + token + element.content.slice(end) });
                            requestAnimationFrame(() => {
                                textarea?.focus();
                                textarea?.setSelectionRange(start + token.length, start + token.length);
                            });
                        }}
                    />
                    <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        Fields appear as {"{{field_name}}"} and are replaced
                        with real values when the document is generated.
                    </span>
                </div>
            ) : null}

            {element.type === "text" ? (
                <TableFieldPicker key={element.id} element={element} elements={elements}
                    fields={fields} onChange={onChange} fieldClass={fieldClass} labelClass={labelClass}
                    selection={tableFieldSelection} onSelectionChange={onTableFieldSelection} />
            ) : null}

            {element.type === "date" ? (
                <p className="text-xs text-muted-foreground">
                    Shows the date the document is generated.
                </p>
            ) : null}
            {element.type === "validity" ? (
                <label className={labelClass}>
                    Validity period
                    <select aria-label="Validity period" value={element.validity_days ?? 30}
                        className={fieldClass}
                        onChange={(event) => onChange({ validity_days: Number(event.target.value) as 30 | 60 | 90 })}>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                    </select>
                    <span className="mt-1 block font-normal text-muted-foreground">
                        Expiration date is calculated from the bid/document date. Preview uses today.
                    </span>
                </label>
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
                            value={element.pdf_font_src ? "pdf-imported" : element.font_family ?? "default"}
                            onChange={(event) =>
                                onChange({ font_family: event.target.value })
                            }
                            className={fieldClass}
                            style={{
                                fontFamily: fontStack(element.font_family),
                            }}
                        >
                            {element.pdf_font_src ? <option value="pdf-imported">Imported: {element.pdf_font_name}</option> : null}
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
                                min={element.pdf_page ? 1 : 8}
                                max={element.pdf_page ? 200 : 48}
                                step={element.pdf_page ? "any" : 1}
                                value={element.font_size}
                                onChange={(event) =>
                                    onChange({
                                        font_size: Math.max(
                                            element.pdf_page ? 1 : 8,
                                            Math.min(
                                                element.pdf_page ? 200 : 48,
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
                            value={element.pdf_line_spacing ? "pdf-original" : element.line_height ?? 1.35}
                            onChange={(event) => { if (event.target.value !== "pdf-original") onChange({ line_height: Number(event.target.value), pdf_line_spacing: undefined }); }}
                            className={fieldClass}
                        >
                            {element.pdf_line_spacing ? <option value="pdf-original">Original PDF ({Number(element.pdf_line_spacing.toFixed(2))}px)</option> : null}
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

const fontChoices = PRINT_LAYOUT_FONT_CHOICES;

const colorChoices = [
    { value: "#000000", label: "Black" },
    { value: "#ffffff", label: "White" },
    { value: "#f3f4f6", label: "Light gray" },
    { value: "#e5e7eb", label: "Silver" },
    { value: "#cbd5e1", label: "Slate gray" },
    { value: "#dbeafe", label: "Light blue" },
    { value: "#dcfce7", label: "Light green" },
    { value: "#fef3c7", label: "Light yellow" },
    { value: "#ffedd5", label: "Light orange" },
    { value: "#ede9fe", label: "Light purple" },
    { value: "#fce7f3", label: "Light pink" },
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
    label = "Text color",
    allowNone = false,
}: {
    value: string;
    onChange: (color: string) => void;
    label?: string;
    allowNone?: boolean;
}) {
    const customRef = useRef<HTMLInputElement>(null);
    const current = value.toLowerCase();
    const known = colorChoices.find((choice) => choice.value === current);
    const options = known
        ? colorChoices
        : [{ value: current, label: `Custom (${current})` }, ...colorChoices];
    const selectedLabel = current === "" ? "No background" : known?.label ?? `Custom (${current})`;

    const swatch = (color: string) => (
        <span
            className="size-5 shrink-0 rounded border border-slate-400/70"
            style={{ backgroundColor: color || "transparent" }}
        />
    );

    return (
        <div className="mt-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start" aria-label={label}>
                        {swatch(current)}
                        <span className="flex-1 truncate">{selectedLabel}</span>
                        <span aria-hidden="true">▾</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuGroup>
                        {allowNone ? <DropdownMenuItem onSelect={() => onChange("")}>No background</DropdownMenuItem> : null}
                        {options.filter((choice) => choice.value).map((choice) => (
                            <DropdownMenuItem key={choice.value} onSelect={() => onChange(choice.value)}>
                                {swatch(choice.value)}
                                {choice.label}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onSelect={() => customRef.current?.click()}>Custom color…</DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <input ref={customRef} type="color" tabIndex={-1} aria-label={`Custom ${label}`}
                className="sr-only" value={current || "#ffffff"}
                onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function fontStack(id?: string) {
    return PRINT_LAYOUT_FONTS[id ?? "default"] ?? PRINT_LAYOUT_FONTS.default;
}

function LayoutRulers({
    height,
    selected,
}: {
    height: number;
    selected?: LayoutElement;
}) {
    const x = (selected?.x ?? 0) * PRINT_LAYOUT_WIDTH / 100;
    const y = selected?.y ?? 0;
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none text-slate-700 print:hidden">
            <div className="absolute left-0 top-0 flex h-7 w-10 items-center justify-center bg-slate-100 text-[10px]">
                px
            </div>
            <div data-layout-ruler="horizontal" className="absolute left-10 top-0 h-7 border-b border-slate-300 bg-slate-100"
                style={{ width: PRINT_LAYOUT_WIDTH }}>
                {Array.from({ length: PRINT_LAYOUT_WIDTH / 10 + 1 }, (_, index) => {
                    const value = index * 10;
                    const major = value % 50 === 0;
                    return (
                        <span key={value} data-ruler-value={value} className="absolute bottom-0 border-l border-slate-400"
                            style={{ left: value, height: major ? 10 : 5 }}>
                            {major ? <span className={cn("absolute -top-4 text-[10px] leading-none", value === PRINT_LAYOUT_WIDTH ? "right-1" : "left-1")}>{value}</span> : null}
                        </span>
                    );
                })}
                {selected ? <span data-ruler-selection="x" className="absolute inset-y-0 border-l-2 border-emerald-700" style={{ left: x }} /> : null}
            </div>
            <div data-layout-ruler="vertical" className="absolute left-0 top-7 w-10 border-r border-slate-300 bg-slate-100"
                style={{ height }}>
                {Array.from({ length: Math.floor(height / 10) + 1 }, (_, index) => {
                    const value = index * 10;
                    const major = value % 50 === 0;
                    return (
                        <span key={value} data-ruler-value={value} className="absolute right-0 border-t border-slate-400"
                            style={{ top: value, width: major ? 10 : 5 }}>
                            {major ? <span className="absolute right-3 top-1 text-[10px] leading-none">{value}</span> : null}
                        </span>
                    );
                })}
                {selected ? <span data-ruler-selection="y" className="absolute inset-x-0 border-t-2 border-emerald-700" style={{ top: y }} /> : null}
            </div>
        </div>
    );
}

export function PreviewZone({
    controller,
    zone,
    applyCase,
    textCase = "original",
    page,
}: {
    page?: { id: string; height: number };
    textCase?: ElementCase;
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
    const zoneItems = elements.filter((element) => element.zone === zone);
    if (!page && zoneItems.some((element) => element.pdf_page)) {
        return <div className="space-y-6">
            {layoutPages(zoneItems, controller.headerHeight).map((item, index) => <div key={item.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Page {index + 1}</p>
                    <Button type="button" variant="outline" size="sm" aria-label={`Remove page ${index + 1}`}
                        onClick={() => controller.removePage(item.id)}>Remove page</Button>
                </div>
                <PreviewZone controller={controller} zone={zone} applyCase={applyCase} textCase={textCase} page={item} />
            </div>)}
        </div>;
    }
    const items = page ? zoneItems.filter((element) => (element.pdf_page ?? "layout") === page.id) : zoneItems;
    const selected = items.find((element) => element.id === selectedId);
    const active = targetZone === zone && (!page || controller.targetPage === (page.id === "layout" ? undefined : page.id));
    const canvasHeight = page?.height ?? controller.headerHeight;

    return (
        <section
            aria-label={meta.label}
            onClick={() => { setTargetZone(zone); controller.setTargetPage(page?.id === "layout" ? undefined : page?.id); }}
            style={
                zone !== "header" && zoneColor
                    ? { backgroundColor: zoneColor }
                    : undefined
            }
            className={cn(
                "relative transition",
                zone === "header" && "pl-10 pr-3 pt-7",
                zone !== "header" && "px-5 py-3 sm:px-8",
                active &&
                    (zone === "header"
                        ? "border-white bg-white/20"
                        : "border-emerald-400 bg-emerald-50/50"),
                !active &&
                    zone !== "header" &&
                    "border-slate-300 bg-slate-50/40 hover:border-emerald-300",
            )}
        >
            {zone === "header" ? <LayoutRulers height={canvasHeight} selected={selected} /> : null}
            <div
                ref={(node) => { if (active) controller.canvasRefs.current[zone] = node; }}
                data-canvas
                className="relative"
                style={{ width: PRINT_LAYOUT_WIDTH, height: canvasHeight, background: page ? "#ffffff" : undefined }}
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
                            role={element.pdf_background ? undefined : "button"}
                            tabIndex={element.pdf_background ? -1 : 0}
                            data-element-id={element.id}
                            aria-pressed={isSelected}
                            aria-label={`${elementLabel(element)} component`}
                            style={{
                                position: "absolute",
                                left: `${element.x ?? 0}%`,
                                top: element.y ?? 0,
                                width: `${element.width}%`,
                                height:
                                    element.pdf_page ||
                                    element.type === "table" ||
                                    element.type === "image" ||
                                    element.type === "spacer" ||
                                    element.type === "divider"
                                        ? element.height
                                        : undefined,
                                zIndex: element.pdf_background ? 0 : isSelected ? 10 : 1,
                                pointerEvents: element.pdf_background ? "none" : undefined,
                            }}
                            onPointerDown={(event) => {
                                event.stopPropagation();
                                setTargetZone(zone);
                                controller.setTargetPage(element.pdf_page);
                                setSelectedId(element.id);
                                const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-table-row][data-table-column]");
                                if (cell) {
                                    controller.selectCell(element.id, Number(cell.dataset.tableRow), Number(cell.dataset.tableColumn));
                                } else {
                                    controller.selectRow(element.id, null);
                                }
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
                            {element.type === "table" ? (
                                <div className="absolute left-0 top-0 flex w-full print:hidden">
                                    {Array.from({ length: element.cells?.[0]?.length ?? (element.columns ?? 2) * 2 }, (_, column) => (
                                        <button key={column} type="button"
                                            aria-label={`Select column ${column + 1}`}
                                            aria-pressed={controller.selectedColumn?.id === element.id && controller.selectedColumn.index === column}
                                            title={`Click the top edge to select column ${column + 1}`}
                                            className="table-column-selector"
                                            style={{
                                                position: "relative", left: 0,
                                                flex: layoutColumnWidths(element)[column],
                                                width: "auto",
                                            }}
                                            onPointerDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedId(element.id);
                                                controller.setSelectedColumn({ id: element.id, index: column });
                                            }} />
                                    ))}
                                </div>
                            ) : null}
                            {element.type === "table" && isSelected ? layoutColumnWidths(element).slice(0, -1).map((_, column) => (
                                <span key={column} role="separator" aria-orientation="vertical"
                                    aria-label={`Resize column ${column + 1}`} data-resize-handle
                                    title={`Drag to resize columns ${column + 1} and ${column + 2}`}
                                    className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none border-l border-primary/50 hover:bg-primary/20"
                                    style={{ left: `${layoutColumnWidths(element).slice(0, column + 1).reduce((sum, value) => sum + value, 0)}%`, zIndex: 5 }}
                                    onPointerDown={(event) => controller.startColumnResize(event, element, column)} />
                            )) : null}
                            {(element.type === "image" && !element.src) ||
                            (element.type === "text" &&
                                element.content.trim() === "" && !element.pdf_line_count) ? (
                                <div className="overflow-hidden rounded border border-dashed border-slate-300 text-center text-[11px] text-slate-400"
                                    style={element.pdf_page ? { height: Math.max(10, element.height), lineHeight: `${Math.max(10, element.height)}px` } : { padding: "12px" }}>
                                    {element.type === "image"
                                        ? "Empty image"
                                        : "Empty text"}
                                </div>
                            ) : (
                                <ElementPreview
                                    sourceElements={elements}
                                    element={{ ...element, width: 100 }}
                                    fields={controller.fields}
                                    selectedColumn={controller.selectedColumn?.id === element.id ? controller.selectedColumn.index : undefined}
                                    selectedRow={controller.selectedRow?.id === element.id ? controller.selectedRow.index : undefined}
                                    onSelectRow={(row) => controller.selectRow(element.id, row)}
                                    selectedCell={controller.selectedCell?.id === element.id ? controller.selectedCell : undefined}
                                    onSelectCell={(row, column) => controller.selectCell(element.id, row, column)}
                                />
                            )}
                            {isSelected && !element.pdf_background
                                ? (
                                      [
                                          ["n", "Resize from the top", "absolute -top-1.5 left-1/2 z-10 h-3 w-8 -translate-x-1/2 cursor-ns-resize"],
                                          ["s", "Resize from the bottom", "absolute -bottom-1.5 left-1/2 z-10 h-3 w-8 -translate-x-1/2 cursor-ns-resize"],
                                          ["e", "Resize from the right", "absolute -right-1.5 top-1/2 z-10 h-8 w-3 -translate-y-1/2 cursor-ew-resize"],
                                          ["w", "Resize from the left", "absolute -left-1.5 top-1/2 z-10 h-8 w-3 -translate-y-1/2 cursor-ew-resize"],
                                          ["nw", "Resize from the top left", "absolute -left-1.5 -top-1.5 z-10 size-3 cursor-nwse-resize"],
                                          ["ne", "Resize from the top right", "absolute -right-1.5 -top-1.5 z-10 size-3 cursor-nesw-resize"],
                                          ["sw", "Resize from the bottom left", "absolute -bottom-1.5 -left-1.5 z-10 size-3 cursor-nesw-resize"],
                                          ["se", "Resize from the bottom right", "absolute -bottom-1.5 -right-1.5 z-10 size-3 cursor-nwse-resize"],
                                      ] as const
                                  ).map(([edge, label, handleClass]) => (
                                      <span
                                          key={edge}
                                          role="separator"
                                          data-resize-handle
                                          aria-label={label}
                                          onPointerDown={(event) =>
                                              controller.startResize(
                                                  event,
                                                  element,
                                                  edge,
                                              )
                                          }
                                          className={`${handleClass} touch-none rounded-full border-2 border-white bg-emerald-600 shadow`}
                                      />
                                  ))
                                : null}
                        </div>
                    );
                })}
                {!page ? <span
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
                /> : null}
            </div>
            {zone === "header" && !page ? (
                <p className="relative mt-4 pb-2 text-xs print:hidden">
                    {selected
                        ? `X: ${Number(((selected.x ?? 0) * PRINT_LAYOUT_WIDTH / 100).toFixed(2))}px · Y: ${selected.y ?? 0}px · Width: ${Number((selected.width * PRINT_LAYOUT_WIDTH / 100).toFixed(2))}px`
                        : "Rulers in pixels. Select a component to see its position and width."}
                </p>
            ) : null}
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

function TableCellFields({ element, cell, fields, onChange, fieldClass, labelClass }: {
    element: LayoutElement;
    cell: { row: number; column: number };
    fields: MergeField[];
    onChange: (patch: Partial<LayoutElement>) => void;
    fieldClass: string;
    labelClass: string;
}) {
    const content = element.cells?.[cell.row]?.[cell.column]
        ?? element.items?.[cell.row]?.[cell.column === 0 ? "label" : "value"];
    if (content === undefined) return null;
    const { row, column } = tableCellPosition(element, cell, fields);
    const references = Array.from(content.matchAll(/\{\{\s*([a-z0-9_]+)\s*}}/g));
    const setContent = (value: string) => onChange(element.cells
        ? { cells: element.cells.map((values, r) => values.map((text, c) => r === cell.row && c === cell.column ? value : text)) }
        : { items: element.items?.map((item, index) => index === cell.row
            ? { ...item, [cell.column === 0 ? "label" : "value"]: value } : item) });
    const available = fields.some((field) => content.length + `{{${field.key}}}`.length <= 300);

    return <div className="space-y-3">
        <p className="text-sm font-semibold">Table fields: row {row}, column {column}</p>
        <label className={labelClass}>Cell text
            <textarea aria-label="Selected cell text" value={content} rows={2} maxLength={300}
                className={fieldClass} onChange={(event) => setContent(event.target.value)} />
        </label>
        <label className={labelClass}>Field name
            <select aria-label="Field name for selected cell" value="" disabled={!available}
                className={fieldClass} onChange={(event) => {
                    if (event.target.value) setContent(content + `{{${event.target.value}}}`);
                }}>
                <option value="">Choose a field to add</option>
                {Array.from(new Set(fields.map((field) => field.group))).map((group) =>
                    <optgroup key={group} label={group}>
                        {fields.filter((field) => field.group === group).map((field) =>
                            <option key={field.key} value={field.key}
                                disabled={content.length + `{{${field.key}}}`.length > 300}>{field.label}</option>)}
                    </optgroup>)}
            </select>
        </label>
        {!fields.length ? <p className="text-xs text-muted-foreground">No document fields are available.</p>
            : !available ? <p role="alert" className="text-xs text-destructive">Not enough space to add a field. Cell text is limited to 300 characters.</p> : null}
        {references.length ? <ul className="space-y-2">
            {references.map((match) => {
                const field = fields.find((item) => item.key === match[1]);
                return <li key={match.index} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words">{field?.label ?? match[1]}</span>
                    <Button type="button" variant="outline" size="sm" aria-label={`Remove ${field?.label ?? match[1]} field`}
                        onClick={() => setContent(content.slice(0, match.index) + content.slice(match.index! + match[0].length))}>
                        Remove
                    </Button>
                </li>;
            })}
        </ul> : <p className="text-xs text-muted-foreground">No fields in this cell.</p>}
        <p className="break-words text-xs text-muted-foreground" aria-live="polite">Preview: {fillFields(content, fields) || "(empty)"}</p>
        <p className="text-xs text-muted-foreground">Fields use real bid or quotation data when the layout is loaded. Adding or removing a field changes only this cell.</p>
    </div>;
}

function TableFieldPicker({ element, elements, fields, onChange, fieldClass, labelClass, selection, onSelectionChange }: {
    selection: TableFieldSelection | null;
    onSelectionChange: (selection: TableFieldSelection) => void;
    element: LayoutElement;
    elements: LayoutElement[];
    fields: MergeField[];
    onChange: (patch: Partial<LayoutElement>) => void;
    fieldClass: string;
    labelClass: string;
}) {
    const tables = elements.filter((item) => item.type === "table");
    const { tableId, row, column } = selection?.elementId === element.id
        ? selection : { tableId: "", row: 1, column: 1 };
    const select = (patch: Partial<Omit<TableFieldSelection, "elementId">>) =>
        onSelectionChange({ elementId: element.id, tableId, row, column, ...patch });
    const table = tables.find((item) => item.id === tableId);
    const dimensions = table ? layoutTableDimensions(table) : { rows: 0, columns: 0 };
    const value = table ? layoutTableCell(table, row, column) : null;
    const token = table ? layoutTableField(table.id, row, column) : "";
    const tooLong = element.content.length + token.length > 1000;
    const missing = resolveLayoutTableFields(element.content, elements).includes("[Missing table cell]");

    return <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Table field</p>
        <label className={labelClass}>Source table
            <select aria-label="Table field source" value={tableId} className={fieldClass}
                onChange={(event) => select({ tableId: event.target.value, row: 1, column: 1 })}>
                <option value="">Choose a table</option>
                {tables.map((item, index) => {
                    const size = layoutTableDimensions(item);
                    const sample = fillFields(layoutTableCell(item, 1, 1) ?? "", fields).slice(0, 30);
                    return <option key={item.id} value={item.id}>
                        Table {index + 1}{sample ? `: ${sample}` : ""} ({size.rows} rows, {size.columns} columns)
                    </option>;
                })}
            </select>
        </label>
        {!tables.length ? <p className="text-xs text-muted-foreground">Add a table to this layout first.</p> : null}
        <div className="flex gap-2">
            <label className={cn(labelClass, "min-w-0 flex-1")}>Row
                <select aria-label="Table field row" value={row} disabled={!table} className={fieldClass}
                    onChange={(event) => select({ row: Number(event.target.value) })}>
                    {Array.from({ length: dimensions.rows }, (_, index) =>
                        <option key={index} value={index + 1}>Row {index + 1}</option>)}
                </select>
            </label>
            <label className={cn(labelClass, "min-w-0 flex-1")}>Column
                <select aria-label="Table field column" value={column} disabled={!table} className={fieldClass}
                    onChange={(event) => select({ column: Number(event.target.value) })}>
                    {Array.from({ length: dimensions.columns }, (_, index) =>
                        <option key={index} value={index + 1}>Column {index + 1}{!table?.cells ? index % 2 === 0 ? " (name)" : " (value)" : ""}</option>)}
                </select>
            </label>
        </div>
        {table ? <p className="break-words text-xs text-muted-foreground" aria-live="polite">
            {value === null ? "This cell does not exist. Choose another row or column."
                : `Cell value: ${fillFields(value, fields) || "(empty)"}`}
        </p> : null}
        <Button type="button" variant="outline" size="sm" disabled={!table || value === null || tooLong}
            onClick={() => onChange({ content: element.content + token })}>Insert table field</Button>
        {tooLong ? <p role="alert" className="text-xs text-destructive">Not enough space to insert this field. Text is limited to 1,000 characters.</p> : null}
        {missing ? <p role="alert" className="text-xs text-destructive">A referenced table cell is missing. Remove its field from the text or restore the source table/cell.</p> : null}
        <p className="text-xs text-muted-foreground">Uses the source cell's text, including merge fields, with this text component's formatting. Row and column numbers refer to the saved table, before empty information rows are hidden.</p>
    </div>;
}

function TableEditor({
    element,
    fields,
    onChange,
    labelClass,
    fieldClass,
    onSelectRow,
    selectedRow,
    onSelectCell,
}: {
    onSelectCell: (row: number, column: number) => void;
    onSelectRow: (row: number) => void;
    selectedRow?: number;
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
        const styles = Array.from({ length: items.length }, (_, i) => element.row_styles?.[i] ?? null);
        [styles[index], styles[target]] = [styles[target], styles[index]];
        const cellStyles = Array.from({ length: items.length }, (_, i) => element.cell_styles?.[i] ?? null);
        [cellStyles[index], cellStyles[target]] = [cellStyles[target], cellStyles[index]];
        onChange({ items: next, row_styles: styles, cell_styles: cellStyles });
        onSelectCell(target, 1);
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
                            <button type="button" aria-pressed={selectedRow === index} data-focus-row={index}
                                className="text-xs font-medium underline underline-offset-2"
                                onClick={() => onSelectRow(index)}>Row {index + 1}</button>
                            <input
                                aria-label="Name"
                                data-focus-cell={`${index}-0`}
                                value={item.label}
                                placeholder="Name"
                                onFocus={() => onSelectCell(index, 0)}
                                onChange={(event) =>
                                    patchItem(index, {
                                        label: event.target.value,
                                    })
                                }
                                className={fieldClass}
                            />
                            <input
                                aria-label="Value"
                                data-focus-cell={`${index}-1`}
                                value={item.value}
                                placeholder="Value or {{field}}"
                                onFocus={() => onSelectCell(index, 1)}
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
                                    onClick={() => {
                                        onChange({
                                            items: items.filter((_, i) => i !== index),
                                            row_styles: element.row_styles?.filter((_, i) => i !== index),
                                            cell_styles: element.cell_styles?.filter((_, i) => i !== index),
                                        });
                                        onSelectCell(Math.max(0, index - 1), 1);
                                    }}
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
                            column_widths: undefined,
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
