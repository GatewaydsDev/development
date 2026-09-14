import { Extension, mergeAttributes } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import '@tiptap/extension-text-style';

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
        return {
            ...this.parent?.(),
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
        return {
            ...this.parent?.(),
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

export const richTextLayoutExtensions = [
    StyledHorizontalRule,
    Table.configure({
        resizable: false,
        HTMLAttributes: {
            class: 'rich-text-table',
        },
    }),
    TableRow,
    StyledTableHeader,
    StyledTableCell,
];
