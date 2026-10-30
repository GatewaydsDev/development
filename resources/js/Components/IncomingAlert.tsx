import { useUnreadChat } from '@/lib/unreadChat';
import { useUnreadMail } from '@/lib/unreadMail';
import { Link } from '@inertiajs/react';
import { FlagIcon } from 'lucide-react';

export default function IncomingAlert() {
    const unreadMail = useUnreadMail();
    const unreadChat = useUnreadChat();
    const hasMail = unreadMail > 0;
    const hasChat = unreadChat > 0;

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
        </div>
    );
}
