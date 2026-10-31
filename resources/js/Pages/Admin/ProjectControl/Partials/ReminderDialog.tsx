import CreatableSelect from '@/Components/CreatableSelect';
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
    emails?: string[];
    mailbox: boolean;
};

export function reminderEmails(person: ReminderPerson): string[] {
    const source = person.emails?.length ? person.emails : person.email ? [person.email] : [];

    return source.map((email) => email.trim()).filter((email) => email !== '');
}

export function isEmailAddress(value: string): boolean {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value.trim());
}

export function emailTyping(value: string): string {
    return value.replace(/[^A-Za-z0-9.@_+%-]/g, '');
}

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
        reminder_email: '',
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
            reminder_email: '',
        });
        form.clearErrors();
        // Reset only when the dialog opens for a job.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, jobUuid]);

    const sender = people.find((person) => person.id === userId);
    const reminderAddress = form.data.reminder_email.trim();
    const emailBlocked = form.data.notify_email && (!isEmailAddress(reminderAddress) || !sender?.mailbox);

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

    const jobOptions = jobs.map((job) => ({
        id: job.uuid,
        name: `${job.job_code} · ${job.name}`,
    }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
            <DialogContent
                className="max-w-xl"
                onInteractOutside={(event) => {
                    const target = event.target;

                    if (target instanceof Element && target.closest('[role="listbox"]')) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>Follow-up reminder</DialogTitle>
                    <DialogDescription>
                        Choose when to be reminded, who should get it, and whether that is a popup, an email, or both.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <CreatableSelect
                        id="reminder-job"
                        label="Job"
                        compact
                        allowCreate={false}
                        value={form.data.project_control_id}
                        options={jobOptions}
                        placeholder="Type to search for a job"
                        error={form.errors.project_control_id}
                        onChange={(jobId) => form.setData('project_control_id', jobId)}
                    />

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
                        <div className="mt-2 grid items-start gap-2 sm:grid-cols-2">
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
                                detail="Choose one address or type another. Sent from your Microsoft 365 mailbox."
                                onClick={() => form.setData('notify_email', !form.data.notify_email)}
                            />
                        </div>
                        {form.data.notify_email ? (
                            <EmailChoices
                                people={people}
                                value={form.data.reminder_email}
                                error={form.errors.reminder_email}
                                blocked={emailBlocked}
                                senderReady={Boolean(sender?.mailbox)}
                                onChange={(email) => form.setData('reminder_email', email)}
                            />
                        ) : null}
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
                    </fieldset>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button type="button" className="bg-sky-600 text-white hover:bg-sky-700" disabled={form.processing || emailBlocked || (form.data.notify_popup && form.data.user_ids.length === 0) || (form.data.notify_email && !form.data.reminder_email)} onClick={submit}>
                        Save reminder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EmailChoices({
    people,
    value,
    error,
    blocked,
    senderReady,
    onChange,
}: {
    people: ReminderPerson[];
    value: string;
    error?: string;
    blocked: boolean;
    senderReady: boolean;
    onChange: (email: string) => void;
}) {
    const choices = people.flatMap((person) => reminderEmails(person).map((email) => ({ person, email })));
    const listed = choices.some((choice) => choice.email === value);

    return (
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-background p-3">
            <div className="max-h-40 space-y-2 overflow-auto pl-4">
                {choices.length === 0 ? <p className="text-sm text-muted-foreground">No personal email is on file.</p> : null}
                {choices.map(({ person, email }) => (
                    <label key={`${person.id}-${email}`} className="flex items-start gap-3 pl-1 text-sm">
                        <input
                            type="radio"
                            name="reminder-email"
                            checked={value === email}
                            onChange={() => onChange(email)}
                            className="mt-1 h-4 w-4 border-border"
                        />
                        <span>
                            <span className="font-medium text-foreground">{email}</span>
                            <span className="block text-muted-foreground">{person.name}</span>
                        </span>
                    </label>
                ))}
            </div>
            <div className="pl-5">
                <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    pattern="^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"
                    value={listed ? '' : value}
                    onChange={(event) => onChange(emailTyping(event.target.value))}
                    className={fieldClass}
                    placeholder="Or type an email"
                />
                {listed || value.trim() === '' || isEmailAddress(value) ? null : (
                    <p className="mt-1 text-sm text-destructive">Enter an email address like name@example.com.</p>
                )}
            </div>
            <InputError message={error} />
            {blocked && (listed || value.trim() === '' || isEmailAddress(value)) ? (
                <p className="text-sm text-destructive">
                    {senderReady ? 'Choose an email from the list or type one.' : 'Your Microsoft 365 mailbox is required to send this email.'}
                </p>
            ) : null}
        </div>
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
