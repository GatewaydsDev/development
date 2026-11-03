import InputError from '@/Components/InputError';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/Components/ui/dialog';
import { PageProps } from '@/types';
import { Link, useForm, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';

export type FollowUpContact = { id: number; first_name: string; last_name: string | null };
export type FollowUpUser = { id: number; name: string };

export default function CreateFollowUpButton({ contacts, users, contactId, timezone }: {
    contacts: FollowUpContact[];
    users: FollowUpUser[];
    contactId?: number;
    timezone?: string;
}) {
    const { auth } = usePage<PageProps>().props;
    const [open, setOpen] = useState(false);
    const form = useForm({
        contact_id: contactId ? String(contactId) : '',
        title: '',
        description: '',
        assigned_user_id: String(auth.user.id),
        due_at: '',
        reminder_at: '',
        priority: 'normal',
    });
    if (!auth.can.manageFollowUps) return null;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('contact-directory.follow-ups.store'), {
            preserveScroll: true,
            onSuccess: () => { form.reset(); setOpen(false); },
        });
    };
    const selectClass = 'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground';

    return (
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); form.clearErrors(); }}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 size-4" />New follow-up</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New follow-up</DialogTitle>
                    <DialogDescription>Schedule a contact-related task. Assign it to yourself to see it in My Day.</DialogDescription>
                </DialogHeader>
                {contacts.length === 0 ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">{auth.can.manageContactsDirectory
                            ? 'Add a contact first, then schedule a follow-up from their contact page.'
                            : 'Ask an administrator to add a contact, then return here to schedule a follow-up.'}</p>
                        <Button asChild><Link href={route('contact-directory.contacts.index')}>Go to Contacts</Link></Button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="follow-up-contact" className="text-sm font-medium">Contact</label>
                            <select id="follow-up-contact" required className={selectClass} value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)}>
                                <option value="">Choose a contact</option>
                                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</option>)}
                            </select>
                            <InputError message={form.errors.contact_id} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="follow-up-title" className="text-sm font-medium">Task title</label>
                            <TextInput id="follow-up-title" className="block w-full" required maxLength={255} placeholder="Call supplier about revised pricing" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} />
                            <InputError message={form.errors.title} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label htmlFor="follow-up-due" className="text-sm font-medium">Due date and time</label>
                                <TextInput id="follow-up-due" type="datetime-local" required className="block w-full min-w-0" value={form.data.due_at} onChange={(e) => form.setData('due_at', e.target.value)} />
                                <InputError message={form.errors.due_at} />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="follow-up-reminder" className="text-sm font-medium">Reminder (optional)</label>
                                <TextInput id="follow-up-reminder" type="datetime-local" className="block w-full min-w-0" value={form.data.reminder_at} max={form.data.due_at || undefined} onChange={(e) => form.setData('reminder_at', e.target.value)} />
                                <InputError message={form.errors.reminder_at} />
                            </div>
                        </div>
                        {timezone && <p className="text-xs text-muted-foreground">Dates and times use the application timezone: {timezone}.</p>}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label htmlFor="follow-up-assignee" className="text-sm font-medium">Assigned to</label>
                                <select id="follow-up-assignee" required className={selectClass} value={form.data.assigned_user_id} onChange={(e) => form.setData('assigned_user_id', e.target.value)}>
                                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.id === auth.user.id ? ' (me)' : ''}</option>)}
                                </select>
                                <InputError message={form.errors.assigned_user_id} />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="follow-up-priority" className="text-sm font-medium">Priority</label>
                                <select id="follow-up-priority" className={selectClass} value={form.data.priority} onChange={(e) => form.setData('priority', e.target.value)}>
                                    {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}
                                </select>
                                <InputError message={form.errors.priority} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="follow-up-description" className="text-sm font-medium">Notes (optional)</label>
                            <textarea id="follow-up-description" className={`${selectClass} h-24 py-2`} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                            <InputError message={form.errors.description} />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.processing}>{form.processing ? 'Saving…' : 'Create follow-up'}</Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
