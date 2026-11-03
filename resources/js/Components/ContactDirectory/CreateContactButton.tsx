import InputError from '@/Components/InputError';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/Components/ui/dialog';
import { PageProps } from '@/types';
import { useForm, usePage } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';

export default function CreateContactButton() {
    const { auth } = usePage<PageProps>().props;
    const [open, setOpen] = useState(false);
    const form = useForm({
        first_name: '', last_name: '', contact_type: 'supplier', owner_id: auth.user.id,
        phone_numbers: [{ phone_number: '', is_primary: true }],
        email_addresses: [{ email_address: '', is_primary: true }],
    });
    if (!auth.can.manageContactsDirectory) return null;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            phone_numbers: data.phone_numbers.filter((phone) => phone.phone_number.trim()),
            email_addresses: data.email_addresses.filter((email) => email.email_address.trim()),
        }));
        form.post(route('contact-directory.contacts.store'), {
            onSuccess: () => { form.reset(); setOpen(false); },
        });
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline"><UserPlus className="mr-2 size-4" />New contact</Button></DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New contact</DialogTitle>
                    <DialogDescription>Add the person you need to follow up with. You can schedule their first task after saving.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label htmlFor="new-contact-first" className="text-sm font-medium">First name</label>
                            <TextInput id="new-contact-first" required maxLength={255} className="block w-full" value={form.data.first_name} onChange={(e) => form.setData('first_name', e.target.value)} />
                            <InputError message={form.errors.first_name} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="new-contact-last" className="text-sm font-medium">Last name (optional)</label>
                            <TextInput id="new-contact-last" maxLength={255} className="block w-full" value={form.data.last_name} onChange={(e) => form.setData('last_name', e.target.value)} />
                            <InputError message={form.errors.last_name} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="new-contact-type" className="text-sm font-medium">Contact type</label>
                        <select id="new-contact-type" className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground" value={form.data.contact_type} onChange={(e) => form.setData('contact_type', e.target.value)}>
                            {['supplier', 'customer', 'subcontractor', 'other'].map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                        </select>
                        <InputError message={form.errors.contact_type} />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="new-contact-email" className="text-sm font-medium">Email (optional)</label>
                        <TextInput id="new-contact-email" type="email" className="block w-full" value={form.data.email_addresses[0].email_address} onChange={(e) => form.setData('email_addresses', [{ email_address: e.target.value, is_primary: true }])} />
                        <InputError message={form.errors['email_addresses.0.email_address']} />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="new-contact-phone" className="text-sm font-medium">Phone (optional)</label>
                        <TextInput id="new-contact-phone" type="tel" className="block w-full" value={form.data.phone_numbers[0].phone_number} onChange={(e) => form.setData('phone_numbers', [{ phone_number: e.target.value, is_primary: true }])} />
                        <InputError message={form.errors['phone_numbers.0.phone_number']} />
                    </div>
                    <InputError message={form.errors.owner_id} />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={form.processing}>{form.processing ? 'Saving…' : 'Create contact'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
