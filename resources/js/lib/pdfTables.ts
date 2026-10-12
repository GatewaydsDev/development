import type { LayoutElement } from '@/Pages/Admin/DocumentSettings/LayoutElements';
import type { PdfTextFragment, PdfTextRegion } from './pdfTextBlocks';
import { paintIsWhite, PRINT_LAYOUT_WIDTH } from './printLayoutGeometry';

export type PdfTableLine = { x1: number; y1: number; x2: number; y2: number; color: string; width: number };
export type PdfTableFill = PdfTextRegion & { color: string };
export type PdfTableGrid = { xs: number[]; ys: number[]; lines: PdfTableLine[] };
const tolerance = 1;
const near = (a: number, b: number) => Math.abs(a - b) <= tolerance;
const coordinates = (values: number[]) => values.sort((a, b) => a - b)
    .filter((value, index, sorted) => !index || !near(value, sorted[index - 1]));

export function pdfPathLines(
    data: ArrayLike<number>, matrix: number[], color: string, width: number,
): { lines: PdfTableLine[]; rectangles: PdfTextRegion[] } {
    const lines: PdfTableLine[] = [];
    let points: Array<[number, number]> = [];
    const rectangles: PdfTextRegion[] = [];
    const point = (x: number, y: number): [number, number] =>
        [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
    let start: [number, number] | null = null;
    let current: [number, number] | null = null;
    let subpathCurved = false;
    const segment = (end: [number, number]) => {
        if (current && (near(current[0], end[0]) || near(current[1], end[1]))) {
            lines.push({ x1: current[0], y1: current[1], x2: end[0], y2: end[1], color, width });
        } else if (current) subpathCurved = true;
        current = end;
        points.push(end);
    };
    for (let index = 0; index < data.length;) {
        const op = data[index++];
        if (op === 0) {
            points = [];
            subpathCurved = false;
            current = start = point(data[index++], data[index++]);
            points.push(current);
        } else if (op === 1) segment(point(data[index++], data[index++]));
        else if (op === 4) {
            if (start) segment(start);
            const xs = coordinates(points.map(p => p[0]));
            const ys = coordinates(points.map(p => p[1]));
            if (!subpathCurved && xs.length === 2 && ys.length === 2 && points.length === 5) {
                rectangles.push({ left: xs[0], right: xs[1], top: ys[0], bottom: ys[1] });
            }
        }
        else if (op === 2 || op === 3) {
            subpathCurved = true;
            index += op === 2 ? 6 : 4;
            current = point(data[index - 2], data[index - 1]);
        } else return { lines: [], rectangles: [] };
    }
        return {
            lines: lines.filter(line => Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > 3),
            rectangles,
        };
}

function covers(lines: PdfTableLine[], vertical: boolean, position: number, start: number, end: number): PdfTableLine | null {
    const matches = lines.filter(line => vertical
        ? near(line.x1, line.x2) && near(line.x1, position)
        : near(line.y1, line.y2) && near(line.y1, position));
    const intervals = matches.map(line => ({
        line, start: Math.min(vertical ? line.y1 : line.x1, vertical ? line.y2 : line.x2),
        end: Math.max(vertical ? line.y1 : line.x1, vertical ? line.y2 : line.x2),
    })).sort((a, b) => a.start - b.start);
    let cursor = start;
    let result: PdfTableLine | null = null;
    for (const interval of intervals) {
        if (interval.start > cursor + tolerance || interval.end < cursor - tolerance) continue;
        result ??= interval.line;
        cursor = Math.max(cursor, interval.end);
        if (cursor >= end - tolerance) return result;
    }
    return null;
}

function gridFromLines(group: PdfTableLine[]): PdfTableGrid | null {
    const xs = coordinates(group.filter(line => near(line.x1, line.x2)).map(line => line.x1));
    const ys = coordinates(group.filter(line => near(line.y1, line.y2)).map(line => line.y1));
    if (xs.length < 2 || ys.length < 2 || (xs.length - 1) * (ys.length - 1) < 2) return null;
    const left = xs[0], right = xs.at(-1)!, top = ys[0], bottom = ys.at(-1)!;
    if (right - left < 30 || bottom - top < 12) return null;
    if (!covers(group, true, left, top, bottom) || !covers(group, true, right, top, bottom) ||
        !covers(group, false, top, left, right) || !covers(group, false, bottom, left, right)) return null;
    return { xs, ys, lines: group };
}

function splitByGap(group: PdfTableLine[], axis: 'x' | 'y'): PdfTableLine[][] {
    const vertical = axis === 'x';
    const positions = coordinates(group
        .filter(line => vertical ? near(line.x1, line.x2) : near(line.y1, line.y2))
        .map(line => vertical ? (line.x1 + line.x2) / 2 : (line.y1 + line.y2) / 2));
    let best = 0;
    let at = -1;
    for (let index = 1; index < positions.length; index++) {
        const gap = positions[index] - positions[index - 1];
        if (gap > best) {
            best = gap;
            at = index;
        }
    }
    if (best < 16 || at < 0) return [];
    const middle = (positions[at - 1] + positions[at]) / 2;
    const before = group.filter(line => (vertical ? Math.max(line.x1, line.x2) : Math.max(line.y1, line.y2)) < middle);
    const after = group.filter(line => (vertical ? Math.min(line.x1, line.x2) : Math.min(line.y1, line.y2)) > middle);
    return before.length >= 4 && after.length >= 4 ? [before, after] : [];
}

function collectPdfTables(lines: PdfTableLine[], depth = 0): PdfTableGrid[] {
    const connected = (a: PdfTableLine, b: PdfTableLine) =>
        Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)) <= Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) + tolerance &&
        Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)) <= Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) + tolerance;
    const remaining = new Set(lines);
    const tables: PdfTableGrid[] = [];
    const rejected: PdfTableLine[][] = [];
    while (remaining.size) {
        const first = remaining.values().next().value!;
        remaining.delete(first);
        const group = [first];
        for (let index = 0; index < group.length; index++) {
            const pool = [...remaining];
            for (const line of pool) {
                if (remaining.has(line) && connected(group[index], line)) {
                    remaining.delete(line);
                    group.push(line);
                }
            }
        }
        const grid = gridFromLines(group);
        if (grid) tables.push(grid);
        else if (depth < 6) rejected.push(group);
    }
    for (const group of rejected) {
        const parts = splitByGap(group, 'y');
        const pieces = parts.length ? parts : splitByGap(group, 'x');
        for (const piece of pieces) tables.push(...collectPdfTables(piece, depth + 1));
    }
    return tables;
}

export function detectPdfTables(lines: PdfTableLine[]): PdfTableGrid[] {
    if (lines.length > 5000) throw new Error('This PDF page has too many vector edges to safely detect editable tables.');
    return collectPdfTables(lines);
}

function sampledCellColor(
    background: (x: number, y: number) => string,
    left: number, right: number, top: number, bottom: number,
): string {
    const samples: string[] = [];
    for (const x of [0.2, 0.5, 0.8]) {
        for (const y of [0.35, 0.65]) {
            samples.push(background(left + (right - left) * x, top + (bottom - top) * y).toLowerCase());
        }
    }
    const counts = new Map<string, number>();
    for (const sample of samples) {
        if (paintIsWhite(sample)) continue;
        counts.set(sample, (counts.get(sample) ?? 0) + 1);
    }
    let best = '';
    let count = 0;
    for (const [color, votes] of counts) if (votes > count) { best = color; count = votes; }
    if (best && count >= 2) return best;
    const all = new Map<string, number>();
    for (const sample of samples) all.set(sample, (all.get(sample) ?? 0) + 1);
    let common = samples[0] ?? '#ffffff';
    let commonCount = 0;
    for (const [color, votes] of all) if (votes > commonCount) { common = color; commonCount = votes; }
    return common;
}

function samePaint(a: string, b: string): boolean {
    const channels = (color: string) => {
        const match = color.trim().toLowerCase().match(/^#([0-9a-f]{6})$/);
        if (!match) return null;
        return [0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16));
    };
    const left = channels(a);
    const right = channels(b);
    if (!left || !right) return a.toLowerCase() === b.toLowerCase();
    return left.every((channel, index) => Math.abs(channel - right[index]) <= 18);
}

function contrastText(color: string): string {
    const match = color.trim().toLowerCase().match(/^#([0-9a-f]{6})$/);
    if (!match) return '#111111';
    const [red, green, blue] = [0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16));
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    return luminance < 0.55 ? '#ffffff' : '#111111';
}

function fragmentsInBand(fragments: PdfTextFragment[], left: number, right: number, top: number, bottom: number) {
    return fragments.filter((fragment) => {
        const x = (fragment.element.x ?? 0) / 100 * PRINT_LAYOUT_WIDTH;
        const y = (fragment.element.y ?? 0) + (fragment.element.height ?? fragment.element.font_size ?? 0) / 2;
        return x >= left - tolerance && x <= right + tolerance && y >= top - tolerance && y <= bottom + tolerance;
    });
}

function bandTextColor(fragments: PdfTextFragment[], left: number, right: number, top: number, bottom: number, fallback: string) {
    const counts = new Map<string, number>();
    for (const fragment of fragmentsInBand(fragments, left, right, top, bottom)) {
        const color = (fragment.element.color || '').toLowerCase();
        if (!color) continue;
        counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    let best = '';
    let count = 0;
    for (const [color, votes] of counts) if (votes > count) { best = color; count = votes; }
    return best || fallback;
}

/** A footer is a colored last row that does not match the rows above it. */
function footerBandColor(
    background: (x: number, y: number) => string,
    left: number, right: number, top: number, bottom: number, bodyTop: number, bodyBottom: number,
): string | null {
    const footer = sampledCellColor(background, left, right, top, bottom);
    if (paintIsWhite(footer) || bodyBottom - bodyTop < 4) return null;
    const body = sampledCellColor(background, left, right, bodyTop, bodyBottom);
    return samePaint(footer, body) ? null : footer;
}

function colorBand(
    base: LayoutElement, left: number, right: number, top: number, bottom: number, backgroundColor: string, textColor: string,
): LayoutElement {
    const height = Math.max(10, bottom - top);
    return {
        ...base,
        id: `pdf-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`,
        type: 'table',
        pdf_background: false,
        pdf_font_src: undefined,
        pdf_font_name: undefined,
        x: left / PRINT_LAYOUT_WIDTH * 100,
        y: top,
        width: (right - left) / PRINT_LAYOUT_WIDTH * 100,
        height,
        cells: [['']],
        header_row: true,
        label_bg: backgroundColor,
        header_color: textColor,
        column_widths: [100],
        row_heights: [height],
        border: paintIsWhite(backgroundColor),
        border_color: '#cbd5e1',
        table_background: '#ffffff',
        text_case: 'original',
        line_height: 1,
    };
}

export type PdfTableColorImport = {
    bands: LayoutElement[];
    /** Full table rectangles, in the same units as a layout table, so the original grid can be cleared. */
    bounds: Array<Pick<LayoutElement, 'x' | 'y' | 'width' | 'height'>>;
    remaining: PdfTextFragment[];
};

/**
 * Keep each detected table's header color, and its footer color when the last row is its own band.
 * Column and row structure stays out so the layout can be built by hand.
 */
export function pdfTableColorBands(
    grids: PdfTableGrid[], fragments: PdfTextFragment[], base: LayoutElement,
    background: (x: number, y: number) => string,
): PdfTableColorImport {
    const used = new Set<PdfTextFragment>();
    const bands: LayoutElement[] = [];
    const bounds: PdfTableColorImport['bounds'] = [];
    for (const { xs, ys } of grids) {
        const left = xs[0];
        const right = xs.at(-1)!;
        const top = ys[0];
        const bottom = ys.at(-1)!;
        bounds.push({
            x: left / PRINT_LAYOUT_WIDTH * 100,
            y: top,
            width: (right - left) / PRINT_LAYOUT_WIDTH * 100,
            height: bottom - top,
        });
        for (const fragment of fragmentsInBand(fragments, left, right, top, bottom)) used.add(fragment);
        const rowCount = ys.length - 1;
        const headerBottom = rowCount > 1 ? ys[1] : (bottom - top <= 48 ? bottom : top + Math.min(36, (bottom - top) * 0.18));
        const headerBackground = sampledCellColor(background, left, right, top, headerBottom);
        if (rowCount > 1 || !paintIsWhite(headerBackground)) {
            bands.push(colorBand(
                base, left, right, top, headerBottom, headerBackground,
                bandTextColor(fragments, left, right, top, headerBottom, contrastText(headerBackground)),
            ));
        }
        const footerTop = rowCount > 1 ? ys[ys.length - 2] : bottom - Math.min(36, (bottom - top) * 0.18);
        const footerBackground = footerTop > headerBottom
            ? footerBandColor(background, left, right, footerTop, bottom, headerBottom, footerTop)
            : null;
        if (footerBackground) {
            bands.push(colorBand(
                base, left, right, footerTop, bottom, footerBackground,
                bandTextColor(fragments, left, right, footerTop, bottom, contrastText(footerBackground)),
            ));
        }
    }
    return { bands, bounds, remaining: fragments.filter((fragment) => !used.has(fragment)) };
}
