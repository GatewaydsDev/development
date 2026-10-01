import { Extension, mergeAttributes, Node } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import '@tiptap/extension-text-style';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const textStyleAttributes = {
    fontSize: 'font-size',
    fontFamily: 'font-family',
    backgroundColor: 'background-color',
    lineHeight: 'line-height',
    letterSpacing: 'letter-spacing',
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
            .map((value) => Number.parseInt(value, 10))
            .filter((value) => Number.isFinite(value) && value > 0);

        if (values.length > 0) {
            return values;
        }
    }

    const width = Number.parseInt(element.style.width, 10);

    return Number.isFinite(width) && width > 0 ? [width] : null;
}

function columnWidthAttribute(existing: Record<string, unknown> | undefined) {
    return {
        ...existing,
        parseHTML: (element: HTMLElement) => columnWidths(element),
        renderHTML: (attributes: { colwidth?: number[] | null }) => {
            const width = attributes.colwidth?.[0];

            if (!width) {
                return {};
            }

            return { style: `width: ${Math.round(width)}px` };
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
};

export const ImportedTextStyles = Extension.create({
    name: 'importedTextStyles',
    addGlobalAttributes() {
        return [
            {
                types: ['textStyle'],
                attributes: styleAttributes(textStyleAttributes),
            },
        ];
    },
});

export const ImportedBlockStyles = Extension.create({
    name: 'importedBlockStyles',
    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading', 'blockquote', 'listItem'],
                attributes: styleAttributes(blockStyleAttributes),
            },
        ];
    },
});

export const StyledHorizontalRule = HorizontalRule.extend({
    addAttributes() {
        return {
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
