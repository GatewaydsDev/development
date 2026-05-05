import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AppNotification } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    CheckCircle2Icon,
    MailIcon,
    Trash2Icon,
} from 'lucide-react';

type ShowProps = {
    notification: AppNotification;
};

function DetailItem({
    label,
    value,
}: {
    label: string;
    value?: string | number | null;
}) {
    return (
        <div className="rounded-lg border border-border bg-background p-4">
            <dt className="text-sm font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">
                {value || 'Not provided'}
            </dd>
        </div>
    );
}

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Unknown date';

export default function Show({ notification }: ShowProps) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href={route('notifications.index')}
                            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                        >
                            <ArrowLeftIcon className="size-4" />
                            Back to notifications
                        </Link>
                        <h2 className="mt-2 text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            {notification.title}
                        </h2>
                    </div>
                    <Badge
                        variant={notification.isRead ? 'outline' : 'destructive'}
                    >
                        {notification.isRead ? 'Read' : 'Unread'}
                    </Badge>
                </div>
            }
        >
            <Head title={notification.title} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto grid max-w-[96rem] gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_0.35fr] lg:px-8">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MailIcon className="size-5 text-muted-foreground" />
                                Contact message
                            </CardTitle>
                            <CardDescription>
                                Received {formatDate(notification.createdAt)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                            <dl className="grid gap-4 md:grid-cols-2">
                                <DetailItem
                                    label="Name"
                                    value={notification.name}
                                />
                                <DetailItem
                                    label="Email"
                                    value={notification.email}
                                />
                                <DetailItem
                                    label="Phone"
                                    value={notification.phoneNumber}
                                />
                                <DetailItem
                                    label="Organization"
                                    value={notification.organization}
                                />
                                <DetailItem
                                    label="Project type"
                                    value={notification.projectType}
                                />
                                <DetailItem
                                    label="Contact submission ID"
                                    value={notification.contactSubmissionId}
                                />
                            </dl>

                            <div className="rounded-xl border border-border bg-background p-5">
                                <h3 className="font-semibold text-foreground">
                                    Message
                                </h3>
                                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                                    {notification.message ||
                                        'No message was included.'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="h-fit shadow-sm">
                        <CardHeader>
                            <CardTitle>Controls</CardTitle>
                            <CardDescription>
                                Update or delete this notification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <Button asChild variant="outline">
                                <Link
                                    href={route(
                                        'notifications.update',
                                        notification.id,
                                    )}
                                    method="patch"
                                    data={{ read: !notification.isRead }}
                                    as="button"
                                >
                                    <CheckCircle2Icon data-icon="inline-start" />
                                    Mark as{' '}
                                    {notification.isRead ? 'unread' : 'read'}
                                </Link>
                            </Button>
                            <Button asChild variant="destructive">
                                <Link
                                    href={route(
                                        'notifications.destroy',
                                        notification.id,
                                    )}
                                    method="delete"
                                    as="button"
                                >
                                    <Trash2Icon data-icon="inline-start" />
                                    Delete notification
                                </Link>
                            </Button>
                        </CardContent>
                        <CardFooter>
                            <p className="text-sm text-muted-foreground">
                                Opening a notification marks it as read. You can
                                mark it unread again from here.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
