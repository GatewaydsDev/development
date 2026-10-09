import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const movableBlocks = new Set([
    'paragraph',
    'heading',
    'blockquote',
    'bulletList',
    'orderedList',
    'table',
    'richImage',
    'imageGallery',
    'horizontalRule',
    'codeBlock',
]);

export const blockMoveModeKey = new PluginKey<boolean>('blockMoveMode');

export const RichTextBlockDrag = Extension.create({
    name: 'richTextBlockDrag',

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin({
                key: blockMoveModeKey,
                state: {
                    init: () => false,
                    apply: (tr, enabled) => tr.getMeta(blockMoveModeKey) ?? enabled,
                },
                view(view) {
                    const findBlock = (target: EventTarget | null) => {
                        if (!(target instanceof Element)) {
                            return null;
                        }

                        if (target.closest('button, input, select, textarea')) {
                            return null;
                        }

                        const block = target.closest<HTMLElement>('[data-movable-block]');

                        return block && view.dom.contains(block) ? block : null;
                    };
                    const onMouseDown = (event: MouseEvent) => {
                        if (!blockMoveModeKey.getState(view.state) || event.button !== 0) {
                            return;
                        }
                        if (event.target instanceof Element && event.target.closest('[data-position-item]')) {
                            return;
                        }

                        const block = findBlock(event.target);

                        if (!block) {
                            return;
                        }

                        event.stopPropagation();
                        const pos = view.posAtDOM(block, 0);
                        const resolved = view.state.doc.resolve(pos);
                        const blockPos = resolved.depth > 0 ? resolved.before() : pos;
                        const node = view.state.doc.nodeAt(blockPos);

                        if (node && NodeSelection.isSelectable(node)) {
                            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, blockPos)));
                        }
                    };
                    const onDragStart = (event: DragEvent) => {
                        if (
                            !blockMoveModeKey.getState(view.state) ||
                            !findBlock(event.target) ||
                            !event.dataTransfer ||
                            !(view.state.selection instanceof NodeSelection)
                        ) {
                            return;
                        }

                        const slice = view.state.selection.content();
                        const serialized = view.serializeForClipboard(slice);
                        event.dataTransfer.clearData();
                        event.dataTransfer.setData('text/html', serialized.dom.innerHTML);
                        event.dataTransfer.setData('text/plain', serialized.text);
                        event.dataTransfer.effectAllowed = 'move';
                        view.dragging = { slice, move: true };
                        event.stopPropagation();
                    };
                    const onDragEnd = () => {
                        view.dragging = null;
                    };

                    view.dom.addEventListener('mousedown', onMouseDown, true);
                    view.dom.addEventListener('dragstart', onDragStart, true);
                    view.dom.addEventListener('dragend', onDragEnd, true);

                    return {
                        destroy() {
                            view.dom.removeEventListener('mousedown', onMouseDown, true);
                            view.dom.removeEventListener('dragstart', onDragStart, true);
                            view.dom.removeEventListener('dragend', onDragEnd, true);
                        },
                    };
                },
                props: {
                    attributes(state): Record<string, string> {
                        return blockMoveModeKey.getState(state)
                            ? { 'data-block-move-mode': 'true' }
                            : {};
                    },
                    decorations(state) {
                        if (!editor.isEditable) {
                            return DecorationSet.empty;
                        }

                        const handles: Decoration[] = [];

                        state.doc.descendants((node, pos, parent) => {
                            if (
                                !movableBlocks.has(node.type.name) ||
                                !NodeSelection.isSelectable(node) ||
                                !parent ||
                                !['doc', 'tableCell', 'tableHeader'].includes(parent.type.name)
                            ) {
                                return;
                            }

                            if (blockMoveModeKey.getState(state)) {
                                handles.push(Decoration.node(pos, pos + node.nodeSize, {
                                    draggable: 'true',
                                    'data-movable-block': 'true',
                                }));
                            }

                            handles.push(
                                Decoration.widget(pos, (view, getPos) => {
                                    const handle = document.createElement('button');
                                    handle.type = 'button';
                                    handle.className = 'rich-text-drag-handle';
                                    handle.textContent = '⋮⋮';
                                    handle.draggable = true;
                                    handle.contentEditable = 'false';
                                    handle.title = 'Drag to move. Use Alt + Up or Down to reorder.';
                                    handle.setAttribute('aria-label', `Move ${node.type.name}`);
                                    handle.addEventListener('mousedown', (event) => {
                                        event.stopPropagation();
                                    });
                                    handle.addEventListener('dragstart', (event) => {
                                        const position = getPos();

                                        if (position === undefined || !event.dataTransfer) {
                                            event.preventDefault();
                                            return;
                                        }

                                        const selection = NodeSelection.create(view.state.doc, position);
                                        view.dispatch(view.state.tr.setSelection(selection));
                                        const slice = selection.content();
                                        const serialized = view.serializeForClipboard(slice);
                                        event.dataTransfer.clearData();
                                        event.dataTransfer.setData('text/html', serialized.dom.innerHTML);
                                        event.dataTransfer.setData('text/plain', serialized.text);
                                        event.dataTransfer.effectAllowed = 'move';
                                        view.dragging = { slice, move: true };
                                        event.stopPropagation();
                                    });
                                    handle.addEventListener('dragend', () => {
                                        view.dragging = null;
                                    });
                                    handle.addEventListener('keydown', (event) => {
                                        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) {
                                            return;
                                        }

                                        event.preventDefault();
                                        const position = getPos();

                                        if (position === undefined) {
                                            return;
                                        }

                                        const selection = NodeSelection.create(view.state.doc, position);
                                        const resolved = view.state.doc.resolve(position);
                                        const neighbor = event.key === 'ArrowUp'
                                            ? resolved.nodeBefore
                                            : view.state.doc.resolve(selection.to).nodeAfter;

                                        if (!neighbor) {
                                            return;
                                        }

                                        const target = event.key === 'ArrowUp'
                                            ? position - neighbor.nodeSize
                                            : position + neighbor.nodeSize;
                                        const tr = view.state.tr
                                            .delete(selection.from, selection.to)
                                            .insert(target, selection.node);
                                        tr.setSelection(NodeSelection.create(tr.doc, target));
                                        view.dispatch(tr.scrollIntoView());
                                        view.focus();
                                    });

                                    return handle;
                                }, { side: -1, stopEvent: () => true }),
                            );
                        });

                        return DecorationSet.create(state.doc, handles);
                    },
                },
            }),
        ];
    },
});
