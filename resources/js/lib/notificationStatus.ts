import {
    CircleCheckIcon,
    ClockIcon,
    InboxIcon,
    ReplyIcon,
    type LucideIcon,
} from 'lucide-react';

export type NotificationStatus = 'new' | 'in_progress' | 'responded' | 'closed';

type StatusMeta = {
    value: NotificationStatus;
    label: string;
    className: string;
    icon: LucideIcon;
};

export const NOTIFICATION_STATUSES: StatusMeta[] = [
    {
        value: 'new',
        label: 'New',
        className:
            'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
        icon: InboxIcon,
    },
    {
        value: 'in_progress',
        label: 'In progress',
        className:
            'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
        icon: ClockIcon,
    },
    {
        value: 'responded',
        label: 'Responded',
        className:
            'border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
        icon: ReplyIcon,
    },
    {
        value: 'closed',
        label: 'Closed',
        className:
            'border-transparent bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        icon: CircleCheckIcon,
    },
];

export function getNotificationStatusMeta(status?: string | null): StatusMeta {
    return (
        NOTIFICATION_STATUSES.find((option) => option.value === status) ??
        NOTIFICATION_STATUSES[0]
    );
}
