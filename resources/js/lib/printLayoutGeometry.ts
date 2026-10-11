export const PRINT_LAYOUT_WIDTH = 700;
export const PRINT_LAYOUT_FONT = 'Arial, Helvetica, sans-serif';

export type TableTextStyle = {
    font_family?: string;
    font_size?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    line_height?: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    text_case?: 'original' | 'camel' | 'uppercase' | 'lowercase';
};

export const TABLE_TEXT_STYLE_KEYS = [
    'font_family', 'font_size', 'color', 'bold', 'italic', 'underline',
    'line_height', 'align', 'text_case',
] as const;

export type TableStriping = {
    cell_backgrounds?: string[][];
    cell_borders?: Array<Array<{ top: string; right: string; bottom: string; left: string }>>;
    cell_spans?: Array<Array<{ rows: number; columns: number }>>;
    row_heights?: number[];
    column_widths?: number[];
    cell_styles?: Array<Array<TableTextStyle | null> | null>;
    row_styles?: Array<TableTextStyle | null>;
    column_colors?: Array<string | null>;
    table_background?: string;
    stripe_direction?: 'none' | 'rows' | 'columns';
    stripe_color_a?: string;
    stripe_color_b?: string;
};

export function layoutColumnWidths(element: TableStriping & { cells?: string[][] | null; columns?: number; label_width?: number }): number[] {
    const count = element.cells?.[0]?.length ?? Math.min(3, element.columns ?? 2) * 2;
    const widths = element.column_widths;
    if (widths?.length === count && widths.every(value => Number.isFinite(value) && value > 0)) {
        const total = widths.reduce((sum, value) => sum + value, 0);
        return widths.map(value => value / total * 100);
    }
    return Array.from({ length: count }, (_, index) => element.cells
        ? 100 / count : (index % 2 === 0 ? element.label_width ?? 30 : 100 - (element.label_width ?? 30)) / (count / 2));
}

export function resizedLayoutColumns(widths: number[], column: number, width: number): number[] {
    const neighbor = column === widths.length - 1 ? column - 1 : column + 1;
    if (neighbor < 0) return widths;
    const total = widths[column] + widths[neighbor];
    const next = [...widths];
    next[column] = Math.max(1, Math.min(total - 1, width));
    next[neighbor] = total - next[column];
    return next;
}

export function tableTextStyle(
    element: TableStriping & Omit<TableTextStyle, 'align' | 'text_case'> & { header_color?: string; align?: string; text_case?: string },
    row: number,
    column: number,
    header = false,
    label = false,
    cellColumn = column,
): TableTextStyle {
    const align = element.align;
    const textCase = element.text_case;
    return {
        font_family: element.font_family,
        font_size: element.font_size,
        underline: element.underline,
        line_height: element.line_height,
        align: align === 'center' || align === 'right' || align === 'justify' ? align : 'left',
        text_case: textCase === 'camel' || textCase === 'uppercase' || textCase === 'lowercase' ? textCase : 'original',
        bold: header || label || element.bold,
        italic: label ? false : element.italic,
        color: element.column_colors?.[column] || (header ? element.header_color || '#ffffff' : element.color),
        ...element.row_styles?.[row],
        ...element.cell_styles?.[row]?.[cellColumn],
    };
}

const tableBorderSides = ['top', 'right', 'bottom', 'left'] as const;
type TableBorderSide = (typeof tableBorderSides)[number];
type CellBorder = { top: string; right: string; bottom: string; left: string };

function hexChannels(color: string): [number, number, number] | null {
    const match = color.trim().match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    if (!match) return null;
    const hex = match[1].length === 3 ? match[1].split('').map(channel => channel + channel).join('') : match[1];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function colorLuminance(color: string): number | null {
    const channels = hexChannels(color);
    if (!channels) return null;
    return (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
}

/** Near-white paints are gaps in a sampled row, not a stripe. Light gray stays distinct. */
export function paintIsWhite(color: string | undefined): boolean {
    const channels = color ? hexChannels(color) : null;
    return !!channels && channels.every(channel => channel >= 250);
}

/** A white stroke disappears on a light cell. The same stroke can still show on a dark header. */
export function borderIsVisible(value: string | undefined, background?: string): boolean {
    if (!value || value === 'none') return false;
    const luminance = colorLuminance(value);
    if (luminance === null || luminance < 0.93) return true;
    const backgroundLuminance = background ? colorLuminance(background) : null;
    return backgroundLuminance !== null && backgroundLuminance < 0.75;
}

function mostCommon(values: string[]): string {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    let best = '';
    let count = 0;
    for (const [value, votes] of counts) if (votes > count) { best = value; count = votes; }
    return best;
}

/**
 * A PDF grid line is often detected on only part of a row or column.
 * Copy the visible stroke across that whole edge so the line does not stop early.
 */
export function completeTableEdges(borders: CellBorder[][], backgrounds?: string[][]): CellBorder[][] {
    const rows = borders.length;
    const columns = borders[0]?.length ?? 0;
    const next = borders.map(row => row.map(cell => ({ ...cell })));
    for (let row = 0; row < rows; row++) {
        for (const side of ['top', 'bottom'] as const) {
            const chosen = mostCommon(next[row].map(cell => borderIsVisible(cell[side]) ? cell[side] : '').filter(Boolean));
            if (!chosen) continue;
            next[row].forEach((cell, column) => {
                if (!borderIsVisible(cell[side], backgrounds?.[row]?.[column])) cell[side] = chosen;
            });
        }
    }
    for (let column = 0; column < columns; column++) {
        for (const side of ['left', 'right'] as const) {
            const chosen = mostCommon(next.map(row => borderIsVisible(row[column]?.[side]) ? row[column][side] : '').filter(Boolean));
            if (!chosen) continue;
            next.forEach((row, rowIndex) => {
                if (row[column] && !borderIsVisible(row[column][side], backgrounds?.[rowIndex]?.[column])) row[column][side] = chosen;
            });
        }
    }
    return next;
}

/**
 * Paint a sampled row so a stripe reaches every column.
 * A balanced label/value pattern (gray, white, gray, white) is left alone.
 * A dark bar with a different accent at the end keeps that accent and fills the gap in between.
 */
export function completeRowBackgrounds(colors: string[][]): string[][] {
    return colors.map(row => {
        const next = [...row];
        const first = next[0];
        const last = next[next.length - 1];
        if (next.length > 2 && first && last && !paintIsWhite(first) && !paintIsWhite(last) && first.toLowerCase() !== last.toLowerCase()) {
            let accent = next.length - 1;
            while (accent > 0 && (next[accent] ?? '').toLowerCase() === last.toLowerCase()) accent -= 1;
            for (let index = 0; index <= accent; index++) {
                if (!next[index] || paintIsWhite(next[index])) next[index] = first;
            }
            return next;
        }
        const colored = next.filter(color => color && !paintIsWhite(color));
        const best = mostCommon(colored.map(color => color.toLowerCase()));
        const bestCount = best ? colored.filter(color => color.toLowerCase() === best).length : 0;
        const whites = next.length - colored.length;
        if (best && bestCount > whites) return next.map(color => !color || paintIsWhite(color) ? best : color);
        return next;
    });
}

export function tableEdgeBorder(
    element: TableStriping & { border?: boolean; border_color?: string },
    row: number,
    column: number,
    side: TableBorderSide,
): string {
    const background = element.cell_backgrounds?.[row]?.[column];
    const borders = element.cell_borders;
    if (borders?.length) {
        const own = completeTableEdges(borders, element.cell_backgrounds)[row]?.[column]?.[side];
        if (borderIsVisible(own, background)) return own!;
    }
    if (element.border === false) return 'none';
    for (const edge of element.cell_borders ?? []) {
        for (const cell of edge ?? []) {
            for (const edgeSide of tableBorderSides) {
                const value = cell?.[edgeSide];
                if (borderIsVisible(value)) return value!;
            }
        }
    }
    return element.border_color ? `1px solid ${element.border_color}` : '0.6px solid #d7dee5';
}

export function tableStripeColor(
    element: TableStriping,
    row: number,
    column: number,
    sourceRow = row,
): string | undefined {
    if (!element.stripe_direction || element.stripe_direction === 'none') {
        const rowColors = element.cell_backgrounds?.[sourceRow];
        if (rowColors?.length) {
            const color = completeRowBackgrounds([rowColors])[0]?.[column];
            if (color) return color;
        }
        return element.table_background || undefined;
    }
    const index = element.stripe_direction === 'columns' ? column : row;
    return index % 2 === 0
        ? element.stripe_color_a || '#ffffff'
        : element.stripe_color_b || '#f3f4f6';
}

export type TextCaseState = { hasWord: boolean; capitalizeNext: boolean };

export function printLayoutTextCase(
    value: string,
    textCase?: string,
    state: TextCaseState = { hasWord: false, capitalizeNext: false },
): string {
    if (textCase === 'uppercase') return value.toUpperCase();
    if (textCase === 'lowercase') return value.toLowerCase();
    if (textCase === 'camel') {
        let result = '';
        for (const character of value) {
            if (character === '\n' || character === '\r') {
                result += character;
                state.hasWord = false;
                state.capitalizeNext = false;
            } else if (/[\s_-]/u.test(character)) {
                state.capitalizeNext = state.hasWord;
            } else {
                result += state.capitalizeNext ? character.toUpperCase() : character.toLowerCase();
                state.capitalizeNext = false;
                state.hasWord = true;
            }
        }
        return result;
    }
    return value;
}

export const PRINT_LAYOUT_FONTS: Record<string, string> = {
    default: PRINT_LAYOUT_FONT,
    helvetica: 'Helvetica, Arial, sans-serif',
    arial: PRINT_LAYOUT_FONT,
    verdana: 'Verdana, Geneva, sans-serif',
    tahoma: 'Tahoma, Geneva, sans-serif',
    trebuchet: '"Trebuchet MS", Helvetica, sans-serif',
    georgia: 'Georgia, serif',
    times: '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace',
    geist: '"Geist Variable", Arial, sans-serif',
    calibri: 'Calibri, Candara, Arial, sans-serif',
    aptos: 'Aptos, Calibri, Arial, sans-serif',
    segoe: '"Segoe UI", Tahoma, Arial, sans-serif',
    century_gothic: '"Century Gothic", "Apple Gothic", Arial, sans-serif',
    lucida_sans: '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
    arial_narrow: '"Arial Narrow", Arial, sans-serif',
    cambria: 'Cambria, Georgia, serif',
    palatino: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
    garamond: 'Garamond, "Baskerville Old Face", "Times New Roman", serif',
    baskerville: 'Baskerville, "Baskerville Old Face", Georgia, serif',
    bookman: '"Bookman Old Style", "URW Bookman", Georgia, serif',
    consolas: 'Consolas, "Courier New", monospace',
    menlo: 'Menlo, Monaco, Consolas, monospace',
    lucida_console: '"Lucida Console", Monaco, monospace',
    impact: 'Impact, "Arial Black", sans-serif',
    arial_black: '"Arial Black", Arial, sans-serif',
    comic_sans: '"Comic Sans MS", "Comic Sans", cursive',
};

export const PRINT_LAYOUT_FONT_CHOICES = [
    { id: 'default', label: 'Default' },
    { id: 'geist', label: 'Geist' },
    { id: 'helvetica', label: 'Helvetica' },
    { id: 'arial', label: 'Arial' },
    { id: 'arial_narrow', label: 'Arial Narrow' },
    { id: 'arial_black', label: 'Arial Black' },
    { id: 'aptos', label: 'Aptos' },
    { id: 'calibri', label: 'Calibri' },
    { id: 'segoe', label: 'Segoe UI' },
    { id: 'century_gothic', label: 'Century Gothic' },
    { id: 'lucida_sans', label: 'Lucida Sans' },
    { id: 'verdana', label: 'Verdana' },
    { id: 'tahoma', label: 'Tahoma' },
    { id: 'trebuchet', label: 'Trebuchet MS' },
    { id: 'georgia', label: 'Georgia' },
    { id: 'times', label: 'Times New Roman' },
    { id: 'cambria', label: 'Cambria' },
    { id: 'palatino', label: 'Palatino' },
    { id: 'garamond', label: 'Garamond' },
    { id: 'baskerville', label: 'Baskerville' },
    { id: 'bookman', label: 'Bookman Old Style' },
    { id: 'courier', label: 'Courier New' },
    { id: 'consolas', label: 'Consolas' },
    { id: 'menlo', label: 'Menlo' },
    { id: 'lucida_console', label: 'Lucida Console' },
    { id: 'impact', label: 'Impact' },
    { id: 'comic_sans', label: 'Comic Sans MS' },
].map((choice) => ({ ...choice, stack: PRINT_LAYOUT_FONTS[choice.id] }));
