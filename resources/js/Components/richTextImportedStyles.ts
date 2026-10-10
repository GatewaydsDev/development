import { Extension, mergeAttributes, Node } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import '@tiptap/extension-text-style';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { loadPdfFont, pdfFontFamily } from '@/lib/printLayoutPdf';
import { toast } from 'sonner';

const textStyleAttributes = {
    fontSize: 'font-size',
    fontFamily: 'font-family',
    fontSynthesis: 'font-synthesis',
    textTransform: 'text-transform',
    backgroundColor: 'background-color',
    lineHeight: 'line-height',
    letterSpacing: 'letter-spacing',
    opacity: 'opacity',
} as const;

const blockStyleAttributes = {
    ...textStyleAttributes,
    color: 'color',
    background: 'background',
    marginTop: 'margin-top',
    marginRight: 'margin-right',
    marginBottom: 'margin-bottom',
    marginLeft: 'margin-left',
    paddingTop: 'padding-top',
    paddingRight: 'padding-right',
    paddingBottom: 'padding-bottom',
    paddingLeft: 'padding-left',
    textIndent: 'text-indent',
    textTransform: 'text-transform',
    whiteSpace: 'white-space',
    border: 'border',
    borderTop: 'border-top',
    borderRight: 'border-right',
    borderBottom: 'border-bottom',
    borderLeft: 'border-left',
} as const;

function styleAttributes(map: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(map).map(([name, cssProperty]) => [
            name,
            {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    element.style.getPropertyValue(cssProperty) || null,
                renderHTML: (attributes: Record<string, string | null>) =>
                    attributes[name]
                        ? { style: `${cssProperty}: ${attributes[name]}` }
                        : {},
            },
        ]),
    );
}

const ROW_RESIZE_EDGE = 6;
const COLUMN_RESIZE_EDGE = 8;
const MIN_ROW_HEIGHT = 32;

function columnWidths(element: HTMLElement): number[] | null {
    const fromAttribute = element.getAttribute('colwidth');

    if (fromAttribute) {
        const values = fromAttribute
            .split(',')
            .map((value) => Number.parseFloat(value))
            .filter((value) => Number.isFinite(value) && value >= 0);

        if (values.length > 0) {
            return values;
        }
    }

    const width = Number.parseFloat(element.style.width);
    const colspan = Math.max(1, Number(element.getAttribute('colspan')) || 1);

    return Number.isFinite(width) && width > 0
        ? Array.from({ length: colspan }, () => width / colspan)
        : null;
}

export function selectedTableColumn(view: EditorView) {
    const selection = view.state.selection;
    const resolved = selection instanceof CellSelection ? selection.$headCell : selection.$from;
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
        if (resolved.node(depth).type.name !== 'table') continue;
        if (!(selection instanceof CellSelection) && resolved.depth < depth + 1) return null;
        const table = resolved.node(depth);
        const tablePos = resolved.before(depth);
        const cellPos = selection instanceof CellSelection ? selection.$headCell.pos : resolved.before(depth + 2);
        const map = TableMap.get(table);
        const column = map.findCell(cellPos - tablePos - 1).left;
        const cell = view.state.doc.nodeAt(cellPos);
        if (!cell || !['tableCell', 'tableHeader'].includes(cell.type.name)) return null;
        const element = view.nodeDOM(cellPos);
        const measured = element instanceof HTMLElement ? element.offsetWidth / (cell?.attrs.colspan || 1) : 48;
        return { tablePos, column, width: cell?.attrs.colwidth?.[0] || Math.round(measured) };
    }
    return null;
}

export function resizeTableColumn(view: EditorView, tablePos: number, column: number, width: number): boolean {
    const table = view.state.doc.nodeAt(tablePos);
    if (!table || table.type.name !== 'table' || !Number.isFinite(width) || width < 48 || width > 4000) return false;
    const map = TableMap.get(table);
    if (column < 0 || column >= map.width) return false;
    const transaction = view.state.tr;
    const visited = new Set<number>();
    for (let row = 0; row < map.height; row += 1) {
        const offset = map.map[row * map.width + column];
        if (visited.has(offset)) continue;
        visited.add(offset);
        const cell = table.nodeAt(offset);
        if (!cell) continue;
        const widths: number[] = cell.attrs.colwidth
            ? [...cell.attrs.colwidth]
            : Array.from({ length: cell.attrs.colspan }, () => 0);
        widths[column - map.findCell(offset).left] = Math.round(width);
        transaction.setNodeMarkup(tablePos + 1 + offset, undefined, { ...cell.attrs, colwidth: widths });
    }
    view.dispatch(transaction);
    return true;
}

function columnWidthAttribute(existing: Record<string, unknown> | undefined) {
    return {
        ...existing,
        parseHTML: (element: HTMLElement) => columnWidths(element),
        renderHTML: (attributes: { colwidth?: number[] | null }) => {
            const widths = attributes.colwidth;

            if (!widths?.length) {
                return {};
            }

            return {
                colwidth: widths.join(','),
                ...(widths.every((width) => width > 0)
                    ? { style: `width: ${widths.reduce((sum, width) => sum + width, 0)}px` }
                    : {}),
            };
        },
    };
}

function tableRowFromEvent(view: EditorView, event: MouseEvent) {
    const target = event.target;

    if (!(target instanceof Element)) {
        return null;
    }

    const cell = target.closest('td, th');

    if (!(cell instanceof HTMLElement) || !view.dom.contains(cell)) {
        return null;
    }

    const rect = cell.getBoundingClientRect();
    const nearBottom = rect.bottom - event.clientY <= ROW_RESIZE_EDGE && event.clientY >= rect.top;
    const nearRight = rect.right - event.clientX <= COLUMN_RESIZE_EDGE;

    if (!nearBottom || nearRight) {
        return null;
    }

    const position = view.posAtDOM(cell, 0);
    const resolved = view.state.doc.resolve(position);

    for (let depth = resolved.depth; depth > 0; depth -= 1) {
        if (resolved.node(depth).type.name === 'tableRow') {
            return {
                cell,
                pos: resolved.before(depth),
                height: cell.parentElement?.getBoundingClientRect().height ?? MIN_ROW_HEIGHT,
            };
        }
    }

    return null;
}

const cellColorAttributes = {
    ...styleAttributes({
        borderTop: 'border-top',
        borderRight: 'border-right',
        borderBottom: 'border-bottom',
        borderLeft: 'border-left',
        fontWeight: 'font-weight',
        paddingTop: 'padding-top',
        paddingRight: 'padding-right',
        paddingBottom: 'padding-bottom',
        paddingLeft: 'padding-left',
        verticalAlign: 'vertical-align',
    }),
    backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) =>
            element.style.backgroundColor || null,
        renderHTML: (attributes: { backgroundColor?: string | null }) =>
            attributes.backgroundColor
                ? { style: `background-color: ${attributes.backgroundColor}` }
                : {},
    },
    color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.color || null,
        renderHTML: (attributes: { color?: string | null }) =>
            attributes.color ? { style: `color: ${attributes.color}` } : {},
    },
    border: {
        default: null,
        parseHTML: (element: HTMLElement) =>
            element.style.border || null,
        renderHTML: (attributes: { border?: string | null }) =>
            attributes.border ? { style: `border: ${attributes.border}` } : {},
    },
};

export const ImportedTextStyles = Extension.create({
    name: 'importedTextStyles',
    addGlobalAttributes() {
        return [
            {
                types: ['textStyle'],
                attributes: {
                    ...styleAttributes(textStyleAttributes),
                    textCase: {
                        default: null,
                        parseHTML: (element: HTMLElement) => element.getAttribute('data-text-case'),
                        renderHTML: (attributes: { textCase?: string }) =>
                            ['original', 'camel', 'uppercase', 'lowercase'].includes(attributes.textCase ?? '')
                                ? { 'data-text-case': attributes.textCase } : {},
                    },
                },
            },
        ];
    },
});

export const ImportedBlockStyles = Extension.create({
    name: 'importedBlockStyles',
    addGlobalAttributes() {
        return [
            {
                types: ['bulletList', 'orderedList'],
                attributes: styleAttributes({
                    listStyleType: 'list-style-type',
                    marginTop: 'margin-top',
                    marginRight: 'margin-right',
                    marginBottom: 'margin-bottom',
                    marginLeft: 'margin-left',
                    paddingLeft: 'padding-left',
                }),
            },
            {
                types: ['paragraph', 'heading', 'blockquote', 'listItem'],
                attributes: {
                    ...styleAttributes(blockStyleAttributes),
                    editorTextCase: {
                        default: 'original',
                        parseHTML: (element: HTMLElement) => element.getAttribute('data-editor-text-case') || 'original',
                        renderHTML: (attributes: { editorTextCase?: string }) =>
                            ['camel', 'uppercase', 'lowercase'].includes(attributes.editorTextCase ?? '')
                                ? { 'data-editor-text-case': attributes.editorTextCase }
                                : {},
                    },
                    pdfFontSrc: {
                        default: null,
                        parseHTML: (element: HTMLElement) => {
                            const src = element.getAttribute('data-pdf-font-src');
                            if (!src || !pdfFontFamily(src)) return null;
                            void loadPdfFont(src).catch(() => toast.error('An imported font could not be loaded. Restore its font asset or choose another font.'));
                            return src;
                        },
                        renderHTML: (attributes: { pdfFontSrc?: string }) => attributes.pdfFontSrc && pdfFontFamily(attributes.pdfFontSrc)
                            ? { 'data-pdf-font-src': attributes.pdfFontSrc } : {},
                    },
                },
            },
        ];
    },
});

export const StyledHorizontalRule = HorizontalRule.extend({
    addAttributes() {
        return {
            ...styleAttributes({ marginTop: 'margin-top', marginBottom: 'margin-bottom' }),
            color: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    const color =
                        element.style.borderTopColor ||
                        element.style.borderColor;

                    if (color && color !== 'rgba(0, 0, 0, 0)') {
                        return color;
                    }

                    const match = element
                        .getAttribute('style')
                        ?.match(/#(?:[0-9a-f]{3,8})\b/i);

                    return match?.[0] ?? null;
                },
                renderHTML: (attributes: {
                    color?: string | null;
                    thickness?: string | null;
                }) => {
                    if (!attributes.color && !attributes.thickness) {
                        return {};
                    }

                    const color = attributes.color || 'currentColor';
                    const thickness = attributes.thickness || '3px';

                    return {
                        style: `border: none; border-top: ${thickness} solid ${color}; height: 0; background: none;`,
                    };
                },
            },
            thickness: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    element.style.borderTopWidth || null,
                renderHTML: () => ({}),
            },
        };
    },
});

export const StyledTableHeader = TableHeader.extend({
    addAttributes() {
        const parent = (this.parent?.() ?? {}) as {
            colwidth?: Record<string, unknown>;
        };

        return {
            ...parent,
            colwidth: columnWidthAttribute(parent.colwidth),
            ...cellColorAttributes,
        };
    },
    renderHTML({ HTMLAttributes }) {
        return [
            'th',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
            0,
        ];
    },
});

export const StyledTableCell = TableCell.extend({
    addAttributes() {
        const parent = (this.parent?.() ?? {}) as {
            colwidth?: Record<string, unknown>;
        };

        return {
            ...parent,
            colwidth: columnWidthAttribute(parent.colwidth),
            ...cellColorAttributes,
        };
    },
    renderHTML({ HTMLAttributes }) {
        return [
            'td',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
            0,
        ];
    },
});

export const ColoredSection = Node.create({
    name: 'coloredSection',
    group: 'block',
    content: 'block+',
    defining: true,

    addAttributes() {
        return {
            backgroundColor: {
                default: '#1F4E79',
                parseHTML: (element: HTMLElement) =>
                    element.style.backgroundColor || null,
            },
            color: {
                default: '#FFFFFF',
                parseHTML: (element: HTMLElement) => element.style.color || null,
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-colored-section]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
        const background = node.attrs.backgroundColor || '#1F4E79';
        const text = node.attrs.color || '#FFFFFF';

        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-colored-section': 'true',
                style: `background-color: ${background}; color: ${text}; padding: 12px 14px; margin: 12px 0;`,
            }),
            0,
        ];
    },
});

export const StyledTableRow = TableRow.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            height: {
                default: null,
                parseHTML: (element: HTMLElement) => element.style.height || null,
                renderHTML: (attributes: { height?: string | null }) =>
                    attributes.height ? { style: `height: ${attributes.height}` } : {},
            },
        };
    },
});

export const TableRowResize = Extension.create({
    name: 'tableRowResize',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('tableRowResize'),
                props: {
                    handleDOMEvents: {
                        mousemove(view, event) {
                            if (rowDrag) {
                                return false;
                            }

                            view.dom.classList.toggle(
                                'row-resize-cursor',
                                tableRowFromEvent(view, event) !== null,
                            );

                            return false;
                        },
                        mouseleave(view) {
                            if (!rowDrag) {
                                view.dom.classList.remove('row-resize-cursor');
                            }

                            return false;
                        },
                        mousedown(view, event) {
                            const row = tableRowFromEvent(view, event);

                            if (!row || event.button !== 0) {
                                return false;
                            }

                            event.preventDefault();
                            const startY = event.clientY;
                            const startHeight = row.height;
                            const rowPos = row.pos;
                            const rowElement = row.cell.parentElement;
                            let nextHeight = Math.round(startHeight);
                            rowDrag = true;
                            view.dom.classList.add('row-resize-cursor');

                            const paint = (height: number) => {
                                if (!(rowElement instanceof HTMLElement)) {
                                    return;
                                }

                                rowElement.style.height = `${height}px`;
                                Array.from(rowElement.children).forEach((child) => {
                                    if (child instanceof HTMLElement) {
                                        child.style.height = `${height}px`;
                                    }
                                });
                            };

                            const onMove = (moveEvent: MouseEvent) => {
                                nextHeight = Math.max(
                                    MIN_ROW_HEIGHT,
                                    Math.round(startHeight + moveEvent.clientY - startY),
                                );
                                paint(nextHeight);
                            };

                            const onUp = () => {
                                rowDrag = false;
                                view.dom.classList.remove('row-resize-cursor');
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);

                                const current = view.state.doc.nodeAt(rowPos);

                                if (!current || current.type.name !== 'tableRow') {
                                    return;
                                }

                                view.dispatch(view.state.tr.setNodeMarkup(rowPos, undefined, {
                                    ...current.attrs,
                                    height: `${nextHeight}px`,
                                }));
                            };

                            window.addEventListener('mousemove', onMove);
                            window.addEventListener('mouseup', onUp);

                            return true;
                        },
                    },
                },
            }),
        ];
    },
});

let rowDrag = false;

export const richTextLayoutExtensions = [
    Extension.create({
        name: 'tableColumnSelectors',
        addProseMirrorPlugins() {
            return [new Plugin({
                props: {
                    decorations(state) {
                        const widgets: Decoration[] = [];
                        state.doc.descendants((table, pos) => {
                            if (table.type.name !== 'table') return;
                            const map = TableMap.get(table);
                            for (let column = 0; column < map.width; column++) {
                                const first = pos + 1 + map.map[column];
                                const last = pos + 1 + map.map[(map.height - 1) * map.width + column];
                                widgets.push(Decoration.widget(first + 1, (view) => {
                                    const button = document.createElement('button');
                                    button.type = 'button';
                                    button.className = 'table-column-selector';
                                    button.setAttribute('aria-label', `Select column ${column + 1}`);
                                    button.title = `Select all cells in column ${column + 1}`;
                                    button.addEventListener('mousedown', (event) => event.preventDefault());
                                    button.addEventListener('click', (event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        view.dispatch(view.state.tr.setSelection(CellSelection.colSelection(
                                            view.state.doc.resolve(first), view.state.doc.resolve(last),
                                        )));
                                        view.focus();
                                    });
                                    return button;
                                }, { key: `column-${pos}-${column}-${last}`, stopEvent: () => true }));
                            }
                        });
                        return DecorationSet.create(state.doc, widgets);
                    },
                },
            })];
        },
    }),
    ColoredSection,
    StyledHorizontalRule,
    Table.configure({
        resizable: true,
        handleWidth: 6,
        cellMinWidth: 48,
        lastColumnResizable: true,
        HTMLAttributes: {
            class: 'rich-text-table',
        },
    }),
    StyledTableRow,
    StyledTableHeader,
    StyledTableCell,
    TableRowResize,
];
