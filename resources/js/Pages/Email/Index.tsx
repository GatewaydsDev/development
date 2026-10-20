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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { ArchiveIcon, ArrowLeftIcon, ForwardIcon, MailIcon, MailOpenIcon, MoreVerticalIcon, RefreshCwIcon, ReplyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MailSettings from '@/Pages/Email/MailSettings';

type MailSummary = {
    id: string;
    subject: string;
    from: string;
    to: string[];
    preview: string;
    received_at: string | null;
    sent_at: string | null;
    is_read: boolean;
    folder: string;
};

type MailMessage = {
    id: string;
    subject: string;
    from: string;
    to: string[];
    received_at: string | null;
    sent_at: string | null;
    body: string;
    images?: Array<{ name: string; src: string }>;
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
    unreadCount?: number;
    deliveryProblems?: string[];
};

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
    unreadCount = 0,
    deliveryProblems = [],
}: Props) {
    const { t } = useTranslation('mail');
    const mailRef = useRef<HTMLDivElement>(null);
    const flash = usePage().props.flash as { success?: string | null } | undefined;
    const [refreshing, setRefreshing] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [draft, setDraft] = useState<ComposeDraft | undefined>(undefined);
    const [draftKey, setDraftKey] = useState(0);
    const [acting, setActing] = useState(false);

    useEffect(() => {
        const visible =
            folder === 'inbox' ? messages.filter((item) => !item.is_read).length : 0;

        setUnreadMail(Math.max(unreadCount, visible));
    }, [unreadCount, folder, messages]);

    useEffect(() => {
        if (folder !== 'inbox' || message === null) {
            return;
        }

        const opened = messages.find((item) => item.id === message.id);

        if (opened && !opened.is_read) {
            acknowledgeUnreadMail(message.id);
        }
    }, [folder, message, messages]);

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
                                    signature={signature}
                                    headerUrl={headerUrl}
                                    headerWidth={headerWidth}
                                    footerColors={footerColors}
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
                                        {messages.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">{t('empty')}</p>
                                        ) : (
                                            messages.map((item) => (
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
                                                        {folder !== 'sent' && !item.is_read ? (
                                                            <MailIcon className="size-3.5 shrink-0 text-red-600" />
                                                        ) : null}
                                                        <span className={folder !== 'sent' && !item.is_read ? 'font-semibold' : 'font-medium'}>
                                                            {item.subject || t('noSubject')}
                                                        </span>
                                                    </p>
                                                    <p className="break-all text-sm text-muted-foreground">
                                                        {folder === 'sent' ? item.to.join(', ') : item.from}
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
                                            <CardTitle className="break-words">{message?.subject || t('select')}</CardTitle>
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
                                                <p className="break-all text-sm text-muted-foreground">
                                                    {t('to')}: {message.to.join(', ')}
                                                </p>
                                                <pre className="max-w-full whitespace-pre-wrap break-words font-sans text-sm text-foreground [overflow-wrap:anywhere]">
                                                    {message.body}
                                                </pre>
                                                {(message.images ?? []).map((image, index) =>
                                                    image.src.startsWith('data:image/') ? (
                                                        <img
                                                            key={`${image.name}-${index}`}
                                                            src={image.src}
                                                            alt={image.name}
                                                            className="mt-3 max-h-48 max-w-full rounded-md border border-border"
                                                        />
                                                    ) : null,
                                                )}
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
                            />
                        </StickyDocumentToolbar>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
