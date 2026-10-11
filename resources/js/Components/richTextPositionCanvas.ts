import { Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { blockMoveModeKey } from './richTextBlockDrag';
import { PRINT_LAYOUT_WIDTH } from '@/lib/printLayoutGeometry';

const CANVAS_WIDTH = PRINT_LAYOUT_WIDTH;
const SNAP = 10;
const coordinate = (value: unknown, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

export const PositionItem = Node.create({
    name: 'positionItem',
    content: '(block | richImage)+',
    defining: true,
    selectable: true,
    addAttributes() {
        return { pdfBackground: {
            default: false,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-pdf-background') === 'true',
            renderHTML: () => ({}),
        }, ...Object.fromEntries(['x', 'y', 'width', 'height'].map((name) => [
            name,
            {
                default: name === 'width' ? CANVAS_WIDTH : 0,
                parseHTML: (element: HTMLElement) => coordinate(element.getAttribute(`data-${name}`), name === 'width' ? CANVAS_WIDTH : 0),
                renderHTML: () => ({}),
            },
        ])) };
    },
    parseHTML: () => [{ tag: 'div[data-position-item]' }],
    renderHTML({ node, HTMLAttributes }) {
        const { x, y, width, height } = node.attrs;
        return ['div', mergeAttributes(HTMLAttributes, {
            'data-position-item': 'true',
            ...(node.attrs.pdfBackground ? { 'data-pdf-background': 'true' } : {}),
            'data-x': x,
            'data-y': y,
            'data-width': width,
            'data-height': height,
            style: `position: absolute; left: ${coordinate(x)}px; top: ${coordinate(y)}px; width: ${coordinate(width, CANVAS_WIDTH)}px; min-height: ${coordinate(height)}px; z-index: ${node.attrs.pdfBackground ? 0 : node.firstChild?.type.name === 'table' ? 2 : 1};`,
        }), 0];
    },
    addNodeView() {
        return ({ node, editor, getPos }) => {
            const dom = document.createElement('div');
            dom.setAttribute('data-position-item', 'true');
            const contentDOM = document.createElement('div');
            contentDOM.className = 'rich-position-item-content';
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.contentEditable = 'false';
            handle.className = 'rich-position-resize-handle';
            handle.setAttribute('aria-label', 'Resize component');
            handle.title = 'Drag to resize. Arrow keys resize by 10px.';
            dom.append(contentDOM, handle);
            let cleanup: (() => void) | null = null;
            const draw = () => {
                dom.dataset.pdfBackground = String(node.attrs.pdfBackground);
                handle.hidden = node.attrs.pdfBackground;
                contentDOM.style.pointerEvents = node.attrs.pdfBackground ? 'none' : '';
                dom.dataset.x = String(node.attrs.x);
                dom.dataset.y = String(node.attrs.y);
                dom.dataset.width = String(node.attrs.width);
                dom.dataset.height = String(node.attrs.height);
                const stack = node.attrs.pdfBackground ? 0 : node.firstChild?.type.name === 'table' ? 2 : 1;
                dom.style.cssText = `position:absolute;left:${coordinate(node.attrs.x)}px;top:${coordinate(node.attrs.y)}px;width:${coordinate(node.attrs.width, CANVAS_WIDTH)}px;min-height:${coordinate(node.attrs.height)}px;z-index:${stack}`;
            };
            const saveSize = (width: number, height: number) => {
                const pos = getPos();
                if (typeof pos !== 'number' || editor.isDestroyed) return;
                const current = editor.state.doc.nodeAt(pos);
                if (current?.type.name !== 'positionItem') return;
                editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, {
                    ...current.attrs,
                    width: Math.max(40, Math.min(CANVAS_WIDTH - current.attrs.x, Math.round(width))),
                    height: Math.max(24, Math.round(height)),
                }));
            };
            handle.addEventListener('mousedown', (event) => {
                if (event.button !== 0 || !editor.isEditable) return;
                event.preventDefault();
                event.stopPropagation();
                cleanup?.();
                const canvas = dom.closest<HTMLElement>('[data-position-canvas]');
                const scale = canvas ? canvas.getBoundingClientRect().width / CANVAS_WIDTH : 1;
                const startWidth = node.attrs.width;
                const startHeight = dom.getBoundingClientRect().height / scale;
                const startX = event.clientX;
                const startY = event.clientY;
                let width = startWidth;
                let height = startHeight;
                const move = (next: MouseEvent) => {
                    width = Math.max(40, Math.min(CANVAS_WIDTH - node.attrs.x, Math.round(startWidth + (next.clientX - startX) / scale)));
                    height = Math.max(24, Math.round(startHeight + (next.clientY - startY) / scale));
                    dom.style.width = `${width}px`;
                    dom.style.minHeight = `${height}px`;
                };
                const up = () => {
                    cleanup?.();
                    saveSize(width, height);
                };
                const key = (next: KeyboardEvent) => {
                    if (next.key === 'Escape') cleanup?.();
                };
                cleanup = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                    window.removeEventListener('keydown', key);
                    draw();
                    cleanup = null;
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
                window.addEventListener('keydown', key);
            });
            handle.addEventListener('keydown', (event) => {
                const deltas: Record<string, [number, number]> = {
                    ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10],
                };
                const delta = deltas[event.key];
                if (!delta) return;
                event.preventDefault();
                event.stopPropagation();
                saveSize(node.attrs.width + delta[0], Math.max(node.attrs.height, contentDOM.scrollHeight) + delta[1]);
            });
            draw();
            return {
                dom,
                contentDOM,
                update(next) {
                    if (next.type !== node.type) {
                        return false;
                    }
                    node = next;
                    draw();
                    return true;
                },
                ignoreMutation: (mutation) => mutation.type === 'attributes' && mutation.target === dom,
                stopEvent: (event) => event.target instanceof globalThis.Node && handle.contains(event.target),
                destroy() {
                    cleanup?.();
                },
            };
        };
    },
});

export const PositionCanvas = Node.create({
    name: 'positionCanvas',
    group: 'block',
    content: 'positionItem+',
    isolating: true,
    addAttributes() {
        return {
            pdfPage: {
                default: false,
                parseHTML: (element: HTMLElement) => element.getAttribute('data-pdf-page') === 'true',
                renderHTML: () => ({}),
            },
            backgroundColor: {
                default: null,
                parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
                renderHTML: () => ({}),
            },
            height: {
                default: 500,
                parseHTML: (element: HTMLElement) => coordinate(element.getAttribute('data-height'), 500),
                renderHTML: () => ({}),
            },
        };
    },
    parseHTML: () => [{ tag: 'div[data-position-canvas]' }],
    renderHTML({ node, HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, {
            'data-position-canvas': 'true',
            ...(node.attrs.pdfPage ? { 'data-pdf-page': 'true' } : {}),
            'data-height': node.attrs.height,
            style: `position: relative; width: ${CANVAS_WIDTH}px; height: ${coordinate(node.attrs.height, 500)}px; background-color: ${node.attrs.backgroundColor || 'transparent'};`,
        }), 0];
    },
    addNodeView() {
        return ({ node, editor, getPos }) => {
            const dom = document.createElement('div');
            dom.className = 'rich-position-stage';
            const contentDOM = document.createElement('div');
            contentDOM.setAttribute('data-position-canvas', 'true');
            if (node.attrs.pdfPage) contentDOM.dataset.pdfPage = 'true';
            contentDOM.style.cssText = `position:relative;width:${CANVAS_WIDTH}px;height:${node.attrs.height}px`;
            contentDOM.style.backgroundColor = node.attrs.backgroundColor || '';
            const rulers = document.createElement('div');
            rulers.contentEditable = 'false';
            rulers.className = 'rich-position-rulers';
            rulers.setAttribute('aria-hidden', 'true');
            const draw = (height: number) => {
                rulers.replaceChildren();
                for (let x = 0; x <= CANVAS_WIDTH; x += 50) {
                    const tick = document.createElement('span');
                    tick.className = 'rich-position-tick-x';
                    tick.style.left = `${x}px`;
                    tick.textContent = String(x);
                    rulers.appendChild(tick);
                }
                for (let y = 0; y < height; y += 50) {
                    const tick = document.createElement('span');
                    tick.className = 'rich-position-tick-y';
                    tick.style.top = `${y}px`;
                    tick.textContent = String(y);
                    rulers.appendChild(tick);
                }
            };
            draw(node.attrs.height);
            dom.append(rulers, contentDOM);
            let frame = 0;
            const observer = new ResizeObserver(() => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => {
                    const pos = getPos();
                    if (typeof pos !== 'number' || editor.isDestroyed) {
                        return;
                    }
                    const page = editor.state.doc.nodeAt(pos);
                    const bottom = Math.max(0, ...Array.from(contentDOM.children).map((child) =>
                        child instanceof HTMLElement ? child.offsetTop + child.scrollHeight : 0,
                    ));
                    if (page?.type.name === 'positionCanvas' && bottom > page.attrs.height) {
                        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...page.attrs, height: Math.ceil(bottom) }));
                    }
                });
            });
            const observeItems = () => {
                observer.disconnect();
                observer.observe(contentDOM);
                Array.from(contentDOM.children).forEach((child) => observer.observe(child));
            };
            frame = requestAnimationFrame(observeItems);
            return {
                dom,
                contentDOM,
                update(next) {
                    if (next.type !== node.type) {
                        return false;
                    }
                    contentDOM.style.height = `${next.attrs.height}px`;
                    contentDOM.style.backgroundColor = next.attrs.backgroundColor || '';
                    if (next.attrs.height !== node.attrs.height) {
                        draw(next.attrs.height);
                    }
                    node = next;
                    cancelAnimationFrame(frame);
                    frame = requestAnimationFrame(observeItems);
                    return true;
                },
                destroy() {
                    cancelAnimationFrame(frame);
                    observer.disconnect();
                },
                ignoreMutation: (mutation) => mutation.type !== 'selection' && !contentDOM.contains(mutation.target),
            };
        };
    },
    addProseMirrorPlugins() {
        return [
            new Plugin({
                view(view) {
                    let cleanup: (() => void) | null = null;
                    const onDown = (event: MouseEvent) => {
                        if (!blockMoveModeKey.getState(view.state) || event.button !== 0 || !(event.target instanceof Element)) {
                            return;
                        }

                        const item = event.target.closest<HTMLElement>('[data-position-item]');
                        const canvas = item?.parentElement;
                        if (!item || !canvas || !view.dom.contains(item) || event.target.closest('button, input')) {
                            return;
                        }

                        event.preventDefault();
                        event.stopImmediatePropagation();
                        cleanup?.();
                        const itemRect = item.getBoundingClientRect();
                        const canvasRect = canvas.getBoundingClientRect();
                        const scale = canvasRect.width / CANVAS_WIDTH;
                        const startX = event.clientX;
                        const startY = event.clientY;
                        const x = coordinate(item.dataset.x);
                        const y = coordinate(item.dataset.y);
                        let nextX = x;
                        let nextY = y;
                        let moved = false;
                        const itemPos = view.posAtDOM(item, 0) - 1;
                        const canvasPos = view.posAtDOM(canvas, 0) - 1;
                        if (view.state.doc.nodeAt(itemPos)?.type.name !== 'positionItem') {
                            return;
                        }
                        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, itemPos)));
                        const label = document.createElement('div');
                        label.className = 'rich-position-coordinates';
                        canvas.parentElement?.appendChild(label);
                        const onMove = (move: MouseEvent) => {
                            moved = true;
                            nextX = Math.max(0, Math.min(CANVAS_WIDTH - itemRect.width / scale, Math.round((x + (move.clientX - startX) / scale) / SNAP) * SNAP));
                            nextY = Math.max(0, Math.round((y + (move.clientY - startY) / scale) / SNAP) * SNAP);
                            item.style.left = `${nextX}px`;
                            item.style.top = `${nextY}px`;
                            label.textContent = `X: ${nextX}px · Y: ${nextY}px`;
                            label.style.left = `${nextX}px`;
                            label.style.top = `${Math.max(0, nextY - 24)}px`;
                        };
                        cleanup = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                            window.removeEventListener('keydown', onKey);
                            label.remove();
                            item.style.left = `${x}px`;
                            item.style.top = `${y}px`;
                            cleanup = null;
                        };
                        const onUp = () => {
                            cleanup?.();
                            if (!moved) {
                                return;
                            }
                            const node = view.state.doc.nodeAt(itemPos);
                            const page = view.state.doc.nodeAt(canvasPos);
                            if (node?.type.name !== 'positionItem' || page?.type.name !== 'positionCanvas') {
                                return;
                            }
                            const tr = closeHistory(view.state.tr).setNodeMarkup(itemPos, undefined, { ...node.attrs, x: nextX, y: nextY });
                            tr.setNodeMarkup(canvasPos, undefined, {
                                ...page.attrs,
                                height: Math.max(page.attrs.height, nextY + itemRect.height / scale + 40),
                            });
                            view.dispatch(tr);
                        };
                        const onKey = (key: KeyboardEvent) => {
                            if (key.key === 'Escape') {
                                cleanup?.();
                            }
                        };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                        window.addEventListener('keydown', onKey);
                    };
                    view.dom.addEventListener('mousedown', onDown, true);
                    return {
                        destroy() {
                            cleanup?.();
                            view.dom.removeEventListener('mousedown', onDown, true);
                        },
                    };
                },
            }),
        ];
    },
});

export function evenCanvasSpacing(editor: Editor): boolean {
    const tr = closeHistory(editor.state.tr);
    editor.state.doc.forEach((canvas, canvasPos) => {
        if (canvas.type.name !== 'positionCanvas') {
            return;
        }
        const rows: Array<{ top: number; bottom: number; items: Array<{ pos: number; y: number }> }> = [];
        const items: Array<{ pos: number; y: number; height: number }> = [];
        canvas.forEach((item, offset) => {
            if (item.attrs.pdfBackground) return;
            const pos = canvasPos + offset + 1;
            const dom = editor.view.nodeDOM(pos);
            if (dom instanceof HTMLElement) {
                items.push({ pos, y: item.attrs.y, height: dom.scrollHeight });
            }
        });
        items.sort((a, b) => a.y - b.y).forEach((item) => {
            const last = rows[rows.length - 1];
            if (last && item.y < last.bottom) {
                last.items.push(item);
                last.bottom = Math.max(last.bottom, item.y + item.height);
            } else {
                rows.push({ top: item.y, bottom: item.y + item.height, items: [item] });
            }
        });
        let bottom = rows[0]?.top ?? 0;
        rows.forEach((row, index) => {
            const top = index === 0 ? row.top : bottom + 16;
            row.items.forEach(({ pos, y }) => {
                const item = tr.doc.nodeAt(pos);
                const nextY = y + top - row.top;
                if (item && nextY !== y) {
                    tr.setNodeMarkup(pos, undefined, { ...item.attrs, y: nextY });
                }
            });
            bottom = top + row.bottom - row.top;
        });
        const height = Math.max(500, Math.ceil(bottom + 40));
        if (canvas.attrs.height !== height) {
            tr.setNodeMarkup(canvasPos, undefined, { ...canvas.attrs, height });
        }
    });
    if (!tr.docChanged) {
        return false;
    }
    editor.view.dispatch(tr);
    return true;
}

export function enablePositionCanvas(editor: Editor) {
    if (editor.state.doc.firstChild?.type.name === 'positionCanvas') {
        return;
    }

    const root = editor.view.dom.getBoundingClientRect();
    const items: Array<{ type: string; attrs: Record<string, number>; content: ReturnType<typeof editor.state.doc.toJSON>[] }> = [];
    const append = (node: ProseMirrorNode, pos: number, split = false) => {
        const element = editor.view.nodeDOM(pos);
        if (!(element instanceof HTMLElement)) {
            return;
        }
        const rect = element.getBoundingClientRect();
        const scale = CANVAS_WIDTH / root.width;
        let width = split ? Math.min(CANVAS_WIDTH, Math.round(rect.width * scale)) : CANVAS_WIDTH;
        let x = split ? Math.max(0, Math.round((rect.left - root.left) * scale)) : 0;
        if (node.isTextblock && node.textContent.trim() !== '') {
            const range = document.createRange();
            range.selectNodeContents(element);
            const textRect = range.getBoundingClientRect();
            const textWidth = Math.ceil(textRect.width * scale);
            if (textWidth > 0) {
                width = Math.min(width, Math.max(80, textWidth + 20));
                const align = getComputedStyle(element).textAlign;
                if (align === 'center') {
                    x += Math.round((rect.width * scale - width) / 2);
                } else if (align === 'right' || align === 'end') {
                    x += Math.round(rect.width * scale - width);
                }
            }
        }
        items.push({
            type: 'positionItem',
            attrs: {
                x: Math.min(CANVAS_WIDTH - width, x),
                y: Math.max(0, Math.round(rect.top - root.top)),
                width,
            },
            content: [node.toJSON()],
        });
    };
    editor.state.doc.forEach((node, pos, index) => {
        let hasImage = false;
        node.descendants((child) => {
            hasImage ||= child.type.name === 'richImage';
        });
        if (index === 0 && node.type.name === 'table' && hasImage) {
            node.descendants((cell, cellPos) => {
                if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
                    cell.forEach((child, childPos) => append(child, pos + cellPos + childPos + 2, true));
                    return false;
                }
            });
        } else {
            append(node, pos);
        }
    });
    editor.commands.setContent({
        type: 'doc',
        content: [{
            type: 'positionCanvas',
            attrs: { height: Math.max(500, Math.ceil(root.height) + 100) },
            content: items,
        }],
    }, true);
}
