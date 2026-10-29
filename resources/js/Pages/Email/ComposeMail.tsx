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
    AlignLeftIcon,
    AlignRightIcon,
    BoldIcon,
    FlagIcon,
    HighlighterIcon,
    ListIndentDecreaseIcon,
    ListIndentIncreaseIcon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    PaperclipIcon,
    Redo2Icon,
    RemoveFormattingIcon,
    SendIcon,
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

type ComposeMailProps = {
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
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36];

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
    onDiscard,
}: ComposeMailProps) {
    const { t } = useTranslation('mail');
    const fileRef = useRef<HTMLInputElement>(null);
    const [showCc, setShowCc] = useState(Boolean(draft?.cc));
    const [selectedLayout, setSelectedLayout] = useState<MailLayoutId | null>(null);
    const layoutSnapshot = useRef('');
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
        body: draft ? placeReplySignature(draft.body ?? '', signatureHtml(stationery, 'reply')) : '',
        importance: 'normal' as 'low' | 'normal' | 'high',
        save_recipients: true,
        attachments: [] as File[],
    });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: false }),
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
        content: draft
            ? placeReplySignature(draft.body || '', signatureHtml(stationery, 'reply'))
            : '',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'min-h-52 px-3 py-3 font-[Calibri,Arial,sans-serif] text-base text-foreground outline-none md:min-h-72 md:text-sm [&_blockquote]:mt-4 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-400 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground dark:[&_blockquote]:border-slate-300 [&_hr]:my-8 [&_hr]:h-1 [&_hr]:border-0 [&_hr]:bg-slate-700 dark:[&_hr]:bg-slate-200',
            },
        },
        onUpdate: ({ editor: current }) => {
            form.setData('body', current.getHTML());
        },
    });
    useEditorTick(editor);

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

        if ([...composedMessageText(editor?.getHTML() ?? '')].length < 8) {
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

    const openLink = () => {
        const previous = editor?.getAttributes('link').href as string | undefined;
        setLinkUrl(previous ?? 'https://');
        setLinkOpen(true);
    };

    const chooseLayout = (layout: MailLayoutId) => {
        const current = editor?.getHTML() ?? '';
        const html = selectedLayout === null
            ? buildLayout(layout, stationery)
            : applyLayout(layout, stationery, current, layoutSnapshot.current);
        editor?.commands.setContent(html);
        const normalized = editor?.getHTML() ?? html;
        layoutSnapshot.current = normalized;
        form.setData('body', normalized);
        setSelectedLayout(layout);
    };

    const layouts: Array<{ id: MailLayoutId; title: string; detail: string; bars: string[] }> = [
        { id: 'blank', title: t('layoutBlank'), detail: t('layoutBlankDetail'), bars: ['h-2 w-2/3 bg-slate-200', 'mt-auto h-2 w-1/2 bg-emerald-700'] },
        { id: 'letter', title: t('layoutLetter'), detail: t('layoutLetterDetail'), bars: ['h-3 w-full bg-emerald-700', 'mt-2 h-1.5 w-5/6 bg-slate-200', 'mt-1 h-1.5 w-2/3 bg-slate-200', 'mt-auto h-2 w-1/2 bg-slate-400', 'mt-1 h-1 w-full bg-emerald-200'] },
        { id: 'note', title: t('layoutNote'), detail: t('layoutNoteDetail'), bars: ['h-1.5 w-4/5 bg-slate-200', 'mt-1 h-1.5 w-3/5 bg-slate-200', 'mt-auto h-2 w-1/2 bg-emerald-700'] },
        { id: 'announcement', title: t('layoutAnnouncement'), detail: t('layoutAnnouncementDetail'), bars: ['mx-auto h-3 w-2/3 bg-emerald-700', 'mx-auto mt-2 h-2 w-1/2 bg-slate-800', 'mt-auto h-1 w-full bg-emerald-200'] },
        { id: 'project', title: t('layoutProject'), detail: t('layoutProjectDetail'), bars: ['h-3 w-full bg-emerald-700', 'mt-2 h-1.5 w-1/3 bg-emerald-500', 'mt-2 h-1.5 w-5/6 bg-slate-200', 'mt-auto h-2 w-1/2 bg-slate-400'] },
        { id: 'followUp', title: t('layoutFollowUp'), detail: t('layoutFollowUpDetail'), bars: ['h-3 w-full bg-emerald-700', 'mt-2 h-1.5 w-2/5 bg-emerald-500', 'mt-2 h-1.5 w-4/5 bg-slate-200', 'mt-auto h-1 w-full bg-emerald-200'] },
    ];

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
        <form onSubmit={submit} className="min-w-0 pb-28">
            <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
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
                <ul
                    className="grid gap-2 border-b border-border bg-muted/40 px-3 py-3"
                    aria-label={t('attachments')}
                >
                    <li className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('attachments')}
                    </li>
                    {attachedFiles.map((file, index) => (
                        <li
                            key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                            className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                        >
                            <PaperclipIcon className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">
                                    {file.name}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                </span>
                            </span>
                            <button
                                type="button"
                                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground"
                                aria-label={`${t('removeAttachment')} ${file.name}`}
                                onClick={() =>
                                    updateAttachments(
                                        attachedFiles.filter((_, itemIndex) => itemIndex !== index),
                                    )
                                }
                            >
                                <XIcon className="size-4" />
                            </button>
                        </li>
                    ))}
                </ul>
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

            <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/30 px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ToolButton label={t('undo')} onClick={() => editor?.chain().focus().undo().run()}>
                    <Undo2Icon className="size-4" />
                </ToolButton>
                <ToolButton label={t('redo')} onClick={() => editor?.chain().focus().redo().run()}>
                    <Redo2Icon className="size-4" />
                </ToolButton>
                <ToolDivider />
                <select
                    aria-label={t('font')}
                    value={String(editor?.getAttributes('textStyle').fontFamily || FONT_FAMILIES[0].value)}
                    onChange={(event) => {
                        const style = editor?.getAttributes('textStyle') ?? {};
                        editor?.chain().focus().setMark('textStyle', { ...style, fontFamily: event.target.value }).run();
                    }}
                    className="h-11 max-w-40 shrink-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
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
                    className="h-11 w-20 shrink-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                    {FONT_SIZES.map((size) => (
                        <option key={size} value={`${size}px`}>{size}</option>
                    ))}
                </select>
                <ToolDivider />
                <ToolButton label={t('bold')} pressed={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
                    <BoldIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('italic')} pressed={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                    <ItalicIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('underline')} pressed={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                    <UnderlineIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('strike')} pressed={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
                    <StrikethroughIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('subscript')} pressed={editor?.isActive('subscript')} onClick={() => editor?.chain().focus().toggleSubscript().run()}>
                    <SubscriptIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('superscript')} pressed={editor?.isActive('superscript')} onClick={() => editor?.chain().focus().toggleSuperscript().run()}>
                    <SuperscriptIcon className="size-4" />
                </ToolButton>
                <Swatches
                    label={t('textColor')}
                    colors={TEXT_COLORS}
                    onPick={(color) => {
                        if (!editor) {
                            return;
                        }

                        const style = editor.getAttributes('textStyle');

                        if (color) {
                            editor.chain().focus().setColor(color).run();

                            return;
                        }

                        editor.chain().focus().setMark('textStyle', { ...style, color: null }).run();
                    }}
                >
                    <TypeIcon className="size-4" style={{ color: String(editor?.getAttributes('textStyle').color || 'currentColor') }} />
                </Swatches>
                <Swatches
                    label={t('highlight')}
                    colors={HIGHLIGHT_COLORS}
                    onPick={(color) => {
                        if (!editor) {
                            return;
                        }

                        if (color) {
                            editor.chain().focus().setHighlight({ color }).run();

                            return;
                        }

                        editor.chain().focus().unsetHighlight().run();
                    }}
                >
                    <HighlighterIcon className="size-4" />
                </Swatches>
                <ToolDivider />
                <ToolButton label={t('bulletList')} pressed={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                    <ListIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('numberedList')} pressed={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                    <ListOrderedIcon className="size-4" />
                </ToolButton>
                <ToolButton
                    label={t('outdent')}
                    onClick={() => {
                        if (!editor) {
                            return;
                        }

                        if (editor.isActive('listItem')) {
                            editor.chain().focus().liftListItem('listItem').run();

                            return;
                        }

                        const indent = Number(editor.getAttributes('paragraph').indent || 0);
                        editor.chain().focus().updateAttributes('paragraph', { indent: Math.max(0, indent - 1) }).run();
                    }}
                >
                    <ListIndentDecreaseIcon className="size-4" />
                </ToolButton>
                <ToolButton
                    label={t('indent')}
                    onClick={() => {
                        if (!editor) {
                            return;
                        }

                        if (editor.can().sinkListItem('listItem')) {
                            editor.chain().focus().sinkListItem('listItem').run();

                            return;
                        }

                        const indent = Number(editor.getAttributes('paragraph').indent || 0);
                        editor.chain().focus().updateAttributes('paragraph', { indent: Math.min(8, indent + 1) }).run();
                    }}
                >
                    <ListIndentIncreaseIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('alignLeft')} pressed={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
                    <AlignLeftIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('alignCenter')} pressed={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
                    <AlignCenterIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('alignRight')} pressed={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
                    <AlignRightIcon className="size-4" />
                </ToolButton>
                <ToolDivider />
                <ToolButton label={t('link')} pressed={editor?.isActive('link') || linkOpen} onClick={openLink}>
                    <LinkIcon className="size-4" />
                </ToolButton>
                <ToolButton
                    label={t('clearFormatting')}
                    onClick={() => editor?.chain().focus().unsetAllMarks().setTextAlign('left').updateAttributes('paragraph', { indent: 0 }).run()}
                >
                    <RemoveFormattingIcon className="size-4" />
                </ToolButton>
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

            {draft ? null : (
                <div className="border-b border-border px-4 py-3">
                    {selectedLayout ? null : (
                        <p className="mb-3 text-sm text-muted-foreground">{t('layoutHelp')}</p>
                    )}
                    <div className="flex flex-wrap gap-3">
                        {layouts.map((layout) => {
                            const selected = selectedLayout === layout.id;

                            return (
                                <button
                                    key={layout.id}
                                    type="button"
                                    title={layout.detail}
                                    aria-pressed={selected}
                                    className="flex w-16 flex-col items-center gap-1 text-center"
                                    onClick={() => chooseLayout(layout.id)}
                                >
                                    <span className={`flex h-16 w-16 flex-col rounded-md border bg-white p-1.5 ${selected ? 'border-emerald-600 ring-2 ring-emerald-600' : 'border-border hover:border-emerald-600'}`}>
                                        {layout.bars.map((bar, index) => (
                                            <span key={`${layout.id}-${index}`} className={`block rounded-sm ${bar}`} />
                                        ))}
                                    </span>
                                    <span className="text-[11px] font-medium leading-4 text-foreground">{layout.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
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

            <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:left-72 xl:left-80 [[data-sidebar-collapsed=1]_&]:lg:left-16 [[data-sidebar-collapsed=1]_&]:xl:left-16">
                <div className="mx-auto flex max-w-[96rem] items-center gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                    <Button
                        className="h-12 shrink-0 bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                        type="submit"
                        disabled={form.processing}
                    >
                        <SendIcon className="size-4" />
                        {form.processing ? t('sending') : t('send')}
                    </Button>
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                        <Button className="h-12 shrink-0 touch-manipulation" type="button" variant="outline" onClick={() => setStationeryOpen(true)}>
                            {t('stationery')}
                        </Button>
                        <Button className="h-12 shrink-0 touch-manipulation" type="button" variant="outline" onClick={onDiscard}>
                            <XIcon className="size-4" />
                            {t('discard')}
                        </Button>
                        <Button className="h-12 shrink-0 touch-manipulation" type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                            <PaperclipIcon className="size-4" />
                            {t('attach')}
                        </Button>
                        <Button
                            className="h-12 shrink-0 touch-manipulation"
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
                    </div>
                </div>
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
