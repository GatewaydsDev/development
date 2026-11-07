import InputError from '@/Components/InputError';
import EmailStationery from '@/Pages/Email/EmailStationery';
import {
    applyLayout,
    buildLayout,
    emptyStationery,
    placeReplySignature,
    signatureHtml,
    withoutStationery,
    type MailLayoutId,
    type MailStationeryData,
} from '@/Pages/Email/mailLayouts';
import { Button } from '@/Components/ui/button';
import { router, useForm } from '@inertiajs/react';
import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    AlignCenterIcon,
    AlignJustifyIcon,
    AlignLeftIcon,
    AlignRightIcon,
    BoldIcon,
    CalendarDaysIcon,
    ClockIcon,
    FlagIcon,
    HighlighterIcon,
    ListIndentDecreaseIcon,
    ListIndentIncreaseIcon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    MinusIcon,
    PaperclipIcon,
    QuoteIcon,
    Redo2Icon,
    RemoveFormattingIcon,
    SendIcon,
    Settings2Icon,
    StrikethroughIcon,
    SubscriptIcon,
    SuperscriptIcon,
    Trash2Icon,
    TypeIcon,
    UnderlineIcon,
    Undo2Icon,
    UserPlusIcon,
    XIcon,
} from 'lucide-react';
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SavedRecipient = {
    id: number;
    name: string | null;
    email: string;
};

export type ComposeDraft = {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
};

export type MailTemplateOption = {
    uuid: string;
    name: string;
    category: string;
    subject: string;
    body: string;
    unresolved: string[];
};

type ComposeMailProps = {
    emailTemplates?: MailTemplateOption[];
    mailbox: string;
    recipients: SavedRecipient[];
    draft?: ComposeDraft;
    stationery?: MailStationeryData;
    onDiscard: () => void;
};

type AddressFieldName = 'to' | 'cc' | 'bcc';

const splitAddresses = (value: string) =>
    value
        .split(/[;,]+/)
        .map((part) => part.trim())
        .filter((part) => part !== '');

const joinAddresses = (addresses: string[]) => addresses.join(', ');

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const MAIL_DOMAINS = [
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'yahoo.com',
    'icloud.com',
    'live.com',
    'aol.com',
    'msn.com',
    'gateway-ds.com',
];

function domainCompletions(entry: string, taken: string[]): string[] {
    const raw = entry.trim().replace(/[,\s]+$/, '');

    if (raw === '' || /[\s,]/.test(raw)) {
        return [];
    }

    const at = raw.indexOf('@');
    const local = at === -1 ? raw : raw.slice(0, at);
    const domainPrefix = at === -1 ? '' : raw.slice(at + 1).toLowerCase();

    if (local === '' || !/^[A-Za-z0-9._%+-]+$/.test(local)) {
        return [];
    }

    const takenSet = new Set(taken.map((address) => address.toLowerCase()));

    return MAIL_DOMAINS.filter((domain) => domain.startsWith(domainPrefix))
        .map((domain) => `${local.toLowerCase()}@${domain}`)
        .filter((email) => email !== raw.toLowerCase() && !takenSet.has(email));
}

const FONT_FAMILIES = [
    { label: 'Calibri', value: 'Calibri, Candara, sans-serif' },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Century Gothic', value: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif' },
    { label: 'Garamond', value: 'Garamond, "Times New Roman", serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];

const TEXT_COLORS = ['#111827', '#dc2626', '#c2410c', '#a16207', '#047857', '#1d4ed8', '#6d28d9', '#6b7280'];

const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bae6fd', '#fecdd3', '#fed7aa'];

const MailTextStyle = Extension.create({
    name: 'mailTextStyle',

    addGlobalAttributes() {
        return [
            {
                types: ['textStyle'],
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element) => element.style.fontSize || null,
                        renderHTML: (attributes) =>
                            attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
                    },
                    fontFamily: {
                        default: null,
                        parseHTML: (element) => element.style.fontFamily || null,
                        renderHTML: (attributes) =>
                            attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
                    },
                },
            },
            {
                types: ['paragraph'],
                attributes: {
                    indent: {
                        default: 0,
                        parseHTML: (element) => Number(element.getAttribute('data-indent') || 0),
                        renderHTML: (attributes) => {
                            const indent = Number(attributes.indent || 0);

                            if (!indent) {
                                return {};
                            }

                            return {
                                'data-indent': indent,
                                style: `margin-left: ${indent * 24}px`,
                            };
                        },
                    },
                },
            },
        ];
    },
});

function useEditorTick(editor: Editor | null) {
    const [, setTick] = useState(0);

    useEffect(() => {
        if (!editor) {
            return;
        }

        const update = () => setTick((value) => value + 1);
        editor.on('transaction', update);

        return () => {
            editor.off('transaction', update);
        };
    }, [editor]);
}

function AddressField({
    id,
    label,
    value,
    error,
    suggestions,
    onChange,
    onFocusField,
}: {
    id: string;
    label: string;
    value: string;
    error?: string;
    suggestions: SavedRecipient[];
    onChange: (value: string) => void;
    onFocusField: () => void;
}) {
    const { t } = useTranslation('mail');
    const [entry, setEntry] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const addresses = splitAddresses(value);
    const query = entry.trim().toLowerCase();
    const savedMatches = suggestions.filter((recipient) => {
        if (query === '') {
            return false;
        }

        return (
            recipient.email.toLowerCase().includes(query) ||
            (recipient.name ?? '').toLowerCase().includes(query)
        );
    });
    const completions = domainCompletions(entry, [
        ...addresses,
        ...savedMatches.map((recipient) => recipient.email),
    ]);
    const optionCount = savedMatches.length + completions.length;

    const commit = (nextEntry = entry) => {
        const email = nextEntry.trim().replace(/,$/, '');

        if (email === '') {
            return;
        }

        if (!addresses.some((address) => address.toLowerCase() === email.toLowerCase())) {
            onChange(joinAddresses([...addresses, email]));
        }

        setEntry('');
        setOpen(false);
    };

    const remove = (email: string) => {
        onChange(joinAddresses(addresses.filter((address) => address !== email)));
    };

    const acceptHighlighted = () => {
        const saved = savedMatches[highlight];

        if (saved) {
            commit(saved.email);

            return;
        }

        const completion = completions[highlight - savedMatches.length];

        if (completion) {
            commit(completion);
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (open && optionCount > 0 && event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((index) => (index + 1) % optionCount);

            return;
        }

        if (open && optionCount > 0 && event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => (index - 1 + optionCount) % optionCount);

            return;
        }

        if (event.key === 'Escape') {
            setOpen(false);

            return;
        }

        if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
            if (entry.trim() === '') {
                return;
            }

            event.preventDefault();

            if (open && optionCount > 0) {
                acceptHighlighted();

                return;
            }

            commit();
        }

        if (event.key === 'Backspace' && entry === '' && addresses.length > 0) {
            remove(addresses[addresses.length - 1]);
        }
    };

    return (
        <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 border-b border-border py-2 text-sm">
            <span className="pt-1.5 text-muted-foreground">{label}</span>
            <span className="relative grid gap-1">
                <span className="flex min-h-9 flex-wrap items-center gap-1">
                    {addresses.map((address) => (
                        <span
                            key={address}
                            className="inline-flex max-w-full items-center gap-1 break-all rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                        >
                            {address}
                            <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center text-muted-foreground touch-manipulation hover:text-foreground"
                                aria-label={`${t('removeRecipient')} ${address}`}
                                onClick={() => remove(address)}
                            >
                                <XIcon className="size-3" />
                            </button>
                        </span>
                    ))}
                    <input
                        id={id}
                        value={entry}
                        onChange={(event) => {
                            setEntry(event.target.value);
                            setHighlight(0);
                            setOpen(true);
                        }}
                        onFocus={() => {
                            onFocusField();
                            setOpen(true);
                        }}
                        onBlur={() => {
                            window.setTimeout(() => {
                                commit();
                                setOpen(false);
                            }, 150);
                        }}
                        onKeyDown={onKeyDown}
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        enterKeyHint="done"
                        className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none sm:min-w-40 md:text-sm"
                    />
                </span>
                {open && optionCount > 0 ? (
                    <span
                        role="listbox"
                        aria-label={t('addressSuggestions')}
                        className="absolute top-full z-20 mt-1 grid max-h-[min(32rem,70dvh)] w-full overflow-y-auto rounded-md border border-border bg-background shadow-sm"
                    >
                        {savedMatches.map((recipient, index) => (
                            <button
                                key={recipient.id}
                                type="button"
                                role="option"
                                aria-selected={highlight === index}
                                className={`min-h-11 px-3 py-2 text-left text-sm touch-manipulation hover:bg-muted ${highlight === index ? 'bg-muted' : ''}`}
                                onMouseEnter={() => setHighlight(index)}
                                onPointerDown={(event) => {
                                    event.preventDefault();
                                    commit(recipient.email);
                                }}
                            >
                                <span className="block text-foreground">
                                    {recipient.name || recipient.email}
                                </span>
                                {recipient.name ? (
                                    <span className="block text-xs text-muted-foreground">
                                        {recipient.email}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                        {completions.map((email, index) => {
                            const optionIndex = savedMatches.length + index;

                            return (
                                <button
                                    key={email}
                                    type="button"
                                    role="option"
                                    aria-selected={highlight === optionIndex}
                                    className={`min-h-11 px-3 py-2 text-left text-sm touch-manipulation hover:bg-muted ${highlight === optionIndex ? 'bg-muted' : ''}`}
                                    onMouseEnter={() => setHighlight(optionIndex)}
                                    onPointerDown={(event) => {
                                        event.preventDefault();
                                        commit(email);
                                    }}
                                >
                                    {email}
                                </button>
                            );
                        })}
                    </span>
                ) : null}
                <InputError message={error} />
            </span>
        </label>
    );
}

function ToolButton({
    label,
    pressed,
    onClick,
    children,
}: {
    label: string;
    pressed?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            title={label}
            onClick={onClick}
            className={`inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-foreground hover:bg-muted lg:size-8 ${pressed ? 'bg-muted' : ''}`}
        >
            {children}
        </button>
    );
}

function ToolDivider() {
    return <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function SectionCard({
    label,
    selected = false,
    disabled = false,
    onClick,
    children,
}: {
    label: string;
    selected?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            title={label}
            disabled={disabled}
            aria-pressed={selected}
            onClick={onClick}
            className={`group flex w-20 shrink-0 flex-col items-center gap-1 rounded-md p-1 text-center disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? 'bg-emerald-100 dark:bg-emerald-950/60' : 'hover:bg-background/80'
            }`}
        >
            <span className={`flex h-10 w-16 flex-col rounded border bg-white p-1 shadow-sm ${
                selected ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-border group-hover:border-emerald-600'
            }`}>
                {children}
            </span>
            <span className="line-clamp-2 text-[10px] font-medium leading-3 text-foreground">{label}</span>
        </button>
    );
}

function Swatches({
    label,
    colors,
    onPick,
    children,
}: {
    label: string;
    colors: string[];
    onPick: (color: string | null) => void;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <span className="relative">
            <ToolButton label={label} pressed={open} onClick={() => setOpen((value) => !value)}>
                {children}
            </ToolButton>
            {open ? (
                <span className="absolute start-0 top-full z-30 mt-1 grid w-40 grid-cols-4 gap-1 rounded-md border border-border bg-background p-2 shadow-md">
                    {colors.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-label={color}
                            className="size-8 rounded-sm border border-border touch-manipulation"
                            style={{ backgroundColor: color }}
                            onClick={() => {
                                onPick(color);
                                setOpen(false);
                            }}
                        />
                    ))}
                    <button
                        type="button"
                        className="col-span-4 min-h-8 rounded-sm border border-border px-2 text-xs text-muted-foreground touch-manipulation hover:bg-muted"
                        onClick={() => {
                            onPick(null);
                            setOpen(false);
                        }}
                    >
                        <XIcon className="me-1 inline size-3" />
                        {label}
                    </button>
                </span>
            ) : null}
        </span>
    );
}

export default function ComposeMail({
    mailbox,
    recipients,
    draft,
    stationery = emptyStationery,
    emailTemplates = [],
    onDiscard,
}: ComposeMailProps) {
    const { t } = useTranslation('mail');
    const fileRef = useRef<HTMLInputElement>(null);
    const initialBody = draft
        ? placeReplySignature(draft.body ?? '', signatureHtml(stationery, 'reply'))
        : buildLayout('letter', stationery);
    const [showCc, setShowCc] = useState(Boolean(draft?.cc));
    const [selectedLayout, setSelectedLayout] = useState<MailLayoutId | null>(draft ? null : 'letter');
    const [composeStationery, setComposeStationery] = useState(stationery);
    const [includeHeader, setIncludeHeader] = useState(stationery.header.trim() !== '');
    const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(
        stationery.newSignatureId ?? stationery.signatures[0]?.id ?? null,
    );
    const [includeFooter, setIncludeFooter] = useState(stationery.footer.trim() !== '');
    const [ribbonTab, setRibbonTab] = useState<'message' | 'format' | 'insert' | 'sections'>('message');
    const stationerySnapshot = useRef(stationery);
    const layoutSnapshot = useRef(initialBody);
    const [stationeryOpen, setStationeryOpen] = useState(false);
    const [showBcc, setShowBcc] = useState(Boolean(draft?.bcc));
    const [activeField, setActiveField] = useState<AddressFieldName>('to');
    const [recipientName, setRecipientName] = useState('');
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const form = useForm({
        to: draft?.to ?? '',
        cc: draft?.cc ?? '',
        bcc: draft?.bcc ?? '',
        subject: draft?.subject ?? '',
        body: initialBody,
        importance: 'normal' as 'low' | 'normal' | 'high',
        save_recipients: true,
        attachments: [] as File[],
    });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
            TextStyle,
            MailTextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({ types: ['paragraph'] }),
            Underline,
            Subscript,
            Superscript,
            LinkExtension.configure({ openOnClick: false }),
            Placeholder.configure({ placeholder: t('writeMessage') }),
        ],
        content: initialBody,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'min-h-52 px-3 py-3 font-[Calibri,Arial,sans-serif] text-base text-foreground outline-none md:min-h-72 md:text-sm [&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:my-2 [&_h4]:text-base [&_h4]:font-semibold [&_blockquote]:mt-4 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-400 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground dark:[&_blockquote]:border-slate-300 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100 [&_hr]:my-8 [&_hr]:h-1 [&_hr]:border-0 [&_hr]:bg-slate-700 dark:[&_hr]:bg-slate-200',
            },
        },
        onUpdate: ({ editor: current }) => {
            form.setData('body', current.getHTML());
        },
    });
    useEditorTick(editor);

    const selectedStationery = (
        base = composeStationery,
        header = includeHeader,
        signatureId = selectedSignatureId,
        footer = includeFooter,
    ): MailStationeryData => ({
        ...base,
        header: header ? base.header : '',
        footer: footer ? base.footer : '',
        signatures: signatureId ? base.signatures : [],
        newSignatureId: signatureId,
    });

    const applySections = ({
        base = composeStationery,
        header = includeHeader,
        signatureId = selectedSignatureId,
        footer = includeFooter,
        saveBase = false,
    }: {
        base?: MailStationeryData;
        header?: boolean;
        signatureId?: string | null;
        footer?: boolean;
        saveBase?: boolean;
    } = {}) => {
        if (saveBase) {
            setComposeStationery(base);
        }

        setIncludeHeader(header);
        setSelectedSignatureId(signatureId);
        setIncludeFooter(footer);

        if (draft || !selectedLayout) {
            return;
        }

        const current = editor?.getHTML() ?? '';
        const html = applyLayout(
            selectedLayout,
            selectedStationery(base, header, signatureId, footer),
            current,
            layoutSnapshot.current,
        );
        editor?.commands.setContent(html);
        const normalized = editor?.getHTML() ?? html;
        layoutSnapshot.current = normalized;
        form.setData('body', normalized);
    };

    useEffect(() => {
        if (stationerySnapshot.current === stationery) {
            return;
        }

        stationerySnapshot.current = stationery;
        const nextSignature = selectedSignatureId
            ? stationery.signatures.find((signature) => signature.id === selectedSignatureId)?.id
                ?? stationery.newSignatureId
                ?? stationery.signatures[0]?.id
                ?? null
            : composeStationery.signatures.length === 0
              ? stationery.newSignatureId ?? stationery.signatures[0]?.id ?? null
              : null;
        applySections({
            base: stationery,
            header: composeStationery.header.trim() === '' ? stationery.header.trim() !== '' : includeHeader,
            signatureId: nextSignature,
            footer: composeStationery.footer.trim() === '' ? stationery.footer.trim() !== '' : includeFooter,
            saveBase: true,
        });
        // Applying newly saved stationery must preserve the writing already in the editor.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stationery]);

    const addSavedRecipient = (email: string) => {
        const current = splitAddresses(form.data[activeField]);

        if (current.some((address) => address.toLowerCase() === email.toLowerCase())) {
            return;
        }

        form.setData(activeField, joinAddresses([...current, email]));

        if (activeField === 'cc') {
            setShowCc(true);
        }

        if (activeField === 'bcc') {
            setShowBcc(true);
        }
    };

    const saveCurrentRecipient = () => {
        const addresses = splitAddresses(form.data[activeField]);
        const email = addresses[addresses.length - 1];

        if (!email || !isEmail(email)) {
            return;
        }

        router.post(
            route('mailbox.recipients.store'),
            { email, name: recipientName },
            { preserveScroll: true, preserveState: true },
        );
        setRecipientName('');
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!editor) {
            return;
        }

        if ([...composedMessageText(editor.getHTML())].length < 8) {
            form.setError('body', t('messageRequired'));

            return;
        }

        form.transform((data) => ({
            ...data,
            body: editor.getHTML(),
            save_recipients: data.save_recipients ? 1 : 0,
            attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
        }));
        form.post(route('mailbox.send'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => onDiscard(),
        });
    };

    const updateAttachments = (next: File[]) => {
        const files = next.slice(0, 5);
        setAttachedFiles(files);
        form.setData('attachments', files);
    };

    const cycleImportance = () => {
        const order = ['normal', 'high', 'low'] as const;
        const index = order.indexOf(form.data.importance);

        form.setData('importance', order[(index + 1) % order.length]);
    };

    const changeFontSize = (delta: number) => {
        if (!editor) {
            return;
        }

        const style = editor.getAttributes('textStyle');
        const current = Number.parseFloat(String(style.fontSize || '16')) || 16;
        const next = Math.min(72, Math.max(8, current + delta));
        editor.chain().focus().setMark('textStyle', { ...style, fontSize: `${next}px` }).run();
    };

    const openLink = () => {
        const previous = editor?.getAttributes('link').href as string | undefined;
        setLinkUrl(previous ?? 'https://');
        setLinkOpen(true);
    };

    const chooseLayout = (layout: MailLayoutId) => {
        const current = editor?.getHTML() ?? '';
        const activeStationery = selectedStationery();
        const html = selectedLayout === null
            ? buildLayout(layout, activeStationery)
            : applyLayout(layout, activeStationery, current, layoutSnapshot.current);
        editor?.commands.setContent(html);
        const normalized = editor?.getHTML() ?? html;
        layoutSnapshot.current = normalized;
        form.setData('body', normalized);
        setSelectedLayout(layout);
    };

    const chooseTemplate = (template: MailTemplateOption) => {
        const activeStationery = selectedStationery();
        const html = buildLayout('letter', activeStationery, template.body);
        editor?.commands.setContent(html);
        const normalized = editor?.getHTML() ?? html;
        layoutSnapshot.current = buildLayout('letter', activeStationery);
        form.setData((data) => ({ ...data, subject: template.subject, body: normalized }));
        setSelectedLayout('letter');
    };

    const layouts: Array<{ id: MailLayoutId; title: string; detail: string }> = [
        { id: 'blank', title: t('layoutBlank'), detail: t('layoutBlankDetail') },
        { id: 'letter', title: t('layoutLetter'), detail: t('layoutLetterDetail') },
        { id: 'note', title: t('layoutNote'), detail: t('layoutNoteDetail') },
        { id: 'announcement', title: t('layoutAnnouncement'), detail: t('layoutAnnouncementDetail') },
        { id: 'project', title: t('layoutProject'), detail: t('layoutProjectDetail') },
        { id: 'followUp', title: t('layoutFollowUp'), detail: t('layoutFollowUpDetail') },
    ];
    const builtInTemplates: MailTemplateOption[] = [
        {
            uuid: 'built-in-general',
            name: t('templateGeneral'),
            category: 'built_in',
            subject: t('templateGeneralSubject'),
            body: templateParagraphs(t('templateGeneralBody')),
            unresolved: [],
        },
        {
            uuid: 'built-in-follow-up',
            name: t('templateFollowUp'),
            category: 'built_in',
            subject: t('templateFollowUpSubject'),
            body: templateParagraphs(t('templateFollowUpBody')),
            unresolved: [],
        },
        {
            uuid: 'built-in-project-update',
            name: t('templateProjectUpdate'),
            category: 'built_in',
            subject: t('templateProjectUpdateSubject'),
            body: templateParagraphs(t('templateProjectUpdateBody')),
            unresolved: [],
        },
        {
            uuid: 'built-in-availability',
            name: t('templateAvailability'),
            category: 'built_in',
            subject: t('templateAvailabilitySubject'),
            body: templateParagraphs(t('templateAvailabilityBody')),
            unresolved: [],
        },
        {
            uuid: 'built-in-thank-you',
            name: t('templateThankYou'),
            category: 'built_in',
            subject: t('templateThankYouSubject'),
            body: templateParagraphs(t('templateThankYouBody')),
            unresolved: [],
        },
    ];
    const availableTemplates = [...builtInTemplates, ...emailTemplates];
    const ribbonTabs = [
        { id: 'message', label: t('ribbonMessage') },
        { id: 'format', label: t('ribbonFormat') },
        { id: 'insert', label: t('ribbonInsert') },
        { id: 'sections', label: t('messageSections') },
    ] as const;

    const applyLink = () => {
        const url = linkUrl.trim();

        if (url === '') {
            editor?.chain().focus().unsetLink().run();
        } else {
            editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }

        setLinkOpen(false);
    };

    return (
        <form onSubmit={submit} className="min-w-0">
            <div className="min-w-0 overflow-hidden rounded-lg border border-emerald-200 bg-background dark:border-emerald-900">
            <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    updateAttachments([...attachedFiles, ...files]);
                    event.target.value = '';
                }}
            />
            {attachedFiles.length > 0 ? (
                <div className="border-b border-border bg-muted/40 px-3 py-2">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('attachments')}
                    </p>
                    <ul className="flex flex-wrap gap-2" aria-label={t('attachments')}>
                        {attachedFiles.map((file, index) => (
                            <li
                                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                                className="flex w-60 max-w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 shadow-sm"
                            >
                                <PaperclipIcon className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-foreground">
                                        {file.name}
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground">
                                        {formatFileSize(file.size)}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground"
                                    aria-label={`${t('removeAttachment')} ${file.name}`}
                                    onClick={() =>
                                        updateAttachments(
                                            attachedFiles.filter((_, itemIndex) => itemIndex !== index),
                                        )
                                    }
                                >
                                    <XIcon className="size-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <InputError message={form.errors.attachments} className="px-3" />

            <div className="px-3">
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 border-b border-border py-2 text-sm">
                    <span className="text-muted-foreground">{t('from')}</span>
                    <span className="break-all text-foreground">{mailbox}</span>
                </div>
                <AddressField
                    id="mail-to"
                    label={t('to')}
                    value={form.data.to}
                    error={form.errors.to}
                    suggestions={recipients}
                    onChange={(to) => form.setData('to', to)}
                    onFocusField={() => setActiveField('to')}
                />
                {showCc ? (
                    <AddressField
                        id="mail-cc"
                        label={t('cc')}
                        value={form.data.cc}
                        error={form.errors.cc}
                        suggestions={recipients}
                        onChange={(cc) => form.setData('cc', cc)}
                        onFocusField={() => setActiveField('cc')}
                    />
                ) : null}
                {showBcc ? (
                    <AddressField
                        id="mail-bcc"
                        label={t('bcc')}
                        value={form.data.bcc}
                        error={form.errors.bcc}
                        suggestions={recipients}
                        onChange={(bcc) => form.setData('bcc', bcc)}
                        onFocusField={() => setActiveField('bcc')}
                    />
                ) : null}
                {!showCc || !showBcc ? (
                    <div className="flex gap-2 py-2">
                        {!showCc ? (
                            <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground" onClick={() => setShowCc(true)}>
                                {t('cc')}
                            </button>
                        ) : null}
                        {!showBcc ? (
                            <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground" onClick={() => setShowBcc(true)}>
                                {t('bcc')}
                            </button>
                        ) : null}
                    </div>
                ) : null}
                <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 border-b border-border py-2 text-sm">
                    <span className="text-muted-foreground">{t('subject')}</span>
                    <input
                        value={form.data.subject}
                        onChange={(event) => form.setData('subject', event.target.value)}
                        maxLength={255}
                        enterKeyHint="next"
                        className="h-11 min-w-0 bg-transparent text-base text-foreground outline-none md:text-sm"
                        required
                    />
                </label>
                <InputError message={form.errors.subject} />
            </div>

            <div className="border-b border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30">
                <div role="tablist" aria-label={t('composeRibbon')} className="flex snap-x overflow-x-auto border-b border-sky-200 px-1 touch-pan-x dark:border-sky-900 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-2">
                    {ribbonTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={ribbonTab === tab.id}
                            onClick={() => setRibbonTab(tab.id)}
                            className={`h-10 shrink-0 snap-start border-b-2 px-2 text-xs font-medium sm:px-3 sm:text-sm ${
                                ribbonTab === tab.id
                                    ? 'border-emerald-700 text-emerald-800 dark:border-emerald-300 dark:text-emerald-200'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex min-h-14 items-center gap-1 overflow-x-auto overscroll-x-contain px-2 py-1.5 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {ribbonTab === 'message' ? (
                        <>
                            <Button type="submit" disabled={form.processing} className="h-10 shrink-0 bg-emerald-700 px-4 text-white hover:bg-emerald-800">
                                <SendIcon className="size-4" />
                                {form.processing ? t('sending') : t('send')}
                            </Button>
                            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={onDiscard}>
                                <XIcon className="size-4" />
                                {t('discard')}
                            </Button>
                            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => fileRef.current?.click()}>
                                <PaperclipIcon className="size-4" />
                                {t('attach')}
                            </Button>
                            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => setRibbonTab('sections')}>
                                {t('messageSections')}
                            </Button>
                            <Button
                                className="h-10 shrink-0"
                                type="button"
                                variant={form.data.importance === 'normal' ? 'outline' : 'secondary'}
                                onClick={cycleImportance}
                            >
                                <FlagIcon className="size-4" />
                                {t(
                                    form.data.importance === 'high'
                                        ? 'importanceHigh'
                                        : form.data.importance === 'low'
                                          ? 'importanceLow'
                                          : 'importanceNormal',
                                )}
                            </Button>
                            <ToolDivider />
                            <ToolButton label={t('undo')} onClick={() => editor?.chain().focus().undo().run()}>
                                <Undo2Icon className="size-4" />
                            </ToolButton>
                            <ToolButton label={t('redo')} onClick={() => editor?.chain().focus().redo().run()}>
                                <Redo2Icon className="size-4" />
                            </ToolButton>
                            <ToolDivider />
                            <span className="shrink-0 self-start pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('template')}
                            </span>
                            {availableTemplates.map((template, index) => (
                                <button
                                    key={template.uuid}
                                    type="button"
                                    title={`${template.name}: ${template.subject}`}
                                    className="group flex w-20 shrink-0 flex-col items-center gap-1 rounded-md p-1 text-center hover:bg-background/80"
                                    onClick={() => chooseTemplate(template)}
                                >
                                    <span
                                        className={`flex h-10 w-16 flex-col rounded border bg-white p-1 shadow-sm group-hover:border-emerald-600 ${
                                            template.category === 'built_in'
                                                ? 'border-emerald-300'
                                                : 'border-violet-300'
                                        }`}
                                    >
                                        <span className={`h-1.5 rounded-sm ${index % 3 === 0 ? 'w-3/4 bg-emerald-600' : index % 3 === 1 ? 'w-1/2 bg-sky-600' : 'w-2/3 bg-violet-600'}`} />
                                        <span className="mt-1 h-1 w-full rounded-sm bg-slate-200" />
                                        <span className="mt-1 h-1 w-4/5 rounded-sm bg-slate-200" />
                                        <span className="mt-auto h-1 w-1/2 rounded-sm bg-slate-300" />
                                    </span>
                                    <span className="line-clamp-2 text-[10px] font-medium leading-3 text-foreground">
                                        {template.name}
                                    </span>
                                </button>
                            ))}
                        </>
                    ) : null}
                    {ribbonTab === 'format' ? (
                        <>
                            <select
                                aria-label={t('paragraphStyle')}
                                value={
                                    editor?.isActive('heading', { level: 1 })
                                        ? 'heading1'
                                        : editor?.isActive('heading', { level: 2 })
                                          ? 'heading2'
                                          : editor?.isActive('heading', { level: 3 })
                                            ? 'heading3'
                                          : editor?.isActive('heading', { level: 4 })
                                            ? 'heading4'
                                            : editor?.isActive('blockquote')
                                              ? 'quote'
                                              : editor?.isActive('codeBlock')
                                                ? 'code'
                                                : 'paragraph'
                                }
                                onChange={(event) => {
                                    if (!editor) return;
                                    const value = event.target.value;

                                    if (editor.isActive('blockquote')) {
                                        editor.chain().focus().toggleBlockquote().run();
                                    }

                                    if (editor.isActive('codeBlock')) {
                                        editor.chain().focus().toggleCodeBlock().run();
                                    }

                                    if (value === 'quote') {
                                        editor.chain().focus().setBlockquote().run();
                                    } else if (value === 'code') {
                                        editor.chain().focus().setCodeBlock().run();
                                    } else if (value.startsWith('heading')) {
                                        editor.chain().focus().setHeading({ level: Number(value.slice(-1)) as 1 | 2 | 3 | 4 }).run();
                                    } else {
                                        editor.chain().focus().setParagraph().run();
                                    }
                                }}
                                className="h-9 w-52 shrink-0 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                            >
                                <option value="paragraph">{t('normalText')}</option>
                                <option value="heading1">{t('heading1')}</option>
                                <option value="heading2">{t('heading2')}</option>
                                <option value="heading3">{t('heading3')}</option>
                                <option value="heading4">{t('heading4')}</option>
                                <option value="quote">{t('quote')}</option>
                                <option value="code">{t('codeBlock')}</option>
                            </select>
                            <select
                                aria-label={t('font')}
                                value={String(editor?.getAttributes('textStyle').fontFamily || FONT_FAMILIES[0].value)}
                                onChange={(event) => {
                                    const style = editor?.getAttributes('textStyle') ?? {};
                                    editor?.chain().focus().setMark('textStyle', { ...style, fontFamily: event.target.value }).run();
                                }}
                                className="h-9 max-w-40 shrink-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                {FONT_FAMILIES.map((font) => (
                                    <option key={font.label} value={font.value}>{font.label}</option>
                                ))}
                            </select>
                            <select
                                aria-label={t('fontSize')}
                                value={String(editor?.getAttributes('textStyle').fontSize || '16px')}
                                onChange={(event) => {
                                    const style = editor?.getAttributes('textStyle') ?? {};
                                    editor?.chain().focus().setMark('textStyle', { ...style, fontSize: event.target.value }).run();
                                }}
                                className="h-9 w-20 shrink-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                {FONT_SIZES.map((size) => (
                                    <option key={size} value={`${size}px`}>{size}</option>
                                ))}
                            </select>
                            <ToolButton label={t('decreaseFontSize')} onClick={() => changeFontSize(-2)}>
                                <span className="text-xs font-semibold">A−</span>
                            </ToolButton>
                            <ToolButton label={t('increaseFontSize')} onClick={() => changeFontSize(2)}>
                                <span className="text-sm font-semibold">A+</span>
                            </ToolButton>
                            <ToolDivider />
                            <ToolButton label={t('bold')} pressed={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><BoldIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('italic')} pressed={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><ItalicIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('underline')} pressed={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('strike')} pressed={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}><StrikethroughIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('subscript')} pressed={editor?.isActive('subscript')} onClick={() => editor?.chain().focus().toggleSubscript().run()}><SubscriptIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('superscript')} pressed={editor?.isActive('superscript')} onClick={() => editor?.chain().focus().toggleSuperscript().run()}><SuperscriptIcon className="size-4" /></ToolButton>
                            <Swatches
                                label={t('textColor')}
                                colors={TEXT_COLORS}
                                onPick={(color) => {
                                    if (!editor) return;
                                    const style = editor.getAttributes('textStyle');
                                    color
                                        ? editor.chain().focus().setColor(color).run()
                                        : editor.chain().focus().setMark('textStyle', { ...style, color: null }).run();
                                }}
                            >
                                <TypeIcon className="size-4" style={{ color: String(editor?.getAttributes('textStyle').color || 'currentColor') }} />
                            </Swatches>
                            <Swatches
                                label={t('highlight')}
                                colors={HIGHLIGHT_COLORS}
                                onPick={(color) => {
                                    if (!editor) return;
                                    color
                                        ? editor.chain().focus().setHighlight({ color }).run()
                                        : editor.chain().focus().unsetHighlight().run();
                                }}
                            >
                                <HighlighterIcon className="size-4" />
                            </Swatches>
                            <ToolDivider />
                            <ToolButton label={t('bulletList')} pressed={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><ListIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('numberedList')} pressed={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrderedIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('quote')} pressed={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><QuoteIcon className="size-4" /></ToolButton>
                            <ToolButton
                                label={t('outdent')}
                                onClick={() => {
                                    if (!editor) return;
                                    if (editor.isActive('listItem')) {
                                        editor.chain().focus().liftListItem('listItem').run();
                                        return;
                                    }
                                    const indent = Number(editor.getAttributes('paragraph').indent || 0);
                                    editor.chain().focus().updateAttributes('paragraph', { indent: Math.max(0, indent - 1) }).run();
                                }}
                            ><ListIndentDecreaseIcon className="size-4" /></ToolButton>
                            <ToolButton
                                label={t('indent')}
                                onClick={() => {
                                    if (!editor) return;
                                    if (editor.can().sinkListItem('listItem')) {
                                        editor.chain().focus().sinkListItem('listItem').run();
                                        return;
                                    }
                                    const indent = Number(editor.getAttributes('paragraph').indent || 0);
                                    editor.chain().focus().updateAttributes('paragraph', { indent: Math.min(8, indent + 1) }).run();
                                }}
                            ><ListIndentIncreaseIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('alignLeft')} pressed={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}><AlignLeftIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('alignCenter')} pressed={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}><AlignCenterIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('alignRight')} pressed={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}><AlignRightIcon className="size-4" /></ToolButton>
                            <ToolButton label={t('alignJustify')} pressed={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()}><AlignJustifyIcon className="size-4" /></ToolButton>
                            <ToolDivider />
                            <ToolButton label={t('clearFormatting')} onClick={() => editor?.chain().focus().unsetAllMarks().setTextAlign('left').updateAttributes('paragraph', { indent: 0 }).run()}>
                                <RemoveFormattingIcon className="size-4" />
                            </ToolButton>
                        </>
                    ) : null}
                    {ribbonTab === 'insert' ? (
                        <>
                            <Button type="button" variant="outline" className="h-9 shrink-0" onClick={() => fileRef.current?.click()}>
                                <PaperclipIcon className="size-4" />
                                {t('attach')}
                            </Button>
                            <Button type="button" variant={linkOpen ? 'secondary' : 'outline'} className="h-9 shrink-0" onClick={openLink}>
                                <LinkIcon className="size-4" />
                                {t('link')}
                            </Button>
                            <Button type="button" variant="outline" className="h-9 shrink-0" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
                                <MinusIcon className="size-4" />
                                {t('horizontalLine')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-9 shrink-0"
                                onClick={() =>
                                    editor?.chain().focus().insertContent(
                                        new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date()),
                                    ).run()
                                }
                            >
                                <CalendarDaysIcon className="size-4" />
                                {t('insertDate')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-9 shrink-0"
                                onClick={() =>
                                    editor?.chain().focus().insertContent(
                                        new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date()),
                                    ).run()
                                }
                            >
                                <ClockIcon className="size-4" />
                                {t('insertTime')}
                            </Button>
                        </>
                    ) : null}
                    {ribbonTab === 'sections' ? (
                        <>
                            {!draft ? (
                                <label className="grid shrink-0 gap-0.5 text-[10px] text-muted-foreground">
                                    {t('layouts')}
                                    <select
                                        value={selectedLayout ?? 'letter'}
                                        onChange={(event) => chooseLayout(event.target.value as MailLayoutId)}
                                        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                                    >
                                        {layouts.map((layout) => (
                                            <option key={layout.id} value={layout.id}>{layout.title}</option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                            {!draft ? (
                                <>
                                    <ToolDivider />
                                    <SectionCard
                                        label={t('header')}
                                        selected={includeHeader && composeStationery.header.trim() !== ''}
                                        disabled={composeStationery.header.trim() === ''}
                                        onClick={() => applySections({ header: !includeHeader })}
                                    >
                                        <span className="h-2 w-full rounded-sm bg-emerald-700" />
                                        <span className="mt-1 h-1 w-3/4 rounded-sm bg-slate-200" />
                                        <span className="mt-1 h-1 w-full rounded-sm bg-slate-200" />
                                    </SectionCard>
                                    {composeStationery.signatures.map((signature) => (
                                        <SectionCard
                                            key={signature.id}
                                            label={signature.name}
                                            selected={selectedSignatureId === signature.id}
                                            onClick={() =>
                                                applySections({
                                                    signatureId: selectedSignatureId === signature.id ? null : signature.id,
                                                })
                                            }
                                        >
                                            <span className="mt-auto h-1.5 w-3/4 rounded-sm bg-slate-500" />
                                            <span className="mt-1 h-1 w-1/2 rounded-sm bg-emerald-600" />
                                        </SectionCard>
                                    ))}
                                    <SectionCard
                                        label={t('footer')}
                                        selected={includeFooter && composeStationery.footer.trim() !== ''}
                                        disabled={composeStationery.footer.trim() === ''}
                                        onClick={() => applySections({ footer: !includeFooter })}
                                    >
                                        <span className="mt-auto h-1 w-full rounded-sm bg-slate-200" />
                                        <span className="mt-1 h-2 w-full rounded-sm bg-emerald-700" />
                                    </SectionCard>
                                </>
                            ) : null}
                            <ToolDivider />
                            <SectionCard
                                label={t('sectionHeading')}
                                onClick={() => editor?.chain().focus().insertContent(`<h2>${t('sectionHeadingPlaceholder')}</h2><p></p>`).run()}
                            >
                                <span className="h-2 w-4/5 rounded-sm bg-slate-800" />
                                <span className="mt-2 h-1 w-full rounded-sm bg-slate-200" />
                                <span className="mt-1 h-1 w-3/4 rounded-sm bg-slate-200" />
                            </SectionCard>
                            <SectionCard
                                label={t('sectionSubheading')}
                                onClick={() => editor?.chain().focus().insertContent(`<h3>${t('sectionSubheadingPlaceholder')}</h3><p></p>`).run()}
                            >
                                <span className="h-1.5 w-3/4 rounded-sm bg-slate-700" />
                                <span className="mt-2 h-1 w-full rounded-sm bg-slate-200" />
                                <span className="mt-1 h-1 w-2/3 rounded-sm bg-slate-200" />
                            </SectionCard>
                            <SectionCard
                                label={t('sectionTextBlock')}
                                onClick={() => editor?.chain().focus().insertContent(`<p>${t('sectionTextPlaceholder')}</p><p></p>`).run()}
                            >
                                <span className="h-1 w-full rounded-sm bg-slate-300" />
                                <span className="mt-1 h-1 w-5/6 rounded-sm bg-slate-300" />
                                <span className="mt-1 h-1 w-full rounded-sm bg-slate-300" />
                                <span className="mt-1 h-1 w-2/3 rounded-sm bg-slate-300" />
                            </SectionCard>
                            <SectionCard
                                label={t('sectionBulletList')}
                                onClick={() => editor?.chain().focus().insertContent(`<ul><li>${t('sectionFirstItem')}</li><li>${t('sectionSecondItem')}</li></ul><p></p>`).run()}
                            >
                                <span className="flex items-center gap-1"><span className="size-1 rounded-full bg-emerald-700" /><span className="h-1 w-12 rounded-sm bg-slate-300" /></span>
                                <span className="mt-1 flex items-center gap-1"><span className="size-1 rounded-full bg-emerald-700" /><span className="h-1 w-10 rounded-sm bg-slate-300" /></span>
                                <span className="mt-1 flex items-center gap-1"><span className="size-1 rounded-full bg-emerald-700" /><span className="h-1 w-11 rounded-sm bg-slate-300" /></span>
                            </SectionCard>
                            <SectionCard
                                label={t('sectionNumberedSteps')}
                                onClick={() => editor?.chain().focus().insertContent(`<ol><li>${t('sectionFirstStep')}</li><li>${t('sectionSecondStep')}</li></ol><p></p>`).run()}
                            >
                                <span className="flex items-center gap-1 text-[7px] text-slate-700"><span>1.</span><span className="h-1 w-11 rounded-sm bg-slate-300" /></span>
                                <span className="mt-1 flex items-center gap-1 text-[7px] text-slate-700"><span>2.</span><span className="h-1 w-10 rounded-sm bg-slate-300" /></span>
                                <span className="mt-1 flex items-center gap-1 text-[7px] text-slate-700"><span>3.</span><span className="h-1 w-9 rounded-sm bg-slate-300" /></span>
                            </SectionCard>
                            <SectionCard
                                label={t('sectionCallToAction')}
                                onClick={() => editor?.chain().focus().insertContent(`<p style="text-align:center"><strong>${t('sectionCallToActionPlaceholder')}</strong></p><p style="text-align:center">${t('sectionCallToActionDetail')}</p><p></p>`).run()}
                            >
                                <span className="mx-auto h-2 w-4/5 rounded-sm bg-emerald-700" />
                                <span className="mx-auto mt-2 h-1 w-3/4 rounded-sm bg-slate-300" />
                                <span className="mx-auto mt-1 h-1 w-1/2 rounded-sm bg-slate-300" />
                            </SectionCard>
                            <SectionCard
                                label={t('horizontalLine')}
                                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                            >
                                <span className="my-auto h-0.5 w-full bg-slate-600" />
                            </SectionCard>
                            <SectionCard
                                label={t('highlightedNote')}
                                onClick={() => editor?.chain().focus().insertContent(`<blockquote><p><strong>${t('sectionNotePlaceholder')}</strong></p></blockquote><p></p>`).run()}
                            >
                                <span className="h-full w-full rounded-sm border-s-4 border-amber-500 bg-amber-100" />
                            </SectionCard>
                            <SectionCard
                                label={t('spacer')}
                                onClick={() => editor?.chain().focus().insertContent('<p><br></p><p><br></p>').run()}
                            >
                                <span className="h-1 w-full rounded-sm bg-slate-200" />
                                <span className="my-auto h-4 w-full border-y border-dashed border-slate-300" />
                                <span className="h-1 w-full rounded-sm bg-slate-200" />
                            </SectionCard>
                            <div className="sticky end-0 ms-auto flex self-stretch items-center bg-sky-50 ps-3 dark:bg-sky-950/30">
                                <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => setStationeryOpen(true)}>
                                    <Settings2Icon className="size-4" />
                                    {t('editAndSaveSections')}
                                </Button>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
            {linkOpen ? (
                <div className="grid gap-2 border-b border-border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <input
                        value={linkUrl}
                        onChange={(event) => setLinkUrl(event.target.value)}
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        enterKeyHint="done"
                        aria-label={t('link')}
                        className="h-11 min-w-0 rounded-md border border-border bg-background px-2 text-base text-foreground outline-none md:text-sm"
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                applyLink();
                            }
                        }}
                    />
                    <Button type="button" className="min-h-11 touch-manipulation" onClick={applyLink}>
                        {t('applyLink')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 touch-manipulation"
                        onClick={() => {
                            editor?.chain().focus().unsetLink().run();
                            setLinkOpen(false);
                        }}
                    >
                        {t('removeLink')}
                    </Button>
                </div>
            ) : null}

            {draft || selectedLayout ? <EditorContent editor={editor} /> : null}
            <InputError message={form.errors.body} className="px-3" />

            <details className="border-t border-border px-3 py-3">
            <summary className="min-h-11 cursor-pointer list-none text-sm font-medium text-foreground touch-manipulation [&::-webkit-details-marker]:hidden">
                {t('savedRecipients')}
            </summary>
            <div className="grid gap-3 pt-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
                <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                        type="checkbox"
                        checked={form.data.save_recipients}
                        onChange={(event) => form.setData('save_recipients', event.target.checked)}
                        className="rounded border-border text-emerald-700 focus:ring-ring"
                    />
                    {t('saveRecipients')}
                </label>
                <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{t('savedRecipients')}</p>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={saveCurrentRecipient}
                        >
                            <UserPlusIcon className="size-3.5" />
                            {t('saveRecipient')}
                        </button>
                    </div>
                    <input
                        value={recipientName}
                        onChange={(event) => setRecipientName(event.target.value)}
                        placeholder={t('recipientName')}
                        className="h-11 rounded-md border border-border bg-background px-2 text-base text-foreground md:h-8 md:text-xs"
                    />
                    {recipients.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('noSavedRecipients')}</p>
                    ) : (
                        <ul className="grid max-h-40 gap-1 overflow-auto">
                            {recipients.map((recipient) => (
                                <li key={recipient.id} className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="min-h-11 min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-sm touch-manipulation hover:bg-muted"
                                        onClick={() => addSavedRecipient(recipient.email)}
                                    >
                                        <span className="block truncate text-foreground">
                                            {recipient.name || recipient.email}
                                        </span>
                                        {recipient.name ? (
                                            <span className="block truncate text-muted-foreground">
                                                {recipient.email}
                                            </span>
                                        ) : null}
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground touch-manipulation hover:text-foreground"
                                        aria-label={`${t('removeRecipient')} ${recipient.email}`}
                                        onClick={() =>
                                            router.delete(route('mailbox.recipients.destroy', recipient.id), {
                                                preserveScroll: true,
                                                preserveState: true,
                                            })
                                        }
                                    >
                                        <Trash2Icon className="size-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            </details>
            </div>

            <EmailStationery open={stationeryOpen} stationery={stationery} onClose={() => setStationeryOpen(false)} />
        </form>
    );
}

export function composedMessageText(html: string): string {
    const own = withoutStationery(html.split(/<hr\b/i)[0] ?? html);

    return own
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

export function mailboxAddress(value: string): string {
    const match = value.match(/<([^<>\s]+@[^<>\s]+)>/);

    return (match?.[1] ?? value).trim();
}

function templateParagraphs(value: string): string {
    return value
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function quotePlainText(body: string, intro?: string): string {
    const escaped = escapeHtml(body).replace(/\n/g, '<br>');
    const heading = intro
        ? `<p>${escapeHtml(intro).replace(/\n/g, '<br>')}</p>`
        : '';

    const writingRoom = '<p><br></p>'.repeat(6);

    return `${writingRoom}<hr>${heading}<blockquote><p>${escaped}</p></blockquote>`;
}
