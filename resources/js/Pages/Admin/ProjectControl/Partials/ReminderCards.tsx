import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';

export type ScheduledReminder = {
    uuid: string;
    job_uuid: string | null;
    job_code: string;
    job_name: string;
    user_name: string;
    remind_at: string;
    note: string | null;
    notify_popup: boolean;
    notify_email: boolean;
    recipient_email: string | null;
    status: string;
};

export const displayReminderWhen = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour = hours % 12 || 12;

    return `${month}/${day}/${year}, ${hour}:${minutes} ${suffix}`;
};

export const reminderLabel = (reminder: ScheduledReminder) => reminder.note?.trim() || displayReminderWhen(reminder.remind_at);

export const reminderHow = (reminder: ScheduledReminder) => {
    return [
        reminder.notify_popup ? 'Popup' : '',
        reminder.notify_email ? `Email${reminder.recipient_email ? ` · ${reminder.recipient_email}` : ''}` : '',
    ].filter(Boolean).join(', ') || '—';
};

const statusClass = (status: string) => {
    if (status === 'Scheduled') {
        return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200';
    }

    if (status === 'Sent') {
        return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200';
    }

    if (status === 'Email failed') {
        return 'bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200';
    }

    if (status === 'Due') {
        return 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200';
    }

    return 'bg-muted text-muted-foreground';
};

export function ReminderStatus({ status }: { status: string }) {
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>{status}</span>;
}

export default function ReminderCards({ reminders }: { reminders: ScheduledReminder[] }) {
    if (reminders.length === 0) {
        return <p className="text-sm text-muted-foreground">No reminders on this job yet.</p>;
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-rose-200 bg-background dark:border-rose-900">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">When</th>
                        <th className="px-3 py-2 font-medium">Who</th>
                        <th className="px-3 py-2 font-medium">How</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Note</th>
                        <th className="px-3 py-2 font-medium"><span className="sr-only">Remove</span></th>
                    </tr>
                </thead>
                <tbody>
                    {reminders.map((reminder) => (
                        <tr key={reminder.uuid} className="border-t border-border">
                            <td className="whitespace-nowrap px-3 py-2 text-foreground">{displayReminderWhen(reminder.remind_at)}</td>
                            <td className="px-3 py-2 text-foreground">{reminder.user_name || '—'}</td>
                            <td className="px-3 py-2 text-foreground">{reminderHow(reminder)}</td>
                            <td className="px-3 py-2"><ReminderStatus status={reminder.status} /></td>
                            <td className="max-w-xs px-3 py-2 text-foreground">{reminder.note?.trim() || '—'}</td>
                            <td className="px-3 py-2 text-right">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.delete(route('admin.project-control.reminders.destroy', reminder.uuid), { preserveScroll: true })}
                                >
                                    Remove
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
