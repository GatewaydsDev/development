import ContactRoleSelect from '@/Components/ContactRoleSelect';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from '@inertiajs/react';
import { FormEventHandler, useEffect, useState } from 'react';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useForm,
} from 'react-hook-form';
import { z } from 'zod';
import {
    blankContact,
    customerToFormData,
    type CustomerContactRole,
    type CustomerContactFormData,
    type CustomerFormData,
    type CustomerPayload,
} from '../types';
import { PlusIcon, Trash2Icon } from 'lucide-react';

type CustomerFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    title: string;
    description: string;
    customer?: CustomerPayload;
    contactRoles: CustomerContactRole[];
};

const optionalEmailSchema = z
    .string()
    .trim()
    .max(255, 'Email must be 255 characters or less.')
    .refine(
        (value) =>
            value === '' ||
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        'Enter a valid email address.',
    );

const customerContactSchema = z.object({
    name: z.string().trim().max(255, 'Contact name must be 255 characters or less.'),
    title: z.string().trim().max(255, 'Title must be 255 characters or less.'),
    email: optionalEmailSchema,
    phone_number: z.string().trim().max(50, 'Phone number must be 50 characters or less.'),
    notes: z.string().trim().max(1000, 'Notes must be 1,000 characters or less.'),
    is_primary: z.boolean(),
    customer_contact_role_id: z.string(),
});

const customerSchema = z
    .object({
        company_name: z
            .string()
            .trim()
            .min(1, 'Enter the company name.')
            .max(255, 'Company name must be 255 characters or less.'),
        email: optionalEmailSchema,
        phone_number: z
            .string()
            .trim()
            .max(50, 'Phone number must be 50 characters or less.'),
        contacts: z.array(customerContactSchema).min(1, 'Add at least one contact.'),
        address_line_1: z.string().trim().max(255),
        address_line_2: z.string().trim().max(255),
        city: z.string().trim().max(255),
        state: z.string().trim().max(255),
        postal_code: z.string().trim().max(50),
        country: z.string().trim().max(255),
    })
    .superRefine((values, context) => {
        const seenEmails = new Map<string, number>();
        const seenPhones = new Map<string, number>();

        values.contacts.forEach((contact, index) => {
            const email = contact.email.trim().toLowerCase();
            const phoneDigits = contact.phone_number.replace(/\D/g, '');

            if (email) {
                const firstIndex = seenEmails.get(email);

                if (firstIndex !== undefined) {
                    [firstIndex, index].forEach((contactIndex) => {
                        context.addIssue({
                            code: 'custom',
                            path: ['contacts', contactIndex, 'email'],
                            message: 'This email is already used in this customer form.',
                        });
                    });
                } else {
                    seenEmails.set(email, index);
                }
            }

            if (phoneDigits) {
                const firstIndex = seenPhones.get(phoneDigits);

                if (firstIndex !== undefined) {
                    [firstIndex, index].forEach((contactIndex) => {
                        context.addIssue({
                            code: 'custom',
                            path: ['contacts', contactIndex, 'phone_number'],
                            message: 'This phone number is already used in this customer form.',
                        });
                    });
                } else {
                    seenPhones.set(phoneDigits, index);
                }
            }
        });
    });

function errorMessage(
    errors: FieldErrors<CustomerFormData>,
    path: string,
): string | undefined {
    const fieldError = path.split('.').reduce<unknown>((carry, segment) => {
        if (!carry || typeof carry !== 'object') {
            return undefined;
        }

        return (carry as Record<string, unknown>)[segment];
    }, errors);

    return typeof fieldError === 'object' &&
        fieldError !== null &&
        'message' in fieldError
        ? String((fieldError as { message?: string }).message)
        : undefined;
}

export default function CustomerForm({
    action,
    method = 'post',
    submitLabel,
    title,
    description,
    customer,
    contactRoles,
}: CustomerFormProps) {
    const [processing, setProcessing] = useState(false);
    const [availabilityErrors, setAvailabilityErrors] = useState<
        Record<string, string>
    >({});
    const {
        handleSubmit,
        setError,
        setValue,
        watch,
        formState: { errors: validationErrors },
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
        defaultValues: customerToFormData(customer),
        mode: 'onChange',
    });
    const data = watch();

    const submit = handleSubmit((values) => {
        const submitOptions = {
            onBefore: () => setProcessing(true),
            onError: (serverErrors: Record<string, string>) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    setError(field as FieldPath<CustomerFormData>, {
                        type: 'server',
                        message: String(message),
                    });
                });
            },
            onFinish: () => setProcessing(false),
        };

        if (method === 'patch') {
            router.patch(action, values, submitOptions);
            return;
        }

        router.post(action, values, submitOptions);
    }) as FormEventHandler;

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClassName = 'text-emerald-700 dark:text-emerald-300';
    const errors = new Proxy({} as Record<string, string | undefined>, {
        get: (_target, property) =>
            errorMessage(validationErrors, String(property)),
    });
    const formErrors = errors;

    const setData = <Field extends FieldPath<CustomerFormData>>(
        field: Field,
        value: PathValue<CustomerFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => {
            const nextErrors: Record<string, string> = {};
            const seenEmails = new Map<string, number>();
            const seenPhones = new Map<string, number>();
            const remoteChecks: Promise<void>[] = [];

            data.contacts.forEach((contact, index) => {
                const email = contact.email.trim().toLowerCase();
                const phoneDigits = contact.phone_number.replace(/\D/g, '');

                if (email) {
                    const firstIndex = seenEmails.get(email);

                    if (firstIndex !== undefined) {
                        nextErrors[`contacts.${index}.email`] =
                            'This email is already used in this customer form.';
                        nextErrors[`contacts.${firstIndex}.email`] =
                            'This email is already used in this customer form.';
                    } else {
                        seenEmails.set(email, index);
                        remoteChecks.push(
                            checkAvailability(
                                'email',
                                contact.email,
                                index,
                                nextErrors,
                                controller.signal,
                            ),
                        );
                    }
                }

                if (phoneDigits) {
                    const firstIndex = seenPhones.get(phoneDigits);

                    if (firstIndex !== undefined) {
                        nextErrors[`contacts.${index}.phone_number`] =
                            'This phone number is already used in this customer form.';
                        nextErrors[`contacts.${firstIndex}.phone_number`] =
                            'This phone number is already used in this customer form.';
                    } else {
                        seenPhones.set(phoneDigits, index);
                        remoteChecks.push(
                            checkAvailability(
                                'phone_number',
                                contact.phone_number,
                                index,
                                nextErrors,
                                controller.signal,
                            ),
                        );
                    }
                }
            });

            Promise.all(remoteChecks)
                .then(() => setAvailabilityErrors({ ...nextErrors }))
                .catch((error) => {
                    if (error.name !== 'AbortError') {
                        setAvailabilityErrors({ ...nextErrors });
                    }
                });
        }, 450);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [data.contacts, customer?.id]);

    const checkAvailability = async (
        field: 'email' | 'phone_number',
        value: string,
        index: number,
        nextErrors: Record<string, string>,
        signal: AbortSignal,
    ) => {
        const params = new URLSearchParams({
            field,
            value,
        });

        if (customer?.id) {
            params.set('customer_id', String(customer.id));
        }

        const response = await fetch(
            `${route('admin.customer-contacts.availability')}?${params.toString()}`,
            {
                signal,
                headers: {
                    Accept: 'application/json',
                },
            },
        );

        if (!response.ok) {
            return;
        }

        const result = (await response.json()) as { available: boolean };

        if (!result.available) {
            nextErrors[`contacts.${index}.${field}`] =
                field === 'email'
                    ? 'This email is already used by another customer contact.'
                    : 'This phone number is already used by another customer contact.';
        }
    };

    const updateContact = (
        index: number,
        field: keyof CustomerContactFormData,
        value: string | boolean,
    ) => {
        updateContactFields(index, {
            [field]: value,
        });
    };

    const updateContactFields = (
        index: number,
        fields: Partial<CustomerContactFormData>,
    ) => {
        const contacts = [...data.contacts];
        contacts[index] = {
            ...contacts[index],
            ...fields,
        };

        setData('contacts', contacts);
    };

    const addContact = () => {
        setData('contacts', [...data.contacts, blankContact()]);
    };

    const removeContact = (index: number) => {
        const contacts = data.contacts.filter(
            (_contact, contactIndex) => contactIndex !== index,
        );

        setData(
            'contacts',
            contacts.length > 0 ? contacts : [blankContact(true)],
        );
    };

    const makePrimary = (index: number) => {
        setData(
            'contacts',
            data.contacts.map((contact, contactIndex) => ({
                ...contact,
                is_primary: contactIndex === index,
            })),
        );
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="flex min-w-0 flex-col gap-6 pr-16 sm:pr-20">
                    <FormActionFab
                        cancelHref={route('admin.customers.index')}
                        saveLabel={submitLabel}
                        disabled={processing}
                    />
                    <section className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="company-name"
                                value="Company name"
                                className={labelClassName}
                            />
                            <TextInput
                                id="company-name"
                                value={data.company_name}
                                className={inputClassName}
                                isFocused
                                onChange={(event) =>
                                    setData('company_name', event.target.value)
                                }
                            />
                            <InputError message={errors.company_name} />
                        </div>
                    </section>

                    <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-foreground">
                                    Contact information
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Add the people, phone numbers, and email
                                    addresses used to contact this customer.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={addContact}
                            >
                                <PlusIcon className="size-4" />
                                Add contact
                            </Button>
                        </div>

                        {data.contacts.map((contact, index) => (
                            <div
                                key={index}
                                className="flex flex-col gap-5 rounded-lg border border-emerald-200 bg-background p-4 shadow-sm dark:border-emerald-900/70"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        <input
                                            id={`contact-primary-${index}`}
                                            type="radio"
                                            checked={contact.is_primary}
                                            onChange={() => makePrimary(index)}
                                            className="border-border text-primary focus:ring-ring"
                                        />
                                        <InputLabel
                                            htmlFor={`contact-primary-${index}`}
                                            value="Primary contact"
                                            className={labelClassName}
                                        />
                                    </div>
                                    {data.contacts.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                removeContact(index)
                                            }
                                        >
                                            <Trash2Icon className="size-4" />
                                            Remove
                                        </Button>
                                    )}
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`contact-name-${index}`}
                                            value="Contact name"
                                            className={labelClassName}
                                        />
                                        <TextInput
                                            id={`contact-name-${index}`}
                                            value={contact.name}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                updateContact(
                                                    index,
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                formErrors[
                                                    `contacts.${index}.name`
                                                ]
                                            }
                                        />
                                    </div>

                                    <ContactRoleSelect
                                        id={`contact-title-${index}`}
                                        value={
                                            contact.customer_contact_role_id
                                        }
                                        roles={contactRoles}
                                        error={
                                            formErrors[
                                                `contacts.${index}.customer_contact_role_id`
                                            ] ||
                                            formErrors[
                                                `contacts.${index}.title`
                                            ]
                                        }
                                        onChange={(roleId, roleName) => {
                                            updateContactFields(index, {
                                                customer_contact_role_id: roleId,
                                                title: roleName,
                                            });
                                        }}
                                    />

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`contact-email-${index}`}
                                            value="Email"
                                            className={labelClassName}
                                        />
                                        <TextInput
                                            id={`contact-email-${index}`}
                                            type="email"
                                            value={contact.email}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                updateContact(
                                                    index,
                                                    'email',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                formErrors[
                                                    `contacts.${index}.email`
                                                ] ||
                                                availabilityErrors[
                                                    `contacts.${index}.email`
                                                ]
                                            }
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`contact-phone-${index}`}
                                            value="Phone number"
                                            className={labelClassName}
                                        />
                                        <PhoneInput
                                            id={`contact-phone-${index}`}
                                            value={contact.phone_number}
                                            className={inputClassName}
                                            onValueChange={(value) =>
                                                updateContact(
                                                    index,
                                                    'phone_number',
                                                    value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                formErrors[
                                                    `contacts.${index}.phone_number`
                                                ] ||
                                                availabilityErrors[
                                                    `contacts.${index}.phone_number`
                                                ]
                                            }
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 md:col-span-2">
                                        <InputLabel
                                            htmlFor={`contact-notes-${index}`}
                                            value="Contact notes"
                                            className={labelClassName}
                                        />
                                        <textarea
                                            id={`contact-notes-${index}`}
                                            value={contact.notes}
                                            className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-3 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                            onChange={(event) =>
                                                updateContact(
                                                    index,
                                                    'notes',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                formErrors[
                                                    `contacts.${index}.notes`
                                                ]
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>

                    <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="address-line-1"
                                value="Address line 1"
                                className={labelClassName}
                            />
                            <TextInput
                                id="address-line-1"
                                value={data.address_line_1}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData(
                                        'address_line_1',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError message={errors.address_line_1} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="address-line-2"
                                value="Address line 2"
                                className={labelClassName}
                            />
                            <TextInput
                                id="address-line-2"
                                value={data.address_line_2}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData(
                                        'address_line_2',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError message={errors.address_line_2} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="city"
                                value="City"
                                className={labelClassName}
                            />
                            <TextInput
                                id="city"
                                value={data.city}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData('city', event.target.value)
                                }
                            />
                            <InputError message={errors.city} />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-3">
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="state"
                                    value="State"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="state"
                                    value={data.state}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData('state', event.target.value)
                                    }
                                />
                                <InputError message={errors.state} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="postal-code"
                                    value="Postal code"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="postal-code"
                                    value={data.postal_code}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData(
                                            'postal_code',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.postal_code} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="country"
                                    value="Country"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="country"
                                    value={data.country}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData('country', event.target.value)
                                    }
                                />
                                <InputError message={errors.country} />
                            </div>
                        </div>
                    </section>

                </form>
            </CardContent>
        </Card>
    );
}

