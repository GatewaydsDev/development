import { mergeAttributes, Node } from '@tiptap/core';
import type { Fragment, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import {
    NodeViewContent,
    NodeViewWrapper,
    ReactNodeViewRenderer,
    type NodeViewProps,
} from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { type MouseEvent as ReactMouseEvent } from 'react';

export type ImageLayout = 'row' | 'stack';

export type RichImageAttrs = {
    src: string;
    alt: string;
    width: number;
    height: number | null;
};

export const IMAGE_SIZE_PRESETS = [
    { label: 'Small', width: 160, height: 120 },
    { label: 'Medium', width: 240, height: 180 },
    { label: 'Large', width: 360, height: 270 },
] as const;

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;
const MIN_IMAGE_SIZE = 48;

function pixels(value: string): number | null {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type KeptImage = {
    attrs: RichImageAttrs;
    content: Fragment | null;
};

function imageFromSelection(
    editor: Editor,
): { pos: number; node: ProseMirrorNode } | null {
    const { selection } = editor.state;

    if (
        selection instanceof NodeSelection &&
        selection.node.type.name === 'richImage'
    ) {
        return { pos: selection.from, node: selection.node };
    }

    const resolved = selection.$from;

    for (let depth = resolved.depth; depth > 0; depth -= 1) {
        if (resolved.node(depth).type.name === 'richImage') {
            return {
                pos: resolved.before(depth),
                node: resolved.node(depth),
            };
        }
    }

    return null;
}

function imageTarget(
    editor: Editor,
    fallbackPos: number | null,
): { pos: number; node: ProseMirrorNode } | null {
    const selected = imageFromSelection(editor);

    if (selected) {
        return selected;
    }

    if (fallbackPos === null) {
        return null;
    }

    const node = editor.state.doc.nodeAt(fallbackPos);

    if (!node || node.type.name !== 'richImage') {
        return null;
    }

    return { pos: fallbackPos, node };
}

function galleryAround(
    editor: Editor,
    imagePos: number,
): { pos: number; node: ProseMirrorNode } | null {
    const resolved = editor.state.doc.resolve(imagePos);

    for (let depth = resolved.depth; depth > 0; depth -= 1) {
        if (resolved.node(depth).type.name === 'imageGallery') {
            return {
                pos: resolved.before(depth),
                node: resolved.node(depth),
            };
        }
    }

    return null;
}

export function currentRichImage(
    editor: Editor | null,
    fallbackPos: number | null,
): { pos: number; node: ProseMirrorNode } | null {
    if (!editor) {
        return null;
    }

    return imageTarget(editor, fallbackPos);
}

function imageAttrs(node: ProseMirrorNode): RichImageAttrs {
    return {
        src: String(node.attrs.src ?? ''),
        alt: String(node.attrs.alt ?? ''),
        width: Number(node.attrs.width) || DEFAULT_WIDTH,
        height: node.attrs.height ? Number(node.attrs.height) : null,
    };
}

function isEmptyParagraph(node: ProseMirrorNode): boolean {
    return node.type.name === 'paragraph' && node.textContent.trim() === '';
}

function pictureRun(doc: ProseMirrorNode, galleryPos: number) {
    const blocks: { node: ProseMirrorNode; pos: number }[] = [];

    doc.forEach((node, offset) => {
        blocks.push({ node, pos: offset });
    });

    let index = blocks.findIndex((block) => block.pos === galleryPos);

    if (index < 0) {
        return null;
    }

    let start = index;
    let end = index;
    const canJoin = (node: ProseMirrorNode) =>
        node.type.name === 'imageGallery' || isEmptyParagraph(node);

    while (start > 0 && canJoin(blocks[start - 1].node)) {
        start -= 1;
    }

    while (end < blocks.length - 1 && canJoin(blocks[end + 1].node)) {
        end += 1;
    }

    while (start <= end && blocks[start].node.type.name !== 'imageGallery') {
        start += 1;
    }

    while (end >= start && blocks[end].node.type.name !== 'imageGallery') {
        end -= 1;
    }

    const images: KeptImage[] = [];

    for (let cursor = start; cursor <= end; cursor += 1) {
        if (blocks[cursor].node.type.name !== 'imageGallery') {
            continue;
        }

        blocks[cursor].node.forEach((child) => {
            if (child.type.name === 'richImage') {
                images.push({
                    attrs: imageAttrs(child),
                    content: child.content,
                });
            }
        });
    }

    return {
        from: blocks[start].pos,
        to: blocks[end].pos + blocks[end].node.nodeSize,
        images,
        gap: Number(blocks[index].node.attrs.gap) || 16,
    };
}

function galleryPosNearCursor(
    editor: Editor,
    fallbackPos: number | null,
): number | null {
    const target = imageTarget(editor, fallbackPos);

    if (target) {
        const gallery = galleryAround(editor, target.pos);

        if (gallery) {
            return gallery.pos;
        }
    }

    const { selection } = editor.state;

    if (selection.$from.depth < 1) {
        return null;
    }

    let position = selection.$from.before(1);
    const current = selection.$from.node(1);

    if (current.type.name === 'imageGallery') {
        return position;
    }

    for (let guard = 0; guard < 20; guard += 1) {
        const resolved = editor.state.doc.resolve(position);
        const previous = resolved.nodeBefore;

        if (!previous) {
            return null;
        }

        const previousPos = position - previous.nodeSize;

        if (previous.type.name === 'imageGallery') {
            return previousPos;
        }

        if (!isEmptyParagraph(previous)) {
            return null;
        }

        position = previousPos;
    }

    return null;
}

function replacePictureRun(
    editor: Editor,
    layout: ImageLayout,
    galleryPos: number,
    extraImages: RichImageAttrs[],
): boolean {
    return editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
            const run = pictureRun(state.doc, galleryPos);

            if (!run) {
                return false;
            }

            const images = [
                ...run.images,
                ...extraImages.map((attrs) => ({
                    attrs,
                    content: null,
                })),
            ].filter((image) => image.attrs.src !== '');

            if (images.length === 0) {
                return false;
            }

            const gallery = state.schema.nodes.imageGallery.create(
                { layout, gap: run.gap },
                images.map((image) =>
                    state.schema.nodes.richImage.create(
                        image.attrs,
                        image.content && image.content.size > 0
                            ? image.content
                            : state.schema.nodes.paragraph.create(),
                    ),
                ),
            );

            tr.replaceWith(run.from, run.to, gallery);

            return true;
        })
        .run();
}

export function insertRichImages(
    editor: Editor,
    layout: ImageLayout,
    images: RichImageAttrs[],
    fallbackPos: number | null,
): boolean {
    if (images.length === 0) {
        return false;
    }

    const galleryPos = galleryPosNearCursor(editor, fallbackPos);

    if (galleryPos !== null && replacePictureRun(editor, layout, galleryPos, images)) {
        return true;
    }

    return editor
        .chain()
        .focus()
        .insertContent({
            type: 'imageGallery',
            attrs: { layout },
            content: images.map((attrs) => ({
                type: 'richImage',
                attrs,
                content: [{ type: 'paragraph' }],
            })),
        })
        .run();
}

export function setImageGalleryLayout(
    editor: Editor,
    layout: ImageLayout,
    fallbackPos: number | null,
): boolean {
    const galleryPos = galleryPosNearCursor(editor, fallbackPos);

    if (galleryPos === null) {
        return false;
    }

    return replacePictureRun(editor, layout, galleryPos, []);
}

export function setImageGap(
    editor: Editor,
    gap: number,
    fallbackPos: number | null,
): boolean {
    const galleryPos = galleryPosNearCursor(editor, fallbackPos);

    if (galleryPos === null) {
        return false;
    }

    const nextGap = Math.max(0, Math.min(80, Math.round(gap)));

    return editor
        .chain()
        .command(({ tr, state }) => {
            const gallery = state.doc.nodeAt(galleryPos);

            if (!gallery || gallery.type.name !== 'imageGallery') {
                return false;
            }

            tr.setNodeMarkup(galleryPos, undefined, {
                ...gallery.attrs,
                gap: nextGap,
            });

            return true;
        })
        .run();
}

export function updateRichImage(
    editor: Editor,
    fallbackPos: number | null,
    attrs: Partial<RichImageAttrs>,
): boolean {
    const target = imageTarget(editor, fallbackPos);

    if (!target) {
        return false;
    }

    return editor
        .chain()
        .command(({ tr }) => {
            tr.setNodeMarkup(target.pos, undefined, {
                ...target.node.attrs,
                ...attrs,
            });

            return true;
        })
        .run();
}

export function matchRichImageSize(
    editor: Editor,
    fallbackPos: number | null,
): boolean {
    const target = imageTarget(editor, fallbackPos);
    const gallery = target ? galleryAround(editor, target.pos) : null;

    if (!target || !gallery) {
        return false;
    }

    const width = target.node.attrs.width;
    const height = target.node.attrs.height;

    return editor
        .chain()
        .focus()
        .command(({ tr }) => {
            let childPos = gallery.pos + 1;

            gallery.node.forEach((child) => {
                if (child.type.name === 'richImage') {
                    tr.setNodeMarkup(childPos, undefined, {
                        ...child.attrs,
                        width,
                        height,
                    });
                }

                childPos += child.nodeSize;
            });

            return true;
        })
        .run();
}

export function removeRichImage(
    editor: Editor,
    fallbackPos: number | null,
): boolean {
    const target = imageTarget(editor, fallbackPos);
    const gallery = target ? galleryAround(editor, target.pos) : null;

    if (!target || !gallery) {
        return false;
    }

    return editor
        .chain()
        .focus()
        .command(({ tr }) => {
            if (gallery.node.childCount <= 1) {
                tr.delete(gallery.pos, gallery.pos + gallery.node.nodeSize);
            } else {
                tr.delete(target.pos, target.pos + target.node.nodeSize);
            }

            return true;
        })
        .run();
}

function RichImageView({
    node,
    updateAttributes,
    selected,
    editor,
    getPos,
}: NodeViewProps) {
    const height = node.attrs.height
        ? Math.max(MIN_IMAGE_SIZE, Number(node.attrs.height))
        : null;
    const position = typeof getPos === 'function' ? getPos() : null;
    let inRow = true;

    if (typeof position === 'number') {
        const resolved = editor.state.doc.resolve(position);

        for (let depth = resolved.depth; depth > 0; depth -= 1) {
            if (resolved.node(depth).type.name === 'imageGallery') {
                inRow = resolved.node(depth).attrs.layout !== 'stack';
            }
        }
    }

    const startResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const startY = event.clientY;
        const image = event.currentTarget.parentElement?.querySelector('img');
        const startHeight =
            height ??
            (image?.getBoundingClientRect().height ?? DEFAULT_HEIGHT);
        let nextHeight = Math.round(startHeight);

        const onMove = (moveEvent: MouseEvent) => {
            nextHeight = Math.max(
                MIN_IMAGE_SIZE,
                Math.round(startHeight + moveEvent.clientY - startY),
            );

            if (image instanceof HTMLElement) {
                image.style.height = `${nextHeight}px`;
            }
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            updateAttributes({ height: nextHeight });
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <NodeViewWrapper
            as="div"
            className={cn('rich-image-column', selected && 'is-selected')}
            style={inRow ? { flex: '1 1 0', minWidth: 0 } : { width: '100%' }}
            data-rich-image="true"
        >
            <div
                className={cn('rich-image-frame', selected && 'is-selected')}
                style={{ width: '100%' }}
            >
                <img
                    src={String(node.attrs.src ?? '')}
                    alt={String(node.attrs.alt ?? '')}
                    draggable={false}
                    style={{
                        width: '100%',
                        height: height ?? 'auto',
                        objectFit: height ? 'cover' : 'contain',
                        maxWidth: '100%',
                    }}
                    onMouseDown={(event) => {
                        event.preventDefault();

                        if (typeof position === 'number') {
                            editor.chain().setNodeSelection(position).run();
                        }
                    }}
                />
                {selected ? (
                    <button
                        type="button"
                        className="rich-image-resize-handle"
                        aria-label="Resize picture height"
                        title="Drag to change the picture height"
                        onMouseDown={startResize}
                    />
                ) : null}
            </div>
            <NodeViewContent
                className="rich-image-caption"
                style={{
                    width: 0,
                    minWidth: '100%',
                    maxWidth: '100%',
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                }}
            />
        </NodeViewWrapper>
    );
}

function ImageGalleryView({ node }: NodeViewProps) {
    const layout = node.attrs.layout === 'stack' ? 'stack' : 'row';
    const gap = Math.max(0, Math.min(80, Number(node.attrs.gap) || 16));

    return (
        <NodeViewWrapper
            className={cn(
                'rich-image-gallery',
                layout === 'stack' ? 'is-stack' : 'is-row',
            )}
            data-image-gallery={layout}
            data-image-gap={gap}
            style={{ ['--image-gap' as string]: `${gap}px` }}
        >
            <NodeViewContent
                className="rich-image-gallery-content"
                style={{ whiteSpace: 'normal' }}
            />
        </NodeViewWrapper>
    );
}

export const RichImage = Node.create({
    name: 'richImage',
    group: 'richImage',
    content: 'paragraph+',
    defining: true,
    selectable: true,
    draggable: false,

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    element.querySelector('img')?.getAttribute('src') || null,
                renderHTML: () => ({}),
            },
            alt: {
                default: '',
                parseHTML: (element: HTMLElement) =>
                    element.querySelector('img')?.getAttribute('alt') || '',
                renderHTML: () => ({}),
            },
            width: {
                default: DEFAULT_WIDTH,
                parseHTML: (element: HTMLElement) =>
                    pixels(element.style.width) ?? DEFAULT_WIDTH,
                renderHTML: () => ({}),
            },
            height: {
                default: DEFAULT_HEIGHT,
                parseHTML: (element: HTMLElement) => {
                    const image = element.querySelector('img');

                    if (!image) {
                        return DEFAULT_HEIGHT;
                    }

                    return pixels(image.style.height);
                },
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-rich-image]',
                contentElement(element: HTMLElement) {
                    let caption = element.querySelector(
                        ':scope > [data-image-caption]',
                    );

                    if (!(caption instanceof HTMLElement)) {
                        caption = document.createElement('div');
                        caption.setAttribute('data-image-caption', 'true');
                        const paragraph = element.querySelector(':scope > p');

                        if (paragraph) {
                            caption.appendChild(paragraph);
                        } else {
                            caption.appendChild(document.createElement('p'));
                        }

                        element.appendChild(caption);
                    }

                    if (!caption.querySelector('p')) {
                        caption.appendChild(document.createElement('p'));
                    }

                    return caption;
                },
            },
        ];
    },

    renderHTML({ node }) {
        const height = node.attrs.height
            ? Math.max(MIN_IMAGE_SIZE, Number(node.attrs.height))
            : null;
        const imageStyle = height
            ? `width: 100%; height: ${height}px; max-width: 100%; object-fit: cover;`
            : 'width: 100%; height: auto; max-width: 100%;';

        return [
            'div',
            {
                'data-rich-image': 'true',
            },
            [
                'img',
                {
                    src: node.attrs.src,
                    alt: node.attrs.alt || '',
                    style: imageStyle,
                },
            ],
            ['div', { 'data-image-caption': 'true' }, 0],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(RichImageView);
    },
});

export const ImageGallery = Node.create({
    name: 'imageGallery',
    group: 'block',
    content: 'richImage+',
    defining: true,
    isolating: true,

    addAttributes() {
        return {
            layout: {
                default: 'row',
                parseHTML: (element: HTMLElement) =>
                    element.getAttribute('data-image-gallery') === 'stack'
                        ? 'stack'
                        : 'row',
                renderHTML: (attributes: { layout?: string }) => ({
                    'data-image-gallery':
                        attributes.layout === 'stack' ? 'stack' : 'row',
                }),
            },
            gap: {
                default: 16,
                parseHTML: (element: HTMLElement) =>
                    pixels(element.style.gap) ??
                    pixels(element.getAttribute('data-image-gap') || '') ??
                    16,
                renderHTML: (attributes: { gap?: number }) => {
                    const gap = Math.max(
                        0,
                        Math.min(80, Number(attributes.gap) || 16),
                    );

                    return {
                        'data-image-gap': String(gap),
                        style: `gap: ${gap}px`,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-image-gallery]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-image-gallery':
                    HTMLAttributes['data-image-gallery'] === 'stack'
                        ? 'stack'
                        : 'row',
            }),
            0,
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageGalleryView);
    },
});

export function defaultImageAttrs(src: string, alt = ''): RichImageAttrs {
    return {
        src,
        alt,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
    };
}
