import { useUnreadChat } from '@/lib/unreadChat';
import { useUnreadMail, useUnreadMailMessageIds } from '@/lib/unreadMail';
import { Link } from '@inertiajs/react';
import { FlagIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type DismissedAlerts = {
    mailIds: string[];
    mailCount: number;
    chatCount: number;
};

const storageKey = 'gateway-dismissed-incoming-alerts';

function savedDismissal(): DismissedAlerts | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const value = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<DismissedAlerts> | null;

        if (!value || !Array.isArray(value.mailIds)) {
            return null;
        }

        return {
            mailIds: value.mailIds.filter((id): id is string => typeof id === 'string'),
            mailCount: typeof value.mailCount === 'number' && Number.isFinite(value.mailCount) ? Math.max(0, value.mailCount) : 0,
            chatCount: typeof value.chatCount === 'number' && Number.isFinite(value.chatCount) ? Math.max(0, value.chatCount) : 0,
        };
    } catch {
        return null;
    }
}

export default function IncomingAlert() {
    const { t } = useTranslation('mail');
    const unreadMail = useUnreadMail();
    const unreadMailIds = useUnreadMailMessageIds();
    const unreadChat = useUnreadChat();
    const [dismissed, setDismissed] = useState<DismissedAlerts | null>(savedDismissal);
    const hasNewMailId = unreadMailIds.some((id) => !dismissed?.mailIds.includes(id));
    const hasMail = unreadMail > 0
        && (dismissed === null || hasNewMailId || (unreadMailIds.length === 0 && unreadMail > dismissed.mailCount));
    const hasChat = unreadChat > 0 && (dismissed === null || unreadChat > dismissed.chatCount);

    const dismiss = () => {
        const next = {
            mailIds: unreadMailIds,
            mailCount: unreadMail,
            chatCount: unreadChat,
        };

        window.localStorage.setItem(storageKey, JSON.stringify(next));
        setDismissed(next);
    };

    if (!hasMail && !hasChat) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 sm:px-6 lg:px-8">
            {hasMail ? (
                <Link
                    href={route('mailbox.index')}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
                >
                    <FlagIcon className="size-4" />
                    {unreadMail === 1 ? '1 new email' : `${unreadMail} new emails`}
                </Link>
            ) : null}
            {hasChat ? (
                <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
                    onClick={() => window.dispatchEvent(new CustomEvent('gateway:open-chat'))}
                >
                    <FlagIcon className="size-4" />
                    {unreadChat === 1 ? '1 new message' : `${unreadChat} new messages`}
                </button>
            ) : null}
            <button
                type="button"
                onClick={dismiss}
                aria-label={t('dismissIncomingAlerts')}
                title={t('dismissIncomingAlerts')}
                className="ms-auto inline-flex size-9 items-center justify-center rounded-md text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
                <XIcon className="size-4" />
            </button>
        </div>
    );
}
