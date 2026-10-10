export type LayoutTableSource = {
    id: string;
    type: string;
    cells?: string[][] | null;
    columns?: number;
    items?: Array<{ label: string; value: string }>;
};

export function layoutTableDimensions(table: LayoutTableSource) {
    const pairs = Math.min(3, Math.max(1, table.columns ?? 2));
    return table.cells
        ? { rows: table.cells.length, columns: table.cells[0]?.length ?? 0 }
        : { rows: Math.ceil((table.items?.length ?? 0) / pairs), columns: pairs * 2 };
}

export function layoutTableCell(table: LayoutTableSource, row: number, column: number): string | null {
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 1 || column < 1) return null;
    if (table.cells) return table.cells[row - 1]?.[column - 1] ?? null;
    const pairs = Math.min(3, Math.max(1, table.columns ?? 2));
    if (column > pairs * 2) return null;
    const item = table.items?.[(row - 1) * pairs + Math.floor((column - 1) / 2)];
    return item ? column % 2 === 1 ? item.label : item.value : null;
}

export function layoutTableField(tableId: string, row: number, column: number) {
    return `{{table_cell:${tableId}:${row}:${column}}}`;
}

export function resolveLayoutTableFields(text: string, elements: LayoutTableSource[]): string {
    return text.replace(/\{\{\s*table_cell:([A-Za-z0-9_-]+):(\d+):(\d+)\s*\}\}/g,
        (_token, id: string, row: string, column: string) => {
            const table = elements.find((element) => element.id === id && element.type === 'table');
            const value = table ? layoutTableCell(table, Number(row), Number(column)) : null;
            return value ?? '[Missing table cell]';
        });
}
