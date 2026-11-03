import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type FollowUp = {
    id: number;
    uuid: string;
    title: string;
    description: string | null;
    due_at: string;
    reminder_at: string | null;
    priority: string;
    status: string;
    completed_at: string | null;
    completed_by_user?: { id: number; name: string } | null;
    snoozed_until: string | null;
    snoozed_reason: string | null;
    creator?: { id: number; name: string } | null;
    contact?: { id: number; uuid: string; first_name: string; last_name: string | null } | null;
    inquiry?: { id: number; uuid: string; title: string; status: string } | null;
    assigned_user?: { id: number; name: string } | null;
};

type Props = PageProps<{ followUp: FollowUp }>;

const PRIORITY_STYLES: Record<string, string> = {
    low: 'bg-muted text-muted-foreground',
    normal: 'bg-secondary text-secondary-foreground',
    high: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    urgent: 'bg-destructive text-white',
};

export default function FollowUpsShow({ followUp }: Props) {
    const isOverdue =
        followUp.status === 'pending' && new Date(followUp.due_at) < new Date();

    return (
        <AuthenticatedLayout stickyTitle={followUp.title}>
            <div className="space-y-6 px-4 py-6 lg:px-8">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge
                        variant={
                            followUp.status === 'completed'
                                ? 'secondary'
                                : followUp.status === 'cancelled'
                                  ? 'outline'
                                  : 'default'
                        }
                    >
                        {followUp.status}
                    </Badge>
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            PRIORITY_STYLES[followUp.priority],
                        )}
                    >
                        {followUp.priority}
                    </span>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Due
                            </span>
                            <span className={isOverdue ? 'font-semibold text-destructive' : ''}>
                                {new Date(followUp.due_at).toLocaleString([], {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                                {isOverdue ? ' · overdue' : ''}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Assigned user
                            </span>
                            {followUp.assigned_user?.name ?? '—'}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Reminder
                            </span>
                            {followUp.reminder_at
                                ? new Date(followUp.reminder_at).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                  })
                                : 'No reminder is scheduled.'}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Contact
                            </span>
                            {followUp.contact ? (
                                <Link
                                    href={route('contact-directory.contacts.show', followUp.contact.uuid)}
                                    className="text-foreground underline-offset-4 hover:underline"
                                >
                                    {followUp.contact.first_name}{' '}
                                    {followUp.contact.last_name ?? ''}
                                </Link>
                            ) : (
                                '—'
                            )}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Inquiry
                            </span>
                            {followUp.inquiry ? (
                                <Link
                                    href={route('contact-directory.inquiries.show', followUp.inquiry.uuid)}
                                    className="text-foreground underline-offset-4 hover:underline"
                                >
                                    {followUp.inquiry.title}
                                </Link>
                            ) : (
                                '—'
                            )}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Snoozed
                            </span>
                            {followUp.snoozed_until
                                ? `Until ${new Date(followUp.snoozed_until).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                  })}${
                                      followUp.snoozed_reason
                                          ? ` · ${followUp.snoozed_reason}`
                                          : ''
                                  }`
                                : 'Not snoozed.'}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Completed
                            </span>
                            {followUp.completed_at
                                ? `${new Date(followUp.completed_at).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                  })}${
                                      followUp.completed_by_user
                                          ? ` by ${followUp.completed_by_user.name}`
                                          : ''
                                  }`
                                : 'Not completed.'}
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-muted-foreground">
                                Created by
                            </span>
                            {followUp.creator?.name ?? '—'}
                        </div>
                        {followUp.description && (
                            <div className="sm:col-span-2">
                                <span className="block text-xs uppercase text-muted-foreground">
                                    Description
                                </span>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                    {followUp.description}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
