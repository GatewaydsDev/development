import { Button } from '@/Components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
    AlignJustifyIcon,
    AlignLeftIcon,
    AlignRightIcon,
    BoldIcon,
    CodeIcon,
    Columns3Icon,
    Heading1Icon,
    Heading2Icon,
    Heading3Icon,
    HighlighterIcon,
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
import { type ReactNode, useEffect, useMemo, useReducer, useRef } from 'react';
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

function contrastingText(hex: string): string {
    const value = hex.replace('#', '');

    if (value.length < 6) {
        return '#111111';
    }

    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

    return luminance > 0.62 ? '#111111' : '#FFFFFF';
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
        source?: string | null;
    }>;
    placeholderValues?: Record<string, string>;
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
}: RichTextEditorProps) {
    const { i18n } = useTranslation();
    const documentLang = i18n.language?.startsWith('es') ? 'es' : 'en-US';
    const ignoreToolbarRefresh = useRef(false);
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
            Placeholder.configure({ placeholder }),
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
        () => mergeBidTextPlaceholders(placeholderFields),
        [placeholderFields],
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

    const insertTable = (headerColor: LayoutColor = LAYOUT_COLORS[0]) => {
        const headerStyle = `background-color: ${headerColor.value}; color: ${headerColor.text};`;
        const headers = ['Column 1', 'Column 2', 'Column 3']
            .map(
                (label) =>
                    `<th style="${headerStyle}"><p>${label}</p></th>`,
            )
            .join('');
        const emptyRow =
            '<tr><td><p><br></p></td><td><p><br></p></td><td><p><br></p></td></tr>';

        editor
            ?.chain()
            .focus()
            .insertContent(
                `<table><tbody><tr>${headers}</tr>${emptyRow}${emptyRow}</tbody></table>`,
            )
            .run();
    };

    const insertColoredSection = (color: LayoutColor) => {
        editor
            ?.chain()
            .focus()
            .insertContent({
                type: 'paragraph',
                attrs: {
                    backgroundColor: color.value,
                    color: color.text,
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    marginTop: '12px',
                    marginBottom: '12px',
                },
                content: [
                    {
                        type: 'text',
                        text: 'Section title',
                        marks: [
                            {
                                type: 'textStyle',
                                attrs: { color: color.text },
                            },
                        ],
                    },
                ],
            })
            .run();
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

        if (!open) {
            refreshToolbar();
        }
    };

    return (
        <BidTextFieldValuesContext.Provider value={placeholderValues}>
        <div className="flex flex-col gap-2">
        <div
            className={cn(
                'overflow-visible rounded-md border bg-background',
                error ? 'border-destructive' : 'border-border',
            )}
        >
            <div
                className="relative z-20 flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-2"
                onMouseDown={(event) => event.preventDefault()}
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
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .toggleHeading({ level: 1 })
                                    .run()
                            }
                        >
                            <Heading1Icon />
                            Heading 1
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .toggleHeading({ level: 2 })
                                    .run()
                            }
                        >
                            <Heading2Icon />
                            Heading 2
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .toggleHeading({ level: 3 })
                                    .run()
                            }
                        >
                            <Heading3Icon />
                            Heading 3
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </ToolbarMenu>
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
                <label
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg hover:bg-muted"
                    title="Text color"
                >
                    <input
                        type="color"
                        className="size-4 cursor-pointer border-0 bg-transparent p-0"
                        value={
                            (editor?.getAttributes('textStyle').color as
                                | string
                                | undefined) || '#171717'
                        }
                        onChange={(event) =>
                            editor
                                ?.chain()
                                .focus()
                                .setColor(event.target.value)
                                .run()
                        }
                    />
                </label>
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
                        <Button type="button" variant="outline" size="sm">
                            <TableIcon />
                            Layout
                        </Button>
                    }
                >
                    <DropdownMenuLabel>Insert layout blocks</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => insertTable()}>
                        <TableIcon />
                        Table with colored header
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Colored section</DropdownMenuLabel>
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
                            size="icon-sm"
                            title="Add column"
                            onClick={() =>
                                editor.chain().focus().addColumnAfter().run()
                            }
                        >
                            <Columns3Icon />
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
                {showPlaceholders ? (
                    <>
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <InsertBidTextFieldMenu
                            onOpenChange={handleMenuOpenChange}
                            fields={insertableFields}
                            values={placeholderValues}
                            onInsert={insertPlaceholder}
                        />
                    </>
                ) : null}
            </div>
            <EditorContent editor={editor} />
        </div>
        <p className="text-xs text-muted-foreground">
            Misspelled words are underlined. Right-click a word to see
            suggested corrections.
        </p>
        </div>
        </BidTextFieldValuesContext.Provider>
    );
}
