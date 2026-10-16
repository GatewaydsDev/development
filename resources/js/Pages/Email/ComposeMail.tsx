import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { router, useForm } from '@inertiajs/react';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    BoldIcon,
    FlagIcon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    PaperclipIcon,
    Redo2Icon,
    StrikethroughIcon,
    Trash2Icon,
    UnderlineIcon,
    Undo2Icon,
    UserPlusIcon,
    XIcon,
} from 'lucide-react';
import { FormEvent, KeyboardEvent, ReactNode, useRef, useState } from 'react';
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
    onDiscard: () => void;
};

type AddressFieldName = 'to' | 'cc' | 'bcc';

const splitAddresses = (value: string) =>
    value
        .split(/[;,]+/)
        .map((part) => part.trim())
        .filter((part) => part !== '');

const joinAddresses = (addresses: string[]) => addresses.join(', ');

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
    const addresses = splitAddresses(value);

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

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
            if (entry.trim() === '') {
                return;
            }

            event.preventDefault();
            commit();
        }

        if (event.key === 'Backspace' && entry === '' && addresses.length > 0) {
            remove(addresses[addresses.length - 1]);
        }
    };

    const matches = suggestions.filter((recipient) => {
        const query = entry.trim().toLowerCase();

        if (query === '') {
            return false;
        }

        return (
            recipient.email.toLowerCase().includes(query) ||
            (recipient.name ?? '').toLowerCase().includes(query)
        );
    });

    return (
        <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 border-b border-border py-2 text-sm">
            <span className="pt-1.5 text-muted-foreground">{label}</span>
            <span className="relative grid gap-1">
                <span className="flex min-h-9 flex-wrap items-center gap-1">
                    {addresses.map((address) => (
                        <span
                            key={address}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                        >
                            {address}
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
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
                        className="h-8 min-w-40 flex-1 bg-transparent text-sm text-foreground outline-none"
                    />
                </span>
                {open && matches.length > 0 ? (
                    <span className="absolute top-full z-20 mt-1 grid w-full overflow-hidden rounded-md border border-border bg-background shadow-sm">
                        {matches.map((recipient) => (
                            <button
                                key={recipient.id}
                                type="button"
                                className="px-3 py-2 text-left text-sm hover:bg-muted"
                                onMouseDown={(event) => {
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
            className={`inline-flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted ${pressed ? 'bg-muted' : ''}`}
        >
            {children}
        </button>
    );
}

export default function ComposeMail({
    mailbox,
    recipients,
    draft,
    onDiscard,
}: ComposeMailProps) {
    const { t } = useTranslation('mail');
    const fileRef = useRef<HTMLInputElement>(null);
    const [showCc, setShowCc] = useState(Boolean(draft?.cc));
    const [showBcc, setShowBcc] = useState(Boolean(draft?.bcc));
    const [activeField, setActiveField] = useState<AddressFieldName>('to');
    const [recipientName, setRecipientName] = useState('');
    const form = useForm({
        to: draft?.to ?? '',
        cc: draft?.cc ?? '',
        bcc: draft?.bcc ?? '',
        subject: draft?.subject ?? '',
        body: draft?.body ?? '',
        importance: 'normal' as 'low' | 'normal' | 'high',
        save_recipients: true,
        attachments: [] as File[],
    });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: false }),
            Underline,
            LinkExtension.configure({ openOnClick: false }),
            Placeholder.configure({ placeholder: t('writeMessage') }),
        ],
        content: draft?.body || '',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'min-h-48 px-3 py-2 text-sm text-foreground outline-none',
            },
        },
        onUpdate: ({ editor: current }) => {
            form.setData('body', current.getHTML());
        },
    });

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

        if (!editor?.getText().trim()) {
            form.setError('body', t('messageRequired'));

            return;
        }

        form.transform((data) => ({
            ...data,
            body: editor.getHTML(),
            save_recipients: data.save_recipients ? 1 : 0,
            attachments: data.attachments.length > 0 ? data.attachments : undefined,
        }));
        form.post(route('mailbox.send'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => onDiscard(),
        });
    };

    const cycleImportance = () => {
        const order = ['normal', 'high', 'low'] as const;
        const index = order.indexOf(form.data.importance);

        form.setData('importance', order[(index + 1) % order.length]);
    };

    const setLink = () => {
        const previous = editor?.getAttributes('link').href as string | undefined;
        const url = window.prompt(t('link'), previous ?? 'https://');

        if (url === null) {
            return;
        }

        if (url.trim() === '') {
            editor?.chain().focus().unsetLink().run();

            return;
        }

        editor?.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    };

    return (
        <form onSubmit={submit} className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <Button type="submit" disabled={form.processing}>
                    {form.processing ? t('sending') : t('send')}
                </Button>
                <Button type="button" variant="outline" onClick={onDiscard}>
                    {t('discard')}
                </Button>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <PaperclipIcon className="size-4" />
                    {t('attach')}
                </Button>
                <Button
                    type="button"
                    variant={form.data.importance === 'normal' ? 'outline' : 'default'}
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
                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        form.setData('attachments', [...form.data.attachments, ...files].slice(0, 5));
                        event.target.value = '';
                    }}
                />
            </div>

            <div className="px-3">
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 border-b border-border py-2 text-sm">
                    <span className="text-muted-foreground">{t('from')}</span>
                    <span className="text-foreground">{mailbox}</span>
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
                <div className="flex gap-3 py-2 text-sm">
                    {!showCc ? (
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setShowCc(true)}>
                            {t('cc')}
                        </button>
                    ) : null}
                    {!showBcc ? (
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setShowBcc(true)}>
                            {t('bcc')}
                        </button>
                    ) : null}
                </div>
                <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 border-b border-border py-2 text-sm">
                    <span className="text-muted-foreground">{t('subject')}</span>
                    <input
                        value={form.data.subject}
                        onChange={(event) => form.setData('subject', event.target.value)}
                        maxLength={255}
                        className="h-9 bg-transparent text-sm text-foreground outline-none"
                        required
                    />
                </label>
                <InputError message={form.errors.subject} />
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1">
                <ToolButton label={t('undo')} onClick={() => editor?.chain().focus().undo().run()}>
                    <Undo2Icon className="size-4" />
                </ToolButton>
                <ToolButton label={t('redo')} onClick={() => editor?.chain().focus().redo().run()}>
                    <Redo2Icon className="size-4" />
                </ToolButton>
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
                <ToolButton label={t('bulletList')} pressed={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                    <ListIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('numberedList')} pressed={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                    <ListOrderedIcon className="size-4" />
                </ToolButton>
                <ToolButton label={t('link')} pressed={editor?.isActive('link')} onClick={setLink}>
                    <LinkIcon className="size-4" />
                </ToolButton>
            </div>

            <EditorContent editor={editor} />
            <InputError message={form.errors.body} className="px-3" />

            {form.data.attachments.length > 0 ? (
                <ul className="grid gap-1 border-t border-border px-3 py-2 text-sm">
                    {form.data.attachments.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                            <span className="truncate text-foreground">{file.name}</span>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`${t('removeAttachment')} ${file.name}`}
                                onClick={() =>
                                    form.setData(
                                        'attachments',
                                        form.data.attachments.filter((_, itemIndex) => itemIndex !== index),
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

            <div className="grid gap-3 border-t border-border px-3 py-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
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
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    />
                    {recipients.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('noSavedRecipients')}</p>
                    ) : (
                        <ul className="grid max-h-40 gap-1 overflow-auto">
                            {recipients.map((recipient) => (
                                <li key={recipient.id} className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
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
                                        className="text-muted-foreground hover:text-foreground"
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
        </form>
    );
}

export function quotePlainText(body: string): string {
    const escaped = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    return `<p></p><blockquote><p>${escaped}</p></blockquote>`;
}
