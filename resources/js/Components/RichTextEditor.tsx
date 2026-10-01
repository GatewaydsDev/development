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
    type DragEvent as ReactDragEvent,
    type FocusEvent as ReactFocusEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';
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
                align="start"
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

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Write or adapt this text…',
    error,
    id,
    compact = false,
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
    const releaseCommandsTimer = useRef<number | null>(null);
    const [commandsPinned, setCommandsPinned] = useState(false);
    const [commandsOffset, setCommandsOffset] = useState(0);
    const [uploadingPictures, setUploadingPictures] = useState(false);
    const [pictureDropActive, setPictureDropActive] = useState(false);
    const pictureDragDepth = useRef(0);
    const [pictureFieldsFocused, setPictureFieldsFocused] = useState(false);
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

    const insertTable = (
        columns: number,
        headerColor: LayoutColor = LAYOUT_COLORS[0],
    ) => {
        const count = Math.min(6, Math.max(2, columns));
        const headerStyle = `background-color: ${headerColor.value}; color: ${headerColor.text};`;
        const headers = Array.from({ length: count }, (_, index) => {
            return `<th style="${headerStyle}"><p>Column ${index + 1}</p></th>`;
        }).join('');
        const cells = Array.from(
            { length: count },
            () => '<td><p><br></p></td>',
        ).join('');
        const emptyRow = `<tr>${cells}</tr>`;

        editor
            ?.chain()
            .focus()
            .insertContent(
                `<table><tbody><tr>${headers}</tr>${emptyRow}${emptyRow}</tbody></table>`,
            )
            .run();
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

    const pinCommands = () => {
        if (releaseCommandsTimer.current !== null) {
            window.clearTimeout(releaseCommandsTimer.current);
            releaseCommandsTimer.current = null;
        }

        setCommandsPinned(true);
    };

    const scheduleReleaseCommands = () => {
        if (releaseCommandsTimer.current !== null) {
            window.clearTimeout(releaseCommandsTimer.current);
        }

        releaseCommandsTimer.current = window.setTimeout(() => {
            releaseCommandsTimer.current = null;

            if (ignoreToolbarRefresh.current) {
                return;
            }

            const frame = editorFrameRef.current;

            if (frame?.contains(document.activeElement)) {
                return;
            }

            setCommandsPinned(false);
        }, 0);
    };

    const handleMenuOpenChange = (open: boolean) => {
        ignoreToolbarRefresh.current = open;

        if (open) {
            pinCommands();
            return;
        }

        refreshToolbar();
        scheduleReleaseCommands();
    };

    useEffect(() => {
        const nav = document.querySelector('nav');

        if (!nav) {
            return;
        }

        const updateOffset = () => {
            setCommandsOffset(Math.ceil(nav.getBoundingClientRect().height));
        };

        updateOffset();
        const observer = new ResizeObserver(updateOffset);
        observer.observe(nav);

        return () => observer.disconnect();
    }, []);

    useEffect(
        () => () => {
            if (releaseCommandsTimer.current !== null) {
                window.clearTimeout(releaseCommandsTimer.current);
            }
        },
        [],
    );

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
            const body = new FormData();
            body.append('image', file);
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

    const dragCarriesFiles = (dataTransfer: DataTransfer | null) =>
        Boolean(
            dataTransfer &&
                Array.from(dataTransfer.types).includes('Files'),
        );

    const droppedPictures = (dataTransfer: DataTransfer | null) => {
        if (!dataTransfer) {
            return [];
        }

        return Array.from(dataTransfer.files).filter((file) =>
            ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
                file.type,
            ),
        );
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

        setUploadingPictures(true);

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

    const onPictureDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!dragCarriesFiles(event.dataTransfer)) {
            return;
        }

        event.preventDefault();
        pictureDragDepth.current += 1;
        setPictureDropActive(true);
    };

    const onPictureDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!dragCarriesFiles(event.dataTransfer)) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    const onPictureDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!dragCarriesFiles(event.dataTransfer)) {
            return;
        }

        pictureDragDepth.current = Math.max(0, pictureDragDepth.current - 1);

        if (pictureDragDepth.current === 0) {
            setPictureDropActive(false);
        }
    };

    const onPictureDrop = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!dragCarriesFiles(event.dataTransfer)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        pictureDragDepth.current = 0;
        setPictureDropActive(false);

        const files = droppedPictures(event.dataTransfer);

        if (files.length === 0) {
            toast.error('Drop a JPEG, PNG, GIF, or WebP picture.');

            return;
        }

        void placeUploadedPictures(files, {
            dropX: event.clientX,
            dropY: event.clientY,
        });
    };

    const pictureHeight = editingPicture?.node.attrs.height
        ? Number(editingPicture.node.attrs.height)
        : '';

    return (
        <BidTextFieldValuesContext.Provider value={placeholderValues}>
        <div className="flex flex-col gap-2">
        <div
            ref={editorFrameRef}
            className={cn(
                'relative overflow-visible rounded-md border bg-background',
                error ? 'border-destructive' : 'border-border',
                pictureDropActive && 'border-emerald-600 ring-2 ring-emerald-600/40',
            )}
            onDragEnterCapture={onPictureDragEnter}
            onDragOverCapture={onPictureDragOver}
            onDragLeaveCapture={onPictureDragLeave}
            onDropCapture={onPictureDrop}
            onFocus={pinCommands}
            onBlur={(event: ReactFocusEvent<HTMLDivElement>) => {
                const next = event.relatedTarget;

                if (next instanceof Node && event.currentTarget.contains(next)) {
                    return;
                }

                scheduleReleaseCommands();
            }}
        >
            <div
                className={cn(
                    'rich-text-commands z-20 flex flex-wrap items-center gap-1 border-b-2 p-2',
                    commandsPinned ? 'is-pinned sticky' : 'relative',
                )}
                style={
                    commandsPinned ? { top: commandsOffset } : undefined
                }
                onMouseDown={(event) => {
                    const target = event.target;

                    if (
                        target instanceof HTMLInputElement ||
                        target instanceof HTMLTextAreaElement ||
                        target instanceof HTMLSelectElement
                    ) {
                        pinCommands();

                        return;
                    }

                    event.preventDefault();
                    pinCommands();
                }}
            >
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!editor?.can().undo()}
                    onClick={() => editor?.chain().focus().undo().run()}
                    title="Undo"
                >
                    <Undo2Icon />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!editor?.can().redo()}
                    onClick={() => editor?.chain().focus().redo().run()}
                    title="Redo"
                >
                    <Redo2Icon />
                </Button>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button type="button" variant="ghost" size="sm">
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
                            Style
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
                    title="Check the whole document and make the space between headings, paragraphs, and sections equal"
                >
                    <AlignVerticalSpaceAroundIcon />
                    Check spacing
                </Button>
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('bold'))}
                    onPressedChange={() =>
                        editor?.chain().focus().toggleBold().run()
                    }
                    aria-label="Bold"
                    title="Bold"
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
                    title="Italic"
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
                    title="Underline"
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
                    title="Strikethrough"
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
                            title="Text color"
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
                                    ? 'Cell fill color'
                                    : 'Section fill color'
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
                    title="Highlight"
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
                    title="Align left"
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
                    title="Align center"
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
                    title="Align right"
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
                    title="Justify"
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
                    title="Bullet list"
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
                    title="Numbered list"
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
                    title="Quote"
                >
                    <QuoteIcon />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={currentParagraphHasBox()}
                    onPressedChange={applyBoxedNote}
                    aria-label="Boxed note"
                    title="Boxed note"
                >
                    <SquareIcon />
                </Toggle>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={setLink}
                    title="Add link"
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
                    title="Remove link"
                >
                    <Link2OffIcon />
                </Button>
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    trigger={
                        <Button type="button" variant="ghost" size="sm">
                            More
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
                        >
                            <ImageIcon />
                            {uploadingPictures ? 'Adding pictures…' : 'Pictures'}
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
                                onClick={() =>
                                    editor &&
                                    updateRichImage(editor, savedImagePos.current, {
                                        width: preset.width,
                                        height: preset.height,
                                    })
                                }
                            >
                                {preset.label}
                            </Button>
                        ))}
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
                                        Number(
                                            editor?.getAttributes('imageGallery')
                                                .gap,
                                        ) || 16
                                    }
                                    aria-label="Space between pictures"
                                    title="Equal space between pictures"
                                    onChange={(event) => {
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
                                    }}
                                />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                H
                                <input
                                    type="number"
                                    min={48}
                                    className="h-7 w-16 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                                    value={pictureHeight}
                                    placeholder="Auto"
                                    aria-label="Picture height"
                                    onChange={(event) => {
                                        if (!editor) {
                                            return;
                                        }

                                        const raw = event.target.value.trim();

                                        if (raw === '') {
                                            updateRichImage(
                                                editor,
                                                savedImagePos.current,
                                                { height: null },
                                            );

                                            return;
                                        }

                                        const height = Number.parseInt(raw, 10);

                                        if (Number.isFinite(height)) {
                                            updateRichImage(
                                                editor,
                                                savedImagePos.current,
                                                { height },
                                            );
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Make every picture in this group this size"
                            onClick={() =>
                                editor &&
                                matchRichImageSize(editor, savedImagePos.current)
                            }
                        >
                            Same size
                        </Button>
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
                            Replace
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
                        <Button type="button" variant="outline" size="sm">
                            <TableIcon />
                            Layout
                        </Button>
                    }
                >
                    <DropdownMenuLabel>Insert layout blocks</DropdownMenuLabel>
                    <DropdownMenuLabel>Add a table</DropdownMenuLabel>
                    {[2, 3, 4, 5, 6].map((columns) => (
                        <DropdownMenuItem
                            key={columns}
                            onClick={() => insertTable(columns)}
                        >
                            <TableIcon />
                            {columns} columns
                        </DropdownMenuItem>
                    ))}
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
                        <ToolbarMenu
                            onOpenChange={handleMenuOpenChange}
                            trigger={
                                <Button type="button" variant="ghost" size="sm">
                                    Header fill
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
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Add row"
                            onClick={() =>
                                editor.chain().focus().addRowAfter().run()
                            }
                        >
                            <Rows3Icon />
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
                            title="Delete row"
                            onClick={() =>
                                editor.chain().focus().deleteRow().run()
                            }
                        >
                            <MinusIcon />
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
                                <Button type="button" variant="ghost" size="sm">
                                    <PaintBucketIcon />
                                    Section color
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
        <p className="text-xs text-muted-foreground">
            Misspelled words are underlined. Right-click a word to see
            suggested corrections. Drop pictures onto the text to add them.
        </p>
        </div>
        </BidTextFieldValuesContext.Provider>
    );
}
