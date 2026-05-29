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
import { getNotificationStatusMeta } from '@/lib/notificationStatus';
import { AppNotification } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { BellIcon, MailOpenIcon, Trash2Icon } from 'lucide-react';

type IndexProps = {
    notifications: AppNotification[];
    unreadCount: number;
};

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Unknown date';

export default function Index({ notifications, unreadCount }: IndexProps) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Notifications
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Review contact form messages and system alerts.
                        </p>
                    </div>
                    <Badge variant={unreadCount > 0 ? 'destructive' : 'outline'}>
                        {unreadCount} unread
                    </Badge>
                </div>
            }
        >
            <Head title="Notifications" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-4 px-4 sm:px-6 lg:px-8">
                    {notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <Card
                                key={notification.id}
                                className={
                                    notification.isRead
                                        ? 'shadow-sm'
                                        : 'border-destructive/30 shadow-sm'
                                }
                            >
                                <CardHeader className="gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 rounded-lg bg-muted p-2 text-muted-foreground">
                                            <BellIcon className="size-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="flex flex-wrap items-center gap-2">
                                                {notification.title}
                                                {(() => {
                                                    const statusMeta =
                                                        getNotificationStatusMeta(
                                                            notification.status,
                                                        );
                                                    const StatusIcon =
                                                        statusMeta.icon;

                                                    return (
                                                        <Badge
                                                            className={`gap-1 ${statusMeta.className}`}
                                                        >
                                                            <StatusIcon className="size-3.5" />
                                                            {statusMeta.label}
                                                        </Badge>
                                                    );
                                                })()}
                                                {!notification.isRead && (
                                                    <Badge variant="destructive">
                                                        New
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription>
                                                {formatDate(
                                                    notification.createdAt,
                                                )}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button asChild variant="outline">
                                            <Link
                                                href={route(
                                                    'notifications.show',
                                                    notification.id,
                                                )}
                                            >
                                                <MailOpenIcon data-icon="inline-start" />
                                                Open
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            variant="destructive"
                                            size="icon"
                                        >
                                            <Link
                                                href={route(
                                                    'notifications.destroy',
                                                    notification.id,
                                                )}
                                                method="delete"
                                                as="button"
                                            >
                                                <Trash2Icon />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-2">
                                        <p className="font-medium text-foreground">
                                            {notification.name ||
                                                notification.email ||
                                                'Contact notification'}
                                        </p>
                                        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                                            {notification.message ||
                                                'No message preview available.'}
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-wrap gap-2">
                                    {notification.email && (
                                        <Badge variant="outline">
                                            {notification.email}
                                        </Badge>
                                    )}
                                    {notification.projectType && (
                                        <Badge variant="secondary">
                                            {notification.projectType}
                                        </Badge>
                                    )}
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>No notifications yet</CardTitle>
                                <CardDescription>
                                    New contact form messages will appear here.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
