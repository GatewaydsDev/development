import { beginSaving, endSaving } from '@/Components/SavingNotice';
import { getEcho, isEchoConnected } from '@/lib/echo';
import { PageProps } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

type ExpenseChange = {
    action: string;
    id: number;
    summary: string;
};

const listProps = ['expenses', 'groups', 'total', 'paid', 'scheduled', 'count'] as const;

/**
 * Keeps expenses current on every signed-in device.
 * A save on one device tells the others to reload and show a reading notice.
 */
export default function ExpenseUpdates() {
    const page = usePage<PageProps & { expense?: { id: number } }>();
    const pageRef = useRef(page);
    const { realtime } = page.props;
    const realtimeKey = realtime?.key;

    pageRef.current = page;

    useEffect(() => {
        const echo = getEcho(realtime);

        if (!echo) {
            return;
        }

        const channel = echo.private('expenses');
        const refresh = (change: ExpenseChange) => {
            const current = pageRef.current;
            const onIndex = current.component === 'Admin/Expenses/Index';
            const editingThis = current.component === 'Admin/Expenses/Edit'
                && current.props.expense?.id === change.id;

            if (!onIndex && !editingThis) {
                return;
            }

            beginSaving('reading');
            router.reload({
                ...(onIndex ? { only: [...listProps], preserveState: true } : {}),
                preserveScroll: true,
                onFinish: () => endSaving('reading'),
            });
        };

        channel.listen('.expense.changed', refresh);

        return () => {
            channel.stopListening('.expense.changed');
            echo.leave('expenses');
        };
        // The socket is created once for this Reverb key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [realtimeKey]);

    useEffect(() => {
        const refreshQuietly = () => {
            if (document.visibilityState !== 'visible' || isEchoConnected()) {
                return;
            }

            if (pageRef.current.component !== 'Admin/Expenses/Index') {
                return;
            }

            router.reload({
                only: [...listProps],
                preserveScroll: true,
                preserveState: true,
            });
        };
        const interval = window.setInterval(refreshQuietly, 20000);

        document.addEventListener('visibilitychange', refreshQuietly);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refreshQuietly);
        };
    }, []);

    return null;
}
