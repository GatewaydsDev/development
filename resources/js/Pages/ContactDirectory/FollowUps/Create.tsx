import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import SplitDateTimeInput from '@/Components/SplitDateTimeInput';
import CreatableSelect, { type CreatableOption } from '@/Components/CreatableSelect';
import RichTextEditor from '@/Components/RichTextEditor';
import { notesToHtml } from '@/lib/notesHtml';
import { MailIcon, PhoneIcon } from 'lucide-react';
import { formatPhoneDisplay } from '@/lib/phoneFormatting';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CalendarClockIcon, ClipboardListIcon, ArrowDownIcon, ArrowUpIcon, ListChecksIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { deviceTimezone, toInputValue, toIsoInstant } from '@/lib/followUpTime';
import FormSection from '@/Components/ContactDirectory/FormSection';
import type { FollowUpContact, FollowUpUser } from '@/Components/ContactDirectory/CreateFollowUpButton';

type ContactWithMethods = FollowUpContact & {
    uuid: string;
    phone_numbers?: { id: number; phone_number: string; country?: string | null; extension: string | null; label: string | null }[];
    email_addresses?: { id: number; email_address: string; label: string | null }[];
};

type EditableFollowUp = {
    uuid: string; contact_id: number; title: string; description: string | null;
    assigned_user_id: number; due_at: string; reminder_at: string | null; priority: string;
    tasks?: { id: number; title: string }[];
};

export default function Create({ contacts, users, contactId, followUp, taskOptions, auth }: PageProps<{
    contacts: ContactWithMethods[]; users: FollowUpUser[]; contactId: number | null; timezone: string; followUp?: EditableFollowUp; taskOptions: CreatableOption[];
}>) {
    const editing = Boolean(followUp);
    const form = useForm({
        contact_id: contactId ? String(contactId) : '',
        title: followUp?.title ?? '', description: followUp?.description ?? '',
        assigned_user_id: String(followUp?.assigned_user_id ?? auth.user.id),
        due_at: toInputValue(followUp?.due_at), reminder_at: toInputValue(followUp?.reminder_at),
        priority: followUp?.priority ?? 'normal',
        tasks: (followUp?.tasks ?? []).map((task) => ({ title: task.title })),
    });
    const [unsavedTitles, setUnsavedTitles] = useState<string[]>([]);
    const titleOptions: CreatableOption[] = [
        ...taskOptions.map((option) => ({ id: option.name, name: option.name })),
        ...[...unsavedTitles, form.data.title, ...form.data.tasks.map((task) => task.title)]
            .filter((title, index, all) => title !== '' && all.indexOf(title) === index && !taskOptions.some((option) => option.name === title))
            .map((title) => ({ id: title, name: title })),
    ];
    const moveTask = (index: number, step: number) => {
        const next = [...form.data.tasks];
        [next[index], next[index + step]] = [next[index + step], next[index]];
        form.setData('tasks', next);
    };
    const setTaskTitle = (index: number, title: string) => form.setData('tasks', form.data.tasks.map((task, i) => (i === index ? { title } : task)));
    const taskSelectProps = { options: titleOptions, optionsProp: 'taskOptions', createRoute: route('contact-directory.task-options.store'), entityLabel: 'task', placeholder: 'Select or add a task', onUseWithoutSaving: (name: string) => setUnsavedTitles((current) => [...current, name]) };
    const [emailTo, setEmailTo] = useState<string | null>(null);
    const selected = contacts.find((contact) => String(contact.id) === form.data.contact_id);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, due_at: toIsoInstant(data.due_at), reminder_at: toIsoInstant(data.reminder_at) }));
        const options = {
            onError: () => requestAnimationFrame(() => document.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center' })),
        };
        if (followUp) form.patch(route('contact-directory.follow-ups.update', followUp.uuid), options);
        else form.post(route('contact-directory.follow-ups.store'), options);
    };
    const inputClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-foreground focus:border-ring focus:ring-ring';
    const labelClass = 'text-emerald-700 dark:text-emerald-300';

    return (
        <AuthenticatedLayout header={<div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                <span>People</span><span>/</span><Link href={route('contact-directory.follow-ups.index')} className="transition hover:text-foreground">Follow-ups</Link><span>/</span><span className="text-foreground">{editing ? 'Edit' : 'Add'}</span>
            </nav>
            <h2 className={`text-xl font-semibold leading-tight ${labelClass}`}>{editing ? 'Edit follow-up' : 'New follow-up'}</h2>
        </div>}>
            <Head title={editing ? 'Edit follow-up' : 'New follow-up'} />
            <div className="py-6 sm:py-8"><div className="w-full px-4 sm:px-6 lg:px-8">
                <Card className="border-0 bg-transparent p-0 shadow-none ring-0">
                    <CardHeader className="px-0"><CardTitle>Follow-up information</CardTitle><CardDescription>Schedule a contact-related task. Assign it to yourself to see it in My Day.</CardDescription></CardHeader>
                    <CardContent className="px-0">
                        {contacts.length === 0 ? <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{auth.can.manageContactsDirectory ? 'Add a contact first, then schedule a follow-up from their contact page.' : 'Ask an administrator to add a contact, then return here to schedule a follow-up.'}</p>
                            <Button asChild><Link href={route('contact-directory.contacts.index')}>Go to Contacts</Link></Button>
                        </div> : <form id="directory-follow-up-form" onSubmit={submit} className="flex w-full min-w-0 flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
                            <FormActionFab form="directory-follow-up-form" cancelHref={followUp ? route('contact-directory.follow-ups.show', followUp.uuid) : route('contact-directory.follow-ups.index')} saveLabel={editing ? 'Save changes' : 'Create follow-up'} disabled={form.processing} />
                            {Object.keys(form.errors).length > 0 && <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">Please correct the highlighted fields before saving.</div>}
                            <FormSection title="Follow-up details" description="Who this is about and what needs to be done." icon={ClipboardListIcon} tone="emerald">
                                <div className="grid min-w-0 gap-5 md:grid-cols-2">
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-contact" value="Contact" className={labelClass} />
                                    <select id="follow-up-contact" required disabled={editing} className={inputClass} value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)}>
                                        <option value="">Choose a contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</option>)}
                                    </select><InputError message={form.errors.contact_id} />
                                    {selected && (selected.phone_numbers?.length || selected.email_addresses?.length) ? <ul className="space-y-1 rounded-md border border-emerald-200 bg-background p-3 text-sm dark:border-emerald-900">
                                        {selected.phone_numbers?.map((phone) => <li key={`p${phone.id}`} className="flex flex-wrap items-center gap-2"><PhoneIcon className="size-4 text-emerald-600" aria-hidden /><a href={`tel:${phone.phone_number}`} className="hover:underline">{formatPhoneDisplay(phone.phone_number, phone.country)}{phone.extension ? ` x${phone.extension}` : ''}</a>{phone.label && <span className="text-xs text-muted-foreground">{phone.label}</span>}</li>)}
                                        {selected.email_addresses?.map((email) => <li key={`e${email.id}`} className="flex flex-wrap items-center gap-2"><MailIcon className="size-4 text-emerald-600" aria-hidden /><button type="button" onClick={() => setEmailTo(email.email_address)} className="break-all text-left hover:underline">{email.email_address}</button>{email.label && <span className="text-xs text-muted-foreground">{email.label}</span>}</li>)}
                                    </ul> : selected ? <p className="text-xs text-muted-foreground">No phone numbers or emails saved for this contact.</p> : null}
                                </div>
                                <div className="space-y-2"><CreatableSelect id="follow-up-title" label="Task title" value={form.data.title} {...taskSelectProps} error={form.errors.title} onChange={(_id, option) => form.setData('title', option?.name ?? '')} /></div>
                                </div>
                            </FormSection>
                            <FormSection title="Schedule" description="Who owns it, when it is due and how urgent it is." icon={CalendarClockIcon} tone="sky">
                                <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-assignee" value="Assigned to" className={labelClass} />
                                    <select id="follow-up-assignee" required className={inputClass} value={form.data.assigned_user_id} onChange={(e) => form.setData('assigned_user_id', e.target.value)}>
                                        {users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.id === auth.user.id ? ' (me)' : ''}</option>)}
                                    </select><InputError message={form.errors.assigned_user_id} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-due" value="Due date and time" className={labelClass} />
                                    <SplitDateTimeInput id="follow-up-due" required className={inputClass} value={form.data.due_at} onChange={(value) => form.setData('due_at', value)} /><InputError message={form.errors.due_at} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-reminder" value="Reminder (optional)" className={labelClass} />
                                    <SplitDateTimeInput id="follow-up-reminder" className={inputClass} value={form.data.reminder_at} max={form.data.due_at || undefined} onChange={(value) => form.setData('reminder_at', value)} /><InputError message={form.errors.reminder_at} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-priority" value="Priority" className={labelClass} />
                                    <select id="follow-up-priority" className={inputClass} value={form.data.priority} onChange={(e) => form.setData('priority', e.target.value)}>{['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}</select><InputError message={form.errors.priority} />
                                </div>
                                </div>
                                <p className="mt-4 text-xs text-muted-foreground">Dates and times use your device timezone ({deviceTimezone()}).</p>
                            </FormSection>
                            <FormSection title="Tasks" description="Optional checklist for this follow-up, shown in this order. Saving a task to the list does not add it here." icon={ListChecksIcon} tone="violet">
                                {form.data.tasks.length === 0 && <p className="mb-4 text-sm text-muted-foreground">No tasks added yet.</p>}
                                <div className="space-y-3">
                                    {form.data.tasks.map((task, index) => (
                                        <div key={index} className="flex items-start gap-2">
                                            <span className="mt-8 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">{index + 1}</span>
                                            <div className="min-w-0 flex-1"><CreatableSelect id={`follow-up-task-${index}`} label={`Task ${index + 1}`} value={task.title} {...taskSelectProps} error={(form.errors as Record<string, string>)[`tasks.${index}.title`]} onChange={(_id, option) => setTaskTitle(index, option?.name ?? '')} /></div>
                                            <div className="mt-6 flex gap-1">
                                                <Button type="button" variant="outline" size="icon" aria-label={`Move task ${index + 1} up`} disabled={index === 0} onClick={() => moveTask(index, -1)}><ArrowUpIcon className="size-4" aria-hidden="true" /></Button>
                                                <Button type="button" variant="outline" size="icon" aria-label={`Move task ${index + 1} down`} disabled={index === form.data.tasks.length - 1} onClick={() => moveTask(index, 1)}><ArrowDownIcon className="size-4" aria-hidden="true" /></Button>
                                                <Button type="button" variant="outline" size="icon" className="text-destructive" aria-label={`Remove task ${index + 1}`} onClick={() => form.setData('tasks', form.data.tasks.filter((_, i) => i !== index))}><Trash2Icon className="size-4" aria-hidden="true" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex justify-end"><Button type="button" className="bg-violet-600 text-white hover:bg-violet-700" onClick={() => form.setData('tasks', [...form.data.tasks, { title: '' }])}><PlusIcon className="size-4" aria-hidden="true" />Add task</Button></div>
                            </FormSection>
                            <FormSection title="Notes" description="Details to remember for this follow-up." icon={ClipboardListIcon} tone="amber">
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-description" value="Notes (optional)" className={labelClass} />
                                <RichTextEditor id="follow-up-description" compact showPlaceholders={false} value={notesToHtml(form.data.description)} onChange={(html) => form.setData('description', html)} error={form.errors.description} /><InputError message={form.errors.description} />
                            </div>
                            </FormSection>
                        </form>}
                        <AlertDialog open={emailTo !== null} onOpenChange={(open) => !open && setEmailTo(null)}>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Send an email?</AlertDialogTitle>
                                    <AlertDialogDescription>Would you like to send an email to {selected?.first_name} {selected?.last_name} at {emailTo}? It opens in your Microsoft 365 mailbox with their details and open tasks.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => selected && emailTo && router.visit(route('contact-directory.contacts.email.compose', { contact: selected.uuid, recipient: emailTo, ...(followUp ? { follow_up: followUp.uuid } : {}) }))}>Yes, compose email</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </div></div>
        </AuthenticatedLayout>
    );
}
