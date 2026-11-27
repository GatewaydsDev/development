import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ComposeMail, {
    mailboxAddress,
    quotePlainText,
    type ComposeDraft,
    type MailTemplateOption,
    type SavedRecipient,
} from '@/Pages/Email/ComposeMail';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { acknowledgeUnreadMail, adjustUnreadMail, setUnreadMail } from '@/lib/unreadMail';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { ArchiveIcon, ArrowLeftIcon, ChevronDownIcon, DownloadIcon, FilePenLineIcon, ForwardIcon, MailIcon, MailOpenIcon, MoreVerticalIcon, PaperclipIcon, RefreshCwIcon, ReplyAllIcon, ReplyIcon, SendIcon, SquarePenIcon, XIcon } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emptyStationery, type MailStationeryData } from '@/Pages/Email/mailLayouts';

type MailFolder = MailFolder | 'drafts';

type MailSummary = {
    id: string;
    subject: string;
    from: string;
    to: string[];
    preview: string;
    received_at: string | null;
    sent_at: string | null;
    is_read: boolean;
    has_attachments?: boolean;
    folder: string;
};

type MailAttachment = {
    id: string;
    name: string;
    content_type: string;
    size: number;
    image: boolean;
};

type MailMessage = {
    id: string;
    subject: string;
    from: string;
    to: string[];
    cc?: string[];
    received_at: string | null;
    sent_at: string | null;
    body: string;
    html?: string;
    bcc?: string[];
    images?: Array<{ name: string; src: string }>;
    attachments?: MailAttachment[];
    has_attachments?: boolean;
};

type AttachmentViewer = {
    name: string;
    src: string;
};

type Props = {
    mailbox: string | null;
    folder: MailFolder;
    status: 'all' | 'unread' | 'read';
    messages: MailSummary[];
    nextCursor: string | null;
    message: MailMessage | null;
    graphError: string | null;
    savedRecipients?: SavedRecipient[];
    signature?: string | null;
    headerUrl?: string | null;
    headerWidth?: number;
    footerColors?: string[];
    stationery?: MailStationeryData;
    emailTemplates?: MailTemplateOption[];
    unreadCount?: number;
    blockedCount?: number;
    deliveryProblems?: string[];
};

function attachmentUrl(messageId: string, attachmentId: string): string {
    return route('mailbox.attachment', {
        message: messageId,
        attachment: attachmentId,
    });
}

function downloadHref(src: string): string {
    if (src.startsWith('data:')) {
        return src;
    }

    return `${src}${src.includes('?') ? '&' : '?'}download=1`;
}

function fileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 1024) {
        return `${Math.max(0, Math.round(bytes || 0))} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageWhen(message: MailMessage): string {
    const stamp = message.received_at ?? message.sent_at;

    if (!stamp) {
        return '';
    }

    const date = new Date(stamp);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function replyAllAddresses(message: MailMessage, mailbox: string): { to: string; cc: string } {
    const own = mailboxAddress(mailbox).toLowerCase();
    const seen = new Set<string>();
    const keep = (value: string) => {
        const email = mailboxAddress(value).toLowerCase();

        if (email === '' || email === own || seen.has(email)) {
            return false;
        }

        seen.add(email);

        return true;
    };
    const addressed = Array.isArray(message.to) ? message.to : [];
    const copiedOnMessage = Array.isArray(message.cc) ? message.cc : [];
    const sender = mailboxAddress(message.from);
    const fromUs = mailboxAddress(sender).toLowerCase() === own;
    const to = fromUs
        ? addressed.filter(keep)
        : [sender].filter(keep);
    const copied = fromUs ? copiedOnMessage : [...addressed, ...copiedOnMessage];

    return {
        to: to.map((value) => mailboxAddress(value)).join(', '),
        cc: copied.filter(keep).map((value) => mailboxAddress(value)).join(', '),
    };
}

function replyIntro(message: MailMessage): string {
    const when = messageWhen(message);

    return when
        ? `On ${when}, ${message.from} wrote:`
        : `${message.from} wrote:`;
}

function forwardIntro(message: MailMessage): string {
    const when = messageWhen(message);
    const sent = when ? `Sent: ${when}` : '';

    return ['---------- Forwarded message ----------', `From: ${message.from}`, sent]
        .filter((line) => line !== '')
        .join('\n');
}

function MessageStatus({
    folder,
    isRead,
}: {
    folder: MailFolder;
    isRead: boolean;
}) {
    const { t } = useTranslation('mail');

    if (folder === 'drafts') {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <FilePenLineIcon className="size-3.5" />
                {t('drafts')}
            </span>
        );
    }

    if (folder === 'sent') {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                <SendIcon className="size-3.5" />
                {t('sentStatus')}
            </span>
        );
    }

    if (isRead) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <MailOpenIcon className="size-3.5" />
                {t('readMessage')}
            </span>
        );
    }

    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
            <MailIcon className="size-3.5" />
            {t('unreadMessage')}
        </span>
    );
}

function MessageOptions({
    messageId,
    folder,
    acting,
    onRead,
    onArchive,
}: {
    messageId: string;
    folder: MailFolder;
    acting: boolean;
    onRead: (messageId: string, isRead: boolean) => void;
    onArchive: (messageId: string, archived: boolean) => void;
}) {
    const { t } = useTranslation('mail');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={t('messageOptions')}
                    className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    <MoreVerticalIcon className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem className="min-h-11" disabled={acting} onSelect={() => onRead(messageId, true)}>
                    <MailOpenIcon className="size-4" />
                    {t('markRead')}
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-11" disabled={acting} onSelect={() => onRead(messageId, false)}>
                    <MailIcon className="size-4" />
                    {t('markUnread')}
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="min-h-11"
                    disabled={acting}
                    onSelect={() => onArchive(messageId, folder !== 'archive')}
                >
                    <ArchiveIcon className="size-4" />
                    {folder === 'archive' ? t('moveToInbox') : t('archive')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const formatWhen = (value: string | null) => {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
};

type ConversationSection = {
    text: string;
    depth: number;
};

function InlineMessageText({ text }: { text: string }) {
    const parts = text.split(/((?:https?:\/\/|www\.)[^\s<>()]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/gi);

    return parts.map((part, index) => {
        if (/^(?:https?:\/\/|www\.)/i.test(part)) {
            const trailing = part.match(/[),.;!?]+$/)?.[0] ?? '';
            const cleanUrl = trailing === '' ? part : part.slice(0, -trailing.length);
            const href = /^www\./i.test(cleanUrl) ? `https://${cleanUrl}` : cleanUrl;

            return (
                <span key={`${part}-${index}`}>
                    <a className="font-medium text-sky-700 underline underline-offset-2 dark:text-sky-300" href={href} target="_blank" rel="noopener noreferrer">
                        {cleanUrl}
                    </a>
                    {trailing}
                </span>
            );
        }

        if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/i.test(part)) {
            return (
                <a key={`${part}-${index}`} className="font-medium text-sky-700 underline underline-offset-2 dark:text-sky-300" href={`mailto:${part}`}>
                    {part}
                </a>
            );
        }

        return part;
    });
}

function FormattedMessageText({ text }: { text: string }) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const blocks: ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index].trim();

        if (line === '') {
            index += 1;
            continue;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            blocks.push(
                <h3 key={`heading-${index}`} className="text-base font-semibold leading-6 text-foreground">
                    <InlineMessageText text={heading[2]} />
                </h3>,
            );
            index += 1;
            continue;
        }

        if (/^\s*[-*•]\s+/.test(lines[index])) {
            const items: string[] = [];

            while (index < lines.length && /^\s*[-*•]\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*[-*•]\s+/, '').trim());
                index += 1;
            }

            blocks.push(
                <ul key={`bullets-${index}`} className="ms-5 list-disc space-y-1 text-sm leading-6 text-foreground marker:text-emerald-700">
                    {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}><InlineMessageText text={item} /></li>)}
                </ul>,
            );
            continue;
        }

        if (/^\s*\d+[.)]\s+/.test(lines[index])) {
            const items: string[] = [];

            while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*\d+[.)]\s+/, '').trim());
                index += 1;
            }

            blocks.push(
                <ol key={`numbers-${index}`} className="ms-5 list-decimal space-y-1 text-sm leading-6 text-foreground marker:font-semibold marker:text-emerald-700">
                    {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}><InlineMessageText text={item} /></li>)}
                </ol>,
            );
            continue;
        }

        if (/^\s*>/.test(lines[index])) {
            const quoted: string[] = [];

            while (index < lines.length && /^\s*>/.test(lines[index])) {
                quoted.push(lines[index].replace(/^\s*>\s?/, ''));
                index += 1;
            }

            blocks.push(
                <blockquote key={`quote-${index}`} className="border-s-4 border-sky-400 bg-sky-500/5 px-3 py-2 text-sm italic leading-6 text-muted-foreground">
                    {quoted.map((quotedLine, quotedIndex) => (
                        <span key={`${quotedLine}-${quotedIndex}`}>
                            <InlineMessageText text={quotedLine} />
                            {quotedIndex < quoted.length - 1 ? <br /> : null}
                        </span>
                    ))}
                </blockquote>,
            );
            continue;
        }

        const paragraph: string[] = [];
        while (
            index < lines.length
            && lines[index].trim() !== ''
            && !/^(#{1,3})\s+/.test(lines[index].trim())
            && !/^\s*[-*•]\s+/.test(lines[index])
            && !/^\s*\d+[.)]\s+/.test(lines[index])
            && !/^\s*>/.test(lines[index])
        ) {
            paragraph.push(lines[index].trim());
            index += 1;
        }

        blocks.push(
            <p key={`paragraph-${index}`} className="text-sm leading-6 text-foreground">
                {paragraph.map((paragraphLine, paragraphIndex) => (
                    <span key={`${paragraphLine}-${paragraphIndex}`}>
                        <InlineMessageText text={paragraphLine} />
                        {paragraphIndex < paragraph.length - 1 ? <br /> : null}
                    </span>
                ))}
            </p>,
        );
    }

    return <div className="grid gap-3 break-words [overflow-wrap:anywhere]">{blocks}</div>;
}

function isConversationBoundary(lines: string[], index: number): boolean {
    const line = lines[index]?.trim() ?? '';
    const startsQuotedBlock = /^>{1,}\s*/.test(line)
        && !/^>{1,}\s*/.test(lines[index - 1]?.trim() ?? '');

    if (
        /^(?:On .{1,300} wrote:|El .{1,300} escribió:)$/i.test(line)
        || /^[-_]{2,}\s*(?:Original Message|Forwarded message|Mensaje original|Mensaje reenviado)\s*[-_]{2,}$/i.test(line)
        || startsQuotedBlock
    ) {
        return true;
    }

    if (/^(?:From|De):\s*.+/i.test(line)) {
        const previous = lines[index - 1]?.trim() ?? '';

        if (/^[-_]{2,}\s*(?:Original Message|Forwarded message|Mensaje original|Mensaje reenviado)\s*[-_]{2,}$/i.test(previous)) {
            return false;
        }

        const nearby = lines.slice(index + 1, index + 7).map((item) => item.trim());
        const hasDate = nearby.some((item) => /^(?:Sent|Date|Enviado|Fecha):/i.test(item));
        const hasRecipient = nearby.some((item) => /^(?:To|Subject|Para|Asunto):/i.test(item));

        return hasDate && hasRecipient;
    }

    return false;
}

function conversationSections(body: string): ConversationSection[] {
    const lines = body.replace(/\r\n?/g, '\n').split('\n');
    const sections: ConversationSection[] = [];
    let start = 0;

    for (let index = 1; index < lines.length; index += 1) {
        if (!isConversationBoundary(lines, index)) {
            continue;
        }

        const text = lines.slice(start, index).join('\n').trim();

        if (text !== '') {
            sections.push({ text, depth: sections.length });
            start = index;
        }
    }

    const remaining = lines.slice(start).join('\n').trim();

    if (remaining !== '') {
        sections.push({ text: remaining, depth: sections.length });
    }

    return sections.length > 0 ? sections : [{ text: body, depth: 0 }];
}

function ConversationBody({ body }: { body: string }) {
    const { t } = useTranslation('mail');
    const sections = conversationSections(body);
    const colors = [
        'border-emerald-500/50 bg-emerald-500/5',
        'border-sky-500/50 bg-sky-500/10',
        'border-amber-500/50 bg-amber-500/10',
        'border-violet-500/50 bg-violet-500/10',
    ];

    if (sections.length === 1) {
        return <FormattedMessageText text={body} />;
    }

    return (
        <div className="grid gap-3">
            {sections.map((section) => (
                <section
                    key={`${section.depth}-${section.text.slice(0, 40)}`}
                    className={`rounded-md border border-s-4 p-3 ${colors[section.depth % colors.length]}`}
                >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.depth === 0
                            ? t('currentMessage')
                            : section.depth === 1
                              ? t('previousMessage')
                              : t('earlierMessage')}
                    </p>
                    <FormattedMessageText text={section.text} />
                </section>
            ))}
        </div>
    );
}

export default function Index({
    mailbox,
    folder,
    status,
    messages,
    nextCursor,
    message,
    graphError,
    savedRecipients = [],
    stationery = emptyStationery,
    emailTemplates = [],
    unreadCount = 0,
    blockedCount = 0,
    deliveryProblems = [],
}: Props) {
    const list = Array.isArray(messages) ? messages : [];
    const { t } = useTranslation('mail');
    const page = usePage();
    const flash = page.props.flash as { success?: string | null; error?: string | null } | undefined;
    const currentCursor = new URLSearchParams(page.url.split('?')[1] ?? '').get('cursor');
    const listScrollKey = `mailbox-list-scroll:${folder}:${status}:${currentCursor ?? 'first'}`;
    const [refreshing, setRefreshing] = useState(false);
    const composeRequested = new URLSearchParams(page.url.split('?')[1] ?? '').get('compose') === '1';
    const [showCompose, setShowCompose] = useState(composeRequested);
    const [draft, setDraft] = useState<ComposeDraft | undefined>(undefined);
    const [draftKey, setDraftKey] = useState(0);
    const [acting, setActing] = useState(false);
    const [bulkActing, setBulkActing] = useState(false);
    const [bulkConfirmation, setBulkConfirmation] = useState<boolean | null>(null);
    const [viewer, setViewer] = useState<AttachmentViewer | null>(null);
    const [viewerFailed, setViewerFailed] = useState(false);
    const [showBlocked, setShowBlocked] = useState(false);
    const listPane = useRef<HTMLDivElement>(null);
    const messagePane = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const visible =
            folder === 'inbox' ? list.filter((item) => !item.is_read).length : 0;

        setUnreadMail(Math.max(unreadCount, visible));
    }, [unreadCount, folder, list]);

    useEffect(() => {
        if (composeRequested) {
            setShowCompose(true);
        }
    }, [composeRequested]);

    useEffect(() => {
        if (folder !== 'inbox' || message === null) {
            return;
        }

        const opened = list.find((item) => item.id === message.id);

        if (opened && !opened.is_read) {
            acknowledgeUnreadMail(message.id);
        }
    }, [folder, message, list]);

    useLayoutEffect(() => {
        const pane = listPane.current;

        if (!pane) {
            return;
        }

        const saved = window.sessionStorage.getItem(listScrollKey);
        const position = saved === null ? Number.NaN : Number(saved);

        pane.scrollTop = Number.isFinite(position) ? Math.max(0, position) : 0;
    }, [listScrollKey, list, message]);

    useLayoutEffect(() => {
        if (messagePane.current) {
            messagePane.current.scrollTop = 0;
        }

        if (!message?.id || window.matchMedia('(min-width: 768px)').matches) {
            return;
        }

        window.scrollTo(0, 0);
    }, [message?.id]);

    const rememberListScroll = () => {
        const pane = listPane.current;

        if (!pane) {
            return;
        }

        window.sessionStorage.setItem(listScrollKey, String(pane.scrollTop));
    };

    const folderHref = (
        nextFolder: MailFolder,
        cursor?: string | null,
        nextStatus: 'all' | 'unread' | 'read' = nextFolder === 'inbox' ? status : 'all',
    ) =>
        route('mailbox.index', {
            folder: nextFolder,
            ...(nextFolder === 'inbox' && nextStatus !== 'all' ? { status: nextStatus } : {}),
            ...(cursor ? { cursor } : {}),
        });

    const refresh = () => {
        setRefreshing(true);
        router.get(
            folderHref(folder),
            {},
            {
                preserveScroll: true,
                onFinish: () => setRefreshing(false),
            },
        );
    };

    const openCompose = (nextDraft?: ComposeDraft) => {
        setDraft(nextDraft);
        setDraftKey((key) => key + 1);
        setShowCompose(true);
    };

    const folderTitle = folder === 'sent' ? t('sent') : folder === 'archive' ? t('archive') : folder === 'drafts' ? t('drafts') : t('inbox');

    const changeRead = (messageId: string, isRead: boolean) => {
        const current = list.find((item) => item.id === messageId);

        if (isRead && current?.is_read === false) {
            acknowledgeUnreadMail(messageId);
        } else if (!isRead && current?.is_read !== false) {
            adjustUnreadMail(1);
        }

        setActing(true);
        router.patch(
            route('mailbox.state'),
            { message: messageId, is_read: isRead ? 1 : 0 },
            {
                preserveScroll: true,
                onFinish: () => setActing(false),
            },
        );
    };

    const changeAllRead = (isRead: boolean) => {
        setBulkConfirmation(null);
        setBulkActing(true);
        router.post(
            route('mailbox.state.all'),
            { is_read: isRead ? 1 : 0 },
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (isRead) {
                        setUnreadMail(0);
                    }

                    window.setTimeout(() => {
                        rememberListScroll();
                        router.reload({
                            only: ['messages', 'unreadCount'],
                        });
                    }, 2000);
                },
                onFinish: () => setBulkActing(false),
            },
        );
    };

    const changeArchive = (messageId: string, archived: boolean) => {
        setActing(true);
        router.post(
            route('mailbox.archive'),
            { message: messageId, archived: archived ? 1 : 0 },
            {
                preserveScroll: true,
                onFinish: () => setActing(false),
            },
        );
    };

    const subjectWithPrefix = (prefix: 'Re' | 'Fw', subject: string) => {
        const pattern = prefix === 'Re' ? /^re:\s*/i : /^fw:\s*/i;

        return pattern.test(subject) ? subject : `${prefix}: ${subject}`;
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        {t('title')}
                    </h2>
                    {mailbox ? (
                        <p className="break-all text-sm text-muted-foreground">
                            {t('mailbox')}: {mailbox}
                        </p>
                    ) : null}
                </div>
            }
        >
            <Head title={t('title')} />

            <div className="py-3 sm:py-6">
                <div
                    className={cn(
                        'flex w-full min-w-0 flex-col gap-3 px-0 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:gap-4 sm:px-6 sm:pb-0 lg:px-8',
                        showCompose
                            ? 'max-sm:pb-0'
                            : 'md:h-[calc(100dvh-13.5rem)] md:overflow-hidden',
                    )}
                >
                    {mailbox === null ? (
                        <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30">
                            <CardHeader>
                                <CardTitle>{t('title')}</CardTitle>
                                <CardDescription>{t('unassigned')}</CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4">
                            <p className="hidden text-sm text-muted-foreground sm:block">{t('received')}</p>
                            {flash?.success ? (
                                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                                    {flash.success}
                                </p>
                            ) : null}
                            {flash?.error ? (
                                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {flash.error}
                                </p>
                            ) : null}
                            {deliveryProblems.length > 0 ? (
                                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                                    <p className="font-medium">This mailbox can be filtered into Junk until the domain authorizes Microsoft 365.</p>
                                    <ul className="mt-1 list-disc ps-5">
                                        {deliveryProblems.map((problem) => (
                                            <li key={problem}>{problem}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                            {folder === 'inbox' && blockedCount > 0 ? (
                                <div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="min-h-11 touch-manipulation border-amber-500/40 text-amber-950 dark:text-amber-100"
                                        aria-expanded={showBlocked}
                                        aria-controls="blocked-email-details"
                                        onClick={() => setShowBlocked((open) => !open)}
                                    >
                                        {t('blockedEmails', { count: blockedCount })}
                                        <ChevronDownIcon className={cn('size-4 transition-transform', showBlocked && 'rotate-180')} />
                                    </Button>
                                    {showBlocked ? (
                                        <p
                                            id="blocked-email-details"
                                            className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                                        >
                                            {t('blockedExplanation', { count: blockedCount })}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                            {graphError ? (
                                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {graphError}
                                </p>
                            ) : null}

                            <div className="hidden flex-wrap items-center gap-2 sm:flex">
                                <Button className="min-h-11 touch-manipulation" variant={folder === 'inbox' ? 'default' : 'outline'} asChild>
                                    <Link href={folderHref('inbox')}>{t('inbox')}</Link>
                                </Button>
                                <Button className="min-h-11 touch-manipulation" variant={folder === 'drafts' ? 'default' : 'outline'} asChild>
                                    <Link href={folderHref('drafts')}>{t('drafts')}</Link>
                                </Button>
                                <Button className="min-h-11 touch-manipulation" variant={folder === 'sent' ? 'default' : 'outline'} asChild>
                                    <Link href={folderHref('sent')}>{t('sent')}</Link>
                                </Button>
                                <Button className="min-h-11 touch-manipulation" variant={folder === 'archive' ? 'default' : 'outline'} asChild>
                                    <Link href={folderHref('archive')}>{t('archive')}</Link>
                                </Button>
                                <Button
                                    className="min-h-11 touch-manipulation"
                                    type="button"
                                    variant={showCompose ? 'default' : 'outline'}
                                    aria-pressed={showCompose}
                                    onClick={() => openCompose()}
                                >
                                    {t('compose')}
                                </Button>
                                <Button className="min-h-11 touch-manipulation" type="button" variant="outline" onClick={refresh} disabled={refreshing}>
                                    <RefreshCwIcon className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
                                    {refreshing ? t('refreshing') : t('refresh')}
                                </Button>
                            </div>

                            {showCompose ? (
                                <ComposeMail
                                    key={draftKey}
                                    mailbox={mailbox}
                                    recipients={savedRecipients}
                                    draft={draft}
                                    stationery={stationery}
                                    emailTemplates={emailTemplates}
                                    onDiscard={() => {
                                        setShowCompose(false);
                                        if (composeRequested) {
                                            router.get(folderHref(folder), {}, { preserveScroll: true, replace: true });
                                        }
                                    }}
                                />
                            ) : null}

                            {showCompose ? null : (
                            <div
                                className="grid min-w-0 gap-3 md:min-h-0 md:flex-1 md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] md:grid-rows-1 md:gap-4 md:overflow-hidden"
                            >
                                <Card className={cn(
                                    'flex flex-col gap-0 border-sky-200 py-0 max-sm:rounded-none max-sm:border-x-0 dark:border-sky-900 md:h-full md:min-h-0 md:overflow-hidden',
                                    message ? 'max-md:hidden' : '',
                                )}>
                                    <CardHeader className="shrink-0 gap-3 border-b p-3">
                                        <CardTitle>{folderTitle}</CardTitle>
                                        {folder === 'inbox' ? (
                                            <div className="grid gap-2 pt-1">
                                                <div
                                                    className="grid grid-cols-3 items-stretch gap-2"
                                                    aria-label={t('filterByStatus')}
                                                >
                                                    {(['all', 'unread', 'read'] as const).map((nextStatus) => (
                                                        <Link
                                                            key={nextStatus}
                                                            href={folderHref('inbox', null, nextStatus)}
                                                            aria-current={status === nextStatus ? 'page' : undefined}
                                                            className={cn(
                                                                'flex h-11 min-w-0 items-center justify-center gap-1 rounded-md border px-1 text-center text-xs font-medium leading-none touch-manipulation sm:text-sm',
                                                                status === nextStatus
                                                                    ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                                                                    : 'border-border bg-background text-muted-foreground hover:border-emerald-500 hover:text-foreground',
                                                            )}
                                                        >
                                                            <span className="truncate">
                                                                {t(
                                                                    nextStatus === 'all'
                                                                        ? 'allMessages'
                                                                        : nextStatus === 'unread'
                                                                          ? 'unreadMessage'
                                                                          : 'readMessage',
                                                                )}
                                                            </span>
                                                            {nextStatus === 'unread' ? (
                                                                <span
                                                                    className={cn(
                                                                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                                                                        status === 'unread'
                                                                            ? 'bg-white/20 text-white'
                                                                            : 'bg-sky-600 text-white',
                                                                    )}
                                                                >
                                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                                </span>
                                                            ) : null}
                                                        </Link>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-2 items-stretch gap-2">
                                                    <Button
                                                        type="button"
                                                        className="h-11 min-w-0 w-full touch-manipulation border-border px-1 text-[11px] sm:px-2 sm:text-xs"
                                                        variant="outline"
                                                        disabled={bulkActing}
                                                        onClick={() => setBulkConfirmation(true)}
                                                    >
                                                        <span className="truncate">{t('markAllRead')}</span>
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        className="h-11 min-w-0 w-full touch-manipulation border-border px-1 text-[11px] sm:px-2 sm:text-xs"
                                                        variant="outline"
                                                        disabled={bulkActing}
                                                        onClick={() => setBulkConfirmation(false)}
                                                    >
                                                        <span className="truncate">{t('markAllUnread')}</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </CardHeader>
                                    <CardContent className="flex flex-col p-0 md:min-h-0 md:flex-1 md:overflow-hidden">
                                        <div
                                            ref={listPane}
                                            className="grid content-start gap-2 p-2 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-y-contain"
                                        >
                                        {list.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">{t('empty')}</p>
                                        ) : (
                                            list.map((item) => {
                                                const reading = message?.id === item.id;

                                                return (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        'relative min-w-0 rounded-md border',
                                                        reading
                                                            ? 'border-emerald-600 bg-emerald-100 ring-2 ring-emerald-600 dark:border-emerald-400 dark:bg-emerald-950/70 dark:ring-emerald-400'
                                                            : folder === 'inbox' && !item.is_read
                                                                ? 'border-sky-400/70 bg-sky-100/70 dark:border-sky-700 dark:bg-sky-950/45'
                                                                : 'border-border',
                                                    )}
                                                >
                                                    <div className="absolute end-0 top-0 z-10">
                                                        <MessageOptions
                                                            messageId={item.id}
                                                            folder={folder}
                                                            acting={acting}
                                                            onRead={changeRead}
                                                            onArchive={changeArchive}
                                                        />
                                                    </div>
                                                <Link
                                                    href={route('mailbox.index', {
                                                        folder,
                                                        ...(folder === 'inbox' && status !== 'all' ? { status } : {}),
                                                        ...(currentCursor ? { cursor: currentCursor } : {}),
                                                        message: item.id,
                                                    })}
                                                    preserveScroll
                                                    preserveState
                                                    aria-current={reading ? 'true' : undefined}
                                                    onClick={() => {
                                                        rememberListScroll();
                                                        if (folder === 'inbox' && !item.is_read) {
                                                            acknowledgeUnreadMail(item.id);
                                                        }
                                                    }}
                                                    className={cn(
                                                        'block min-h-11 min-w-0 rounded-md py-3.5 pe-12 ps-3 text-left touch-manipulation sm:py-3',
                                                        reading
                                                            ? 'hover:bg-emerald-200/80 dark:hover:bg-emerald-900/60'
                                                            : 'hover:bg-muted',
                                                    )}
                                                >
                                                    <p className="flex items-center gap-2 break-words text-foreground">
                                                        {folder === 'drafts' ? (
                                                            <FilePenLineIcon className="size-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                                                        ) : folder === 'sent' ? (
                                                            <SendIcon className="size-3.5 shrink-0 text-sky-600" />
                                                        ) : item.is_read ? (
                                                            <MailOpenIcon className="size-3.5 shrink-0 text-emerald-600" />
                                                        ) : (
                                                            <MailIcon className="size-3.5 shrink-0 text-sky-700 dark:text-sky-300" />
                                                        )}
                                                        <span className={folder === 'inbox' && !item.is_read ? 'font-semibold' : 'font-medium'}>
                                                            {item.subject || t('noSubject')}
                                                        </span>
                                                        {item.has_attachments ? (
                                                            <PaperclipIcon className="size-3.5 shrink-0" aria-label={t('attachments')} />
                                                        ) : null}
                                                    </p>
                                                    <p className="break-all text-sm text-muted-foreground">
                                                        {folder === 'sent' || folder === 'drafts' ? (Array.isArray(item.to) ? item.to : []).join(', ') : item.from}
                                                    </p>
                                                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                        {item.preview}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {formatWhen(folder === 'sent' ? item.sent_at : item.received_at)}
                                                    </p>
                                                </Link>
                                                </div>
                                                );
                                            })
                                        )}
                                        <div className="grid grid-cols-2 gap-2 pt-2 sm:flex">
                                            {nextCursor ? (
                                                <Button variant="outline" className="min-h-11 touch-manipulation" asChild>
                                                    <Link href={folderHref(folder, nextCursor)}>{t('next')}</Link>
                                                </Button>
                                            ) : null}
                                            <Button variant="outline" className="min-h-11 touch-manipulation" asChild>
                                                <Link href={folderHref(folder)}>{t('first')}</Link>
                                            </Button>
                                        </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card
                                    className={cn(
                                        'flex flex-col gap-0 border-emerald-200 py-0 max-sm:rounded-none max-sm:border-x-0 dark:border-emerald-900 md:h-full md:min-h-0 md:overflow-hidden',
                                        message ? '' : 'max-md:hidden',
                                    )}
                                >
                                    <CardHeader className="shrink-0 gap-3 border-b p-3">
                                        {message ? (
                                            <Button variant="ghost" className="mb-1 min-h-11 w-fit touch-manipulation px-2 md:hidden" asChild>
                                                <Link
                                                    href={folderHref(folder, currentCursor)}
                                                    preserveScroll
                                                    preserveState
                                                >
                                                    <ArrowLeftIcon className="size-4" />
                                                    {t('back')}
                                                </Link>
                                            </Button>
                                        ) : null}
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle className="flex items-center gap-2 break-words">
                                                {message ? (
                                                    <MessageStatus
                                                        folder={folder}
                                                        isRead={
                                                            list.find((item) => item.id === message.id)
                                                                ?.is_read ?? true
                                                        }
                                                    />
                                                ) : null}
                                                <span>{message?.subject || t('select')}</span>
                                            </CardTitle>
                                            {message ? (
                                                <MessageOptions
                                                    messageId={message.id}
                                                    folder={folder}
                                                    acting={acting}
                                                    onRead={changeRead}
                                                    onArchive={changeArchive}
                                                />
                                            ) : null}
                                        </div>
                                        {message ? (
                                            <CardDescription className="break-all">
                                                {t('from')}: {message.from}
                                            </CardDescription>
                                        ) : null}
                                    </CardHeader>
                                    <CardContent className="flex flex-col p-0 md:min-h-0 md:flex-1 md:overflow-hidden">
                                        <div
                                            ref={messagePane}
                                            className="p-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-y-contain"
                                        >
                                        {message ? (
                                            <div className="grid gap-3">
                                                <div className="grid grid-cols-3 gap-1.5 md:flex md:flex-wrap md:gap-2">
                                                    {folder === 'drafts' ? (
                                                        <Button
                                                            type="button"
                                                            className="col-span-3 min-h-11 bg-emerald-700 text-white touch-manipulation hover:bg-emerald-800 md:col-span-1"
                                                            onClick={() =>
                                                                openCompose({
                                                                    id: message.id,
                                                                    saved: true,
                                                                    to: (message.to ?? []).join(', '),
                                                                    cc: (message.cc ?? []).join(', '),
                                                                    bcc: (message.bcc ?? []).join(', '),
                                                                    subject: message.subject === '(No subject)' ? '' : message.subject,
                                                                    body: message.html || message.body,
                                                                })
                                                            }
                                                        >
                                                            <FilePenLineIcon className="size-4" />
                                                            {t('continueDraft')}
                                                        </Button>
                                                    ) : null}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="min-h-11 touch-manipulation px-2 text-xs sm:text-sm"
                                                        onClick={() =>
                                                            openCompose({
                                                                to: mailboxAddress(message.from),
                                                                cc: '',
                                                                bcc: '',
                                                                subject: subjectWithPrefix('Re', message.subject),
                                                                body: quotePlainText(
                                                                    message.body,
                                                                    replyIntro(message),
                                                                ),
                                                            })
                                                        }
                                                    >
                                                        <ReplyIcon className="size-4" />
                                                        {t('reply')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="min-h-11 touch-manipulation px-2 text-xs sm:text-sm"
                                                        onClick={() => {
                                                            const recipients = replyAllAddresses(message, mailbox ?? '');

                                                            openCompose({
                                                                to: recipients.to,
                                                                cc: recipients.cc,
                                                                bcc: '',
                                                                subject: subjectWithPrefix('Re', message.subject),
                                                                body: quotePlainText(
                                                                    message.body,
                                                                    replyIntro(message),
                                                                ),
                                                            });
                                                        }}
                                                    >
                                                        <ReplyAllIcon className="size-4" />
                                                        {t('replyAll')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="min-h-11 touch-manipulation px-2 text-xs sm:text-sm"
                                                        onClick={() =>
                                                            openCompose({
                                                                to: '',
                                                                cc: '',
                                                                bcc: '',
                                                                subject: subjectWithPrefix('Fw', message.subject),
                                                                body: quotePlainText(
                                                                    message.body,
                                                                    forwardIntro(message),
                                                                ),
                                                            })
                                                        }
                                                    >
                                                        <ForwardIcon className="size-4" />
                                                        {t('forward')}
                                                    </Button>
                                                </div>
                                                {(message.attachments ?? []).length > 0 ||
                                                (message.images ?? []).length > 0 ||
                                                message.has_attachments ? (
                                                    <section
                                                        aria-label={t('attachments')}
                                                        className="flex flex-wrap gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-50 p-2 dark:bg-emerald-950/40"
                                                    >
                                                        <p className="w-full text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                                                            {t('attachments')}
                                                        </p>
                                                        {(message.attachments ?? []).length === 0 &&
                                                        (message.images ?? []).length === 0 ? (
                                                            <p className="w-full text-sm text-muted-foreground">{t('attachmentMissing')}</p>
                                                        ) : null}
                                                        {(message.attachments ?? []).length === 0
                                                            ? (message.images ?? []).map((image, index) =>
                                                                  image.src.startsWith('data:image/') ? (
                                                                      <div
                                                                          key={`${image.name}-${index}`}
                                                                          className="flex w-full max-w-full flex-col gap-2 rounded-md border border-emerald-700/30 bg-background px-2 py-2 shadow-sm sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                                                                      >
                                                                          <button
                                                                              type="button"
                                                                              className="flex min-w-0 items-center gap-2 text-left"
                                                                              onClick={() => {
                                                                                  setViewerFailed(false);
                                                                                  setViewer({ name: image.name, src: image.src });
                                                                              }}
                                                                          >
                                                                              <img
                                                                                  src={image.src}
                                                                                  alt={image.name}
                                                                                  className="size-9 rounded border border-border object-cover"
                                                                              />
                                                                              <span className="truncate text-xs font-medium">{image.name}</span>
                                                                          </button>
                                                                          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center">
                                                                              <Button
                                                                                  type="button"
                                                                                  className="min-h-11 bg-emerald-700 px-3 text-white hover:bg-emerald-800 sm:h-9"
                                                                                  onClick={() => {
                                                                                      setViewerFailed(false);
                                                                                      setViewer({ name: image.name, src: image.src });
                                                                                  }}
                                                                              >
                                                                                  {t('openAttachment')}
                                                                              </Button>
                                                                              <Button asChild variant="outline" className="min-h-11 px-3 sm:h-9">
                                                                                  <a href={downloadHref(image.src)} download={image.name}>
                                                                                      <DownloadIcon className="size-4" />
                                                                                      {t('downloadAttachment')}
                                                                                  </a>
                                                                              </Button>
                                                                          </div>
                                                                      </div>
                                                                  ) : null,
                                                              )
                                                            : null}
                                                        {(message.attachments ?? []).map((file) => (
                                                            <div
                                                                key={file.id}
                                                                className="flex w-full max-w-full flex-col gap-2 rounded-md border border-emerald-700/30 bg-background px-2 py-2 shadow-sm sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                                                            >
                                                                <span className="flex min-w-0 items-center gap-1.5 text-xs">
                                                                    <PaperclipIcon className="size-3.5 shrink-0" />
                                                                    <span className="truncate font-medium">{file.name}</span>
                                                                    <span className="shrink-0 text-muted-foreground">{fileSize(file.size)}</span>
                                                                </span>
                                                                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center">
                                                                    {file.image ? (
                                                                        <Button
                                                                            type="button"
                                                                            className="min-h-11 bg-emerald-700 px-3 text-white hover:bg-emerald-800 sm:h-9"
                                                                            onClick={() => {
                                                                                setViewerFailed(false);
                                                                                setViewer({
                                                                                    name: file.name,
                                                                                    src: attachmentUrl(message.id, file.id),
                                                                                });
                                                                            }}
                                                                        >
                                                                            {t('openAttachment')}
                                                                        </Button>
                                                                    ) : (
                                                                        <Button asChild className="min-h-11 bg-emerald-700 px-3 text-white hover:bg-emerald-800 sm:h-9">
                                                                            <a
                                                                                href={attachmentUrl(message.id, file.id)}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                            >
                                                                                {t('openAttachment')}
                                                                            </a>
                                                                        </Button>
                                                                    )}
                                                                    <Button asChild variant="outline" className="min-h-11 px-3 sm:h-9">
                                                                        <a href={downloadHref(attachmentUrl(message.id, file.id))} download={file.name}>
                                                                            <DownloadIcon className="size-4" />
                                                                            {t('downloadAttachment')}
                                                                        </a>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </section>
                                                ) : null}
                                                <p className="break-all text-sm text-muted-foreground">
                                                    {t('to')}: {(Array.isArray(message.to) ? message.to : []).join(', ')}
                                                </p>
                                                {(Array.isArray(message.cc) ? message.cc : []).length > 0 ? (
                                                    <p className="break-all text-sm text-muted-foreground">
                                                        {t('cc')}: {message.cc?.join(', ')}
                                                    </p>
                                                ) : null}
                                                <ConversationBody body={message.body} />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{t('select')}</p>
                                        )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {mailbox ? (
                <nav
                    aria-label={t('mailbox')}
                    className={cn(
                        'fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.55)] backdrop-blur sm:hidden',
                        showCompose ? 'hidden' : '',
                    )}
                >
                    <Link
                        href={folderHref('inbox')}
                        className={cn(
                            'relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium touch-manipulation',
                            folder === 'inbox' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
                        )}
                    >
                        <MailIcon className="size-5" />
                        {t('inbox')}
                        {unreadCount > 0 ? (
                            <span className="absolute end-2 top-1.5 min-w-5 rounded-full bg-sky-600 px-1 text-center text-[10px] leading-5 text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        ) : null}
                    </Link>
                    <Link
                        href={folderHref('drafts')}
                        className={cn(
                            'flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium touch-manipulation',
                            folder === 'drafts' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
                        )}
                    >
                        <FilePenLineIcon className="size-5" />
                        {t('drafts')}
                    </Link>
                    <Link
                        href={folderHref('sent')}
                        className={cn(
                            'flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium touch-manipulation',
                            folder === 'sent' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
                        )}
                    >
                        <SendIcon className="size-5" />
                        {t('sent')}
                    </Link>
                    <button
                        type="button"
                        className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md bg-emerald-700 px-1 text-[11px] font-semibold text-white touch-manipulation"
                        onClick={() => openCompose()}
                    >
                        <SquarePenIcon className="size-5" />
                        {t('compose')}
                    </button>
                    <Link
                        href={folderHref('archive')}
                        className={cn(
                            'flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium touch-manipulation',
                            folder === 'archive' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
                        )}
                    >
                        <ArchiveIcon className="size-5" />
                        {t('archive')}
                    </Link>
                    <button
                        type="button"
                        className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium text-muted-foreground touch-manipulation"
                        onClick={refresh}
                        disabled={refreshing}
                    >
                        <RefreshCwIcon className={refreshing ? 'size-5 animate-spin' : 'size-5'} />
                        {t('refresh')}
                    </button>
                </nav>
            ) : null}
            <Dialog
                open={bulkConfirmation !== null}
                onClose={() => setBulkConfirmation(null)}
                className="relative z-50"
            >
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <DialogPanel className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
                        <DialogTitle className="text-lg font-semibold text-foreground">
                            {t('confirmBulkReadTitle')}
                        </DialogTitle>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {bulkConfirmation === false ? t('confirmMarkAllUnread') : t('confirmMarkAllRead')}
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 touch-manipulation"
                                onClick={() => setBulkConfirmation(null)}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                type="button"
                                className="min-h-11 bg-emerald-700 text-white touch-manipulation hover:bg-emerald-800"
                                onClick={() => changeAllRead(bulkConfirmation !== false)}
                            >
                                {bulkConfirmation === false ? t('markAllUnread') : t('markAllRead')}
                            </Button>
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>
            <Dialog open={viewer !== null} onClose={() => setViewer(null)} className="relative z-50">
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                        <DialogPanel className="w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                                        {t('attachedImage')}
                                    </p>
                                    <DialogTitle className="mt-1 break-all text-lg font-semibold text-foreground">
                                        {viewer?.name ?? t('openAttachment')}
                                    </DialogTitle>
                                </div>
                                <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                                    {viewer ? (
                                        <Button asChild className="min-h-11 flex-1 bg-emerald-700 text-white hover:bg-emerald-800 sm:flex-none">
                                            <a href={downloadHref(viewer.src)} download={viewer.name}>
                                                <DownloadIcon />
                                                {t('downloadAttachment')}
                                            </a>
                                        </Button>
                                    ) : null}
                                    <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t('closeAttachment')} onClick={() => setViewer(null)}>
                                        <XIcon />
                                    </Button>
                                </div>
                            </div>
                            <div className="max-h-[calc(100dvh-7rem)] overflow-auto bg-slate-100 p-4 dark:bg-slate-950 sm:p-8">
                                {viewer && !viewerFailed ? (
                                    <img
                                        src={viewer.src}
                                        alt={viewer.name}
                                        className="mx-auto max-h-[75dvh] max-w-full rounded-md bg-white"
                                        onError={() => setViewerFailed(true)}
                                    />
                                ) : (
                                    <div className="grid justify-items-center gap-3">
                                        <p className="text-center text-sm text-muted-foreground">{t('attachmentUnavailable')}</p>
                                        {viewer ? (
                                            <a
                                                href={viewer.src}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-medium text-emerald-700 underline dark:text-emerald-300"
                                            >
                                                {t('openAttachment')}
                                            </a>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </DialogPanel>
                    </div>
                </div>
            </Dialog>
        </AuthenticatedLayout>
    );
}
