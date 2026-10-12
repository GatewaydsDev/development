import { PRINT_LAYOUT_FONTS } from './printLayoutGeometry';

export type PdfTextRun = {
    line: number; offset: number; length: number;
    x: number; y: number; width: number; height: number;
    font_size: number; font_family?: string; pdf_font_src?: string; pdf_font_name?: string;
    bold: boolean; italic: boolean; color: string;
};

export type PdfLayoutElement = {
    pdf_page?: string;
    pdf_page_height?: number;
    pdf_background?: boolean;
    pdf_font_src?: string;
    pdf_font_name?: string;
    pdf_line_count?: number;
    pdf_line_spacing?: number;
    pdf_list_lines?: number[];
    pdf_bullet_style?: 'disc' | 'circle' | 'square';
    pdf_text_runs?: PdfTextRun[];
    list_flow?: 'original' | 'auto';
};

/** A line break inside one bullet. A normal newline still starts the next bullet. */
export const LIST_CONTINUATION = '\u2028';

export type ListTextItem = { lines: string[]; reserved: number };

type ListSpacing = {
    list_flow?: 'original' | 'auto';
    pdf_list_lines?: number[];
    pdf_line_spacing?: number;
    font_size?: number;
    line_height?: number;
};

export function listKeepsOriginalSpace(element: ListSpacing): boolean {
    if (element.list_flow === 'auto') return false;
    if (element.list_flow === 'original') return true;
    return Boolean(element.pdf_list_lines?.length || element.pdf_line_spacing);
}

export function listLineSpacing(element: ListSpacing): number {
    return element.pdf_line_spacing ?? (element.font_size ?? 12) * (element.line_height ?? 1.35);
}

export function listTextItems(content: string, element: ListSpacing): ListTextItem[] {
    const counts = element.pdf_list_lines;
    const slots = counts?.reduce((sum, count) => sum + count, 0) ?? 0;
    if (!content.includes(LIST_CONTINUATION) && counts && counts.length > 0) {
        const lines = content.split(/\r?\n/);
        if (lines.length >= slots && lines.length !== counts.length) {
            const items: ListTextItem[] = [];
            let cursor = 0;
            counts.forEach((count) => {
                const grouped = lines.slice(cursor, cursor + count);
                items.push({ lines: grouped.length ? grouped : [''], reserved: Math.max(1, count) });
                cursor += count;
            });
            lines.slice(cursor).forEach((line) => items.push({ lines: [line], reserved: 1 }));
            return items;
        }
    }

    const items = content === '' ? [''] : content.split(/\r?\n/);
    return items.map((item, index) => {
        const lines = item.split(LIST_CONTINUATION);
        return {
            lines: lines.length ? lines : [''],
            reserved: Math.max(1, counts?.[index] ?? lines.length),
        };
    });
}

export function listLineUnits(content: string, element: ListSpacing): number[] {
    const original = listKeepsOriginalSpace(element);
    return listTextItems(content, element).map((item) => original
        ? Math.max(item.reserved, Math.max(1, item.lines.length))
        : Math.max(1, item.lines.length));
}

export function listBlockHeight(content: string, element: ListSpacing): number {
    return listLineUnits(content, element).reduce((sum, lines) => sum + lines * listLineSpacing(element), 0);
}

export function joinListItems(items: ListTextItem[]): string {
    return items.map((item) => item.lines.join(LIST_CONTINUATION)).join('\n');
}

export function pdfRunText(lines: string[], runs: PdfTextRun[], index: number): string {
    const run = runs[index];
    const last = !runs.slice(index + 1).some(next => next.line === run.line);
    const line = lines[run.line] ?? '';
    const boundaries = [...line.matchAll(/\{\{[^{}]*\}\}/g)].map(match => ({
        start: [...line.slice(0, match.index)].length,
        end: [...line.slice(0, match.index + match[0].length)].length,
    }));
    const boundary = (offset: number) => boundaries.find(token => token.start < offset && token.end > offset)?.end ?? offset;
    return [...line].slice(boundary(run.offset), last ? undefined : boundary(run.offset + run.length)).join('');
}

export function pdfRunY(run: PdfTextRun, element: PdfLayoutElement & { font_size?: number; line_height?: number }): number {
    return element.pdf_line_spacing ? run.y : run.line * (element.font_size ?? run.font_size) * (element.line_height ?? 1.35);
}

export function pdfFontSources(elements: PdfLayoutElement[]): string[] {
    return [...new Set(elements.flatMap(element => [
        element.pdf_font_src,
        ...(element.pdf_text_runs ?? []).map(run => run.pdf_font_src),
    ]).filter((src): src is string => Boolean(src)))];
}
export function pdfTextLineHeight(element: PdfLayoutElement & { font_size?: number; line_height?: number }): number {
    return element.pdf_line_spacing ? element.pdf_line_spacing / (element.font_size ?? 12) : element.line_height ?? 1.35;
}

export function pdfTextLines(content: string, element: PdfLayoutElement & { list_style?: string }): string[] {
    const lines = content.split(/\r?\n/);
    const counts = element.list_style === 'bullet' || element.list_style === 'numbered' ? element.pdf_list_lines : undefined;
    const length = Math.max(lines.length, counts?.length ?? element.pdf_line_count ?? 1);
    return Array.from({ length }, (_, index) => {
        const line = lines[index] || '\u00a0';
        return counts ? line + '\n\u00a0'.repeat(Math.max(0, (counts[index] ?? 1) - 1)) : line;
    });
}

export function pdfFontFamily(src?: string): string | null {
    const match = src?.match(/^\/storage\/editor-fonts\/([a-f0-9]{64})\.ttf$/);
    return match ? `PDF_${match[1]}` : null;
}

const fonts = new Map<string, Promise<FontFace>>();
export function loadPdfFont(src: string): Promise<FontFace> {
    const family = pdfFontFamily(src);
    if (!family) return Promise.reject(new Error('Invalid imported font URL.'));
    let loaded = fonts.get(src);
    if (!loaded) {
        loaded = new FontFace(family, `url("${src}")`).load().then((font) => {
            document.fonts.add(font);
            return font;
        }).catch((error) => { fonts.delete(src); throw error; });
        fonts.set(src, loaded);
    }
    return loaded;
}

export function pdfTextFont(element: PdfLayoutElement & { font_family?: string }) {
    const fallback = PRINT_LAYOUT_FONTS[element.font_family ?? 'default'] ?? PRINT_LAYOUT_FONTS.default;
    const family = pdfFontFamily(element.pdf_font_src);
    return family ? `"${family}", ${fallback}` : fallback;
}

export function layoutPages<T extends PdfLayoutElement>(elements: T[], height: number): Array<{ id: string; height: number; elements: T[] }> {
    const pages = new Map<string, { id: string; height: number; elements: T[] }>();
    for (const element of elements) {
        const id = element.pdf_page ?? 'layout';
        if (!pages.has(id)) pages.set(id, { id, height: element.pdf_page_height ?? height, elements: [] });
        pages.get(id)!.elements.push(element);
    }
    return [...pages.values()];
}
