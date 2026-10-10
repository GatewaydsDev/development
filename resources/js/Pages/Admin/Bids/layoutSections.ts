import { PRINT_LAYOUT_WIDTH, printLayoutTextCase, tableStripeColor, tableTextStyle, type TableStriping, type TextCaseState } from '@/lib/printLayoutGeometry';
import { resolveLayoutTableFields } from '@/lib/printLayoutTableFields';
import { layoutColumnWidths } from '@/lib/printLayoutGeometry';
import { layoutPages, pdfTextFont, pdfTextLines, pdfTextLineHeight, pdfRunText, pdfRunY, type PdfLayoutElement } from '@/lib/printLayoutPdf';

export type PrintLayoutElement = TableStriping & PdfLayoutElement & {
    id: string;
    type: string;
    zone?: string;
    content?: string;
    src?: string;
    align?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    line_height?: number;
    list_style?: 'none' | 'bullet' | 'numbered';
    validity_days?: 30 | 60 | 90;
    color?: string;
    fields?: string[];
    show_labels?: boolean;
    layout?: string;
    border?: boolean;
    border_color?: string;
    label_bg?: string;
    label_width?: number;
    columns?: number;
    items?: Array<{ label: string; value: string }>;
    cells?: string[][];
    header_row?: boolean;
    header_color?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    font_size?: number;
    font_family?: string;
    text_case?: string;
};

export type PrintLayoutOption = {
    id: number;
    name: string;
    elements: PrintLayoutElement[];
    headerHeight?: number;
    headerBackground?: string;
    tableHeaderBackground?: string;
    textCase?: string;
    version?: string;
};

export type PrintLayoutCatalog = {
    printLayouts: PrintLayoutOption[];
    assignedPrintLayoutId?: number | null;
};
export type LayoutSection = {
    id: string;
    label: string;
    html: string;
    table?: {
        guide?: boolean;
        borderless: boolean;
        borderColor: string;
        labelBackground: string;
        headerBackground?: string;
        headerColor?: string;
    };
};

const COMPANY_LABELS: Record<string, string> = {
    company_name: 'name',
    company_speciality: 'speciality',
    company_legal_name: 'legal name',
    company_address: 'address',
    company_phone: 'phone',
    company_contact_phone: 'contact phone',
    company_email: 'email',
    company_website: 'website',
    company_contact_url: 'contact page',
};

// Layout merge fields mapped to the bid text editor's placeholder keys.
const EDITOR_KEYS: Record<string, string> = {
    project_name: 'project_name',
    project_number: 'project_number',
    project_address: 'project_address',
    document_title: 'project_name',
    document_number: 'project_number',
    bid_number: 'project_number',
    bid_date: 'today',
    generated_date: 'today',
    generated_by: 'authorized_representative',
    validity_30: 'validity_30',
    validity_60: 'validity_60',
    validity_90: 'validity_90',
};

const escapeHtml = (text: string) =>
    text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const applyCase = printLayoutTextCase;

// Known values are written as real text; project fields stay live placeholders.
const resolve = (
    text: string,
    literals: Record<string, string>,
    mode?: string,
    fieldKeys: Record<string, string> = EDITOR_KEYS,
    caseState: TextCaseState = { hasWord: false, capitalizeNext: false },
) => {
    let out = '';
    let last = 0;
    const pattern = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        out += escapeHtml(applyCase(text.slice(last, match.index), mode, caseState));
        last = match.index + match[0].length;

        const key = match[1];

        if (Object.prototype.hasOwnProperty.call(literals, key)) {
            out += escapeHtml(applyCase(literals[key], mode, caseState));
        } else {
            const fieldKey = fieldKeys[key] ?? key;
            const token = `{{${fieldKey}}}`;
            out += mode && ['camel', 'uppercase', 'lowercase'].includes(mode)
                ? `<span data-bid-field="${escapeHtml(fieldKey)}" data-text-case="${mode}">${token}</span>`
                : token;
            caseState.hasWord = true;
            caseState.capitalizeNext = false;
        }
    }

    return out + escapeHtml(applyCase(text.slice(last), mode, caseState));
};

const plain = (html: string) => html.replace(/\{\{[^}]*\}\}/g, 'x').replace(/&[a-z]+;/g, 'x');

const wrap = (html: string, element: PrintLayoutElement) => {
    let out = html;

    if (element.bold) {
        out = `<strong>${out}</strong>`;
    }

    if (element.italic) {
        out = `<em>${out}</em>`;
    }
    if (element.underline) {
        out = `<u>${out}</u>`;
    }

    return out;
};

const paragraphStyle = (element: PrintLayoutElement, align = true) => {
    const rules: string[] = [
        'margin-top: 0px', 'margin-bottom: 0px',
        `line-height: ${pdfTextLineHeight(element)}`,
        `font-size: ${element.font_size ?? 12}px`,
        `font-family: ${pdfTextFont(element)}`,
    ];
    if (['text', 'date', 'validity'].includes(element.type)) {
        rules.push(`padding-top: ${element.pdf_page ? 0 : 2}px`, `padding-bottom: ${element.pdf_page ? 0 : 2}px`, `white-space: ${element.pdf_page ? 'pre' : 'pre-line'}`);
    } else if (element.type === 'company' && element.layout !== 'table') {
        rules.push('padding-top: 1px', 'padding-bottom: 1px');
    }

    if (element.color) {
        rules.push(`color: ${element.color}`);
    }
    if (element.pdf_font_src) rules.push('font-synthesis: none');

    if (align) {
        rules.push(`text-align: ${element.align ?? 'left'}`);
    }
    if (element.text_case && ['uppercase', 'lowercase'].includes(element.text_case)) {
        rules.push(`text-transform: ${element.text_case}`);
    }

    return rules.length > 0 ? ` style="${escapeHtml(rules.join('; '))}"` : '';
};

const paragraph = (html: string, element: PrintLayoutElement, align = true) =>
    `<p${element.text_case && ['camel', 'uppercase', 'lowercase'].includes(element.text_case) ? ` data-editor-text-case="${element.text_case}"` : ''}${element.pdf_font_src ? ` data-pdf-font-src="${escapeHtml(element.pdf_font_src)}"` : ''}${paragraphStyle(element, align)}>${wrap((html || (element.pdf_page ? '&nbsp;' : '')).replace(/\r?\n/g, '<br>'), element)}</p>`;

const preview = (text: string) => {
    const clean = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, '[$1]').trim();

    return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean;
};

const pageWidthPx = PRINT_LAYOUT_WIDTH;

type Built = LayoutSection & { y: number; x: number; w: number; h: number };

function build(
    element: PrintLayoutElement,
    index: number,
    literals: Record<string, string>,
    fieldKeys?: Record<string, string>,
): Built | null {
    const id = element.id || String(index);
    const base = {
        id,
        y: element.y ?? 0,
        x: element.x ?? 0,
        w: element.width ?? 100,
        h: 24,
    };

    if (element.type === 'text' || element.type === 'date' || element.type === 'validity') {
        const runCaseStates: Record<number, TextCaseState> = {};
        const html = resolve(
            element.type === 'validity' ? `{{validity_${element.validity_days ?? 30}}}`
                : element.type === 'date' ? '{{generated_date}}' : element.content ?? '',
            literals,
            element.text_case,
            fieldKeys,
        );

        if (plain(html).trim() === '' && !element.pdf_page) {
            return null;
        }

        return {
            ...base,
            h: element.pdf_page ? element.height ?? 24 : Math.round((element.font_size ?? 12) * (element.line_height ?? 1.5) * (element.content?.split(/\r?\n/).length ?? 1)),
            label: `Text: ${preview(element.content ?? '')}`,
            html: element.type === 'text' && element.list_style && element.list_style !== 'none'
                ? (() => {
                    const tag = element.list_style === 'numbered' ? 'ol' : 'ul';
                    const list = element.list_style === 'numbered' ? 'decimal' : element.pdf_bullet_style ?? 'disc';
                    const itemStyle = paragraphStyle({ ...element, type: 'listItem' });
                    const lines = pdfTextLines(element.content ?? '', element)
                        .map((line) => resolve(line, literals, element.text_case, fieldKeys));
                    return `<${tag} style="margin: 0; padding-left: 20px; list-style-type: ${list}">${lines.map((line) => `<li${itemStyle}>${paragraph(line || '&nbsp;', element)}</li>`).join('')}</${tag}>`;
                })()
                : element.pdf_text_runs?.length ? element.pdf_text_runs.map((run, index) => {
                    const lines = pdfTextLines(element.content ?? '', element);
                    const text = resolve(pdfRunText(lines, element.pdf_text_runs!, index), literals, element.text_case, fieldKeys,
                        runCaseStates[run.line] ??= { hasWord: false, capitalizeNext: false });
                    const y = pdfRunY(run, element);
                    return `<div data-position-item="true" data-x="${run.x}" data-y="${y}" data-width="${run.width}" data-height="${run.height}" style="position:absolute;left:${run.x}px;top:${y}px;width:${run.width}px;min-height:${run.height}px;">${paragraph(text, { ...element, ...run, pdf_line_spacing: undefined, line_height: 1 })}</div>`;
                }).join('')
                : paragraph(pdfTextLines(html, element).join('\n'), element),
        };
    }

    if (element.type === 'table') {
        const widths = layoutColumnWidths(element);
        const innerWidth = pageWidthPx * (element.width ?? 100) / 100 - (element.border ? 1 : 0);
        if (element.cells) {
            return {
                ...base,
                h: element.row_heights?.length === element.cells.length ? element.row_heights.reduce((sum, height) => sum + height, 0) : element.cells.length * 32,
                label: `Table (${element.cells.length} rows)`,
                html: `<table${element.table_background ? ` style="background-color:${escapeHtml(element.table_background)}"` : ''}><tbody>${element.cells.map((row, index) => `<tr${element.row_heights?.[index] ? ` style="height:${element.row_heights[index]}px"` : ''}>${row.map((cell, column) => {
                    const span = element.cell_spans?.[index]?.[column];
                    if (span && (!span.rows || !span.columns)) return '';
                    const header = index === 0 && element.header_row;
                    const tag = header ? 'th' : 'td';
                    const background = header ? element.label_bg || '#065f46'
                        : tableStripeColor(element, index - (element.header_row ? 1 : 0), column, index);
                    const style = { ...element, ...tableTextStyle(element, index, column, !!header) };
                    const css = [
                        `width: ${innerWidth * widths.slice(column, column + (span?.columns ?? 1)).reduce((sum, value) => sum + value, 0) / 100}px`,
                        ...(element.row_heights?.[index] ? [`height: ${element.row_heights[index]}px`, 'padding: 2px 6px'] : []),
                        ...(background ? [`background-color: ${background}`] : []),
                        ...(header ? ['font-weight: normal'] : []),
                    ].join('; ');
                    const borders = element.border ? element.cell_borders?.[index]?.[column] : undefined;
                    const borderCss = borders ? Object.entries(borders).map(([side, value]) => `border-${side}:${value}`).join(';') : '';
                    const colwidth = widths.slice(column, column + (span?.columns ?? 1)).map(width => Math.max(1, Math.round(innerWidth * width / 100))).join(',');
                    return `<${tag} data-layout-column="${column}" colwidth="${colwidth}"${span ? ` colspan="${span.columns}" rowspan="${span.rows}"` : ''} style="${css};${borderCss}">${paragraph(resolve(cell, literals, style.text_case, fieldKeys) || '&nbsp;', style)}</${tag}>`;
                }).join('')}</tr>`).join('')}</tbody></table><p></p>`,
                table: {
                    borderless: !element.border, borderColor: element.border_color || '#cbd5e1', labelBackground: '',
                    headerBackground: element.header_row ? element.label_bg || '#065f46' : undefined,
                    headerColor: element.header_row ? element.header_color || '#ffffff' : undefined,
                },
            };
        }
        const rows = (element.items ?? [])
            .map((item, index) => ({
                index,
                label: resolve(item.label, literals, tableTextStyle(element, index, 0, false, true, 0).text_case, fieldKeys).trim(),
                value: resolve(item.value, literals, tableTextStyle(element, index, 1, false, false, 1).text_case, fieldKeys).trim(),
            }))
            .filter((row) => plain(row.value) !== '' || plain(row.label) !== '');

        if (rows.length === 0) {
            return null;
        }

        const pairs = Math.min(3, Math.max(1, element.columns ?? 2));
        const font = element.font_size ?? 12;
        const body = Array.from(
            { length: Math.ceil(rows.length / pairs) },
            (_, rowIndex) =>
                `<tr>${Array.from({ length: pairs }, (_, col) => {
                    const row = rows[rowIndex * pairs + col] ?? {
                        label: '',
                        value: '',
                        index: -1,
                    };

                    const labelWidth = innerWidth * widths[col * 2] / 100;
                    const valueWidth = innerWidth * widths[col * 2 + 1] / 100;
                    const labelColor = tableStripeColor(element, rowIndex, col * 2) ?? element.label_bg;
                    const valueColor = tableStripeColor(element, rowIndex, col * 2 + 1);
                    return `<td style="width: ${labelWidth}px; background-color: ${labelColor || 'transparent'}">${paragraph(row.label || '&nbsp;', { ...element, ...tableTextStyle(element, row.index, col * 2, false, true, 0) })}</td><td style="width: ${valueWidth}px; background-color: ${valueColor || 'transparent'}">${paragraph(row.value || '&nbsp;', { ...element, ...tableTextStyle(element, row.index, col * 2 + 1, false, false, 1) })}</td>`;
                }).join('')}</tr>`,
        ).join('');

        return {
            ...base,
            h: rows.length * font * 2,
            label: `Info table (${rows.length} ${rows.length === 1 ? 'row' : 'rows'})`,
            html: `<table><tbody>${body}</tbody></table><p></p>`,
            table: {
                borderless: !element.border,
                borderColor: element.border_color || '#111827',
                labelBackground: element.label_bg ?? '',
            },
        };
    }

    if (element.type === 'company') {
        const keys = (element.fields ?? ['company_name', 'company_address', 'company_phone', 'company_email']).filter((key) => literals[key]?.trim());

        if (keys.length === 0) {
            return null;
        }

        const lines = keys.map((key) => {
            const value = escapeHtml(applyCase(literals[key], element.text_case));

            return paragraph(
                !element.show_labels
                    ? value
                    : `<span style="opacity: 0.65">${escapeHtml(applyCase(COMPANY_LABELS[key] ?? key, element.text_case))}: </span>${value}`,
                element.layout === 'table' ? { ...element, type: 'companyCell' } : element,
            );
        });

        if (element.layout === 'table') {
            const columns = Math.max(1, Math.min(4, element.columns ?? 2));
            const rows = Array.from({ length: Math.ceil(lines.length / columns) }, (_, r) =>
                `<tr>${Array.from({ length: columns }, (_, c) =>
                    `<td>${lines[r * columns + c] ?? '<p></p>'}</td>`).join('')}</tr>`,
            ).join('');
            return {
                ...base,
                h: Math.ceil(lines.length / columns) * 40,
                label: 'Company table',
                html: `<table><tbody>${rows}</tbody></table>`,
                table: { borderless: !element.border, borderColor: element.color || '#111827', labelBackground: '' },
            };
        }
        return {
            ...base,
            h: lines.length * Math.round((element.font_size ?? 12) * 1.5),
            label: `Company details (${lines.length} ${lines.length === 1 ? 'field' : 'fields'})`,
            html: lines.join(''),
        };
    }

    if (element.type === 'image' && element.src) {
        const width = Math.round(((element.width ?? 30) / 100) * pageWidthPx);
        const middle = (element.x ?? 0) + (element.width ?? 30) / 2;
        const margin =
            middle > 65
                ? 'margin-left: auto; '
                : middle > 35
                  ? 'margin-left: auto; margin-right: auto; '
                  : '';

        return {
            ...base,
            h: Math.round(width * 0.6),
            label: 'Image',
            html: `<div data-rich-image="true" style="${margin}width: ${width}px"><img src="${escapeHtml(element.src)}" alt="" style="width: 100%; height: auto; max-width: 100%;"><div data-image-caption="true"><p></p></div></div>`,
        };
    }

    if (element.type === 'divider') {
        return {
            ...base,
            h: (element.height ?? 2) + 12,
            label: 'Divider line',
            html: `<hr style="border-top: ${element.height ?? 1}px solid ${element.color || '#111827'}; margin-top: 6px; margin-bottom: 6px">`,
        };
    }

    if (element.type === 'spacer') {
        return { ...base, h: element.height ?? 24, label: 'Spacer', html: '<p style="font-size: 0px; line-height: 0; margin: 0"></p>' };
    }

    return null;
}

const overlapsX = (a: Built, b: Built) =>
    a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5;

export function positionedLayoutSections(
    layout: PrintLayoutOption,
    literals: Record<string, string>,
    fieldKeys?: Record<string, string>,
    pdfPage = false,
): LayoutSection[] {
    if (!pdfPage && layout.elements.some((element) => element.pdf_page)) {
        return layoutPages(layout.elements, layout.headerHeight ?? 160).flatMap((page, index) =>
            positionedLayoutSections({ ...layout, elements: page.elements, headerHeight: page.height }, literals, fieldKeys, true)
                .map((section) => ({
                    ...section, id: `${section.id}-${page.id}`, label: `${layout.name} — page ${index + 1}`,
                    html: section.html.replace('data-position-canvas="true"', 'data-position-canvas="true" data-pdf-page="true"'),
                })));
    }
    const children: string[] = [];
    const bottom = layout.headerHeight ?? 160;
    layout.elements.forEach((element, index) => {
        if (element.zone && element.zone !== 'header') {
            return;
        }
        const item = build({
            ...element,
            content: element.type === 'text' ? resolveLayoutTableFields(element.content ?? '', layout.elements) : element.content,
            text_case: element.text_case,
        }, index, literals, fieldKeys);
        if (!item) {
            return;
        }
        const parsed = new DOMParser().parseFromString(item.html, 'text/html');
        const settings = item.table;
        if (settings) {
            parsed.querySelectorAll('tr').forEach((row, rowIndex) => {
                Array.from(row.children).forEach((cell, column) => {
                    if (!(cell instanceof HTMLElement)) {
                        return;
                    }
                    column = Number(cell.dataset.layoutColumn ?? column);
                    delete cell.dataset.layoutColumn;
                    if (settings.borderless || !cell.style.borderTop) cell.style.border = settings.borderless ? 'none' : `1px solid ${settings.borderColor}`;
                    cell.style.padding = element.type === 'company' ? '4px 8px' : element.row_heights?.length ? '2px 6px' : '6px 10px';
                    cell.style.verticalAlign = element.type === 'company' ? 'top' : 'middle';
                    cell.style.backgroundColor = 'transparent';
                    if (!cell.style.width) {
                        // ProseMirror column widths exclude the collapsed outer border.
                        const innerWidth = item.w * pageWidthPx / 100 - (settings.borderless ? 0 : 1);
                        cell.style.width = `${innerWidth / row.children.length}px`;
                    }
                    if (cell.tagName === 'TH') {
                        cell.style.backgroundColor = settings.headerBackground ?? '';
                        cell.style.color = settings.headerColor ?? '';
                    } else if (column % 2 === 0 && settings.labelBackground) {
                        cell.style.backgroundColor = settings.labelBackground;
                    }
                    if (cell.tagName !== 'TH' && element.type === 'table') {
                        const color = tableStripeColor(element, rowIndex - (element.cells && element.header_row ? 1 : 0), column, rowIndex);
                        if (color) cell.style.backgroundColor = color;
                    }
                });
            });
        }
        parsed.querySelectorAll<HTMLElement>('[data-rich-image]').forEach((image) => {
            image.style.width = `${Math.round(item.w * pageWidthPx / 100)}px`;
            image.style.margin = '0';
        });
        const content = Array.from(parsed.body.children)
            .filter((child) =>
                !(child.tagName === 'P' && child.textContent === '' && !child.getAttribute('style')),
            )
            .map((child) => child.outerHTML)
            .join('');
        const x = Number((item.x * pageWidthPx / 100).toFixed(2));
        const width = Number((item.w * pageWidthPx / 100).toFixed(2));
        const height = element.type === 'spacer' || element.pdf_page ? element.height ?? 24 : 0;
        children.push(`<div data-position-item="true"${element.pdf_background ? ' data-pdf-background="true"' : ''} data-x="${x}" data-y="${item.y}" data-width="${width}" data-height="${height}" style="position: absolute; left: ${x}px; top: ${item.y}px; width: ${width}px; min-height: ${height}px">${content || '<p></p>'}</div>`);
    });
    if (!children.length) {
        return [];
    }
    return [{
        id: `layout-${layout.id}`,
        label: layout.name,
        html: `<div data-position-canvas="true" data-height="${bottom}" style="position: relative; width: ${pageWidthPx}px; height: ${bottom}px; background-color: ${layout.headerBackground || '#ffffff'}">${children.join('')}</div>`,
    }];
}

export function layoutSections(
    elements: PrintLayoutElement[],
    literals: Record<string, string> = {},
    fieldKeys?: Record<string, string>,
): LayoutSection[] {
    const built = elements
        .filter((element) => {
            const zone = element.zone;

            return !zone || zone === 'header';
        })
        .map((element, index) => build({
            ...element,
            content: element.type === 'text' ? resolveLayoutTableFields(element.content ?? '', elements) : element.content,
        }, index, literals, fieldKeys))
        .filter((item): item is Built => item !== null)
        .sort((a, b) => a.y - b.y || a.x - b.x);

    // The same divider stacked at one position is a single line.
    const unique = built.filter(
        (item, index) =>
            !(
                item.label === 'Divider line' &&
                built.findIndex(
                    (other) =>
                        other.label === item.label &&
                        other.y === item.y &&
                        other.html === item.html,
                ) !== index
            ),
    );

    const rows: Built[][] = [];
    const beside = new Map<string, Built[]>();
    const taken = new Set<string>();

    // Text that starts within an image's height sits beside that image.
    unique.forEach((image) => {
        if (image.label !== 'Image' || taken.has(image.id)) {
            return;
        }

        const near = unique.filter(
            (other) =>
                other !== image &&
                !taken.has(other.id) &&
                !other.table &&
                other.label !== 'Image' &&
                other.label !== 'Divider line' &&
                other.label !== 'Spacer' &&
                other.y >= image.y &&
                other.y < image.y + image.h + 20,
        );

        if (near.length > 0) {
            beside.set(image.id, near);
            near.forEach((other) => taken.add(other.id));
        }
    });

    unique.forEach((item) => {
        if (taken.has(item.id)) {
            return;
        }

        const sideItems = beside.get(item.id);

        if (sideItems) {
            const alignRight = item.x + item.w / 2 > 65;
            const picture = `<td>${item.html}</td>`;
            const text = `<td>${sideItems.map((other) => other.html).join('')}</td>`;

            rows.push([
                {
                    ...item,
                    label: 'Header row',
                    h: Math.max(item.h, ...sideItems.map((other) => other.y + other.h - item.y)),
                    html: `<table><tbody><tr>${alignRight ? text + picture : picture + text}</tr></tbody></table><p></p>`,
                    table: { borderless: true, guide: true, borderColor: '#111827', labelBackground: '' },
                },
            ]);

            return;
        }

        const row = rows[rows.length - 1];

        if (
            row &&
            !item.table &&
            row.every(
                (other) =>
                    !other.table &&
                    Math.abs(other.y - item.y) <= 20 &&
                    !overlapsX(other, item),
            )
        ) {
            row.push(item);
            return;
        }

        rows.push([item]);
    });

    const sections: LayoutSection[] = [];
    let bottom = 0;

    rows.forEach((row) => {
        const top = row[0].y;
        const gap = Math.floor((top - bottom) / 40);

        for (let i = 0; i < Math.min(gap, 3); i += 1) {
            sections.push({ id: `gap-${sections.length}`, label: 'Spacing', html: '<p></p>' });
        }

        bottom = top + Math.max(...row.map((item) => item.h));

        if (row.length === 1) {
            const [item] = row;

            if (item.label === 'Spacer') {
                return;
            }

            sections.push({
                id: item.id,
                label: item.label,
                html: item.html,
                table: item.table,
            });

            return;
        }

        const ordered = [...row].sort((a, b) => a.x - b.x);

        sections.push({
            id: ordered.map((item) => item.id).join('+'),
            label: `Row: ${ordered.map((item) => item.label).join(' | ')}`,
            html: `<table><tbody><tr>${ordered
                .map((item) => `<td>${item.html}</td>`)
                .join('')}</tr></tbody></table><p></p>`,
            table: { borderless: true, borderColor: '#111827', labelBackground: '' },
        });
    });

    return sections;
}
