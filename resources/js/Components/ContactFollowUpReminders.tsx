import { Button } from '@/Components/ui/button';
import { Link } from '@inertiajs/react';
import { BellRingIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type DueReminder = {
    uuid: string;
    title: string;
    contact: string;
    priority: string;
    due_at: string | null;
    remind_at: string;
};

const token = () => {
    const raw = document.cookie
        .split('; ')
        .find((item) => item.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    return raw ? decodeURIComponent(raw) : '';
};

const when = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
        : '';

export default function ContactFollowUpReminders() {
    const [reminders, setReminders] = useState<DueReminder[]>([]);

    useEffect(() => {
        let stopped = false;

        const load = async () => {
            try {
                const response = await fetch(route('contact-directory.follow-ups.reminders.due'), {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    return;
                }

                const payload = (await response.json()) as { reminders?: DueReminder[] };

                if (!stopped) {
                    setReminders(payload.reminders ?? []);
                }
            } catch {
                // The next poll can try again.
            }
        };

        void load();
        const timer = window.setInterval(() => void load(), 30000);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, []);

    const current = reminders[0];

    if (!current) {
        return null;
    }

    const dismiss = async () => {
        setReminders((items) => items.filter((item) => item.uuid !== current.uuid));

        await fetch(route('contact-directory.follow-ups.reminders.dismiss', current.uuid), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': token(),
            },
            credentials: 'same-origin',
        });
    };

    return (
        <aside
            className="fixed bottom-5 end-4 z-40 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-sky-200 bg-card p-4 shadow-2xl dark:border-sky-900"
            aria-live="polite"
        >
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
                    <BellRingIcon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Follow-up reminder</p>
                    <p className="reminder-shimmer mt-1 font-semibold">{current.title}</p>
                    <p className="reminder-shimmer text-sm">
                        {current.contact ? `${current.contact} · ` : ''}Due {when(current.due_at)}
                    </p>
                </div>
            </div>
            {reminders.length > 1 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                    {reminders.length - 1} more reminder{reminders.length === 2 ? '' : 's'}
                </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full">
                    <Link href={route('contact-directory.follow-ups.show', current.uuid)}>Open follow-up</Link>
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => void dismiss()}>
                    Dismiss
                </Button>
            </div>
        </aside>
    );
}
