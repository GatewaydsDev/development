import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const fieldClassName =
    'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

type ContactRecord = {
    id: number;
    name?: string | null;
};

type QuickContractorContactDialogProps = {
    show: boolean;
    contractorId: string;
    partyLabel: string;
    onClose: () => void;
    onCreated: (contactId: string) => void;
};

export default function QuickContractorContactDialog({
    show,
    contractorId,
    partyLabel,
    onClose,
    onCreated,
}: QuickContractorContactDialogProps) {
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const close = () => {
        if (saving) {
            return;
        }

        setName('');
        setTitle('');
        setEmail('');
        setPhone('');
        setErrors({});
        onClose();
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const contactName = name.trim();

        if (contactName === '') {
            setErrors({ name: 'Enter the contact name.' });

            return;
        }

        setSaving(true);
        setErrors({});

        router.post(
            route('admin.contractors.contacts.store', contractorId),
            {
                name: contactName,
                title: title.trim(),
                email: email.trim(),
                phone_number: phone.trim(),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => {
                    const contractors =
                        (
                            page.props.options as
                                | {
                                      contractors?: Array<{
                                          id: number;
                                          contacts?: ContactRecord[];
                                      }>;
                                  }
                                | undefined
                        )?.contractors ?? [];
                    const contacts =
                        contractors.find(
                            (contractor) => String(contractor.id) === contractorId,
                        )?.contacts ?? [];
                    const created = [...contacts]
                        .reverse()
                        .find(
                            (contact) =>
                                (contact.name ?? '').toLowerCase() ===
                                contactName.toLowerCase(),
                        );

                    setName('');
                    setTitle('');
                    setEmail('');
                    setPhone('');
                    setErrors({});
                    onClose();

                    if (created) {
                        onCreated(String(created.id));
                    }
                },
                onError: (responseErrors) => {
                    setErrors(
                        Object.fromEntries(
                            Object.entries(responseErrors).map(([key, value]) => [
                                key,
                                String(value),
                            ]),
                        ),
                    );
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <Modal show={show} maxWidth="lg" onClose={close}>
            <form onSubmit={submit} className="flex flex-col gap-5 p-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Add contact
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Add a person for this {partyLabel} without leaving the
                        quotation.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="quick-contact-name" value="Name" />
                        <TextInput
                            id="quick-contact-name"
                            value={name}
                            className={fieldClassName}
                            onChange={(event) => {
                                setName(event.target.value);
                                setErrors((current) => ({ ...current, name: '' }));
                            }}
                        />
                        <InputError message={errors.name} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="quick-contact-title" value="Title" />
                        <TextInput
                            id="quick-contact-title"
                            value={title}
                            className={fieldClassName}
                            placeholder="Project manager"
                            onChange={(event) => setTitle(event.target.value)}
                        />
                        <InputError message={errors.title} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="quick-contact-email" value="Email" />
                        <TextInput
                            id="quick-contact-email"
                            type="email"
                            value={email}
                            className={fieldClassName}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                setErrors((current) => ({ ...current, email: '' }));
                            }}
                        />
                        <InputError message={errors.email} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="quick-contact-phone" value="Phone" />
                        <TextInput
                            id="quick-contact-phone"
                            value={phone}
                            className={fieldClassName}
                            onChange={(event) => setPhone(event.target.value)}
                        />
                        <InputError message={errors.phone_number} />
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={close}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save contact'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
