import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
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
import {
    getNotificationStatusMeta,
    NOTIFICATION_STATUSES,
} from '@/lib/notificationStatus';
import { cn } from '@/lib/utils';
import { AppNotification, Contact } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    ArrowLeftIcon,
    CheckCircle2Icon,
    MailIcon,
    SendIcon,
    Trash2Icon,
    UsersIcon,
} from 'lucide-react';
import { FormEvent } from 'react';

type ShowProps = {
    notification: AppNotification;
    contacts: Contact[];
    companyEmail?: string | null;
    canSendEmail: boolean;
    emailedContactIds: number[];
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

export default function Show({
    notification,
    contacts,
    companyEmail,
    canSendEmail,
    emailedContactIds,
}: ShowProps) {
    const emailForm = useForm({
        contact_ids: [] as number[],
        subject: `Contact request from ${notification.name ?? 'website'}`,
        message:
            'Hi,\n\nPlease find the details of a new contact request below.\n\nThanks',
        include_company: false,
    });

    const toggleContact = (contactId: number) => {
        emailForm.setData(
            'contact_ids',
            emailForm.data.contact_ids.includes(contactId)
                ? emailForm.data.contact_ids.filter((id) => id !== contactId)
                : [...emailForm.data.contact_ids, contactId],
        );
    };

    const currentStatus = getNotificationStatusMeta(notification.status);

    const changeStatus = (status: string) => {
        if (status === notification.status) {
            return;
        }

        router.patch(
            route('notifications.status', notification.id),
            { status },
            {
                preserveScroll: true,
                onSuccess: () =>
                    toast.success('Status updated', {
                        description: `Marked as ${
                            getNotificationStatusMeta(status).label
                        }.`,
                    }),
                onError: () =>
                    toast.error('Status not updated', {
                        description:
                            'Something went wrong while updating the status. Please try again.',
                    }),
            },
        );
    };

    const submitEmail = (event: FormEvent) => {
        event.preventDefault();

        const recipientCount =
            emailForm.data.contact_ids.length +
            (emailForm.data.include_company && companyEmail ? 1 : 0);

        emailForm.post(route('notifications.send-email', notification.id), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Email sent', {
                    description:
                        recipientCount > 0
                            ? `Your message was sent to ${recipientCount} ${
                                  recipientCount === 1
                                      ? 'recipient'
                                      : 'recipients'
                              }.`
                            : 'Your message was sent successfully.',
                });
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];

                toast.error('Email not sent', {
                    description:
                        firstError ||
                        'Something went wrong while sending the email. Please try again.',
                });
            },
        });
    };

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
                    <div className="flex items-center gap-2">
                        <Badge className={cn('gap-1', currentStatus.className)}>
                            <currentStatus.icon className="size-3.5" />
                            {currentStatus.label}
                        </Badge>
                        <Badge
                            variant={
                                notification.isRead ? 'outline' : 'destructive'
                            }
                        >
                            {notification.isRead ? 'Read' : 'Unread'}
                        </Badge>
                    </div>
                </div>
            }
        >
            <Head title={notification.title} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto grid max-w-[96rem] gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_0.35fr] lg:px-8">
                    <div className="flex flex-col gap-6">
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
                                        label="Service location"
                                        value={notification.address}
                                    />
                                    <DetailItem
                                        label="State"
                                        value={notification.state}
                                    />
                                    <DetailItem
                                        label="Country"
                                        value={notification.country}
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

                        {canSendEmail && (
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <SendIcon className="size-5 text-muted-foreground" />
                                        Send email to contacts
                                    </CardTitle>
                                    <CardDescription>
                                        Forward this request to one or more
                                        contacts. The email includes the company
                                        logo and the request details.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form
                                        onSubmit={submitEmail}
                                        className="flex flex-col gap-5"
                                    >
                                        <div>
                                            <InputLabel value="Recipients" />
                                            {contacts.length > 0 ? (
                                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                    {contacts.map((contact) => {
                                                        const checked =
                                                            emailForm.data.contact_ids.includes(
                                                                contact.id,
                                                            );
                                                        const alreadyEmailed =
                                                            emailedContactIds.includes(
                                                                contact.id,
                                                            );

                                                        return (
                                                            <label
                                                                key={contact.id}
                                                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                                                                    checked
                                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                                                        : 'border-border bg-background hover:bg-muted/50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="mt-1 size-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                                    checked={
                                                                        checked
                                                                    }
                                                                    onChange={() =>
                                                                        toggleContact(
                                                                            contact.id,
                                                                        )
                                                                    }
                                                                />
                                                                <span className="min-w-0">
                                                                    <span className="flex items-center gap-2 font-medium text-foreground">
                                                                        {
                                                                            contact.name
                                                                        }
                                                                        {alreadyEmailed && (
                                                                            <Badge variant="outline">
                                                                                Emailed
                                                                            </Badge>
                                                                        )}
                                                                    </span>
                                                                    <span className="block truncate text-sm text-muted-foreground">
                                                                        {
                                                                            contact.email
                                                                        }
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                                                    <UsersIcon className="size-4" />
                                                    No contacts yet.{' '}
                                                    <Link
                                                        href={route(
                                                            'admin.contacts.index',
                                                        )}
                                                        className="font-medium text-emerald-700 underline dark:text-emerald-300"
                                                    >
                                                        Add contacts
                                                    </Link>
                                                </div>
                                            )}
                                            <InputError
                                                message={
                                                    emailForm.errors.contact_ids
                                                }
                                                className="mt-1"
                                            />
                                        </div>

                                        {companyEmail && (
                                            <label className="flex items-center gap-2 text-sm text-foreground">
                                                <input
                                                    type="checkbox"
                                                    className="size-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                    checked={
                                                        emailForm.data
                                                            .include_company
                                                    }
                                                    onChange={(event) =>
                                                        emailForm.setData(
                                                            'include_company',
                                                            event.target.checked,
                                                        )
                                                    }
                                                />
                                                Also send to the company email (
                                                {companyEmail})
                                            </label>
                                        )}

                                        <div>
                                            <InputLabel
                                                htmlFor="subject"
                                                value="Subject"
                                            />
                                            <TextInput
                                                id="subject"
                                                className="mt-1 block w-full"
                                                value={emailForm.data.subject}
                                                onChange={(event) =>
                                                    emailForm.setData(
                                                        'subject',
                                                        event.target.value,
                                                    )
                                                }
                                                required
                                            />
                                            <InputError
                                                message={
                                                    emailForm.errors.subject
                                                }
                                                className="mt-1"
                                            />
                                        </div>

                                        <div>
                                            <InputLabel
                                                htmlFor="message"
                                                value="Message (optional)"
                                            />
                                            <textarea
                                                id="message"
                                                rows={4}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                value={emailForm.data.message}
                                                onChange={(event) =>
                                                    emailForm.setData(
                                                        'message',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    emailForm.errors.message
                                                }
                                                className="mt-1"
                                            />
                                        </div>

                                        <div>
                                            <Button
                                                type="submit"
                                                disabled={emailForm.processing}
                                            >
                                                <SendIcon className="size-4" />
                                                Send email
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <Card className="h-fit shadow-sm">
                        <CardHeader>
                            <CardTitle>Controls</CardTitle>
                            <CardDescription>
                                Update or delete this notification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-foreground">
                                    Status
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {NOTIFICATION_STATUSES.map((option) => {
                                        const isActive =
                                            option.value === notification.status;

                                        return (
                                            <Button
                                                key={option.value}
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className={cn(
                                                    'justify-start gap-2',
                                                    isActive
                                                        ? cn(
                                                              'pointer-events-none ring-2 ring-ring',
                                                              option.className,
                                                          )
                                                        : 'text-muted-foreground',
                                                )}
                                                onClick={() =>
                                                    changeStatus(option.value)
                                                }
                                            >
                                                <option.icon className="size-4" />
                                                {option.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="h-px bg-border" />

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
