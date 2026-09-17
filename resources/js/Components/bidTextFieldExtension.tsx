import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
    NodeViewWrapper,
    ReactNodeViewRenderer,
    type NodeViewProps,
} from '@tiptap/react';
import { cn } from '@/lib/utils';
import { createContext, useContext } from 'react';

export const BidTextFieldValuesContext = createContext<Record<string, string>>(
    {},
);

function BidTextFieldChip({ node }: NodeViewProps) {
    const values = useContext(BidTextFieldValuesContext);
    const key = String(node.attrs.key ?? '');
    const value = (values[key] ?? '').trim();

    return (
        <NodeViewWrapper
            as="span"
            className={cn(
                'bid-text-field-chip rounded px-1 font-semibold',
                value
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
            )}
            data-bid-field={key}
            title={`{{${key}}}`}
        >
            {value || `{{${key}}}`}
        </NodeViewWrapper>
    );
}

export const BidTextFieldExtension = Node.create({
    name: 'bidTextField',
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,

    addAttributes() {
        return {
            key: {
                default: '',
                parseHTML: (element) =>
                    element.getAttribute('data-bid-field') ?? '',
                renderHTML: (attributes) =>
                    attributes.key ? { 'data-bid-field': attributes.key } : {},
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-bid-field]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
        const key = String(node.attrs.key ?? '');

        return [
            'span',
            mergeAttributes(HTMLAttributes, { 'data-bid-field': key }),
            `{{${key}}}`,
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(BidTextFieldChip);
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('bidTextFieldTokens'),
                appendTransaction: (transactions, _oldState, newState) => {
                    if (
                        !transactions.some(
                            (transaction) => transaction.docChanged,
                        )
                    ) {
                        return null;
                    }

                    const type = newState.schema.nodes.bidTextField;

                    if (!type) {
                        return null;
                    }

                    const replacements: Array<{
                        from: number;
                        to: number;
                        key: string;
                    }> = [];
                    const pattern = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

                    newState.doc.descendants((node, pos) => {
                        if (!node.isText) {
                            return;
                        }

                        const text = node.text ?? '';
                        pattern.lastIndex = 0;
                        let match = pattern.exec(text);

                        while (match) {
                            replacements.push({
                                from: pos + match.index,
                                to: pos + match.index + match[0].length,
                                key: match[1].toLowerCase(),
                            });
                            match = pattern.exec(text);
                        }
                    });

                    if (replacements.length === 0) {
                        return null;
                    }

                    let { tr } = newState;

                    for (const item of replacements.sort(
                        (left, right) => right.from - left.from,
                    )) {
                        tr = tr.replaceWith(
                            item.from,
                            item.to,
                            type.create({ key: item.key }),
                        );
                    }

                    return tr;
                },
            }),
        ];
    },
});
