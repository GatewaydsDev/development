import { Button } from '@/Components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { Separator } from '@/Components/ui/separator';
import { Toggle } from '@/Components/ui/toggle';
import { cn } from '@/lib/utils';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    ImportedBlockStyles,
    ImportedTextStyles,
    richTextLayoutExtensions,
} from '@/Components/richTextImportedStyles';
import {
    AlignCenterIcon,
    AlignVerticalSpaceAroundIcon,
    AlignJustifyIcon,
    AlignLeftIcon,
    AlignRightIcon,
    BoldIcon,
    CodeIcon,
    Columns3Icon,
    EllipsisIcon,
    Heading1Icon,
    Heading2Icon,
    Heading3Icon,
    Heading4Icon,
    HighlighterIcon,
    ImageIcon,
    ImagePlusIcon,
    ImagesIcon,
    ItalicIcon,
    Link2Icon,
    LoaderCircleIcon,
    Link2OffIcon,
    ListIcon,
    ListOrderedIcon,
    MinusIcon,
    PaintBucketIcon,
    PilcrowIcon,
    QuoteIcon,
    Redo2Icon,
    RemoveFormattingIcon,
    Rows3Icon,
    ScalingIcon,
    SquareIcon,
    StrikethroughIcon,
    SubscriptIcon,
    SuperscriptIcon,
    TableIcon,
    Trash2Icon,
    UnderlineIcon,
    Undo2Icon,
} from 'lucide-react';
import InsertBidTextFieldMenu from '@/Components/InsertBidTextFieldMenu';
import {
    BidTextFieldExtension,
    BidTextFieldValuesContext,
} from '@/Components/bidTextFieldExtension';
import {
    currentRichImage,
    defaultImageAttrs,
    IMAGE_SIZE_PRESETS,
    ImageGallery,
    insertRichImages,
    matchRichImageSize,
    removeRichImage,
    RichImage,
    setImageGap,
    setImageGalleryLayout,
    updateRichImage,
    type ImageLayout,
    type RichImageAttrs,
} from '@/Components/richTextImageExtension';
import { toast } from 'sonner';
import {
    type ChangeEvent,
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    isEmptyHtml,
    mergeBidTextPlaceholders,
    placeholderToken,
} from '@/Pages/Admin/Bids/bidText';

type LayoutColor = {
    label: string;
    value: string;
    text: string;
};

const TEXT_COLORS = [
    { label: 'Black', value: '#111111' },
    { label: 'Gray', value: '#6B7280' },
    { label: 'Navy', value: '#1F4E79' },
    { label: 'Gateway green', value: '#047857' },
    { label: 'Gold', value: '#A16207' },
    { label: 'Red', value: '#9B1C1C' },
    { label: 'Sky', value: '#0369A1' },
    { label: 'White', value: '#FFFFFF' },
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32] as const;

const FONT_FAMILIES = [
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    { label: 'Courier New', value: "'Courier New', Courier, monospace" },
] as const;

const LINE_SPACING = [
    { label: 'Single', value: '1' },
    { label: '1.15', value: '1.15' },
    { label: '1.5', value: '1.5' },
    { label: 'Double', value: '2' },
] as const;

const LAYOUT_COLORS: LayoutColor[] = [
    { label: 'Navy', value: '#1F4E79', text: '#FFFFFF' },
    { label: 'Gateway green', value: '#047857', text: '#FFFFFF' },
    { label: 'Gold', value: '#C4A35A', text: '#111111' },
    { label: 'Red', value: '#9B1C1C', text: '#FFFFFF' },
    { label: 'Slate', value: '#334155', text: '#FFFFFF' },
    { label: 'Sky', value: '#0369A1', text: '#FFFFFF' },
    { label: 'Sand', value: '#F3E8C8', text: '#111111' },
    { label: 'Light gray', value: '#E2E8F0', text: '#111111' },
];

const DOCUMENT_LINE_HEIGHT = '1.5';
const DOCUMENT_BLOCK_SPACE = '12px';
const FOOTNOTE_FONT_SIZE = '10px';
const FOOTNOTE_COLOR = '#6b7280';

function isFootnoteBlock(attrs: {
    fontSize?: string | null;
    color?: string | null;
}): boolean {
    return (
        attrs.fontSize === FOOTNOTE_FONT_SIZE &&
        attrs.color?.toLowerCase() === FOOTNOTE_COLOR
    );
}

function isEmptySpacer(node: {
    type: { name: string };
    content: { size: number };
    attrs: { border?: string | null };
}): boolean {
    return (
        node.type.name === 'paragraph' &&
        node.content.size === 0 &&
        !node.attrs.border
    );
}

function evenDocumentSpacing(editor: Editor): {
    changed: boolean;
    message: string;
} {
    let updated = 0;
    let removed = 0;

    const changed = editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
            const empties = new Map<
                number,
                { count: number; positions: number[] }
            >();

            state.doc.descendants((node, pos) => {
                if (
                    node.type.name === 'table' ||
                    node.type.name === 'imageGallery' ||
                    node.type.name === 'richImage'
                ) {
                    return false;
                }

                if (
                    node.type.name !== 'paragraph' &&
                    node.type.name !== 'heading' &&
                    node.type.name !== 'blockquote' &&
                    node.type.name !== 'listItem'
                ) {
                    return;
                }

                const $pos = state.doc.resolve(pos);
                const parentName = $pos.parent.type.name;
                const tight =
                    node.type.name === 'listItem' ||
                    parentName === 'listItem' ||
                    parentName === 'blockquote';
                const last = $pos.index() === $pos.parent.childCount - 1;
                const next = {
                    lineHeight: DOCUMENT_LINE_HEIGHT,
                    marginTop: '0px',
                    marginBottom:
                        tight || last ? '0px' : DOCUMENT_BLOCK_SPACE,
                };

                if (
                    node.attrs.lineHeight !== next.lineHeight ||
                    node.attrs.marginTop !== next.marginTop ||
                    node.attrs.marginBottom !== next.marginBottom
                ) {
                    tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        ...next,
                    });
                    updated += 1;
                }

                if (!isEmptySpacer(node) || $pos.parent.childCount < 2) {
                    return;
                }

                const parentDepth = $pos.depth - 1;
                const parentKey =
                    parentDepth <= 0 ? 0 : $pos.before(parentDepth);
                const group = empties.get(parentKey) ?? {
                    count: $pos.parent.childCount,
                    positions: [],
                };

                group.positions.push(pos);
                empties.set(parentKey, group);
            });

            const deleteAt: number[] = [];

            empties.forEach((group) => {
                if (group.count - group.positions.length < 1) {
                    return;
                }

                deleteAt.push(...group.positions);
            });

            deleteAt
                .sort((left, right) => right - left)
                .forEach((pos) => {
                    const mapped = tr.mapping.map(pos);
                    const current = tr.doc.nodeAt(mapped);

                    if (!current || !isEmptySpacer(current)) {
                        return;
                    }

                    tr.delete(mapped, mapped + current.nodeSize);
                    removed += 1;
                });

            return updated > 0 || removed > 0;
        })
        .run();

    if (!changed) {
        return {
            changed: false,
            message:
                'Spacing is already even across headings, paragraphs, and sections.',
        };
    }

    return {
        changed: true,
        message:
            'Spacing is even. Headings, paragraphs, and sections now use the same space.',
    };
}

function applyBlockStyle(
    editor: Editor,
    attrs: Record<string, string | null>,
) {
    const { from, to } = editor.state.selection;

    editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
            let changed = false;

            state.doc.nodesBetween(from, to, (node, pos) => {
                if (
                    node.type.name !== 'paragraph' &&
                    node.type.name !== 'heading' &&
                    node.type.name !== 'listItem'
                ) {
                    return;
                }

                tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    ...attrs,
                });
                changed = true;
            });

            return changed;
        })
        .run();
}

function applyFootnote(editor: Editor) {
    const { from, to } = editor.state.selection;
    const active =
        editor.isActive('paragraph') &&
        isFootnoteBlock(editor.getAttributes('paragraph'));

    editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
            let changed = false;

            state.doc.nodesBetween(from, to, (node, pos) => {
                if (
                    node.type.name !== 'paragraph' &&
                    node.type.name !== 'heading' &&
                    node.type.name !== 'listItem'
                ) {
                    return;
                }

                const type =
                    node.type.name === 'heading'
                        ? state.schema.nodes.paragraph
                        : undefined;

                tr.setNodeMarkup(pos, type, {
                    ...node.attrs,
                    ...(node.type.name === 'heading' ? { level: undefined } : {}),
                    fontSize: active ? null : FOOTNOTE_FONT_SIZE,
                    color: active ? null : FOOTNOTE_COLOR,
                    lineHeight: active ? null : '1.4',
                });
                changed = true;
            });

            return changed;
        })
        .run();
}

function currentBlockType(
    editor: Editor,
): 'heading' | 'blockquote' | 'paragraph' {
    if (editor.isActive('heading')) {
        return 'heading';
    }

    if (editor.isActive('blockquote')) {
        return 'blockquote';
    }

    return 'paragraph';
}

function fillCurrentTableHeaders(
    editor: Editor,
    background: string,
    color: string,
) {
    const { $from } = editor.state.selection;
    let tablePos: number | null = null;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name === 'table') {
            tablePos = $from.before(depth);
            break;
        }
    }

    if (tablePos === null) {
        return;
    }

    const table = editor.state.doc.nodeAt(tablePos);

    if (!table) {
        return;
    }

    let { tr } = editor.state;

    table.descendants((node, pos) => {
        if (node.type.name !== 'tableHeader') {
            return;
        }

        tr = tr.setNodeMarkup(tablePos + 1 + pos, undefined, {
            ...node.attrs,
            backgroundColor: background,
            color,
        });
    });

    editor.view.dispatch(tr);
}

function labelCurrentTableHeaders(editor: Editor) {
    const { $from } = editor.state.selection;
    let tablePos: number | null = null;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name === 'table') {
            tablePos = $from.before(depth);
            break;
        }
    }

    if (tablePos === null) {
        return;
    }

    const table = editor.state.doc.nodeAt(tablePos);

    if (!table) {
        return;
    }

    const inserts: number[] = [];

    table.descendants((node, pos) => {
        if (node.type.name === 'tableHeader' && node.textContent === '') {
            inserts.push(tablePos + 1 + pos + 1);
        }
    });

    if (inserts.length === 0) {
        return;
    }

    let { tr } = editor.state;

    for (let index = inserts.length - 1; index >= 0; index -= 1) {
        tr = tr.insertText(`Column ${index + 1}`, inserts[index]);
    }

    editor.view.dispatch(tr);
}

function currentTableHasHeaders(editor: Editor) {
    const { $from } = editor.state.selection;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'table') {
            continue;
        }

        let hasHeader = false;

        $from.node(depth).descendants((node) => {
            if (node.type.name === 'tableHeader') {
                hasHeader = true;
            }
        });

        return hasHeader;
    }

    return false;
}

function ColorChoices({
    onSelect,
    allowClear,
    onClear,
}: {
    onSelect: (color: LayoutColor) => void;
    allowClear?: boolean;
    onClear?: () => void;
}) {
    return (
        <>
            {LAYOUT_COLORS.map((swatch) => (
                <DropdownMenuItem
                    key={swatch.value}
                    onClick={() => onSelect(swatch)}
                >
                    <span
                        className="size-4 rounded-sm border border-border"
                        style={{ backgroundColor: swatch.value }}
                    />
                    {swatch.label}
                </DropdownMenuItem>
            ))}
            {allowClear ? (
                <DropdownMenuItem onClick={onClear}>Clear fill</DropdownMenuItem>
            ) : null}
        </>
    );
}

function ToolbarMenu({
    trigger,
    children,
    contentClassName,
    onOpenChange,
}: {
    trigger: ReactNode;
    children: ReactNode;
    contentClassName?: string;
    onOpenChange?: (open: boolean) => void;
}) {
    return (
        <DropdownMenu modal={false} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={8}
                collisionPadding={12}
                className={cn('z-[200] min-w-48', contentClassName)}
                onCloseAutoFocus={(event) => event.preventDefault()}
            >
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

type RichTextEditorProps = {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    error?: string;
    id?: string;
    compact?: boolean;
    allowSideToolbar?: boolean;
    showPlaceholders?: boolean;
    placeholderFields?: Array<{
        key: string;
        name?: string;
        label?: string;
        group?: string;
        source?: string | null;
    }>;
    placeholderValues?: Record<string, string>;
    placeholderCatalog?: 'bid' | 'provided';
    placeholderIntro?: string;
    placeholderSearchPlaceholder?: string;
    allowCreatePlaceholder?: boolean;
    placeholderGroupOrder?: readonly string[];
    placeholderPages?: Array<{
        key: string;
        label: string;
        records: Array<{
            id: number;
            label: string;
            hint?: string;
            fields: Array<{
                key: string;
                label: string;
                value: string;
            }>;
        }>;
    }>;
};

const EDITOR_PICTURE_TARGET_BYTES = 1_500_000;

function canvasBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });
}

async function prepareEditorPicture(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) {
        return file;
    }

    let bitmap: ImageBitmap;

    try {
        bitmap = await createImageBitmap(file);
    } catch {
        return file;
    }

    const paint = (longestEdge: number) => {
        const scale = Math.min(
            1,
            longestEdge / Math.max(bitmap.width, bitmap.height, 1),
        );
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
            return null;
        }

        context.drawImage(bitmap, 0, 0, width, height);

        return canvas;
    };

    let longestEdge = 1600;
    let canvas = paint(longestEdge);
    let blob: Blob | null = null;

    if (canvas) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
            let quality = 0.82;
            blob = await canvasBlob(canvas, 'image/webp', quality);
            const type = blob ? 'image/webp' : 'image/jpeg';

            if (!blob) {
                blob = await canvasBlob(canvas, type, quality);
            }

            while (blob && blob.size > EDITOR_PICTURE_TARGET_BYTES && quality > 0.4) {
                quality = Math.round((quality - 0.12) * 100) / 100;
                blob = await canvasBlob(canvas, type, quality);
            }

            if (blob && blob.size <= EDITOR_PICTURE_TARGET_BYTES) {
                break;
            }

            longestEdge = Math.round(longestEdge * 0.75);
            canvas = paint(longestEdge);

            if (!canvas) {
                break;
            }
        }
    }

    bitmap.close();

    if (!blob) {
        return file;
    }

    const base = file.name.replace(/\.[^.]+$/, '') || 'picture';
    const extension = blob.type === 'image/jpeg' ? 'jpg' : 'webp';

    return new File([blob], `${base}.${extension}`, {
        type: blob.type || 'image/webp',
    });
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Write or adapt this text…',
    error,
    id,
    compact = false,
    allowSideToolbar = true,
    showPlaceholders = true,
    placeholderFields = [],
    placeholderValues = {},
    placeholderCatalog = 'bid',
    placeholderIntro,
    placeholderSearchPlaceholder,
    allowCreatePlaceholder = true,
    placeholderGroupOrder,
    placeholderPages = [],
}: RichTextEditorProps) {
    const { i18n } = useTranslation();
    const documentLang = i18n.language?.startsWith('es') ? 'es' : 'en-US';
    const ignoreToolbarRefresh = useRef(false);
    const editorFrameRef = useRef<HTMLDivElement>(null);
    const [commandsOffset, setCommandsOffset] = useState(0);
    const [commandsLeft, setCommandsLeft] = useState(0);
    const [commandsWide, setCommandsWide] = useState(false);
    const [commandsScrolled, setCommandsScrolled] = useState(false);
    const [commandSidePose, setCommandSidePose] = useState(false);
    const commandBarRef = useRef<HTMLDivElement>(null);
    const commandsScrolledRef = useRef(false);
    const dockOriginRef = useRef<{
        top: number;
        left: number;
        width: number;
        height: number;
    } | null>(null);
    const [commandHint, setCommandHint] = useState<{
        text: string;
        top: number;
        left: number;
    } | null>(null);
    const [uploadingPictures, setUploadingPictures] = useState(false);
    const [pictureDropActive, setPictureDropActive] = useState(false);
    const placeDroppedPicturesRef = useRef<
        (files: File[], x: number, y: number) => void
    >(() => {});
    const [pictureFieldsFocused, setPictureFieldsFocused] = useState(false);
    const [spaceDraft, setSpaceDraft] = useState<string | null>(null);
    const [heightDraft, setHeightDraft] = useState<string | null>(null);
    const pictureInputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);
    const pictureLayout = useRef<ImageLayout>('row');
    const appendPictures = useRef(false);
    const cursorBeforePictures = useRef<number | null>(null);
    const savedImagePos = useRef<number | null>(null);
    const [, refreshToolbar] = useReducer((tick: number) => tick + 1, 0);
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
                horizontalRule: false,
            }),
            Underline,
            TextStyle.configure({ mergeNestedSpanStyles: true }),
            Color,
            ImportedTextStyles,
            ImportedBlockStyles,
            ...richTextLayoutExtensions,
            ImageGallery,
            RichImage,
            BidTextFieldExtension,
            Highlight.configure({ multicolor: true }),
            Subscript,
            Superscript,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: {
                    rel: 'noopener noreferrer',
                    target: '_blank',
                },
            }),
            Placeholder.configure({
                includeChildren: true,
                showOnlyCurrent: false,
                placeholder: ({ node, pos, editor: current }) => {
                    if (node.type.name === 'paragraph' && current) {
                        const resolved = current.state.doc.resolve(pos);

                        for (let depth = resolved.depth; depth > 0; depth -= 1) {
                            if (resolved.node(depth).type.name === 'richImage') {
                                return 'Add text';
                            }
                        }
                    }

                    return current?.isEmpty ? placeholder : '';
                },
            }),
        ],
        content: value || '',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                id: id ?? 'rich-text-editor',
                class: cn(
                    'rich-text-content px-4 py-3 focus:outline-none',
                    compact ? 'min-h-32' : 'min-h-64',
                ),
                spellcheck: 'true',
                autocorrect: 'on',
                autocapitalize: 'sentences',
                lang: documentLang,
            },
        },
        onUpdate: ({ editor: current }) => {
            onChange(current.getHTML());
        },
        onTransaction: () => {
            if (!ignoreToolbarRefresh.current) {
                refreshToolbar();
            }
        },
        onSelectionUpdate: () => {
            if (!ignoreToolbarRefresh.current) {
                refreshToolbar();
            }
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }

        const current = editor.getHTML();
        const incoming = value || '';

        if (incoming === current) {
            return;
        }

        if (isEmptyHtml(incoming) && isEmptyHtml(current)) {
            return;
        }

        editor.commands.setContent(incoming, false);
    }, [editor, value]);

    useEffect(() => {
        if (!editor) {
            return;
        }

        const dom = editor.view.dom;
        dom.setAttribute('spellcheck', 'true');
        dom.setAttribute('autocorrect', 'on');
        dom.setAttribute('autocapitalize', 'sentences');
        dom.setAttribute('lang', documentLang);
    }, [documentLang, editor]);

    const insertableFields = useMemo(
        () =>
            placeholderCatalog === 'provided'
                ? placeholderFields.map((field) => ({
                      key: field.key,
                      label: field.label || field.name || field.key,
                      group: field.group || 'Quotation',
                      source: field.source || field.key,
                      sourceLabel: field.label || field.name || field.key,
                  }))
                : mergeBidTextPlaceholders(placeholderFields),
        [placeholderCatalog, placeholderFields],
    );

    const insertPlaceholder = (key: string) => {
        editor?.chain().focus().insertContent(placeholderToken(key)).run();
    };

    const setLink = () => {
        if (!editor) {
            return;
        }

        const previous = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Enter a URL', previous || 'https://');

        if (url === null) {
            return;
        }

        if (url.trim() === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: url.trim() })
            .run();
    };

    const insertTable = (columns: number, withHeader = true) => {
        if (!editor) {
            return;
        }

        const count = Math.min(6, Math.max(2, columns));

        editor
            .chain()
            .focus()
            .insertTable({
                rows: 3,
                cols: count,
                withHeaderRow: withHeader,
            })
            .run();

        if (!withHeader) {
            return;
        }

        const headerColor = LAYOUT_COLORS[0];

        fillCurrentTableHeaders(editor, headerColor.value, headerColor.text);
        labelCurrentTableHeaders(editor);
    };

    const boxedNoteStyles = {
        border: '1px solid #111827',
        backgroundColor: '#ffffff',
        paddingTop: '12px',
        paddingBottom: '12px',
        paddingLeft: '16px',
        paddingRight: '16px',
        marginTop: '12px',
        marginBottom: '12px',
    };

    const currentParagraphHasBox = () =>
        Boolean(editor?.getAttributes('paragraph').border);

    const applyBoxedNote = () => {
        if (!editor) {
            return;
        }

        if (currentParagraphHasBox()) {
            editor
                .chain()
                .focus()
                .updateAttributes('paragraph', {
                    border: null,
                    backgroundColor: null,
                    paddingTop: null,
                    paddingBottom: null,
                    paddingLeft: null,
                    paddingRight: null,
                    marginTop: null,
                    marginBottom: null,
                })
                .run();
            return;
        }

        const isEmpty =
            editor.state.selection.empty &&
            editor.state.selection.$from.parent.content.size === 0;

        if (isEmpty) {
            editor
                .chain()
                .focus()
                .insertContent({
                    type: 'paragraph',
                    attrs: boxedNoteStyles,
                    content: [
                        {
                            type: 'text',
                            text: 'IMPORTANT: ',
                            marks: [{ type: 'bold' }],
                        },
                        {
                            type: 'text',
                            text: 'Type your note here.',
                        },
                    ],
                })
                .run();
            return;
        }

        editor
            .chain()
            .focus()
            .updateAttributes('paragraph', boxedNoteStyles)
            .run();
    };

    const insertColoredSection = (color: LayoutColor) => {
        editor
            ?.chain()
            .focus()
            .insertContent({
                type: 'coloredSection',
                attrs: {
                    backgroundColor: color.value,
                    color: color.text,
                },
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 2 },
                        content: [{ type: 'text', text: 'Section title' }],
                    },
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'Write this section here.' },
                        ],
                    },
                ],
            })
            .run();
    };

    const recolorColoredSection = (color: LayoutColor) => {
        editor
            ?.chain()
            .focus()
            .updateAttributes('coloredSection', {
                backgroundColor: color.value,
                color: color.text,
            })
            .run();
    };

    const removeColoredSection = () => {
        if (!editor) {
            return;
        }

        const { state } = editor;
        const { $from } = state.selection;

        for (let depth = $from.depth; depth > 0; depth -= 1) {
            if ($from.node(depth).type.name !== 'coloredSection') {
                continue;
            }

            const from = $from.before(depth);
            const node = $from.node(depth);

            editor.view.dispatch(state.tr.delete(from, from + node.nodeSize));
            editor.commands.focus();

            return;
        }
    };

    const insertColoredLine = (color: LayoutColor, thickness = '4px') => {
        editor
            ?.chain()
            .focus()
            .insertContent({
                type: 'horizontalRule',
                attrs: {
                    color: color.value,
                    thickness,
                },
            })
            .run();
    };

    const applyFill = (color: LayoutColor | null) => {
        if (!editor) {
            return;
        }

        if (editor.isActive('table')) {
            editor
                .chain()
                .focus()
                .setCellAttribute(
                    'backgroundColor',
                    color?.value ?? null,
                )
                .setCellAttribute('color', color?.text ?? null)
                .run();
            return;
        }

        editor
            .chain()
            .focus()
            .updateAttributes(currentBlockType(editor), {
                backgroundColor: color?.value ?? null,
                color: color?.text ?? null,
                paddingTop: color ? '10px' : null,
                paddingBottom: color ? '10px' : null,
                paddingLeft: color ? '12px' : null,
                paddingRight: color ? '12px' : null,
            })
            .run();
    };

    const handleMenuOpenChange = (open: boolean) => {
        ignoreToolbarRefresh.current = open;

        if (open) {
            return;
        }

        refreshToolbar();
    };

    useEffect(() => {
        const updateOffset = () => {
            const header = document.querySelector('nav.sticky');
            const sidebar = document.querySelector('aside');
            const stickyTitle = document.querySelector(
                '[data-sticky-page-title]',
            );
            const frame = editorFrameRef.current;
            const wide = window.matchMedia('(min-width: 1024px)').matches;
            const navBottom = header
                ? header.getBoundingClientRect().bottom
                : 0;
            const titleBottom = stickyTitle
                ? stickyTitle.getBoundingClientRect().bottom
                : navBottom + 56;
            const dockTop = Math.ceil(Math.max(navBottom, titleBottom) + 8);

            setCommandsOffset(dockTop);
            setCommandsWide(wide);
            setCommandsLeft(
                wide && sidebar
                    ? Math.round(sidebar.getBoundingClientRect().right)
                    : 8,
            );

            const rect = frame?.getBoundingClientRect();
            const pastHeader = Boolean(
                rect &&
                    rect.top < navBottom + 4 &&
                    rect.bottom > dockTop + 48,
            );
            const editorOnScreen = Boolean(
                rect &&
                    rect.bottom > dockTop + 48 &&
                    rect.top < window.innerHeight - 40,
            );
            const remainingScroll = Math.max(
                0,
                document.documentElement.scrollHeight -
                    window.innerHeight -
                    window.scrollY,
            );
            const distanceToHeader = rect ? rect.top - (navBottom + 4) : 0;
            const pageCannotReachHeader =
                distanceToHeader > remainingScroll + 48;
            let scrolled = false;

            if (allowSideToolbar && wide && rect) {
                if (pastHeader || (editorOnScreen && pageCannotReachHeader)) {
                    scrolled = true;
                } else if (commandsScrolledRef.current && editorOnScreen) {
                    scrolled = true;
                }
            }

            if (scrolled && !commandsScrolledRef.current && commandBarRef.current) {
                const box = commandBarRef.current.getBoundingClientRect();
                dockOriginRef.current = {
                    top: box.top,
                    left: box.left,
                    width: box.width,
                    height: box.height,
                };
            }

            if (!scrolled) {
                dockOriginRef.current = null;
            }

            commandsScrolledRef.current = scrolled;
            setCommandsScrolled(scrolled);
        };

        updateOffset();
        const observer = new ResizeObserver(updateOffset);
        const header = document.querySelector('nav.sticky');
        const sidebar = document.querySelector('aside');

        if (header) {
            observer.observe(header);
        }

        if (sidebar) {
            observer.observe(sidebar);
        }

        window.addEventListener('resize', updateOffset);
        window.addEventListener('scroll', updateOffset, { passive: true });

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateOffset);
            window.removeEventListener('scroll', updateOffset);
        };
    }, [allowSideToolbar]);

    const commandsDocked = commandsWide && commandsScrolled;

    useLayoutEffect(() => {
        if (!commandsDocked) {
            setCommandSidePose(false);

            return;
        }

        const frame = requestAnimationFrame(() => setCommandSidePose(true));

        return () => cancelAnimationFrame(frame);
    }, [commandsDocked]);

    useEffect(() => {
        const main = document.querySelector('main');

        if (!main || !commandsDocked) {
            return;
        }

        const count = Number(main.dataset.commandDocks ?? '0') + 1;
        main.dataset.commandDocks = String(count);
        main.classList.add('rich-text-commands-docked');

        return () => {
            const next = Math.max(
                0,
                Number(main.dataset.commandDocks ?? '1') - 1,
            );

            if (next === 0) {
                main.classList.remove('rich-text-commands-docked');
                delete main.dataset.commandDocks;

                return;
            }

            main.dataset.commandDocks = String(next);
        };
    }, [commandsDocked]);

    const selectedPicture = currentRichImage(editor, null);

    if (selectedPicture) {
        savedImagePos.current = selectedPicture.pos;
    }

    const editingPicture = currentRichImage(editor, savedImagePos.current);
    const showPictureTools = Boolean(
        editingPicture && (editor?.isActive('richImage') || pictureFieldsFocused),
    );

    const uploadEditorImages = async (files: File[]): Promise<RichImageAttrs[]> => {
        const token = decodeURIComponent(
            document.cookie
                .split('; ')
                .find((row) => row.startsWith('XSRF-TOKEN='))
                ?.slice('XSRF-TOKEN='.length) ?? '',
        );
        const uploaded: RichImageAttrs[] = [];

        for (const file of files) {
            const picture = await prepareEditorPicture(file);
            const body = new FormData();
            body.append('image', picture);
            const response = await fetch(route('admin.editor-images.store'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': token,
                },
                body,
            });
            const payload = (await response.json().catch(() => null)) as {
                url?: string;
                message?: string;
                errors?: { image?: string[] };
            } | null;

            if (!response.ok || !payload?.url) {
                throw new Error(
                    payload?.errors?.image?.[0] ??
                        payload?.message ??
                        'Could not add that picture.',
                );
            }

            const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
            uploaded.push(defaultImageAttrs(payload.url, alt));
        }

        return uploaded;
    };

    const placeUploadedPictures = async (
        files: File[],
        options: {
            replace?: boolean;
            layout?: ImageLayout;
            append?: boolean;
            cursor?: number | null;
            dropX?: number;
            dropY?: number;
        } = {},
    ) => {
        if (!editor || files.length === 0) {
            return;
        }

        const started = performance.now();
        flushSync(() => {
            setUploadingPictures(true);
        });
        await new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve(undefined));
            });
        });

        try {
            const images = await uploadEditorImages(files);

            if (options.dropX !== undefined && options.dropY !== undefined) {
                const coords = editor.view.posAtCoords({
                    left: options.dropX,
                    top: options.dropY,
                });

                if (coords) {
                    try {
                        editor.commands.setTextSelection(coords.pos);
                    } catch {
                        editor.commands.focus();
                    }
                } else {
                    editor.commands.focus('end');
                }
            } else if (
                options.cursor !== undefined &&
                options.cursor !== null &&
                options.cursor <= editor.state.doc.content.size
            ) {
                try {
                    editor.commands.setTextSelection(options.cursor);
                } catch {
                    // The file dialog can leave the cursor on a picture.
                }
            }

            if (options.replace && images[0]) {
                updateRichImage(editor, savedImagePos.current, {
                    src: images[0].src,
                    alt: images[0].alt,
                });

                return;
            }

            const existingLayout = editor.getAttributes('imageGallery').layout;
            const layout: ImageLayout =
                options.layout ??
                (existingLayout === 'stack' ? 'stack' : 'row');

            insertRichImages(
                editor,
                layout,
                images,
                options.append ? savedImagePos.current : null,
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Could not add that picture.',
            );
        } finally {
            const elapsed = performance.now() - started;
            if (elapsed < 900) {
                await new Promise((resolve) => {
                    window.setTimeout(resolve, 900 - elapsed);
                });
            }

            setUploadingPictures(false);
        }
    };

    const choosePictures = (layout: ImageLayout, append: boolean) => {
        pictureLayout.current = layout;
        appendPictures.current = append;
        cursorBeforePictures.current = editor?.state.selection.from ?? null;
        pictureInputRef.current?.click();
    };

    const onPicturesChosen = async (
        event: ChangeEvent<HTMLInputElement>,
        replace: boolean,
    ) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';

        void placeUploadedPictures(files, {
            replace,
            layout: pictureLayout.current,
            append: appendPictures.current,
            cursor: cursorBeforePictures.current,
        });
    };

    placeDroppedPicturesRef.current = (files, x, y) => {
        void placeUploadedPictures(files, { dropX: x, dropY: y });
    };

    useEffect(() => {
        const frame = editorFrameRef.current;
        const form = frame?.closest('form');

        if (!frame || !form) {
            return;
        }

        const carriesFiles = (dataTransfer: DataTransfer | null) => {
            if (!dataTransfer) {
                return false;
            }

            const types = Array.from(dataTransfer.types);

            return (
                types.includes('Files') ||
                types.includes('application/x-moz-file') ||
                dataTransfer.files.length > 0
            );
        };

        const pictureFiles = (dataTransfer: DataTransfer | null) =>
            Array.from(dataTransfer?.files ?? []).filter((file) => {
                if (file.type.startsWith('image/')) {
                    return true;
                }

                return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
            });

        const onDragOver = (event: DragEvent) => {
            if (!carriesFiles(event.dataTransfer)) {
                return;
            }

            event.preventDefault();

            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy';
            }

            const target = event.target;
            setPictureDropActive(
                target instanceof Node && frame.contains(target),
            );
        };

        const onDragLeave = (event: DragEvent) => {
            const next = event.relatedTarget;

            if (next instanceof Node && form.contains(next)) {
                return;
            }

            setPictureDropActive(false);
        };

        const onDrop = (event: DragEvent) => {
            if (!carriesFiles(event.dataTransfer)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            setPictureDropActive(false);

            const target = event.target;
            const frames = Array.from(
                form.querySelectorAll('[data-rich-text-frame]'),
            );
            const hit =
                target instanceof Element
                    ? target.closest('[data-rich-text-frame]')
                    : null;
            const shouldInsert = hit
                ? hit === frame
                : frames[0] === frame;

            if (!shouldInsert) {
                return;
            }

            const files = pictureFiles(event.dataTransfer);

            if (files.length === 0) {
                toast.error('Drop a JPEG, PNG, GIF, or WebP picture.');

                return;
            }

            placeDroppedPicturesRef.current(
                files,
                event.clientX,
                event.clientY,
            );
        };

        form.addEventListener('dragover', onDragOver, true);
        form.addEventListener('dragleave', onDragLeave, true);
        form.addEventListener('drop', onDrop, true);

        return () => {
            form.removeEventListener('dragover', onDragOver, true);
            form.removeEventListener('dragleave', onDragLeave, true);
            form.removeEventListener('drop', onDrop, true);
        };
    }, [editor]);

    const pictureHeight = editingPicture?.node.attrs.height
        ? Number(editingPicture.node.attrs.height)
        : '';

    return (
        <BidTextFieldValuesContext.Provider value={placeholderValues}>
        <div className="flex flex-col gap-2">
        <div
            ref={editorFrameRef}
            data-rich-text-frame
            className={cn(
                'relative flex flex-col overflow-visible rounded-md border bg-background',
                error ? 'border-destructive' : 'border-border',
                pictureDropActive && 'border-emerald-600 ring-2 ring-emerald-600/40',
            )}
        >
            {(() => {
                const commandBar = (
            <div
                ref={commandBarRef}
                className={cn(
                    'rich-text-commands z-30 border-border',
                    commandsDocked
                        ? 'is-pinned flex w-[4rem] shrink-0 flex-col items-center justify-start gap-0.5 overflow-x-hidden overflow-y-auto border-r-2 p-1'
                        : 'relative flex w-full flex-wrap items-center gap-1 border-b-2 p-1.5',
                )}
                style={
                    commandsDocked
                        ? commandSidePose || !dockOriginRef.current
                            ? {
                                  position: 'fixed',
                                  top: commandsOffset,
                                  left: commandsLeft,
                                  width: '4rem',
                                  height: `calc(100vh - ${commandsOffset}px - 0.75rem)`,
                                  zIndex: 28,
                              }
                            : {
                                  position: 'fixed',
                                  top: dockOriginRef.current.top,
                                  left: dockOriginRef.current.left,
                                  width: dockOriginRef.current.width,
                                  height: dockOriginRef.current.height,
                                  zIndex: 28,
                              }
                        : undefined
                }
                onMouseDown={(event) => {
                    const target = event.target;

                    if (
                        target instanceof HTMLInputElement ||
                        target instanceof HTMLTextAreaElement ||
                        target instanceof HTMLSelectElement
                    ) {
                        return;
                    }

                    event.preventDefault();
                    setCommandHint(null);
                }}
                onScroll={() => setCommandHint(null)}
                onMouseOver={(event) => {
                    const target = event.target;

                    if (!(target instanceof Element)) {
                        return;
                    }

                    const control = target.closest('button');

                    if (!(control instanceof HTMLElement)) {
                        setCommandHint(null);

                        return;
                    }

                    const text =
                        control.dataset.commandHint ||
                        control.getAttribute('title') ||
                        control.getAttribute('aria-label');

                    if (!text) {
                        setCommandHint(null);

                        return;
                    }

                    control.dataset.commandHint = text;
                    control.removeAttribute('title');
                    const rect = control.getBoundingClientRect();
                    setCommandHint({
                        text,
                        top: rect.top + rect.height / 2,
                        left: rect.right + 10,
                    });
                }}
                onMouseLeave={() => setCommandHint(null)}
            >
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!editor?.can().undo()}
                    onClick={() => editor?.chain().focus().undo().run()}
                    title="Undo the last change"
                >
                    <Undo2Icon />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!editor?.can().redo()}
                    onClick={() => editor?.chain().focus().redo().run()}
                    title="Redo the last change"
                >
                    <Redo2Icon />
                </Button>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button type="button" variant="ghost" size="icon-sm" title="Change the style, heading, font, or line spacing">
                            {editor?.isActive('heading', { level: 1 }) ? (
                                <Heading1Icon />
                            ) : editor?.isActive('heading', { level: 2 }) ? (
                                <Heading2Icon />
                            ) : editor?.isActive('heading', { level: 3 }) ? (
                                <Heading3Icon />
                            ) : editor?.isActive('heading', { level: 4 }) ? (
                                <Heading4Icon />
                            ) : editor?.isActive('blockquote') ? (
                                <QuoteIcon />
                            ) : editor?.isActive('paragraph') &&
                              isFootnoteBlock(
                                  editor.getAttributes('paragraph'),
                              ) ? (
                                <span className="text-[10px] font-semibold leading-none">
                                    Fn
                                </span>
                            ) : (
                                <PilcrowIcon />
                            )}
                        </Button>
                    }
                >
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            onClick={() =>
                                editor?.chain().focus().setParagraph().run()
                            }
                        >
                            <PilcrowIcon />
                            Paragraph
                        </DropdownMenuItem>
                        {([1, 2, 3, 4] as const).map((level) => {
                            const HeadingIcon = [
                                Heading1Icon,
                                Heading2Icon,
                                Heading3Icon,
                                Heading4Icon,
                            ][level - 1];

                            return (
                                <DropdownMenuItem
                                    key={level}
                                    onClick={() => {
                                        if (!editor) {
                                            return;
                                        }

                                        if (
                                            editor.isActive('heading', {
                                                level,
                                            })
                                        ) {
                                            editor
                                                .chain()
                                                .focus()
                                                .setParagraph()
                                                .run();

                                            return;
                                        }

                                        editor
                                            .chain()
                                            .focus()
                                            .setHeading({ level })
                                            .updateAttributes('heading', {
                                                fontSize: null,
                                            })
                                            .run();
                                    }}
                                >
                                    <HeadingIcon />
                                    Heading {level}
                                </DropdownMenuItem>
                            );
                        })}
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .toggleBlockquote()
                                    .run()
                            }
                        >
                            <QuoteIcon />
                            Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => editor && applyFootnote(editor)}
                        >
                            <span className="w-4 text-center text-[10px] font-semibold leading-none text-muted-foreground">
                                Fn
                            </span>
                            Footnote
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            Font size
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem
                                onClick={() =>
                                    editor &&
                                    applyBlockStyle(editor, { fontSize: null })
                                }
                            >
                                Default
                            </DropdownMenuItem>
                            {FONT_SIZES.map((size) => (
                                <DropdownMenuItem
                                    key={size}
                                    onClick={() =>
                                        editor &&
                                        applyBlockStyle(editor, {
                                            fontSize: `${size}px`,
                                        })
                                    }
                                >
                                    {size}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Font</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem
                                onClick={() =>
                                    editor &&
                                    applyBlockStyle(editor, {
                                        fontFamily: null,
                                    })
                                }
                            >
                                Default
                            </DropdownMenuItem>
                            {FONT_FAMILIES.map((font) => (
                                <DropdownMenuItem
                                    key={font.label}
                                    onClick={() =>
                                        editor &&
                                        applyBlockStyle(editor, {
                                            fontFamily: font.value,
                                        })
                                    }
                                >
                                    <span style={{ fontFamily: font.value }}>
                                        {font.label}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            Line spacing
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem
                                onClick={() =>
                                    editor &&
                                    applyBlockStyle(editor, {
                                        lineHeight: null,
                                    })
                                }
                            >
                                Default
                            </DropdownMenuItem>
                            {LINE_SPACING.map((spacing) => (
                                <DropdownMenuItem
                                    key={spacing.label}
                                    onClick={() =>
                                        editor &&
                                        applyBlockStyle(editor, {
                                            lineHeight: spacing.value,
                                        })
                                    }
                                >
                                    {spacing.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                </ToolbarMenu>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (!editor) {
                            return;
                        }

                        const result = evenDocumentSpacing(editor);

                        if (result.changed) {
                            toast.success(result.message);

                            return;
                        }

                        toast.message(result.message);
                    }}
                    title="Even out the space between headings, paragraphs, and sections"
                >
                    <AlignVerticalSpaceAroundIcon />
                </Button>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('bold'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleBold().run()
                    }
                    aria-label="Bold"
                    title="Make the selected text bold"
                >
                    <BoldIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('italic'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleItalic().run()
                    }
                    aria-label="Italic"
                    title="Make the selected text italic"
                >
                    <ItalicIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('underline'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleUnderline().run()
                    }
                    aria-label="Underline"
                    title="Underline the selected text"
                >
                    <UnderlineIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('strike'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleStrike().run()
                    }
                    aria-label="Strikethrough"
                    title="Strike through the selected text"
                >
                    <StrikethroughIcon />
                </Toggle>
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Change the text color"
                            aria-label="Text color"
                        >
                            <span className="flex flex-col items-center leading-none">
                                <span className="text-sm font-semibold">A</span>
                                <span
                                    className="mt-0.5 h-1 w-3.5 rounded-sm border border-black/10"
                                    style={{
                                        backgroundColor:
                                            (editor?.getAttributes('textStyle')
                                                .color as string | undefined) ||
                                            '#111111',
                                    }}
                                />
                            </span>
                        </Button>
                    }
                >
                    <DropdownMenuLabel>Text color</DropdownMenuLabel>
                    {TEXT_COLORS.map((swatch) => (
                        <DropdownMenuItem
                            key={swatch.value}
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .setColor(swatch.value)
                                    .run()
                            }
                        >
                            <span
                                className="size-4 rounded-sm border border-border"
                                style={{ backgroundColor: swatch.value }}
                            />
                            {swatch.label}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <div
                        className="flex items-center gap-2 px-2 py-1.5 text-sm"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <span>Custom</span>
                        <input
                            type="color"
                            aria-label="Custom text color"
                            className="size-7 cursor-pointer border-0 bg-transparent p-0"
                            value={
                                (editor?.getAttributes('textStyle').color as
                                    | string
                                    | undefined) || '#111111'
                            }
                            onChange={(event) =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .setColor(event.target.value)
                                    .run()
                            }
                        />
                    </div>
                    <DropdownMenuItem
                        onClick={() =>
                            editor?.chain().focus().unsetColor().run()
                        }
                    >
                        Default color
                    </DropdownMenuItem>
                </ToolbarMenu>
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title={
                                editor?.isActive('table')
                                    ? 'Fill this table cell'
                                    : 'Fill this section with a background color'
                            }
                        >
                            <PaintBucketIcon />
                        </Button>
                    }
                >
                    <DropdownMenuLabel>
                        {editor?.isActive('table')
                            ? 'Fill this cell'
                            : 'Fill this section'}
                    </DropdownMenuLabel>
                    <ColorChoices
                        allowClear
                        onSelect={applyFill}
                        onClear={() => applyFill(null)}
                    />
                </ToolbarMenu>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('highlight'))}
                    onPressedChange={() =>
                        editor
                            ?.chain()
                            .focus()
                            .toggleHighlight({ color: '#fef08a' })
                            .run()
                    }
                    aria-label="Highlight"
                    title="Highlight the selected text"
                >
                    <HighlighterIcon />
                </Toggle>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive({ textAlign: 'left' }))}
                    onPressedChange={() =>
                        editor?.chain().focus().setTextAlign('left').run()
                    }
                    aria-label="Align left"
                    title="Align the text to the left"
                >
                    <AlignLeftIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive({ textAlign: 'center' }))}
                    onPressedChange={() =>
                        editor?.chain().focus().setTextAlign('center').run()
                    }
                    aria-label="Align center"
                    title="Center the text"
                >
                    <AlignCenterIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive({ textAlign: 'right' }))}
                    onPressedChange={() =>
                        editor?.chain().focus().setTextAlign('right').run()
                    }
                    aria-label="Align right"
                    title="Align the text to the right"
                >
                    <AlignRightIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(
                        editor?.isActive({ textAlign: 'justify' }),
                    )}
                    onPressedChange={() =>
                        editor?.chain().focus().setTextAlign('justify').run()
                    }
                    aria-label="Justify"
                    title="Justify the text so both edges line up"
                >
                    <AlignJustifyIcon />
                </Toggle>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('bulletList'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleBulletList().run()
                    }
                    aria-label="Bullet list"
                    title="Turn the text into a bullet list"
                >
                    <ListIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('orderedList'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleOrderedList().run()
                    }
                    aria-label="Numbered list"
                    title="Turn the text into a numbered list"
                >
                    <ListOrderedIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('blockquote'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleBlockquote().run()
                    }
                    aria-label="Quote"
                    title="Format the text as a quote"
                >
                    <QuoteIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={currentParagraphHasBox()}
                    onPressedChange={applyBoxedNote}
                    aria-label="Boxed note"
                    title="Put the text in a box"
                >
                    <SquareIcon />
                </Toggle>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={setLink}
                    title="Add a link to the selected text"
                >
                    <Link2Icon />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!editor?.isActive('link')}
                    onClick={() =>
                        editor?.chain().focus().unsetLink().run()
                    }
                    title="Remove the link"
                >
                    <Link2OffIcon />
                </Button>
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button type="button" variant="ghost" size="icon-sm" title="Code, subscript, superscript, and clear formatting">
                            <EllipsisIcon />
                        </Button>
                    }
                >
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            onClick={() =>
                                editor?.chain().focus().toggleCode().run()
                            }
                        >
                            <CodeIcon />
                            Inline code
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .toggleCodeBlock()
                                    .run()
                            }
                        >
                            <CodeIcon />
                            Code block
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .toggleSubscript()
                                    .run()
                            }
                        >
                            <SubscriptIcon />
                            Subscript
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .toggleSuperscript()
                                    .run()
                            }
                        >
                            <SuperscriptIcon />
                            Superscript
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .unsetAllMarks()
                                    .clearNodes()
                                    .run()
                            }
                        >
                            <RemoveFormattingIcon />
                            Clear formatting
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </ToolbarMenu>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingPictures}
                            title={uploadingPictures ? 'Adding pictures' : 'Add pictures side by side or one under another'}
                        >
                            <ImageIcon />
                        </Button>
                    }
                >
                    <DropdownMenuLabel>Add pictures</DropdownMenuLabel>
                    <DropdownMenuItem
                        onSelect={() => choosePictures('row', false)}
                    >
                        <ImagesIcon />
                        Side by side
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() => choosePictures('stack', false)}
                    >
                        <Rows3Icon />
                        One under another
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={() => {
                            if (!editor) {
                                return;
                            }

                            const picture = currentRichImage(
                                editor,
                                savedImagePos.current,
                            );

                            if (!picture) {
                                toast.message(
                                    'Click a picture first, then choose Same size.',
                                );

                                return;
                            }

                            matchRichImageSize(editor, picture.pos);
                        }}
                    >
                        <ScalingIcon />
                        Same size
                    </DropdownMenuItem>
                </ToolbarMenu>
                {showPictureTools && editingPicture ? (
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Place these pictures side by side"
                            onClick={() =>
                                editor &&
                                setImageGalleryLayout(
                                    editor,
                                    'row',
                                    savedImagePos.current,
                                )
                            }
                        >
                            <Columns3Icon />
                            Side by side
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Place these pictures one under another"
                            onClick={() =>
                                editor &&
                                setImageGalleryLayout(
                                    editor,
                                    'stack',
                                    savedImagePos.current,
                                )
                            }
                        >
                            <Rows3Icon />
                            Stacked
                        </Button>
                        {IMAGE_SIZE_PRESETS.map((preset) => (
                            <Button
                                key={preset.label}
                                type="button"
                                variant="ghost"
                                size="sm"
                                title={preset.label}
                                onClick={() =>
                                    editor &&
                                    updateRichImage(editor, savedImagePos.current, {
                                        width: preset.width,
                                        height: preset.height,
                                    })
                                }
                            >
                                <span className="text-[11px] font-semibold leading-none">
                                    {preset.label.slice(0, 1)}
                                </span>
                            </Button>
                        ))}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-labeled-command
                            title="Make every picture in this group the same size"
                            onClick={() =>
                                editor &&
                                matchRichImageSize(editor, savedImagePos.current)
                            }
                        >
                            <ScalingIcon />
                            <span>Same size</span>
                        </Button>
                        <div
                            data-picture-fields
                            className="flex items-center gap-1"
                            onMouseDown={(event) => event.stopPropagation()}
                            onFocus={() => setPictureFieldsFocused(true)}
                            onBlur={(event) => {
                                const next = event.relatedTarget;

                                if (
                                    next instanceof Node &&
                                    event.currentTarget.contains(next)
                                ) {
                                    return;
                                }

                                setPictureFieldsFocused(false);
                            }}
                        >
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                Space
                                <input
                                    type="number"
                                    min={0}
                                    max={80}
                                    className="h-7 w-16 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                                    value={
                                        spaceDraft ??
                                        String(
                                            Number(
                                                editor?.getAttributes(
                                                    'imageGallery',
                                                ).gap,
                                            ) || 16,
                                        )
                                    }
                                    aria-label="Space between pictures"
                                    title="Equal space between pictures"
                                    onFocus={(event) => {
                                        setPictureFieldsFocused(true);
                                        setSpaceDraft(event.currentTarget.value);
                                    }}
                                    onChange={(event) =>
                                        setSpaceDraft(event.target.value)
                                    }
                                    onBlur={(event) => {
                                        const gap = Number.parseInt(
                                            event.target.value,
                                            10,
                                        );

                                        if (editor && Number.isFinite(gap)) {
                                            setImageGap(
                                                editor,
                                                gap,
                                                savedImagePos.current,
                                            );
                                        }

                                        setSpaceDraft(null);
                                    }}
                                    onKeyDown={(event) => {
                                        event.stopPropagation();

                                        if (event.key === 'Enter') {
                                            event.currentTarget.blur();
                                        }
                                    }}
                                />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                H
                                <input
                                    type="number"
                                    min={48}
                                    className="h-7 w-16 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                                    value={
                                        heightDraft ??
                                        (pictureHeight === ''
                                            ? ''
                                            : String(pictureHeight))
                                    }
                                    placeholder="Auto"
                                    aria-label="Picture height"
                                    onFocus={(event) => {
                                        setPictureFieldsFocused(true);
                                        setHeightDraft(event.currentTarget.value);
                                    }}
                                    onChange={(event) =>
                                        setHeightDraft(event.target.value)
                                    }
                                    onBlur={(event) => {
                                        if (!editor) {
                                            setHeightDraft(null);

                                            return;
                                        }

                                        const raw = event.target.value.trim();

                                        if (raw === '') {
                                            updateRichImage(
                                                editor,
                                                savedImagePos.current,
                                                { height: null },
                                            );
                                        } else {
                                            const height = Number.parseInt(
                                                raw,
                                                10,
                                            );

                                            if (Number.isFinite(height)) {
                                                updateRichImage(
                                                    editor,
                                                    savedImagePos.current,
                                                    { height },
                                                );
                                            }
                                        }

                                        setHeightDraft(null);
                                    }}
                                    onKeyDown={(event) => {
                                        event.stopPropagation();

                                        if (event.key === 'Enter') {
                                            event.currentTarget.blur();
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Add another picture to this group"
                            onClick={() => {
                                const galleryLayout = editor?.getAttributes(
                                    'imageGallery',
                                ).layout;
                                choosePictures(
                                    galleryLayout === 'stack' ? 'stack' : 'row',
                                    true,
                                );
                            }}
                        >
                            <ImagePlusIcon />
                            Add picture
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Replace this picture"
                            onClick={() => replaceInputRef.current?.click()}
                        >
                            <span className="text-[10px] font-semibold leading-none">
                                New
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Remove this picture"
                            onClick={() =>
                                editor &&
                                removeRichImage(editor, savedImagePos.current)
                            }
                        >
                            <Trash2Icon />
                            Remove
                        </Button>
                    </>
                ) : null}
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button type="button" variant="outline" size="icon-sm" title="Add a table, colored section, or colored line">
                            <TableIcon />
                        </Button>
                    }
                >
                    <DropdownMenuLabel>Insert layout blocks</DropdownMenuLabel>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <TableIcon />
                            Table with headers
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {[2, 3, 4, 5, 6].map((columns) => (
                                <DropdownMenuItem
                                    key={columns}
                                    onClick={() => insertTable(columns, true)}
                                >
                                    {columns} columns
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Columns3Icon />
                            Summary, no header
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {[2, 3, 4, 5, 6].map((columns) => (
                                <DropdownMenuItem
                                    key={columns}
                                    onClick={() => insertTable(columns, false)}
                                >
                                    {columns} columns
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={applyBoxedNote}>
                        <SquareIcon />
                        Boxed note
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Add a colored section</DropdownMenuLabel>
                    <ColorChoices onSelect={insertColoredSection} />
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Colored line</DropdownMenuLabel>
                    <ColorChoices
                        onSelect={(color) => insertColoredLine(color)}
                    />
                    <DropdownMenuItem
                        onClick={() =>
                            insertColoredLine(LAYOUT_COLORS[0], '8px')
                        }
                    >
                        <MinusIcon />
                        Thick navy bar
                    </DropdownMenuItem>
                </ToolbarMenu>
                {editor?.isActive('table') ? (
                    <>
                        {currentTableHasHeaders(editor) ? (
                            <ToolbarMenu
                                onOpenChange={handleMenuOpenChange}
                                trigger={
                                    <Button type="button" variant="ghost" size="icon-sm" title="Header fill">
                                        <PaintBucketIcon />
                                    </Button>
                                }
                            >
                                <DropdownMenuLabel>
                                    Table header color
                                </DropdownMenuLabel>
                                <ColorChoices
                                    onSelect={(color) =>
                                        fillCurrentTableHeaders(
                                            editor,
                                            color.value,
                                            color.text,
                                        )
                                    }
                                />
                            </ToolbarMenu>
                        ) : null}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-labeled-command
                            title="Add a row above this one"
                            disabled={!editor.can().addRowBefore()}
                            onClick={() =>
                                editor.chain().focus().addRowBefore().run()
                            }
                        >
                            <Rows3Icon />
                            <span>Row above</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-labeled-command
                            title="Add a row below this one"
                            disabled={!editor.can().addRowAfter()}
                            onClick={() =>
                                editor.chain().focus().addRowAfter().run()
                            }
                        >
                            <Rows3Icon />
                            <span>Row below</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-labeled-command
                            title="Remove this row"
                            disabled={!editor.can().deleteRow()}
                            onClick={() =>
                                editor.chain().focus().deleteRow().run()
                            }
                        >
                            <MinusIcon />
                            <span>Remove row</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Add column"
                            onClick={() =>
                                editor.chain().focus().addColumnAfter().run()
                            }
                        >
                            <Columns3Icon />
                            Add column
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Remove column"
                            onClick={() =>
                                editor.chain().focus().deleteColumn().run()
                            }
                        >
                            <MinusIcon />
                            Remove column
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Delete table"
                            onClick={() =>
                                editor.chain().focus().deleteTable().run()
                            }
                        >
                            <Trash2Icon />
                        </Button>
                    </>
                ) : null}
                {editor?.isActive('coloredSection') ? (
                    <>
                        <ToolbarMenu
                            onOpenChange={handleMenuOpenChange}
                            trigger={
                                <Button type="button" variant="ghost" size="icon-sm" title="Change this section color">
                                    <PaintBucketIcon />
                                </Button>
                            }
                        >
                            <DropdownMenuLabel>
                                Section background
                            </DropdownMenuLabel>
                            <ColorChoices onSelect={recolorColoredSection} />
                        </ToolbarMenu>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Remove section"
                            onClick={removeColoredSection}
                        >
                            <Trash2Icon />
                            Remove section
                        </Button>
                    </>
                ) : null}
                {showPlaceholders ? (
                    <>
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <InsertBidTextFieldMenu
                            onOpenChange={handleMenuOpenChange}
                            fields={insertableFields}
                            values={placeholderValues}
                            onInsert={insertPlaceholder}
                            intro={placeholderIntro}
                            searchPlaceholder={placeholderSearchPlaceholder}
                            allowCreate={allowCreatePlaceholder}
                            groupOrder={placeholderGroupOrder}
                            pages={placeholderPages}
                        />
                    </>
                ) : null}
            </div>
                );

                const commandHintPopover = commandHint
                    ? createPortal(
                          <div
                              className="pointer-events-none fixed z-[210] max-w-xs -translate-y-1/2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md"
                              style={{
                                  top: commandHint.top,
                                  left: commandHint.left,
                              }}
                          >
                              {commandHint.text}
                          </div>,
                          document.body,
                      )
                    : null;

                return (
                    <>
                        {commandsDocked
                            ? createPortal(commandBar, document.body)
                            : commandBar}
                        {commandHintPopover}
                    </>
                );
            })()}
            <div className="relative min-w-0 flex-1">
            <input
                ref={pictureInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(event) => onPicturesChosen(event, false)}
            />
            <input
                ref={replaceInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(event) => onPicturesChosen(event, true)}
            />
            <EditorContent editor={editor} />
            {pictureDropActive ? (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-md border-2 border-dashed border-emerald-600 bg-emerald-50/90 text-sm font-medium text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100">
                    <span className="flex items-center gap-2">
                        <ImageIcon />
                        Drop pictures here
                    </span>
                </div>
            ) : null}
            </div>
            {uploadingPictures
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/55"
                          role="status"
                          aria-live="polite"
                      >
                          <span className="flex items-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground shadow-lg">
                              <LoaderCircleIcon className="size-5 animate-spin" />
                              Making the picture smaller and saving it…
                          </span>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
        <p className="text-xs text-muted-foreground">
            Misspelled words are underlined. Right-click a word to see
            suggested corrections. Drop pictures onto the text to add them.
        </p>
        </div>
        </BidTextFieldValuesContext.Provider>
    );
}
