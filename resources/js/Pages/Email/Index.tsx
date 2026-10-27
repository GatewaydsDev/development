import StickyDocumentToolbar from '@/Components/StickyDocumentToolbar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ComposeMail, {
    mailboxAddress,
    quotePlainText,
    type ComposeDraft,
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
import { acknowledgeUnreadMail, setUnreadMail } from '@/lib/unreadMail';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { ArchiveIcon, ArrowLeftIcon, DownloadIcon, ForwardIcon, MailIcon, MailOpenIcon, MoreVerticalIcon, PaperclipIcon, RefreshCwIcon, ReplyAllIcon, ReplyIcon, SendIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MailSettings from '@/Pages/Email/MailSettings';
import { emptyStationery, type MailStationeryData } from '@/Pages/Email/mailLayouts';

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
    folder: 'inbox' | 'sent' | 'archive';
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
    unreadCount?: number;
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
    folder: 'inbox' | 'sent' | 'archive';
    isRead: boolean;
}) {
    const { t } = useTranslation('mail');

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
    folder: 'inbox' | 'sent' | 'archive';
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

export default function Index({
    mailbox,
    folder,
    messages,
    nextCursor,
    message,
    graphError,
    savedRecipients = [],
    signature = null,
    headerUrl = null,
    headerWidth = 100,
    footerColors = [],
    stationery = emptyStationery,
    unreadCount = 0,
    deliveryProblems = [],
}: Props) {
    const list = Array.isArray(messages) ? messages : [];
    const { t } = useTranslation('mail');
    const mailRef = useRef<HTMLDivElement>(null);
    const flash = usePage().props.flash as { success?: string | null } | undefined;
    const [refreshing, setRefreshing] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [draft, setDraft] = useState<ComposeDraft | undefined>(undefined);
    const [draftKey, setDraftKey] = useState(0);
    const [acting, setActing] = useState(false);
    const [viewer, setViewer] = useState<AttachmentViewer | null>(null);
    const [viewerFailed, setViewerFailed] = useState(false);

    useEffect(() => {
        const visible =
            folder === 'inbox' ? list.filter((item) => !item.is_read).length : 0;

        setUnreadMail(Math.max(unreadCount, visible));
    }, [unreadCount, folder, list]);

    useEffect(() => {
        if (folder !== 'inbox' || message === null) {
            return;
        }

        const opened = list.find((item) => item.id === message.id);

        if (opened && !opened.is_read) {
            acknowledgeUnreadMail(message.id);
        }
    }, [folder, message, list]);

    const folderHref = (nextFolder: 'inbox' | 'sent' | 'archive', cursor?: string | null) =>
        route('mailbox.index', {
            folder: nextFolder,
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

    const folderTitle = folder === 'sent' ? t('sent') : folder === 'archive' ? t('archive') : t('inbox');

    const changeRead = (messageId: string, isRead: boolean) => {
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

            <div className="py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-8">
                <div className="mx-auto flex max-w-[96rem] min-w-0 flex-col gap-4 px-3 sm:gap-6 sm:px-6 lg:px-8">
                    {mailbox === null ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('title')}</CardTitle>
                                <CardDescription>{t('unassigned')}</CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <div ref={mailRef} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                        <div className="flex min-w-0 flex-col gap-4">
                            <p className="text-sm text-muted-foreground">{t('received')}</p>
                            {flash?.success ? (
                                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                                    {flash.success}
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
                            {graphError ? (
                                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {graphError}
                                </p>
                            ) : null}

                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                                <Button className="min-h-11 touch-manipulation" variant={folder === 'inbox' ? 'default' : 'outline'} asChild>
                                    <Link href={folderHref('inbox')}>{t('inbox')}</Link>
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
                                    onDiscard={() => setShowCompose(false)}
                                />
                            ) : null}

                            {showCompose ? null : (
                            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
                                <Card className={message ? 'max-md:hidden' : undefined}>
                                    <CardHeader>
                                        <CardTitle>{folderTitle}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-2">
                                        {list.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">{t('empty')}</p>
                                        ) : (
                                            list.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        'relative min-w-0 rounded-md border',
                                                        folder !== 'sent' && !item.is_read
                                                            ? 'border-red-500/40 bg-red-500/5'
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
                                                        message: item.id,
                                                    })}
                                                    className="block min-h-11 min-w-0 rounded-md py-3 pe-12 ps-3 text-left touch-manipulation hover:bg-muted"
                                                >
                                                    <p className="flex items-center gap-2 break-words text-foreground">
                                                        {folder === 'sent' ? (
                                                            <SendIcon className="size-3.5 shrink-0 text-sky-600" />
                                                        ) : item.is_read ? (
                                                            <MailOpenIcon className="size-3.5 shrink-0 text-emerald-600" />
                                                        ) : (
                                                            <MailIcon className="size-3.5 shrink-0 text-red-600" />
                                                        )}
                                                        <span className={folder !== 'sent' && !item.is_read ? 'font-semibold' : 'font-medium'}>
                                                            {item.subject || t('noSubject')}
                                                        </span>
                                                        {item.has_attachments ? (
                                                            <PaperclipIcon className="size-3.5 shrink-0" aria-label={t('attachments')} />
                                                        ) : null}
                                                    </p>
                                                    <p className="break-all text-sm text-muted-foreground">
                                                        {folder === 'sent' ? (Array.isArray(item.to) ? item.to : []).join(', ') : item.from}
                                                    </p>
                                                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                        {item.preview}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {formatWhen(folder === 'sent' ? item.sent_at : item.received_at)}
                                                    </p>
                                                </Link>
                                                </div>
                                            ))
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
                                    </CardContent>
                                </Card>

                                <Card className={message ? undefined : 'max-md:hidden'}>
                                    <CardHeader>
                                        {message ? (
                                            <Button variant="outline" className="mb-2 min-h-11 w-fit touch-manipulation md:hidden" asChild>
                                                <Link href={folderHref(folder)}>
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
                                    <CardContent>
                                        {message ? (
                                            <div className="grid gap-3">
                                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="min-h-11 touch-manipulation"
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
                                                        className="min-h-11 touch-manipulation"
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
                                                        className="min-h-11 touch-manipulation"
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
                                                        className="grid gap-2 rounded-lg border-2 border-emerald-700 bg-emerald-50 p-3 dark:bg-emerald-950/40"
                                                    >
                                                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                                                            {t('attachments')}
                                                        </p>
                                                        {(message.attachments ?? []).length === 0 &&
                                                        (message.images ?? []).length === 0 ? (
                                                            <p className="text-sm text-muted-foreground">{t('attachmentMissing')}</p>
                                                        ) : null}
                                                        {(message.attachments ?? []).length === 0
                                                            ? (message.images ?? []).map((image, index) =>
                                                                  image.src.startsWith('data:image/') ? (
                                                                      <div
                                                                          key={`${image.name}-${index}`}
                                                                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-700/30 bg-background px-3 py-2"
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
                                                                                  className="size-12 rounded border border-border object-cover"
                                                                              />
                                                                              <span className="truncate text-sm font-medium">{image.name}</span>
                                                                          </button>
                                                                          <Button
                                                                              type="button"
                                                                              className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"
                                                                              onClick={() => {
                                                                                  setViewerFailed(false);
                                                                                  setViewer({ name: image.name, src: image.src });
                                                                              }}
                                                                          >
                                                                              {t('openAttachment')}
                                                                          </Button>
                                                                      </div>
                                                                  ) : null,
                                                              )
                                                            : null}
                                                        {(message.attachments ?? []).map((file) => (
                                                            <div
                                                                key={file.id}
                                                                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-700/30 bg-background px-3 py-2"
                                                            >
                                                                <span className="flex min-w-0 items-center gap-2 text-sm">
                                                                    <PaperclipIcon className="size-4 shrink-0" />
                                                                    <span className="truncate font-medium">{file.name}</span>
                                                                    <span className="shrink-0 text-muted-foreground">{fileSize(file.size)}</span>
                                                                </span>
                                                                {file.image ? (
                                                                    <Button
                                                                        type="button"
                                                                        className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"
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
                                                                    <Button asChild className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">
                                                                        <a
                                                                            href={attachmentUrl(message.id, file.id)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                        >
                                                                            {t('openAttachment')}
                                                                        </a>
                                                                    </Button>
                                                                )}
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
                                                <pre className="max-w-full whitespace-pre-wrap break-words font-sans text-sm text-foreground [overflow-wrap:anywhere]">
                                                    {message.body}
                                                </pre>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{t('select')}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                            )}
                        </div>
                        <StickyDocumentToolbar scopeRef={mailRef} propertiesPanel>
                            <MailSettings
                                signature={signature}
                                headerUrl={headerUrl}
                                headerWidth={headerWidth}
                                footerColors={footerColors}
                                stationery={stationery}
                            />
                        </StickyDocumentToolbar>
                        </div>
                    )}
                </div>
            </div>
            <Dialog open={viewer !== null} onClose={() => setViewer(null)} className="relative z-50">
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                        <DialogPanel className="w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                                        {t('attachedImage')}
                                    </p>
                                    <DialogTitle className="mt-1 break-all text-lg font-semibold text-foreground">
                                        {viewer?.name ?? t('openAttachment')}
                                    </DialogTitle>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {viewer ? (
                                        <Button asChild className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">
                                            <a href={downloadHref(viewer.src)} download={viewer.name}>
                                                <DownloadIcon />
                                                {t('downloadAttachment')}
                                            </a>
                                        </Button>
                                    ) : null}
                                    <Button type="button" variant="ghost" size="icon" aria-label={t('closeAttachment')} onClick={() => setViewer(null)}>
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
