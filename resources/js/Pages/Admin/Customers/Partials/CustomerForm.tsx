import ContactRoleSelect from '@/Components/ContactRoleSelect';
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
import { Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useState } from 'react';
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

export default function CustomerForm({
    action,
    method = 'post',
    submitLabel,
    title,
    description,
    customer,
    contactRoles,
}: CustomerFormProps) {
    const { data, setData, errors, processing, post, patch } =
        useForm<CustomerFormData>(customerToFormData(customer));
    const [availabilityErrors, setAvailabilityErrors] = useState<
        Record<string, string>
    >({});

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        if (method === 'patch') {
            patch(action);
            return;
        }

        post(action);
    };

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClassName = 'text-emerald-700 dark:text-emerald-300';
    const formErrors = errors as Record<string, string | undefined>;

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
                <form onSubmit={submit} className="flex flex-col gap-6">
                    <section className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="customer-name"
                                value="Customer name"
                                className={labelClassName}
                            />
                            <TextInput
                                id="customer-name"
                                value={data.name}
                                className={inputClassName}
                                isFocused
                                onChange={(event) =>
                                    setData('name', event.target.value)
                                }
                            />
                            <InputError message={errors.name} />
                        </div>

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

                    <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link href={route('admin.customers.index')}>
                                Cancel
                            </Link>
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {submitLabel}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

