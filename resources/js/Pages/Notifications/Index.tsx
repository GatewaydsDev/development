import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { getNotificationStatusMeta } from '@/lib/notificationStatus';
import { formatProjectType } from '@/lib/projectType';
import { cn } from '@/lib/utils';
import { AppNotification } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { BellIcon, MailOpenIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('common');

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
                        <Card className="shadow-sm">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Notification</TableHead>
                                            <TableHead className="hidden md:table-cell">
                                                Contact
                                            </TableHead>
                                            <TableHead className="hidden lg:table-cell">
                                                Project type
                                            </TableHead>
                                            <TableHead className="text-center">
                                                Status
                                            </TableHead>
                                            <TableHead className="hidden text-center sm:table-cell">
                                                Received
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Actions
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {notifications.map((notification) => {
                                            const statusMeta =
                                                getNotificationStatusMeta(
                                                    notification.status,
                                                );
                                            const StatusIcon = statusMeta.icon;

                                            return (
                                                <TableRow
                                                    key={notification.id}
                                                    className={cn(
                                                        !notification.isRead &&
                                                            'bg-destructive/5',
                                                    )}
                                                >
                                                    <TableCell className="max-w-[22rem]">
                                                        <div className="flex items-start gap-3">
                                                            <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                                                                <BellIcon className="size-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-medium text-foreground">
                                                                        {
                                                                            notification.title
                                                                        }
                                                                    </span>
                                                                    {!notification.isRead && (
                                                                        <Badge variant="destructive">
                                                                            New
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="truncate text-sm text-muted-foreground">
                                                                    {notification.name ||
                                                                        notification.email ||
                                                                        'Contact notification'}
                                                                </p>
                                                                <p className="line-clamp-1 text-sm text-muted-foreground/80 md:hidden">
                                                                    {notification.message ||
                                                                        'No message preview.'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <span className="block truncate text-sm text-muted-foreground">
                                                            {notification.email ||
                                                                '—'}
                                                        </span>
                                                        {notification.phoneNumber && (
                                                            <span className="block truncate text-xs text-muted-foreground/80">
                                                                {
                                                                    notification.phoneNumber
                                                                }
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="hidden lg:table-cell">
                                                        {notification.projectType ? (
                                                            <Badge variant="secondary">
                                                                {formatProjectType(
                                                                    notification.projectType,
                                                                    t,
                                                                )}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge
                                                            className={cn(
                                                                'mx-auto gap-1',
                                                                statusMeta.className,
                                                            )}
                                                        >
                                                            <StatusIcon className="size-3.5" />
                                                            {statusMeta.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="hidden whitespace-nowrap text-center text-sm text-muted-foreground sm:table-cell">
                                                        {formatDate(
                                                            notification.createdAt,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                asChild
                                                                variant="outline"
                                                                size="sm"
                                                            >
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
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
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
