import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { useForm, usePage } from '@inertiajs/react';
import { BellIcon, MailIcon } from 'lucide-react';
import { ReactNode, useEffect } from 'react';

export type ReminderPerson = {
    id: number;
    name: string;
    email: string;
    mailbox: boolean;
};

export type ReminderJob = {
    uuid: string;
    job_code: string;
    name: string;
};

const fieldClass =
    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring dark:[color-scheme:dark]';

export default function ReminderDialog({
    open,
    jobUuid,
    jobs,
    people,
    onOpenChange,
}: {
    open: boolean;
    jobUuid: string;
    jobs: ReminderJob[];
    people: ReminderPerson[];
    onOpenChange: (open: boolean) => void;
}) {
    const userId = usePage().props.auth.user.id;
    const form = useForm({
        project_control_id: jobUuid,
        remind_at: '',
        note: '',
        user_ids: [userId] as number[],
        notify_popup: true,
        notify_email: false,
    });

    useEffect(() => {
        if (!open) {
            return;
        }

        form.setData({
            project_control_id: jobUuid || jobs[0]?.uuid || '',
            remind_at: '',
            note: '',
            user_ids: [userId],
            notify_popup: true,
            notify_email: false,
        });
        form.clearErrors();
        // Reset only when the dialog opens for a job.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, jobUuid]);

    const selected = people.filter((person) => form.data.user_ids.includes(person.id));
    const emailBlocked = form.data.notify_email && selected.some((person) => !person.mailbox || !person.email);

    const togglePerson = (id: number) => {
        const ids = form.data.user_ids.includes(id)
            ? form.data.user_ids.filter((item) => item !== id)
            : [...form.data.user_ids, id];

        form.setData('user_ids', ids);
    };

    const submit = () => {
        form.transform((data) => ({
            ...data,
            remind_at: data.remind_at ? new Date(data.remind_at).toISOString() : '',
        }));
        form.post(route('admin.project-control.reminders.store'), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Follow-up reminder</DialogTitle>
                    <DialogDescription>
                        Choose when to be reminded, who should get it, and whether that is a popup, an email, or both.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <label className="block text-sm font-medium text-foreground">
                        Job
                        <select
                            value={form.data.project_control_id}
                            onChange={(event) => form.setData('project_control_id', event.target.value)}
                            className={`${fieldClass} mt-1`}
                        >
                            {jobs.map((job) => (
                                <option key={job.uuid} value={job.uuid}>
                                    {job.job_code} · {job.name}
                                </option>
                            ))}
                        </select>
                        <InputError message={form.errors.project_control_id} className="mt-1" />
                    </label>

                    <label className="block text-sm font-medium text-foreground">
                        When
                        <input
                            type="datetime-local"
                            value={form.data.remind_at}
                            onChange={(event) => form.setData('remind_at', event.target.value)}
                            className={`${fieldClass} mt-1`}
                        />
                        <InputError message={form.errors.remind_at} className="mt-1" />
                    </label>

                    <label className="block text-sm font-medium text-foreground">
                        Note
                        <textarea
                            value={form.data.note}
                            onChange={(event) => form.setData('note', event.target.value)}
                            className={`${fieldClass} mt-1 h-20 py-2`}
                            placeholder="What should they remember?"
                        />
                        <InputError message={form.errors.note} className="mt-1" />
                    </label>

                    <fieldset>
                        <legend className="text-sm font-medium text-foreground">How should they be notified?</legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <Channel
                                pressed={form.data.notify_popup}
                                icon={<BellIcon className="size-4" />}
                                title="Popup in Gateway"
                                detail="Shows while they are signed in."
                                onClick={() => form.setData('notify_popup', !form.data.notify_popup)}
                            />
                            <Channel
                                pressed={form.data.notify_email}
                                icon={<MailIcon className="size-4" />}
                                title="Personal email"
                                detail="Sent from each person's Microsoft 365 mailbox."
                                onClick={() => form.setData('notify_email', !form.data.notify_email)}
                            />
                        </div>
                        <InputError message={form.errors.notify_popup || form.errors.notify_email} className="mt-1" />
                    </fieldset>

                    <fieldset>
                        <legend className="text-sm font-medium text-foreground">Who</legend>
                        <div className="mt-2 max-h-40 space-y-2 overflow-auto rounded-md border border-border p-2">
                            {people.map((person) => (
                                <label key={person.id} className="flex items-start gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={form.data.user_ids.includes(person.id)}
                                        onChange={() => togglePerson(person.id)}
                                        className="mt-1 h-4 w-4 rounded border-border"
                                    />
                                    <span>
                                        <span className="font-medium text-foreground">{person.name}</span>
                                        <span className="block text-muted-foreground">
                                            {person.email || 'No personal email'}
                                            {person.mailbox ? ' · Microsoft 365 ready' : ' · No Microsoft 365 mailbox'}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <InputError message={form.errors.user_ids} className="mt-1" />
                        {emailBlocked ? (
                            <p className="mt-1 text-sm text-destructive">
                                Email needs a personal address and a Microsoft 365 mailbox for every person selected.
                            </p>
                        ) : null}
                    </fieldset>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button type="button" className="bg-sky-600 text-white hover:bg-sky-700" disabled={form.processing || emailBlocked || form.data.user_ids.length === 0} onClick={submit}>
                        Save reminder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Channel({
    pressed,
    icon,
    title,
    detail,
    onClick,
}: {
    pressed: boolean;
    icon: ReactNode;
    title: string;
    detail: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={
                pressed
                    ? 'rounded-xl border border-emerald-700 bg-emerald-50 p-3 text-left dark:bg-emerald-950/40'
                    : 'rounded-xl border border-border bg-background p-3 text-left hover:bg-muted'
            }
        >
            <span className="flex items-center gap-2 font-medium text-foreground">
                {icon}
                {title}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
        </button>
    );
}
