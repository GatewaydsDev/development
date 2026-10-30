import { Button } from '@/Components/ui/button';
import { Link } from '@inertiajs/react';
import { BellIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type DueReminder = {
    uuid: string;
    job_uuid: string | null;
    job_code: string;
    name: string;
    customer: string | null;
    note: string | null;
    remind_at: string;
};

const token = () => {
    const raw = document.cookie
        .split('; ')
        .find((item) => item.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    return raw ? decodeURIComponent(raw) : '';
};

const when = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

export default function FollowUpReminders() {
    const [reminders, setReminders] = useState<DueReminder[]>([]);

    useEffect(() => {
        let stopped = false;

        const load = async () => {
            try {
                const response = await fetch(route('admin.project-control.reminders.due'), {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
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

        await fetch(route('admin.project-control.reminders.dismiss', current.uuid), {
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
            className="fixed bottom-5 start-4 z-40 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-emerald-200 bg-card p-4 shadow-2xl lg:start-[19.5rem] xl:start-[21.5rem] [:root[data-sidebar-collapsed='1']_&]:lg:start-20 [:root[data-sidebar-collapsed='1']_&]:xl:start-20"
            aria-live="polite"
        >
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
                    <BellIcon className="size-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Follow-up reminder</p>
                    <p className="mt-1 font-semibold text-foreground">{current.job_code} · {current.name}</p>
                    <p className="text-sm text-muted-foreground">{when(current.remind_at)}{current.customer ? ` · ${current.customer}` : ''}</p>
                </div>
            </div>
            {current.note ? <p className="mt-3 text-sm text-foreground">{current.note}</p> : null}
            {reminders.length > 1 ? (
                <p className="mt-2 text-xs text-muted-foreground">{reminders.length - 1} more reminder{reminders.length === 2 ? '' : 's'}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
                {current.job_uuid ? (
                    <Button asChild size="sm">
                        <Link href={route('admin.project-control.edit', current.job_uuid)}>Open job</Link>
                    </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" onClick={() => void dismiss()}>
                    Dismiss
                </Button>
            </div>
        </aside>
    );
}
