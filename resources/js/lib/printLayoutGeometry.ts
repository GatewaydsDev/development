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

export function tableEdgeBorder(
    element: TableStriping & { border?: boolean; border_color?: string },
    row: number,
    column: number,
    side: (typeof tableBorderSides)[number],
): string {
    const own = element.cell_borders?.[row]?.[column]?.[side];
    if (own && own !== 'none') return own;
    if (element.border === false) return 'none';
    for (const borders of element.cell_borders ?? []) {
        for (const cell of borders ?? []) {
            for (const edge of tableBorderSides) {
                const value = cell?.[edge];
                if (value && value !== 'none') return value;
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
    if (!element.stripe_direction || element.stripe_direction === 'none') return element.cell_backgrounds?.[sourceRow]?.[column] || element.table_background || undefined;
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
