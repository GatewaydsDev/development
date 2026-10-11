import { Button } from '@/Components/ui/button';
import StickyDocumentToolbar from '@/Components/StickyDocumentToolbar';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import { Description, Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { Separator } from '@/Components/ui/separator';
import { Toggle } from '@/Components/ui/toggle';
import { cn } from '@/lib/utils';
import { CellSelection } from '@tiptap/pm/tables';
import { PRINT_LAYOUT_FONT_CHOICES, printLayoutTextCase } from '@/lib/printLayoutGeometry';
import { blockMoveModeKey, RichTextBlockDrag } from '@/Components/richTextBlockDrag';
import { enablePositionCanvas, evenCanvasSpacing, PositionCanvas, PositionItem } from '@/Components/richTextPositionCanvas';
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
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
    ImportedBlockStyles,
    ImportedTextStyles,
    richTextLayoutExtensions,
    selectedTableColumn,
    resizeTableColumn,
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
    ChevronDownIcon,
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
    MoveIcon,
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
    LayoutTemplateIcon,
    TypeIcon,
    TableIcon,
    Trash2Icon,
    UnderlineIcon,
    Undo2Icon,
} from 'lucide-react';
import InsertBidTextFieldMenu from '@/Components/InsertBidTextFieldMenu';
import type { LayoutSection } from '@/Pages/Admin/Bids/layoutSections';
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

const FONT_FAMILIES = PRINT_LAYOUT_FONT_CHOICES
    .filter((choice) => choice.id !== 'default')
    .map((choice) => ({ label: choice.label, value: choice.stack }));

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
    if (editor.state.doc.firstChild?.type.name === 'positionCanvas') {
        const changed = evenCanvasSpacing(editor);
        return {
            changed,
            message: changed
                ? 'Sections now have equal 16px gaps. Side-by-side items keep their alignment.'
                : 'Positioned sections already have equal 16px gaps.',
        };
    }
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

            const apply = (node: import('@tiptap/pm/model').Node, pos: number) => {
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
            };
            if (state.selection instanceof CellSelection) {
                state.selection.forEachCell((cell, pos) => {
                    cell.descendants((node, offset) => apply(node, pos + 1 + offset));
                });
            } else {
                state.doc.nodesBetween(from, to, apply);
            }

            return changed;
        })
        .run();
}

function toggleInlineEmphasis(editor: Editor, type: 'bold' | 'italic'): boolean {
    let imported = false;
    const { from, to } = editor.state.selection;
    editor.state.doc.nodesBetween(from, to, (node) => {
        if (node.attrs.pdfFontSrc || node.attrs.fontSynthesis === 'none'
            || node.marks.some(mark => mark.attrs.fontSynthesis === 'none')) imported = true;
    });
    const chain = editor.chain().focus();
    if (imported) chain.setMark('textStyle', { fontSynthesis: 'weight style' });
    return (type === 'bold' ? chain.toggleBold() : chain.toggleItalic()).run();
}

const ImportedInlineEmphasis = Extension.create({
    name: 'importedInlineEmphasis',
    priority: 1100,
    addKeyboardShortcuts() {
        return {
            'Mod-b': () => toggleInlineEmphasis(this.editor, 'bold'),
            'Mod-i': () => toggleInlineEmphasis(this.editor, 'italic'),
        };
    },
});

function applyTextColor(editor: Editor, color: string | null) {
    if (!(editor.state.selection instanceof CellSelection)) {
        if (color) editor.chain().focus().setColor(color).run();
        else editor.chain().focus().unsetColor().run();
        return;
    }
    const { tr, schema, selection } = editor.state;
    selection.forEachCell((cell, pos) => {
        tr.setNodeMarkup(pos, undefined, { ...cell.attrs, color });
        cell.descendants((node, offset) => {
            const at = pos + 1 + offset;
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                tr.setNodeMarkup(at, undefined, { ...node.attrs, color });
            }
            if (node.isText) {
                const existing = node.marks.find((mark) => mark.type === schema.marks.textStyle);
                tr.removeMark(at, at + node.nodeSize, schema.marks.textStyle);
                const attrs = { ...existing?.attrs, color };
                if (Object.values(attrs).some(Boolean)) {
                    tr.addMark(at, at + node.nodeSize, schema.marks.textStyle.create(attrs));
                }
            }
        });
    });
    editor.view.dispatch(tr);
    editor.view.focus();
}

function applyEditorTextCase(editor: Editor, mode: string) {
    const { state } = editor;
    const ranges: Array<{ from: number; to: number }> = [];
    if (state.selection instanceof CellSelection) {
        state.selection.forEachCell((cell, pos) => ranges.push({ from: pos + 1, to: pos + cell.nodeSize - 1 }));
    } else if (state.selection.empty && state.selection.$from.parent.isTextblock) {
        ranges.push({ from: state.selection.$from.start(), to: state.selection.$from.end() });
    } else {
        ranges.push({ from: state.selection.from, to: state.selection.to });
    }
    const changes: Array<{ from: number; to: number; text: string; marks: import('@tiptap/pm/model').Node['marks'] }> = [];
    const tr = state.tr;
    for (const range of ranges) {
        const caseState = { hasWord: false, capitalizeNext: false };
        state.doc.nodesBetween(range.from, range.to, (node, pos) => {
            if (node.type.name === 'hardBreak') {
                caseState.hasWord = false;
                caseState.capitalizeNext = false;
            }
            if (node.isTextblock) {
                caseState.hasWord = false;
                caseState.capitalizeNext = false;
                if (range.from <= pos + 1 && range.to >= pos + node.nodeSize - 1) {
                    tr.setNodeMarkup(pos, undefined, { ...node.attrs, editorTextCase: mode, textTransform: null });
                }
            }
            if (!node.isText && node.type.name !== 'bidTextField') return;
            const parent = state.doc.resolve(pos);
            const partial = range.from > parent.start() || range.to < parent.end();
            const existing = node.marks.find(mark => mark.type === state.schema.marks.textStyle);
            const marks = partial || existing?.attrs.textCase || existing?.attrs.textTransform
                ? [...node.marks.filter(mark => mark.type !== state.schema.marks.textStyle),
                    state.schema.marks.textStyle.create({
                        ...existing?.attrs,
                        textCase: mode === 'original' && !partial ? null : mode,
                        textTransform: 'none',
                    })]
                : node.marks;
            if (node.type.name === 'bidTextField') {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, textCase: mode }, marks);
                caseState.hasWord = true;
                return;
            }
            const from = Math.max(pos, range.from);
            const to = Math.min(pos + node.nodeSize, range.to);
            if (from >= to) return;
            const source = (node.text ?? '').slice(from - pos, to - pos);
            let text = '';
            for (const part of source.split(/(\{\{\s*[a-z0-9_]+\s*}})/gi)) {
                if (mode === 'original') {
                    text += part;
                } else if (/^\{\{/.test(part)) {
                    text += part;
                    caseState.hasWord = true;
                } else {
                    text += printLayoutTextCase(part, mode, caseState);
                }
            }
            changes.push({ from, to, text, marks });
        });
    }
    for (const change of changes.sort((a, b) => b.from - a.from)) {
        if (change.text) tr.replaceWith(change.from, change.to, state.schema.text(change.text, change.marks));
        else tr.delete(change.from, change.to);
    }
    editor.view.dispatch(tr);
    editor.view.focus();
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
    background: string | null,
    color: string | null,
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

function fillCurrentTableCells(editor: Editor, color: LayoutColor | null) {
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
        if (
            node.type.name !== 'tableCell' &&
            node.type.name !== 'tableHeader'
        ) {
            return;
        }

        tr = tr.setNodeMarkup(tablePos + 1 + pos, undefined, {
            ...node.attrs,
            backgroundColor: color?.value ?? null,
            color: color?.text ?? null,
        });
    });

    editor.view.dispatch(tr);
}

function setCurrentTableBorders(editor: Editor, border: string | null) {
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
        if (
            node.type.name !== 'tableCell' &&
            node.type.name !== 'tableHeader'
        ) {
            return;
        }

        tr = tr.setNodeMarkup(tablePos + 1 + pos, undefined, {
            ...node.attrs,
            border,
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
    allowCustom,
}: {
    onSelect: (color: LayoutColor) => void;
    allowClear?: boolean;
    onClear?: () => void;
    allowCustom?: boolean;
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
            {allowCustom ? (
                <div
                    className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    <label className="flex w-full cursor-pointer items-center justify-between gap-3">
                        Custom color
                        <input
                            type="color"
                            aria-label="Choose a custom background color"
                            className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                            onChange={(event) => {
                                const value = event.target.value;
                                const channels = [1, 3, 5].map((offset) => {
                                    const channel =
                                        Number.parseInt(
                                            value.slice(offset, offset + 2),
                                            16,
                                        ) / 255;

                                    return channel <= 0.04045
                                        ? channel / 12.92
                                        : ((channel + 0.055) / 1.055) ** 2.4;
                                });
                                const luminance =
                                    0.2126 * channels[0] +
                                    0.7152 * channels[1] +
                                    0.0722 * channels[2];

                                onSelect({
                                    label: 'Custom',
                                    value,
                                    text:
                                        luminance > 0.179
                                            ? '#111111'
                                            : '#FFFFFF',
                                });
                            }}
                        />
                    </label>
                </div>
            ) : null}
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
    side = 'right',
}: {
    trigger: ReactNode;
    children: ReactNode;
    contentClassName?: string;
    onOpenChange?: (open: boolean) => void;
    side?: 'bottom' | 'right';
}) {
    return (
        <DropdownMenu modal={false} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent
                side={side}
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

function ToolbarStyleMenu({
    label,
    value,
    choices,
    docked,
    icon,
    onChange,
    onOpenChange,
    includeDefault = true,
}: {
    label: string;
    value: string | null;
    choices: readonly { label: string; value: string }[];
    docked: boolean;
    icon: ReactNode;
    onChange: (value: string | null) => void;
    onOpenChange: (open: boolean) => void;
    includeDefault?: boolean;
}) {
    const current = choices.find((choice) => choice.value === value)?.label
        ?? (value ? 'Custom' : 'Default');

    return (
        <ToolbarMenu
            onOpenChange={onOpenChange}
            side={docked ? 'right' : 'bottom'}
            trigger={
                <Button
                    type="button"
                    variant="outline"
                    size={docked ? 'icon-sm' : 'sm'}
                    aria-label={`${label}: ${current}`}
                    title={`${label}: ${current}`}
                >
                    {docked ? icon : (
                        <>
                            <span>{label}: {current}</span>
                            <ChevronDownIcon data-icon="inline-end" />
                        </>
                    )}
                </Button>
            }
        >
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
                value={value || 'default'}
                onValueChange={(next) => onChange(next === 'default' ? null : next)}
            >
                {includeDefault ? <DropdownMenuRadioItem value="default">Default</DropdownMenuRadioItem> : null}
                {choices.map((choice) => (
                    <DropdownMenuRadioItem key={choice.value} value={choice.value}>
                        {choice.label}
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
        </ToolbarMenu>
    );
}

type RichTextEditorProps = {
    layoutSections?: LayoutSection[];
    layoutLoad?: {
        key: number;
        sections: LayoutSection[];
        replace?: boolean;
        document?: { type: string; content?: unknown[] } | null;
    } | null;
    layoutName?: string;
    allowBlockDrag?: boolean;
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
    layoutSections = [],
    layoutLoad = null,
    layoutName,
    allowBlockDrag = false,
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
    const [commandHint, setCommandHint] = useState<{
        text: string;
        top: number;
        left: number;
    } | null>(null);
    const [uploadingPictures, setUploadingPictures] = useState(false);
    const [pictureDropActive, setPictureDropActive] = useState(false);
    const [movingBlocks, setMovingBlocks] = useState(false);
    const [columnWidthDraft, setColumnWidthDraft] = useState<string | null>(null);
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
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkError, setLinkError] = useState<string | null>(null);
    const linkSelection = useRef<{ from: number; to: number } | null>(null);
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
            ImportedInlineEmphasis,
            ...richTextLayoutExtensions,
            PositionCanvas,
            PositionItem,
            ...(allowBlockDrag ? [RichTextBlockDrag] : []),
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
                : mergeBidTextPlaceholders(placeholderFields).filter(
                      (field) => field.group !== 'Contractor' || Boolean(placeholderValues[field.key]?.trim()),
                  ),
        [placeholderCatalog, placeholderFields, placeholderValues],
    );

    const insertPlaceholder = (key: string) => {
        editor?.chain().focus().insertContent(placeholderToken(key)).run();
    };

    const setLink = () => {
        if (!editor) {
            return;
        }

        const previous = editor.getAttributes('link').href as string | undefined;
        linkSelection.current = {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
        };
        setLinkUrl(previous || 'https://');
        setLinkError(null);
        setLinkDialogOpen(true);
    };

    const saveLink = () => {
        if (!editor || !linkSelection.current) return;
        const chain = editor.chain().setTextSelection(linkSelection.current).extendMarkRange('link');
        const url = linkUrl.trim();
        const saved = url === '' ? chain.unsetLink().run() : chain.setLink({ href: url }).run();
        if (!saved) {
            setLinkError('Enter a valid, safe URL such as https://example.com.');
            return;
        }
        setLinkDialogOpen(false);
        requestAnimationFrame(() => editor.commands.focus());
    };

    const insertLayoutSection = (section: LayoutSection) =>
        insertLayoutSections([section], false);

    const insertLayoutSections = (list: LayoutSection[], atStart: boolean) => {
        if (!editor || list.length === 0) {
            return;
        }

        const chain = editor.chain();

        (atStart ? chain.focus('start') : chain.focus()).run();

        const start = editor.state.selection.from;

        editor
            .chain()
            .insertContent(list.map((section) => section.html).join(''))
            .run();

        const tables = list.filter((section) => section.table);

        if (tables.length === 0) {
            return;
        }

        const end = editor.state.selection.to;
        let { tr } = editor.state;
        let tableIndex = 0;

        editor.state.doc.nodesBetween(start, end, (node, pos) => {
            if (node.type.name !== 'table') {
                return;
            }

            const settings = tables[tableIndex]?.table;

            tableIndex += 1;

            if (!settings) {
                return false;
            }

            node.descendants((cell, cellPos, _parent, index) => {
                if (
                    cell.type.name !== 'tableCell' &&
                    cell.type.name !== 'tableHeader'
                ) {
                    return;
                }

                tr = tr.setNodeMarkup(pos + 1 + cellPos, undefined, {
                    ...cell.attrs,
                    border: settings.guide
                        ? '1px dashed #bfc0c1'
                        : settings.borderless
                          ? 'none'
                        : `1px solid ${settings.borderColor}`,
                    backgroundColor:
                        cell.type.name === 'tableHeader' && settings.headerBackground
                            ? settings.headerBackground
                            : cell.attrs.backgroundColor
                            ? cell.attrs.backgroundColor
                            : index % 2 === 0 && settings.labelBackground
                            ? settings.labelBackground
                            : null,
                    ...(cell.type.name === 'tableHeader' && settings.headerColor
                        ? { color: settings.headerColor }
                        : {}),
                });
            });

            return false;
        });

        editor.view.dispatch(tr);
    };

    const lastLoadKey = useRef(layoutLoad?.key ?? 0);

    useEffect(() => {
        if (!editor || !layoutLoad || layoutLoad.key === lastLoadKey.current) {
            return;
        }

        lastLoadKey.current = layoutLoad.key;
        if (layoutLoad.document) {
            const expectsTable = JSON.stringify(layoutLoad.document).includes('"type":"table"');
            try {
                editor.commands.setContent(layoutLoad.document as Parameters<typeof editor.commands.setContent>[0], true);
                let sawTable = false;
                editor.state.doc.descendants((node) => {
                    sawTable ||= node.type.name === 'table';
                });
                if (!expectsTable || sawTable) {
                    editor.commands.focus('start');
                    return;
                }
                editor.commands.clearContent();
            } catch {
                editor.commands.clearContent();
            }
        }
        if (layoutLoad.replace) {
            editor.commands.clearContent();
        }

        insertLayoutSections(layoutLoad.sections, true);
        if (movingBlocks) {
            enablePositionCanvas(editor);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutLoad?.key, editor]);

    const insertTable = (
        columns: number,
        withHeader = true,
        withoutBorders = false,
    ) => {
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
            if (withoutBorders) {
                setCurrentTableBorders(editor, 'none');
            }

            return;
        }

        const headerColor = LAYOUT_COLORS[0];

        fillCurrentTableHeaders(editor, headerColor.value, headerColor.text);
        labelCurrentTableHeaders(editor);

        if (withoutBorders) {
            setCurrentTableBorders(editor, 'none');
        }
    };

    const insertBoxedNoteWithColumns = (
        columns: number,
        withoutBorders = false,
    ) => {
        if (!editor) {
            return;
        }

        editor
            .chain()
            .focus()
            .insertTable({
                rows: 1,
                cols: Math.min(4, Math.max(2, columns)),
                withHeaderRow: false,
            })
            .run();

        if (withoutBorders) {
            setCurrentTableBorders(editor, 'none');
        }
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

    const applyBoxedNote = (color: LayoutColor | null = null) => {
        if (!editor) {
            return;
        }

        if (currentParagraphHasBox() && !color) {
            editor
                .chain()
                .focus()
                .updateAttributes('paragraph', {
                    border: null,
                    backgroundColor: null,
                    color: null,
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
                    attrs: {
                        ...boxedNoteStyles,
                        ...(color
                            ? {
                                  backgroundColor: color.value,
                                  color: color.text,
                              }
                            : {}),
                    },
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
            .updateAttributes('paragraph', {
                ...boxedNoteStyles,
                ...(color
                    ? {
                          backgroundColor: color.value,
                          color: color.text,
                      }
                    : {}),
            })
            .run();
    };

    const applyBoxedNoteBackground = (color: LayoutColor) => {
        editor
            ?.chain()
            .focus()
            .updateAttributes('paragraph', {
                ...boxedNoteStyles,
                backgroundColor: color.value,
                color: color.text,
            })
            .run();
    };

    const applyBoxedNoteBorder = (border: string | null) => {
        editor
            ?.chain()
            .focus()
            .updateAttributes('paragraph', {
                ...boxedNoteStyles,
                border,
            })
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
    const textStyle = editor?.getAttributes('textStyle') ?? {};
    const blockStyle = editor?.getAttributes(
        editor.isActive('heading') ? 'heading' : 'paragraph',
    ) ?? {};
    const currentStyle = (attribute: string): string | null => {
        const value = textStyle[attribute] || blockStyle[attribute];
        return typeof value === 'string' ? value : null;
    };

    return (
        <BidTextFieldValuesContext.Provider value={placeholderValues}>
        <div className="flex flex-col gap-2">
        <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} className="relative z-50">
            <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-background p-6 text-foreground shadow-lg">
                    <DialogTitle className="text-lg font-semibold">Edit link</DialogTitle>
                    <Description className="text-sm text-muted-foreground">
                        Enter a URL for the selected text. Leave it blank to remove the link.
                    </Description>
                    <form className="flex flex-col gap-4" onSubmit={(event) => {
                        event.preventDefault();
                        saveLink();
                    }}>
                        <div className="flex flex-col gap-1">
                            <InputLabel htmlFor={`${id ?? 'rich-text-editor'}-link-url`} value="URL" />
                            <TextInput
                                id={`${id ?? 'rich-text-editor'}-link-url`}
                                type="text"
                                inputMode="url"
                                spellCheck={false}
                                autoCapitalize="none"
                                autoCorrect="off"
                                data-autofocus
                                value={linkUrl}
                                onChange={(event) => { setLinkUrl(event.target.value); setLinkError(null); }}
                                aria-invalid={Boolean(linkError)}
                                aria-describedby={linkError ? `${id ?? 'rich-text-editor'}-link-error` : undefined}
                            />
                            {linkError ? <p id={`${id ?? 'rich-text-editor'}-link-error`} role="alert" className="text-sm text-destructive">{linkError}</p> : null}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">Save link</Button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
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
                role="toolbar"
                aria-label="Document text formatting"
                className="rich-text-commands relative flex w-full flex-wrap items-center gap-1 border-b-2 border-border p-1.5"
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
                <div
                    role="group"
                    aria-label="Text style and typography"
                    className="flex flex-wrap items-center gap-1"
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
                {allowBlockDrag ? (
                    <Button
                        type="button"
                        variant={movingBlocks ? 'secondary' : 'outline'}
                        size="sm"
                        data-labeled-command
                        aria-pressed={movingBlocks}
                        disabled={!editor}
                        title={movingBlocks ? 'Switch to editing text and resizing table columns' : 'Drag items on the ruler grid, snapping every 10px'}
                        onClick={() => {
                            if (!editor) return;
                            const next = !movingBlocks;
                            if (next) enablePositionCanvas(editor);
                            editor.view.dispatch(editor.state.tr.setMeta(blockMoveModeKey, next));
                            setMovingBlocks(next);
                        }}
                    >
                        <MoveIcon data-icon="inline-start" />
                        {movingBlocks ? 'Edit text' : 'Move items'}
                    </Button>
                ) : null}
                <ToolbarMenu
                    onOpenChange={handleMenuOpenChange}
                    side="bottom"
                    trigger={
                        <Button type="button" variant="ghost" size="sm" title="Paragraph style" aria-label="Paragraph style">
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
                            {(
                                <>
                                    <span>
                                        {editor?.isActive('heading')
                                            ? `Heading ${editor.getAttributes('heading').level}`
                                            : editor?.isActive('blockquote') ? 'Quote'
                                            : editor?.isActive('paragraph') && isFootnoteBlock(editor.getAttributes('paragraph')) ? 'Footnote'
                                            : 'Paragraph'}
                                    </span>
                                    <ChevronDownIcon data-icon="inline-end" />
                                </>
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
                </ToolbarMenu>
                <ToolbarStyleMenu
                    label="Font"
                    value={currentStyle('fontFamily')}
                    choices={FONT_FAMILIES}
                    docked={false}
                    icon={<TypeIcon />}
                    onOpenChange={handleMenuOpenChange}
                    onChange={(fontFamily) => editor && applyBlockStyle(editor, { fontFamily })}
                />
                <ToolbarStyleMenu
                    label="Font size"
                    value={currentStyle('fontSize')}
                    choices={FONT_SIZES.map((size) => ({ label: `${size}px`, value: `${size}px` }))}
                    docked={false}
                    icon={<span className="text-xs">Size</span>}
                    onOpenChange={handleMenuOpenChange}
                    onChange={(fontSize) => editor && applyBlockStyle(editor, { fontSize })}
                />
                <ToolbarStyleMenu
                    label="Line spacing"
                    value={currentStyle('lineHeight')}
                    choices={LINE_SPACING}
                    docked={false}
                    icon={<AlignVerticalSpaceAroundIcon />}
                    onOpenChange={handleMenuOpenChange}
                    onChange={(lineHeight) => editor && applyBlockStyle(editor, { lineHeight })}
                />
                <ToolbarStyleMenu
                    label="Text case"
                    includeDefault={false}
                    value={textStyle.textCase ?? (blockStyle.editorTextCase !== 'original' ? blockStyle.editorTextCase : (blockStyle.textTransform === 'uppercase' || blockStyle.textTransform === 'lowercase' ? blockStyle.textTransform : 'original'))}
                    choices={[
                        { label: 'As entered', value: 'original' },
                        { label: 'UPPERCASE', value: 'uppercase' },
                        { label: 'lowercase', value: 'lowercase' },
                        { label: 'camelCase', value: 'camel' },
                    ]}
                    docked={false}
                    icon={<TypeIcon />}
                    onOpenChange={handleMenuOpenChange}
                    onChange={(mode) => editor && applyEditorTextCase(editor, mode ?? 'original')}
                />
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
                </div>
                <Separator />
                <Toggle
                    size="sm"
                    pressed={Boolean(editor?.isActive('bold'))}
                    onPressedChange={() =>
                        editor && toggleInlineEmphasis(editor, 'bold')
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
                        editor && toggleInlineEmphasis(editor, 'italic')
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
                            onClick={() => editor && applyTextColor(editor, swatch.value)}
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
                            onChange={(event) => editor && applyTextColor(editor, event.target.value)}
                        />
                    </div>
                    <DropdownMenuItem
                        onClick={() => editor && applyTextColor(editor, null)}
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
                    onPressedChange={() => applyBoxedNote()}
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
                    <DropdownMenuLabel>Insert a table</DropdownMenuLabel>
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
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <TableIcon />
                            Borderless table with headers
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {[2, 3, 4, 5, 6].map((columns) => (
                                <DropdownMenuItem
                                    key={columns}
                                    onClick={() =>
                                        insertTable(columns, true, true)
                                    }
                                >
                                    {columns} columns
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <TableIcon />
                            Borderless table, no header
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {[2, 3, 4, 5, 6].map((columns) => (
                                <DropdownMenuItem
                                    key={columns}
                                    onClick={() =>
                                        insertTable(columns, false, true)
                                    }
                                >
                                    {columns} columns
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Insert a boxed note</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => applyBoxedNote()}>
                        <SquareIcon />
                        Boxed note
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <PaintBucketIcon />
                            Boxed note background
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <ColorChoices
                                allowCustom
                                onSelect={(color) => applyBoxedNote(color)}
                            />
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Columns3Icon />
                            Boxed note with columns
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {[2, 3, 4].map((columns) => (
                                <DropdownMenuItem
                                    key={columns}
                                    onClick={() =>
                                        insertBoxedNoteWithColumns(columns)
                                    }
                                >
                                    {columns} columns
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Columns3Icon />
                            Borderless boxed note with columns
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {[2, 3, 4].map((columns) => (
                                <DropdownMenuItem
                                    key={columns}
                                    onClick={() =>
                                        insertBoxedNoteWithColumns(
                                            columns,
                                            true,
                                        )
                                    }
                                >
                                    {columns} columns
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Other layout blocks</DropdownMenuLabel>
                    <DropdownMenuLabel className="font-normal text-muted-foreground">
                        Section background
                    </DropdownMenuLabel>
                    <ColorChoices onSelect={insertColoredSection} />
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="font-normal text-muted-foreground">
                        Line color
                    </DropdownMenuLabel>
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
                        <label
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            Column width
                            <input
                                type="number"
                                min={48}
                                max={4000}
                                step={1}
                                aria-label="Selected table column width in pixels"
                                title="Set this column's width in pixels, or drag its edge in Edit text mode"
                                className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                                value={columnWidthDraft ?? selectedTableColumn(editor.view)?.width ?? ''}
                                onFocus={(event) => setColumnWidthDraft(event.currentTarget.value)}
                                onChange={(event) => setColumnWidthDraft(event.target.value)}
                                onBlur={(event) => {
                                    const column = selectedTableColumn(editor.view);
                                    const width = Number(event.target.value);
                                    if (!column || !resizeTableColumn(editor.view, column.tablePos, column.column, width)) {
                                        toast.error('Choose a table cell and enter a column width between 48 and 4000 pixels.');
                                    }
                                    setColumnWidthDraft(null);
                                }}
                                onKeyDown={(event) => {
                                    event.stopPropagation();
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        event.currentTarget.blur();
                                    }
                                }}
                            />
                            px
                        </label>
                        {currentTableHasHeaders(editor) ? (
                            <ToolbarMenu
                                onOpenChange={handleMenuOpenChange}
                                trigger={
                                    <Button type="button" variant="ghost" size="sm" data-labeled-command title="Change table header background">
                                        <PaintBucketIcon />
                                        Header color
                                    </Button>
                                }
                            >
                                <DropdownMenuLabel>
                                    Table header color
                                </DropdownMenuLabel>
                                <ColorChoices
                                    allowCustom
                                    allowClear
                                    onSelect={(color) =>
                                        fillCurrentTableHeaders(
                                            editor,
                                            color.value,
                                            color.text,
                                        )
                                    }
                                    onClear={() =>
                                        fillCurrentTableHeaders(
                                            editor,
                                            null,
                                            null,
                                        )
                                    }
                                />
                            </ToolbarMenu>
                        ) : null}
                        <ToolbarMenu
                            onOpenChange={handleMenuOpenChange}
                            trigger={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-labeled-command
                                    title="Change table cell background"
                                >
                                    <PaintBucketIcon />
                                    Cell color
                                </Button>
                            }
                        >
                            <DropdownMenuLabel>Table background</DropdownMenuLabel>
                            <ColorChoices
                                allowCustom
                                allowClear
                                onSelect={(color) =>
                                    fillCurrentTableCells(editor, color)
                                }
                                onClear={() =>
                                    fillCurrentTableCells(editor, null)
                                }
                            />
                        </ToolbarMenu>
                        <ToolbarMenu
                            onOpenChange={handleMenuOpenChange}
                            trigger={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-labeled-command
                                    title="Change table border visibility"
                                >
                                    <TableIcon />
                                    Borders
                                </Button>
                            }
                        >
                            <DropdownMenuLabel>Table borders</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() =>
                                    setCurrentTableBorders(editor, 'none')
                                }
                            >
                                No borders
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    setCurrentTableBorders(
                                        editor,
                                        '1px solid #d1d5db',
                                    )
                                }
                            >
                                Show borders
                            </DropdownMenuItem>
                        </ToolbarMenu>
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
                {editor?.isActive('paragraph') &&
                currentParagraphHasBox() ? (
                    <ToolbarMenu
                        onOpenChange={handleMenuOpenChange}
                        trigger={
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="Change boxed note background"
                            >
                                <PaintBucketIcon />
                            </Button>
                        }
                    >
                        <DropdownMenuLabel>
                            Boxed note background
                        </DropdownMenuLabel>
                        <ColorChoices
                            allowCustom
                            allowClear
                            onSelect={applyBoxedNoteBackground}
                            onClear={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .updateAttributes('paragraph', {
                                        backgroundColor: null,
                                        color: null,
                                    })
                                    .run()
                            }
                        />
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Box border</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => applyBoxedNoteBorder('none')}
                        >
                            No border
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                applyBoxedNoteBorder('1px solid #111827')
                            }
                        >
                            Show border
                        </DropdownMenuItem>
                    </ToolbarMenu>
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
                {layoutSections.length > 0 ? (
                    <>
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <ToolbarMenu
                            onOpenChange={handleMenuOpenChange}
                            trigger={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    title="Insert a section from the print layout"
                                >
                                    <LayoutTemplateIcon />
                                    Layout sections
                                </Button>
                            }
                        >
                            <DropdownMenuLabel>
                                {layoutName
                                    ? `From “${layoutName}”`
                                    : 'From the print layout'}
                            </DropdownMenuLabel>
                            {layoutSections.map((section) => (
                                <DropdownMenuItem
                                    key={section.id}
                                    onClick={() => insertLayoutSection(section)}
                                >
                                    {section.label}
                                </DropdownMenuItem>
                            ))}
                        </ToolbarMenu>
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
                        <StickyDocumentToolbar scopeRef={editorFrameRef} enabled={allowSideToolbar}>
                            {commandBar}
                        </StickyDocumentToolbar>
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
            <div className={allowBlockDrag ? 'overflow-x-auto' : undefined}>
                <EditorContent editor={editor} />
            </div>
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
