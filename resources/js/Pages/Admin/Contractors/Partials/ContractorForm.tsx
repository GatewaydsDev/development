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
import { router } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useForm,
} from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
    blankContact,
    contractorToFormData,
    phoneTypeLabel,
    type ContractorFormData,
    type ContractorContactFormData,
    type ContractorOptions,
    type ContractorPayload,
} from '../types';

type ContractorFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    title: string;
    description: string;
    contractor?: ContractorPayload;
    options: ContractorOptions;
};

const optionalEmailSchema = z
    .string()
    .trim()
    .max(255, 'Email must be 255 characters or less.')
    .refine(
        (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        'Enter a valid email address.',
    );

function contractorSchema(phoneTypes: string[]) {
    const contactSchema = z
        .object({
            name: z
                .string()
                .trim()
                .max(255, 'Contact name must be 255 characters or less.'),
            title: z
                .string()
                .trim()
                .max(255, 'Title must be 255 characters or less.'),
            email: optionalEmailSchema,
            phone_number: z
                .string()
                .trim()
                .max(50, 'Phone number must be 50 characters or less.'),
            phone_type: z.string(),
            notes: z
                .string()
                .trim()
                .max(1000, 'Notes must be 1,000 characters or less.'),
            is_primary: z.boolean(),
        })
        .superRefine((contact, context) => {
            const phoneDigits = contact.phone_number.replace(/\D/g, '');

            if (phoneDigits && !contact.phone_type) {
                context.addIssue({
                    code: 'custom',
                    path: ['phone_type'],
                    message: 'Select a phone type.',
                });
            }

            if (
                contact.phone_type &&
                !phoneTypes.includes(contact.phone_type)
            ) {
                context.addIssue({
                    code: 'custom',
                    path: ['phone_type'],
                    message: 'Select a valid phone type.',
                });
            }
        });

    return z
        .object({
            name: z
                .string()
                .trim()
                .min(1, 'Enter the contractor name.')
                .max(255),
            website: z.string().trim().max(255),
            address_line_1: z.string().trim().max(255),
            address_line_2: z.string().trim().max(255),
            city: z.string().trim().max(255),
            state: z.string().trim().max(255),
            postal_code: z.string().trim().max(50),
            country: z.string().trim().max(255),
            notes: z
                .string()
                .trim()
                .max(5000, 'Notes must be 5,000 characters or less.'),
            contacts: z.array(contactSchema),
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
                                message:
                                    'This email is already used in this contractor form.',
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
                                message:
                                    'This phone number is already used in this contractor form.',
                            });
                        });
                    } else {
                        seenPhones.set(phoneDigits, index);
                    }
                }
            });
        });
}

function errorMessage(
    errors: FieldErrors<ContractorFormData>,
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

export default function ContractorForm({
    action,
    method = 'post',
    submitLabel,
    title,
    description,
    contractor,
    options,
}: ContractorFormProps) {
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
    } = useForm<ContractorFormData>({
        resolver: zodResolver(contractorSchema(options.phoneTypes)),
        defaultValues: contractorToFormData(contractor),
        mode: 'onChange',
    });
    const data = watch();

    const submit = handleSubmit((values) => {
        const submitOptions = {
            onBefore: () => setProcessing(true),
            onError: (serverErrors: Record<string, string>) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    setError(field as FieldPath<ContractorFormData>, {
                        type: 'server',
                        message: String(message),
                    });
                });
                toast.error(
                    Object.values(serverErrors)[0] ||
                        'The contractor could not be saved. Check the form and try again.',
                );
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

    const setData = <Field extends FieldPath<ContractorFormData>>(
        field: Field,
        value: PathValue<ContractorFormData, Field>,
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
                            'This email is already used in this contractor form.';
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
                            'This phone number is already used in this contractor form.';
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
    }, [data.contacts, contractor?.id]);

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

        if (contractor?.id) {
            params.set('contractor_id', String(contractor.id));
        }

        const response = await fetch(
            `${route('admin.contractor-contacts.availability')}?${params.toString()}`,
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
                    ? 'This email is already used by another contractor contact.'
                    : 'This phone number is already used by another contractor contact.';
        }
    };

    const updateContactFields = (
        index: number,
        fields: Partial<ContractorContactFormData>,
    ) => {
        const contacts = [...data.contacts];
        contacts[index] = {
            ...contacts[index],
            ...fields,
        };

        setData('contacts', contacts);
    };

    const updateContact = (
        index: number,
        field: keyof ContractorContactFormData,
        value: string | boolean,
    ) => {
        updateContactFields(index, {
            [field]: value,
        });
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
                <form
                    onSubmit={submit}
                    className="flex flex-col gap-6 pr-14 sm:pr-16"
                >
                    <FormActionFab
                        cancelHref={route('admin.contractors.index')}
                        saveLabel={submitLabel}
                        disabled={processing}
                    />

                    <section className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="contractor-name"
                                value="Company name"
                                className={labelClassName}
                            />
                            <TextInput
                                id="contractor-name"
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
                                htmlFor="contractor-website"
                                value="Website"
                                className={labelClassName}
                            />
                            <TextInput
                                id="contractor-website"
                                value={data.website}
                                className={inputClassName}
                                placeholder="https://"
                                onChange={(event) =>
                                    setData('website', event.target.value)
                                }
                            />
                            <InputError message={errors.website} />
                        </div>
                    </section>

                    <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-foreground">
                                    Contact information
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Add one or more people with a phone number,
                                    phone type, and email address.
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
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`contact-title-${index}`}
                                            value="Title"
                                            className={labelClassName}
                                        />
                                        <TextInput
                                            id={`contact-title-${index}`}
                                            value={contact.title}
                                            className={inputClassName}
                                            placeholder="Project manager, estimator..."
                                            onChange={(event) =>
                                                updateContact(
                                                    index,
                                                    'title',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                formErrors[
                                                    `contacts.${index}.title`
                                                ]
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`contact-email-${index}`}
                                            value="Email address"
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
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`contact-phone-type-${index}`}
                                            value="Phone type"
                                            className={labelClassName}
                                        />
                                        <select
                                            id={`contact-phone-type-${index}`}
                                            value={contact.phone_type}
                                            onChange={(event) =>
                                                updateContact(
                                                    index,
                                                    'phone_type',
                                                    event.target.value,
                                                )
                                            }
                                            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                        >
                                            <option value="">
                                                Select a type
                                            </option>
                                            {options.phoneTypes.map((type) => (
                                                <option key={type} value={type}>
                                                    {phoneTypeLabel(type)}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={
                                                formErrors[
                                                    `contacts.${index}.phone_type`
                                                ]
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`contact-notes-${index}`}
                                            value="Contact notes"
                                            className={labelClassName}
                                        />
                                        <TextInput
                                            id={`contact-notes-${index}`}
                                            value={contact.notes}
                                            className={inputClassName}
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

                    <section className="grid gap-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30 md:grid-cols-2">
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <h3 className="text-base font-semibold text-foreground">
                                Address
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Office or job-site mailing address for this
                                contractor.
                            </p>
                        </div>
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

                    <section className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="contractor-notes"
                            value="Notes"
                            className={labelClassName}
                        />
                        <textarea
                            id="contractor-notes"
                            value={data.notes}
                            className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-3 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                            onChange={(event) =>
                                setData('notes', event.target.value)
                            }
                        />
                        <InputError message={errors.notes} />
                    </section>
                </form>
            </CardContent>
        </Card>
    );
}
