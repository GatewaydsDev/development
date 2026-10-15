import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { RefreshCwIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
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
}: Props) {
    const { t } = useTranslation('mail');
    const flash = usePage().props.flash as { success?: string | null } | undefined;
    const [refreshing, setRefreshing] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const form = useForm({
        to: '',
        subject: '',
        body: '',
    });

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

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('mailbox.send'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setShowCompose(false);
            },
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        {t('title')}
                    </h2>
                    {mailbox ? (
                        <p className="text-sm text-muted-foreground">
                            {t('mailbox')}: {mailbox}
                        </p>
                    ) : null}
                </div>
            }
        >
            <Head title={t('title')} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
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

                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                                <div className="flex gap-2">
                                    <Button variant={folder === 'inbox' ? 'default' : 'outline'} asChild>
                                        <Link href={folderHref('inbox')}>{t('inbox')}</Link>
                                    </Button>
                                    <Button variant={folder === 'sent' ? 'default' : 'outline'} asChild>
                                        <Link href={folderHref('sent')}>{t('sent')}</Link>
                                    </Button>
                                </div>
                                <Button type="button" variant="outline" onClick={() => setShowCompose((open) => !open)}>
                                    {t('compose')}
                                </Button>
                                <Button type="button" variant="outline" onClick={refresh} disabled={refreshing}>
                                    <RefreshCwIcon className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
                                    {refreshing ? t('refreshing') : t('refresh')}
                                </Button>
                            </div>

                            {showCompose ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{t('compose')}</CardTitle>
                                        <CardDescription>{mailbox}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={submit} className="grid gap-4">
                                            <label className="grid gap-1 text-sm">
                                                {t('to')}
                                                <input
                                                    type="email"
                                                    value={form.data.to}
                                                    onChange={(event) => form.setData('to', event.target.value)}
                                                    className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                                                    required
                                                />
                                                <InputError message={form.errors.to} />
                                            </label>
                                            <label className="grid gap-1 text-sm">
                                                {t('subject')}
                                                <input
                                                    type="text"
                                                    value={form.data.subject}
                                                    onChange={(event) => form.setData('subject', event.target.value)}
                                                    maxLength={255}
                                                    className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                                                    required
                                                />
                                                <InputError message={form.errors.subject} />
                                            </label>
                                            <label className="grid gap-1 text-sm">
                                                {t('message')}
                                                <textarea
                                                    value={form.data.body}
                                                    onChange={(event) => form.setData('body', event.target.value)}
                                                    rows={8}
                                                    maxLength={20000}
                                                    className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                                                    required
                                                />
                                                <InputError message={form.errors.body} />
                                            </label>
                                            <Button type="submit" disabled={form.processing}>
                                                {form.processing ? t('sending') : t('send')}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            ) : null}

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <Card>
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
                                                    className="rounded-md border border-border px-3 py-3 text-left hover:bg-muted"
                                                >
                                                    <p className="font-medium text-foreground">
                                                        {item.subject || t('noSubject')}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
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
                                        <div className="flex gap-2 pt-2">
                                            {nextCursor ? (
                                                <Button variant="outline" asChild>
                                                    <Link href={folderHref(folder, nextCursor)}>{t('next')}</Link>
                                                </Button>
                                            ) : null}
                                            <Button variant="outline" asChild>
                                                <Link href={folderHref(folder)}>{t('first')}</Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>{message?.subject || t('select')}</CardTitle>
                                        {message ? (
                                            <CardDescription>
                                                {t('from')}: {message.from}
                                            </CardDescription>
                                        ) : null}
                                    </CardHeader>
                                    <CardContent>
                                        {message ? (
                                            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                                                {message.body}
                                            </pre>
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
