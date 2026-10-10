import type { LayoutElement } from '@/Pages/Admin/DocumentSettings/LayoutElements';
import type { PdfTextFragment, PdfTextRegion } from './pdfTextBlocks';
import { PRINT_LAYOUT_WIDTH, type TableTextStyle } from './printLayoutGeometry';

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
    let curved = false;
    let subpathCurved = false;
    const segment = (end: [number, number]) => {
        if (current && (near(current[0], end[0]) || near(current[1], end[1]))) {
            lines.push({ x1: current[0], y1: current[1], x2: end[0], y2: end[1], color, width });
        } else if (current) curved = subpathCurved = true;
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
            curved = subpathCurved = true;
            index += op === 2 ? 6 : 4;
            current = point(data[index - 2], data[index - 1]);
        } else return { lines: [], rectangles: [] };
    }
    return { lines: curved ? [] : lines.filter(line => Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > 3), rectangles };
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

export function detectPdfTables(lines: PdfTableLine[]): PdfTableGrid[] {
    if (lines.length > 5000) throw new Error('This PDF page has too many vector edges to safely detect editable tables.');
    const connected = (a: PdfTableLine, b: PdfTableLine) =>
        Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)) <= Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) + tolerance &&
        Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)) <= Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) + tolerance;
    const remaining = new Set(lines);
    const tables: PdfTableGrid[] = [];
    while (remaining.size) {
        const first = remaining.values().next().value!;
        remaining.delete(first);
        const group = [first];
        for (let index = 0; index < group.length; index++) {
            for (const line of remaining) {
                if (connected(group[index], line)) { remaining.delete(line); group.push(line); }
            }
        }
        const xs = coordinates(group.filter(line => near(line.x1, line.x2)).map(line => line.x1));
        const ys = coordinates(group.filter(line => near(line.y1, line.y2)).map(line => line.y1));
        if (xs.length < 2 || ys.length < 2 || (xs.length - 1) * (ys.length - 1) < 2) continue;
        const left = xs[0], right = xs.at(-1)!, top = ys[0], bottom = ys.at(-1)!;
        if (right - left < 30 || bottom - top < 12) continue;
        if (!covers(group, true, left, top, bottom) || !covers(group, true, right, top, bottom) ||
            !covers(group, false, top, left, right) || !covers(group, false, bottom, left, right)) continue;
        if (xs.length > 13 || ys.length > 61) {
            throw new Error('A detected PDF table exceeds 12 columns or 60 rows. Split that table in the source PDF before importing.');
        }
        tables.push({ xs, ys, lines: group });
    }
    return tables;
}

export function editablePdfTables(
    grids: PdfTableGrid[], fragments: PdfTextFragment[], base: LayoutElement,
    background: (x: number, y: number) => string,
): { tables: LayoutElement[]; remaining: PdfTextFragment[] } {
    const used = new Set<PdfTextFragment>();
    const tables = grids.map(grid => {
        const { xs, ys, lines } = grid;
        const columns = xs.length - 1, rows = ys.length - 1;
        const cells = Array.from({ length: rows }, () => Array<string>(columns).fill(''));
        const styles = Array.from({ length: rows }, () => Array<TableTextStyle | null>(columns).fill(null));
        const spans = Array.from({ length: rows }, () => Array.from({ length: columns }, () => ({ rows: 0, columns: 0 })));
        const colors = Array.from({ length: rows }, () => Array<string>(columns).fill('#ffffff'));
        const borders = Array.from({ length: rows }, () => Array.from({ length: columns }, () => ({
            top: 'none', right: 'none', bottom: 'none', left: 'none',
        })));
        const assigned = new Set<string>();
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
            const key = (r: number, c: number) => `${r}:${c}`;
            if (assigned.has(key(row, column))) continue;
            const group: Array<[number, number]> = [[row, column]];
            assigned.add(key(row, column));
            for (let index = 0; index < group.length; index++) {
                const [r, c] = group[index];
                const neighbors: Array<[number, number, boolean]> = [
                    [r, c + 1, !covers(lines, true, xs[c + 1], ys[r], ys[r + 1])],
                    [r, c - 1, !covers(lines, true, xs[c], ys[r], ys[r + 1])],
                    [r + 1, c, !covers(lines, false, ys[r + 1], xs[c], xs[c + 1])],
                    [r - 1, c, !covers(lines, false, ys[r], xs[c], xs[c + 1])],
                ];
                for (const [nr, nc, open] of neighbors) {
                    if (!open || nr < 0 || nc < 0 || nr >= rows || nc >= columns || assigned.has(key(nr, nc))) continue;
                    assigned.add(key(nr, nc)); group.push([nr, nc]);
                }
            }
            const bottomRow = Math.max(...group.map(([r]) => r));
            const rightColumn = Math.max(...group.map(([, c]) => c));
            if (group.some(([r, c]) => r < row || c < column) ||
                group.length !== (bottomRow - row + 1) * (rightColumn - column + 1)) {
                throw new Error('A PDF table has an irregular merged cell. Use rectangular cells in the source PDF before importing.');
            }
            spans[row][column] = { rows: bottomRow - row + 1, columns: rightColumn - column + 1 };
            colors[row][column] = background((xs[column] + xs[rightColumn + 1]) / 2, (ys[row] + ys[bottomRow + 1]) / 2);
            const css = (line: PdfTableLine | null) => line && line.width > 0 ? `${Number(Math.max(0.2, line.width).toFixed(3))}px solid ${line.color}` : 'none';
            borders[row][column] = {
                left: css(covers(lines, true, xs[column], ys[row], ys[bottomRow + 1])),
                right: css(covers(lines, true, xs[rightColumn + 1], ys[row], ys[bottomRow + 1])),
                top: css(covers(lines, false, ys[row], xs[column], xs[rightColumn + 1])),
                bottom: css(covers(lines, false, ys[bottomRow + 1], xs[column], xs[rightColumn + 1])),
            };
            const text = fragments.filter(fragment => {
                const x = (fragment.element.x ?? 0) * 7, y = fragment.element.y ?? 0;
                return x >= xs[column] - tolerance && x < xs[rightColumn + 1] - tolerance &&
                    y >= ys[row] - tolerance && y < ys[bottomRow + 1] - tolerance;
            }).sort((a, b) => (a.element.y ?? 0) - (b.element.y ?? 0) || (a.element.x ?? 0) - (b.element.x ?? 0));
            text.forEach(fragment => used.add(fragment));
            const first = text[0]?.element;
            // Imported cell text stays blank; its typography and original line breaks remain editable.
            const lineYs = coordinates(text.map(fragment => fragment.element.y ?? 0));
            cells[row][column] = '\n'.repeat(Math.max(0, lineYs.length - 1));
            const raw = text.map(fragment => fragment.text).join(' ');
            styles[row][column] = {
                font_size: first?.font_size ?? base.font_size, font_family: first?.font_family ?? base.font_family,
                bold: first?.bold ?? false, italic: first?.italic ?? false, color: first?.color ?? '#111111',
                line_height: 1, text_case: raw && raw === raw.toUpperCase() && raw !== raw.toLowerCase() ? 'uppercase'
                    : raw && raw === raw.toLowerCase() && raw !== raw.toUpperCase() ? 'lowercase' : 'original',
            };
        }
        return { ...base, id: `pdf-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`, type: 'table' as const,
            pdf_background: false, pdf_font_src: undefined, pdf_font_name: undefined,
            x: xs[0] / PRINT_LAYOUT_WIDTH * 100, y: ys[0],
            width: (xs.at(-1)! - xs[0]) / PRINT_LAYOUT_WIDTH * 100, height: ys.at(-1)! - ys[0],
            cells, cell_styles: styles, cell_spans: spans, cell_backgrounds: colors, cell_borders: borders,
            column_widths: xs.slice(1).map((x, index) => (x - xs[index]) / (xs.at(-1)! - xs[0]) * 100),
            row_heights: ys.slice(1).map((y, index) => y - ys[index]), border: true, table_background: '#ffffff',
            text_case: 'original' as const, line_height: 1,
        };
    });
    return { tables, remaining: fragments.filter(fragment => !used.has(fragment)) };
}
