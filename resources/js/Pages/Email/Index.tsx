import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ComposeMail, {
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
import { acknowledgeUnreadMail } from '@/lib/unreadMail';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, ForwardIcon, RefreshCwIcon, ReplyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
};

type Props = {
    mailbox: string | null;
    folder: 'inbox' | 'sent';
    messages: MailSummary[];
    nextCursor: string | null;
    message: MailMessage | null;
    graphError: string | null;
    savedRecipients?: SavedRecipient[];
};

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
}: Props) {
    const { t } = useTranslation('mail');
    const flash = usePage().props.flash as { success?: string | null } | undefined;
    const [refreshing, setRefreshing] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [draft, setDraft] = useState<ComposeDraft | undefined>(undefined);
    const [draftKey, setDraftKey] = useState(0);

    useEffect(() => {
        if (folder === 'inbox' && message) {
            acknowledgeUnreadMail();
        }
    }, [folder, message]);

    const folderHref = (nextFolder: 'inbox' | 'sent', cursor?: string | null) =>
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
                <div className="mx-auto flex max-w-6xl min-w-0 flex-col gap-4 px-3 sm:gap-6 sm:px-6 lg:px-8">
                    {mailbox === null ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('title')}</CardTitle>
                                <CardDescription>{t('unassigned')}</CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground">{t('received')}</p>
                            {flash?.success ? (
                                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                                    {flash.success}
                                </p>
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
                                <Button className="min-h-11 touch-manipulation" type="button" variant="outline" onClick={() => openCompose()}>
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
                                    onDiscard={() => setShowCompose(false)}
                                />
                            ) : null}

                            <div className={`grid min-w-0 gap-4 md:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)] ${showCompose ? 'max-md:hidden' : ''}`}>
                                <Card className={message ? 'max-md:hidden' : undefined}>
                                    <CardHeader>
                                        <CardTitle>{folder === 'sent' ? t('sent') : t('inbox')}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-2">
                                        {messages.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">{t('empty')}</p>
                                        ) : (
                                            messages.map((item) => (
                                                <Link
                                                    key={item.id}
                                                    href={route('mailbox.index', {
                                                        folder,
                                                        message: item.id,
                                                    })}
                                                    className="block min-h-11 min-w-0 rounded-md border border-border px-3 py-3 text-left touch-manipulation hover:bg-muted"
                                                >
                                                    <p className="break-words font-medium text-foreground">
                                                        {item.subject || t('noSubject')}
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
                                        <CardTitle className="break-words">{message?.subject || t('select')}</CardTitle>
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
                                                                to: message.from,
                                                                cc: '',
                                                                bcc: '',
                                                                subject: subjectWithPrefix('Re', message.subject),
                                                                body: quotePlainText(message.body),
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
                                                                body: quotePlainText(message.body),
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
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{t('select')}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
