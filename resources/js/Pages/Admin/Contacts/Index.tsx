import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Contact } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Head, Link, router } from '@inertiajs/react';
import {
    PencilIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
    UsersIcon,
    XIcon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type ContactsPaginator = {
    data: Contact[];
    links: PaginationLink[];
    total: number;
    from: number | null;
    to: number | null;
};

type IndexProps = {
    filters: {
        search?: string;
    };
    contacts: ContactsPaginator;
};

const contactSchema = z.object({
    name: z.string().trim().min(1, 'Name is required.').max(255),
    email: z
        .string()
        .trim()
        .min(1, 'Email is required.')
        .email('Enter a valid email address.')
        .max(255),
    phone_number: z.string().trim().max(50),
    company: z.string().trim().max(255),
    title: z.string().trim().max(255),
    notes: z.string().trim().max(1000, 'Notes must be 1000 characters or less.'),
    is_active: z.boolean(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const defaultValues: ContactFormValues = {
    name: '',
    email: '',
    phone_number: '',
    company: '',
    title: '',
    notes: '',
    is_active: true,
};

export default function Index({ filters, contacts }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const {
        control,
        register,
        handleSubmit,
        reset,
        setError,
        clearErrors,
        formState: { errors },
    } = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues,
        mode: 'onChange',
    });

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.contacts.index'),
            { search },
            { preserveState: true, replace: true },
        );
    };

    const openCreate = () => {
        setEditingId(null);
        clearErrors();
        reset(defaultValues);
        setFormOpen(true);
    };

    const openEdit = (contact: Contact) => {
        setEditingId(contact.id);
        clearErrors();
        reset({
            name: contact.name ?? '',
            email: contact.email ?? '',
            phone_number: contact.phone_number ?? '',
            company: contact.company ?? '',
            title: contact.title ?? '',
            notes: contact.notes ?? '',
            is_active: contact.is_active ?? true,
        });
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingId(null);
        clearErrors();
        reset(defaultValues);
    };

    const submit = (values: ContactFormValues) => {
        const options = {
            preserveScroll: true,
            onBefore: () => setProcessing(true),
            onError: (serverErrors: Record<string, string>) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    setError(field as keyof ContactFormValues, {
                        type: 'server',
                        message: String(message),
                    });
                });
            },
            onSuccess: () => closeForm(),
            onFinish: () => setProcessing(false),
        };

        if (editingId) {
            router.patch(
                route('admin.contacts.update', editingId),
                values,
                options,
            );
            return;
        }

        router.post(route('admin.contacts.store'), values, options);
    };

    const destroyContact = (contact: Contact) => {
        if (!window.confirm(`Delete contact ${contact.name}?`)) {
            return;
        }

        router.delete(route('admin.contacts.destroy', contact.id), {
            preserveScroll: true,
        });
    };

    const paginationLabel = (label: string) =>
        label
            .replace('&laquo; Previous', 'Previous')
            .replace('Next &raquo;', 'Next');

    const inputClassName =
        'mt-1 block w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Contacts</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Contacts
                        </h2>
                    </div>

                    <Button onClick={openCreate}>
                        <PlusIcon className="size-4" />
                        Add contact
                    </Button>
                </div>
            }
        >
            <Head title="Contacts" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    {formOpen && (
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>
                                    {editingId
                                        ? 'Edit contact'
                                        : 'New contact'}
                                </CardTitle>
                                <CardDescription>
                                    Contacts can be selected as email recipients
                                    on a contact request.
                                </CardDescription>
                                <CardAction>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={closeForm}
                                        aria-label="Close form"
                                    >
                                        <XIcon className="size-4" />
                                    </Button>
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <form
                                    onSubmit={handleSubmit(submit)}
                                    className="grid gap-4 pr-14 sm:pr-16 md:grid-cols-2"
                                    noValidate
                                >
                                    <FormActionFab
                                        cancelHref={route(
                                            'admin.contacts.index',
                                        )}
                                        saveLabel={
                                            editingId
                                                ? 'Save changes'
                                                : 'Create contact'
                                        }
                                        disabled={processing}
                                    />
                                    <div>
                                        <InputLabel
                                            htmlFor="name"
                                            value="Name"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="name"
                                            className={inputClassName}
                                            aria-invalid={Boolean(errors.name)}
                                            {...register('name')}
                                        />
                                        <InputError
                                            message={errors.name?.message}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <InputLabel
                                            htmlFor="email"
                                            value="Email"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="email"
                                            type="email"
                                            className={inputClassName}
                                            aria-invalid={Boolean(errors.email)}
                                            {...register('email')}
                                        />
                                        <InputError
                                            message={errors.email?.message}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <InputLabel
                                            htmlFor="phone_number"
                                            value="Phone (optional)"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <Controller
                                            name="phone_number"
                                            control={control}
                                            render={({ field }) => (
                                                <PhoneInput
                                                    id="phone_number"
                                                    className={inputClassName}
                                                    placeholder="(555) 555-5555"
                                                    aria-invalid={Boolean(
                                                        errors.phone_number,
                                                    )}
                                                    value={field.value}
                                                    onBlur={field.onBlur}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                />
                                            )}
                                        />
                                        <InputError
                                            message={
                                                errors.phone_number?.message
                                            }
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <InputLabel
                                            htmlFor="company"
                                            value="Company (optional)"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="company"
                                            className={inputClassName}
                                            aria-invalid={Boolean(
                                                errors.company,
                                            )}
                                            {...register('company')}
                                        />
                                        <InputError
                                            message={errors.company?.message}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <InputLabel
                                            htmlFor="title"
                                            value="Title (optional)"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="title"
                                            className={inputClassName}
                                            aria-invalid={Boolean(errors.title)}
                                            {...register('title')}
                                        />
                                        <InputError
                                            message={errors.title?.message}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 md:pt-7">
                                        <input
                                            id="is_active"
                                            type="checkbox"
                                            className="size-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            {...register('is_active')}
                                        />
                                        <InputLabel
                                            htmlFor="is_active"
                                            value="Active"
                                            className="!mb-0 text-emerald-700 dark:text-emerald-300"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <InputLabel
                                            htmlFor="notes"
                                            value="Notes (optional)"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <textarea
                                            id="notes"
                                            rows={3}
                                            className="mt-1 block w-full rounded-md border-border bg-background text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                            aria-invalid={Boolean(errors.notes)}
                                            {...register('notes')}
                                        />
                                        <InputError
                                            message={errors.notes?.message}
                                            className="mt-1"
                                        />
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Contact directory</CardTitle>
                                <CardDescription>
                                    Reusable contacts you can email from any
                                    contact request.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={submitSearch}
                                className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                            >
                                <div className="relative">
                                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search contacts"
                                        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
                                    />
                                </div>
                                <Button type="submit" variant="outline">
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.4fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                                    <div>Contact</div>
                                    <div>Email</div>
                                    <div>Phone</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {contacts.data.length > 0 ? (
                                    contacts.data.map((contact) => (
                                        <div
                                            key={contact.id}
                                            className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center lg:gap-4"
                                        >
                                            <div>
                                                <p className="flex items-center gap-2 font-medium text-foreground">
                                                    {contact.name}
                                                    {!contact.is_active && (
                                                        <Badge variant="secondary">
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {[
                                                        contact.title,
                                                        contact.company,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') ||
                                                        'No company'}
                                                </p>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {contact.email}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {contact.phone_number ||
                                                    'Not added'}
                                            </div>
                                            <div className="flex flex-wrap gap-2 md:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        openEdit(contact)
                                                    }
                                                >
                                                    <PencilIcon className="size-4" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() =>
                                                        destroyContact(contact)
                                                    }
                                                >
                                                    <Trash2Icon className="size-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <UsersIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No contacts found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Add your first contact to start
                                            sending emails.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {contacts.from ?? 0} to{' '}
                                    {contacts.to ?? 0} of {contacts.total}{' '}
                                    contacts
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {contacts.links.length > 3 &&
                                        contacts.links.map((link, index) =>
                                            link.url ? (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant={
                                                        link.active
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link href={link.url}>
                                                        {paginationLabel(
                                                            link.label,
                                                        )}
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                >
                                                    {paginationLabel(link.label)}
                                                </Button>
                                            ),
                                        )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
