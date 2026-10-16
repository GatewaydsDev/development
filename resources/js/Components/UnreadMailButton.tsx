import { useUnreadMail } from '@/lib/unreadMail';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { MailIcon } from 'lucide-react';

export default function UnreadMailButton({
    onDark = false,
    className,
}: {
    onDark?: boolean;
    className?: string;
}) {
    const unread = useUnreadMail();
    const hasUnread = unread > 0;
    const countLabel = unread > 99 ? '99+' : String(unread);

    return (
        <Link
            href={route('mailbox.index')}
            aria-label={
                hasUnread
                    ? `${unread} unread ${unread === 1 ? 'email' : 'emails'}`
                    : 'Email'
            }
            className={cn(
                'relative inline-flex size-11 items-center justify-center rounded-md border transition touch-manipulation focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 lg:size-9',
                hasUnread
                    ? 'border-red-500 bg-red-50 text-red-600 shadow-sm shadow-red-500/40 hover:bg-red-100 dark:border-red-400 dark:bg-red-950/60 dark:text-red-400 dark:hover:bg-red-950'
                    : onDark
                      ? 'border-white/30 bg-white/10 text-white hover:bg-white/20 focus:ring-offset-[#111827]'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground focus:ring-offset-background',
                className,
            )}
        >
            <MailIcon
                className={cn('size-4', hasUnread && 'animate-mail-alert')}
            />
            {hasUnread ? (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[0.65rem] font-semibold leading-5 text-white ring-2 ring-background">
                    {countLabel}
                </span>
            ) : null}
        </Link>
    );
}
