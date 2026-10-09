export type PrintLayoutElement = {
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
    company_name: 'Company name',
    company_legal_name: 'Legal name',
    company_address: 'Address',
    company_phone: 'Phone',
    company_contact_phone: 'Contact phone',
    company_email: 'Email',
    company_website: 'Website',
    company_contact_url: 'Contact page',
};

const FONT_STACKS: Record<string, string> = {
    helvetica: 'Helvetica, Arial, sans-serif',
    arial: 'Arial, Helvetica, sans-serif',
    verdana: 'Verdana, Geneva, sans-serif',
    tahoma: 'Tahoma, Geneva, sans-serif',
    trebuchet: '"Trebuchet MS", Helvetica, sans-serif',
    georgia: 'Georgia, serif',
    times: '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace',
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
};

const escapeHtml = (text: string) =>
    text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const applyCase = (text: string, mode?: string) => {
    if (mode === 'uppercase') {
        return text.toUpperCase();
    }

    if (mode === 'lowercase') {
        return text.toLowerCase();
    }

    if (mode === 'camel') {
        return text.replace(
            /\w\S*/g,
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        );
    }

    return text;
};

// Known values are written as real text; project fields stay live placeholders.
const resolve = (
    text: string,
    literals: Record<string, string>,
    mode?: string,
) => {
    let out = '';
    let last = 0;
    const pattern = /\{\{\s*([a-z_]+)\s*\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        out += escapeHtml(applyCase(text.slice(last, match.index), mode));
        last = match.index + match[0].length;

        const key = match[1];

        if (Object.prototype.hasOwnProperty.call(literals, key)) {
            out += escapeHtml(applyCase(literals[key], mode));
        } else if (EDITOR_KEYS[key]) {
            out += `{{${EDITOR_KEYS[key]}}}`;
        } else {
            out += escapeHtml(match[0]);
        }
    }

    return out + escapeHtml(applyCase(text.slice(last), mode));
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
    const rules: string[] = ['margin-top: 0px', 'margin-bottom: 0px', `line-height: ${element.line_height ?? 1.35}`];
    if (element.type === 'text' || element.type === 'date') {
        rules.push('padding-top: 2px', 'padding-bottom: 2px');
    } else if (element.type === 'company' && element.layout !== 'table') {
        rules.push('padding-top: 1px', 'padding-bottom: 1px');
    }

    if (element.font_size) {
        rules.push(`font-size: ${element.font_size}px`);
    }

    const family = FONT_STACKS[element.font_family ?? ''];

    if (family) {
        rules.push(`font-family: ${family}`);
    }

    if (element.color) {
        rules.push(`color: ${element.color}`);
    }

    if (align && element.align && element.align !== 'left') {
        rules.push(`text-align: ${element.align}`);
    }
    if (element.text_case && ['uppercase', 'lowercase', 'camel'].includes(element.text_case)) {
        const transform = element.text_case === 'camel' ? 'capitalize' : element.text_case;
        rules.push(`text-transform: ${transform}`);
    }

    return rules.length > 0 ? ` style="${escapeHtml(rules.join('; '))}"` : '';
};

const paragraph = (html: string, element: PrintLayoutElement, align = true) =>
    `<p${paragraphStyle(element, align)}>${wrap(html.replace(/\r?\n/g, '<br>'), element)}</p>`;

const preview = (text: string) => {
    const clean = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, '[$1]').trim();

    return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean;
};

const pageWidthPx = 700;

type Built = LayoutSection & { y: number; x: number; w: number; h: number };

function build(
    element: PrintLayoutElement,
    index: number,
    literals: Record<string, string>,
): Built | null {
    const id = element.id || String(index);
    const base = {
        id,
        y: element.y ?? 0,
        x: element.x ?? 0,
        w: element.width ?? 100,
        h: 24,
    };

    if (element.type === 'text' || element.type === 'date') {
        const html = resolve(
            element.type === 'date' ? '{{generated_date}}' : element.content ?? '',
            literals,
            element.text_case,
        );

        if (plain(html).trim() === '') {
            return null;
        }

        return {
            ...base,
            h: Math.round((element.font_size ?? 12) * (element.line_height ?? 1.5) * (element.content?.split(/\r?\n/).length ?? 1)),
            label: `Text: ${preview(element.content ?? '')}`,
            html: element.type === 'text' && element.list_style && element.list_style !== 'none'
                ? (() => {
                    const tag = element.list_style === 'numbered' ? 'ol' : 'ul';
                    const list = element.list_style === 'numbered' ? 'decimal' : 'disc';
                    const itemStyle = paragraphStyle({ ...element, type: 'listItem' });
                    return `<${tag} style="margin: 0; padding-left: 20px; list-style-type: ${list}">${html.split(/\r?\n/).map((line) => `<li${itemStyle}>${paragraph(line || '&nbsp;', element)}</li>`).join('')}</${tag}>`;
                })()
                : paragraph(html, element),
        };
    }

    if (element.type === 'table') {
        if (element.cells) {
            return {
                ...base,
                h: element.cells.length * 32,
                label: `Table (${element.cells.length} rows)`,
                html: `<table><tbody>${element.cells.map((row, index) => `<tr>${row.map((cell) => {
                    const header = index === 0 && element.header_row;
                    const tag = header ? 'th' : 'td';
                    return `<${tag}>${paragraph(resolve(cell, literals, element.text_case), header ? { ...element, bold: true, color: element.header_color || '#ffffff' } : element)}</${tag}>`;
                }).join('')}</tr>`).join('')}</tbody></table><p></p>`,
                table: {
                    borderless: !element.border, borderColor: element.border_color || '#cbd5e1', labelBackground: '',
                    headerBackground: element.header_row ? element.label_bg || '#065f46' : undefined,
                    headerColor: element.header_row ? element.header_color || '#ffffff' : undefined,
                },
            };
        }
        const rows = (element.items ?? [])
            .map((item) => ({
                label: resolve(item.label, literals, element.text_case).trim(),
                value: resolve(item.value, literals, element.text_case).trim(),
            }))
            .filter((row) => plain(row.value) !== '' || plain(row.label) !== '');

        if (rows.length === 0) {
            return null;
        }

        const pairs = Math.min(3, Math.max(1, element.columns ?? 1));
        const font = element.font_size ?? 12;
        const body = Array.from(
            { length: Math.ceil(rows.length / pairs) },
            (_, rowIndex) =>
                `<tr>${Array.from({ length: pairs }, (_, col) => {
                    const row = rows[rowIndex * pairs + col] ?? {
                        label: '',
                        value: '',
                    };

                    const labelWidth = Math.round(pageWidthPx * (element.width ?? 100) / 100 / pairs * (element.label_width ?? 30) / 100);
                    const valueWidth = Math.round(pageWidthPx * (element.width ?? 100) / 100 / pairs) - labelWidth;
                    return `<td style="width: ${labelWidth}px">${paragraph(row.label, { ...element, bold: true }, false)}</td><td style="width: ${valueWidth}px">${paragraph(row.value, element)}</td>`;
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
        const keys = (element.fields ?? []).filter((key) => literals[key]);

        if (keys.length === 0) {
            return null;
        }

        const lines = keys.map((key) => {
            const value = escapeHtml(applyCase(literals[key], element.text_case));

            return paragraph(
                element.show_labels === false
                    ? value
                    : `${escapeHtml(COMPANY_LABELS[key] ?? key)}: ${value}`,
                element,
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
            html: `<div data-rich-image="true" style="${margin}width: ${width}px"><img src="${escapeHtml(element.src)}" alt="" style="width: 100%; height: auto; max-width: 100%;"><div data-image-caption="true"><p>&nbsp;</p></div></div>`,
        };
    }

    if (element.type === 'divider') {
        return {
            ...base,
            h: (element.height ?? 2) + 12,
            label: 'Divider line',
            html: `<hr style="border-top: ${element.height ?? 1}px solid ${element.color || '#111827'}">`,
        };
    }

    if (element.type === 'spacer') {
        return { ...base, h: element.height ?? 24, label: 'Spacer', html: '<p></p>' };
    }

    return null;
}

const overlapsX = (a: Built, b: Built) =>
    a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5;

export function positionedLayoutSections(
    layout: PrintLayoutOption,
    literals: Record<string, string>,
): LayoutSection[] {
    const children: string[] = [];
    let bottom = layout.headerHeight ?? 160;
    layout.elements.forEach((element, index) => {
        if (element.zone && element.zone !== 'header') {
            return;
        }
        const item = build(element, index, literals);
        if (!item) {
            return;
        }
        const parsed = new DOMParser().parseFromString(item.html, 'text/html');
        const settings = item.table;
        if (settings) {
            parsed.querySelectorAll('tr').forEach((row) => {
                Array.from(row.children).forEach((cell, column) => {
                    if (!(cell instanceof HTMLElement)) {
                        return;
                    }
                    cell.style.border = settings.borderless ? 'none' : `1px solid ${settings.borderColor}`;
                    cell.style.padding = element.type === 'company' ? '4px 8px' : '6px 10px';
                    cell.style.verticalAlign = element.type === 'company' ? 'top' : 'middle';
                    cell.style.backgroundColor = 'transparent';
                    if (!cell.style.width) {
                        cell.style.width = `${Math.round(item.w * pageWidthPx / 100 / row.children.length)}px`;
                    }
                    if (cell.tagName === 'TH') {
                        cell.style.backgroundColor = settings.headerBackground ?? '';
                        cell.style.color = settings.headerColor ?? '';
                    } else if (column % 2 === 0 && settings.labelBackground) {
                        cell.style.backgroundColor = settings.labelBackground;
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
        bottom = Math.max(bottom, item.y + item.h);
        const height = element.type === 'spacer' ? element.height ?? 24 : 0;
        children.push(`<div data-position-item="true" data-x="${x}" data-y="${item.y}" data-width="${width}" data-height="${height}" style="position: absolute; left: ${x}px; top: ${item.y}px; width: ${width}px; min-height: ${height}px">${content || '<p></p>'}</div>`);
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
): LayoutSection[] {
    const built = elements
        .filter((element) => {
            const zone = element.zone;

            return !zone || zone === 'header';
        })
        .map((element, index) => build(element, index, literals))
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
