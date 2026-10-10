import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
    NodeViewWrapper,
    ReactNodeViewRenderer,
    type NodeViewProps,
} from '@tiptap/react';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { createContext, useContext } from 'react';
import { printLayoutTextCase } from '@/lib/printLayoutGeometry';

export const BidTextFieldValuesContext = createContext<Record<string, string>>(
    {},
);

function BidTextFieldChip({ node, deleteNode }: NodeViewProps) {
    const values = useContext(BidTextFieldValuesContext);
    const key = String(node.attrs.key ?? '');
    const value = printLayoutTextCase((values[key] ?? '').trim(), node.attrs.textCase);

    return (
        <NodeViewWrapper
            as="span"
            className={cn(
                'bid-text-field-chip inline-flex items-center gap-1 rounded px-1 font-semibold',
                value
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
            )}
            data-bid-field={key}
            title={`{{${key}}}`}
        >
            <span>{value || `{{${key}}}`}</span>
            <button
                type="button"
                contentEditable={false}
                className="inline-flex size-4 items-center justify-center rounded-sm hover:bg-black/10"
                aria-label={`Remove ${value || key}`}
                title="Remove field"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteNode();
                }}
            >
                <XIcon className="size-3" />
            </button>
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
            textCase: {
                default: 'original',
                parseHTML: (element) => element.getAttribute('data-text-case') || 'original',
                renderHTML: (attributes) => ['camel', 'uppercase', 'lowercase'].includes(attributes.textCase)
                    ? { 'data-text-case': attributes.textCase }
                    : {},
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
                        marks: import('@tiptap/pm/model').Node['marks'];
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
                                marks: node.marks,
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
                            type.create({
                                key: item.key,
                                textCase: item.marks.find(mark => mark.type.name === 'textStyle')?.attrs.textCase
                                    ?? tr.doc.resolve(tr.mapping.map(item.from)).parent.attrs.editorTextCase ?? 'original',
                            }, null, item.marks),
                        );
                    }

                    return tr;
                },
            }),
        ];
    },
});
