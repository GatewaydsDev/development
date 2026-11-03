import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import type { FollowUpContact, FollowUpUser } from '@/Components/ContactDirectory/CreateFollowUpButton';

export default function Create({ contacts, users, contactId, timezone, auth }: PageProps<{
    contacts: FollowUpContact[]; users: FollowUpUser[]; contactId: number | null; timezone: string;
}>) {
    const form = useForm({
        contact_id: contactId ? String(contactId) : '',
        title: '', description: '', assigned_user_id: String(auth.user.id),
        due_at: '', reminder_at: '', priority: 'normal',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('contact-directory.follow-ups.store'), {
            onError: () => requestAnimationFrame(() => document.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center' })),
        });
    };
    const inputClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-foreground focus:border-ring focus:ring-ring';
    const labelClass = 'text-emerald-700 dark:text-emerald-300';

    return (
        <AuthenticatedLayout header={<div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                <span>People</span><span>/</span><Link href={route('contact-directory.follow-ups.index')} className="transition hover:text-foreground">Follow-ups</Link><span>/</span><span className="text-foreground">Add</span>
            </nav>
            <h2 className={`text-xl font-semibold leading-tight ${labelClass}`}>New follow-up</h2>
        </div>}>
            <Head title="New follow-up" />
            <div className="py-6 sm:py-8"><div className="w-full px-4 sm:px-6 lg:px-8">
                <Card className="shadow-sm">
                    <CardHeader><CardTitle>Follow-up information</CardTitle><CardDescription>Schedule a contact-related task. Assign it to yourself to see it in My Day.</CardDescription></CardHeader>
                    <CardContent>
                        {contacts.length === 0 ? <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{auth.can.manageContactsDirectory ? 'Add a contact first, then schedule a follow-up from their contact page.' : 'Ask an administrator to add a contact, then return here to schedule a follow-up.'}</p>
                            <Button asChild><Link href={route('contact-directory.contacts.index')}>Go to Contacts</Link></Button>
                        </div> : <form id="directory-follow-up-form" onSubmit={submit} className="flex w-full min-w-0 flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
                            <FormActionFab form="directory-follow-up-form" cancelHref={route('contact-directory.follow-ups.index')} saveLabel="Create follow-up" disabled={form.processing} />
                            {Object.keys(form.errors).length > 0 && <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">Please correct the highlighted fields before saving.</div>}
                            <section className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-contact" value="Contact" className={labelClass} />
                                    <select id="follow-up-contact" required className={inputClass} value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)}>
                                        <option value="">Choose a contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</option>)}
                                    </select><InputError message={form.errors.contact_id} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-title" value="Task title" className={labelClass} />
                                    <TextInput id="follow-up-title" required maxLength={255} className={inputClass} placeholder="Call supplier about revised pricing" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} /><InputError message={form.errors.title} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-assignee" value="Assigned to" className={labelClass} />
                                    <select id="follow-up-assignee" required className={inputClass} value={form.data.assigned_user_id} onChange={(e) => form.setData('assigned_user_id', e.target.value)}>
                                        {users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.id === auth.user.id ? ' (me)' : ''}</option>)}
                                    </select><InputError message={form.errors.assigned_user_id} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-due" value="Due date and time" className={labelClass} />
                                    <TextInput id="follow-up-due" type="datetime-local" required className={inputClass} value={form.data.due_at} onChange={(e) => form.setData('due_at', e.target.value)} /><InputError message={form.errors.due_at} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-reminder" value="Reminder (optional)" className={labelClass} />
                                    <TextInput id="follow-up-reminder" type="datetime-local" className={inputClass} value={form.data.reminder_at} max={form.data.due_at || undefined} onChange={(e) => form.setData('reminder_at', e.target.value)} /><InputError message={form.errors.reminder_at} />
                                </div>
                                <div className="space-y-2"><InputLabel htmlFor="follow-up-priority" value="Priority" className={labelClass} />
                                    <select id="follow-up-priority" className={inputClass} value={form.data.priority} onChange={(e) => form.setData('priority', e.target.value)}>{['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}</select><InputError message={form.errors.priority} />
                                </div>
                            </section>
                            <p className="text-xs text-muted-foreground">Dates and times use the application timezone: {timezone}.</p>
                            <div className="space-y-2"><InputLabel htmlFor="follow-up-description" value="Notes (optional)" className={labelClass} />
                                <textarea id="follow-up-description" className={`${inputClass} min-h-32 py-3`} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} /><InputError message={form.errors.description} />
                            </div>
                        </form>}
                    </CardContent>
                </Card>
            </div></div>
        </AuthenticatedLayout>
    );
}
