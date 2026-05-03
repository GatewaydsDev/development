import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, useForm } from '@inertiajs/react';
import {
    Building2Icon,
    GlobeIcon,
    MailIcon,
    MapPinIcon,
    PhoneIcon,
} from 'lucide-react';
import { FormEventHandler } from 'react';

type Company = {
    id: number;
    uuid: string;
    name: string;
    legal_name: string | null;
    email: string | null;
    phone_number: string | null;
    contact_phone_number: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    website_url: string | null;
    contact_url: string | null;
    notes: string | null;
    is_active: boolean;
};

type ShowProps = {
    company: Company | null;
};

type CompanyFormData = {
    name: string;
    legal_name: string;
    email: string;
    phone_number: string;
    contact_phone_number: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    website_url: string;
    contact_url: string;
    notes: string;
    is_active: boolean;
};

function DetailItem({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div className="rounded-lg border border-border bg-background p-4">
            <dt className="text-sm font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">
                {value || 'Not added yet'}
            </dd>
        </div>
    );
}

export default function Show({ company }: ShowProps) {
    const { data, setData, errors, processing, post, patch } =
        useForm<CompanyFormData>({
            name: company?.name ?? '',
            legal_name: company?.legal_name ?? '',
            email: company?.email ?? '',
            phone_number: company?.phone_number ?? '',
            contact_phone_number: company?.contact_phone_number ?? '',
            address_line_1: company?.address_line_1 ?? '',
            address_line_2: company?.address_line_2 ?? '',
            city: company?.city ?? '',
            state: company?.state ?? '',
            postal_code: company?.postal_code ?? '',
            country: company?.country ?? '',
            website_url: company?.website_url ?? '',
            contact_url: company?.contact_url ?? '',
            notes: company?.notes ?? '',
            is_active: company?.is_active ?? true,
        });

    const fullAddress = company
        ? [
              company.address_line_1,
              company.address_line_2,
              company.city,
              company.state,
              company.postal_code,
              company.country,
          ]
              .filter(Boolean)
              .join(', ')
        : null;

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        if (company) {
            patch(route('admin.company.update', company.id));
            return;
        }

        post(route('admin.company.store'));
    };

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <span className="text-foreground">Company</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Company profile
                    </h2>
                </div>
            }
        >
            <Head title="Company" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    {company ? (
                        <>
                            <Card className="shadow-sm">
                                <CardHeader className="gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Building2Icon className="size-5 text-muted-foreground" />
                                            {company.name}
                                        </CardTitle>
                                        <CardDescription>
                                            {company.legal_name ||
                                                'Gateway Door Systems company record'}
                                        </CardDescription>
                                    </div>
                                    <Badge
                                        variant={
                                            company.is_active
                                                ? 'default'
                                                : 'outline'
                                        }
                                    >
                                        {company.is_active
                                            ? 'Active'
                                            : 'Inactive'}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        <DetailItem
                                            label="Company name"
                                            value={company.name}
                                        />
                                        <DetailItem
                                            label="Legal name"
                                            value={company.legal_name}
                                        />
                                        <DetailItem
                                            label="UUID"
                                            value={company.uuid}
                                        />
                                    </dl>
                                </CardContent>
                            </Card>

                            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <MapPinIcon className="size-5 text-muted-foreground" />
                                            Address
                                        </CardTitle>
                                        <CardDescription>
                                            Primary company location.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <dl className="grid gap-4 md:grid-cols-2">
                                            <DetailItem
                                                label="Address line 1"
                                                value={company.address_line_1}
                                            />
                                            <DetailItem
                                                label="Address line 2"
                                                value={company.address_line_2}
                                            />
                                            <DetailItem
                                                label="City"
                                                value={company.city}
                                            />
                                            <DetailItem
                                                label="State"
                                                value={company.state}
                                            />
                                            <DetailItem
                                                label="Postal code"
                                                value={company.postal_code}
                                            />
                                            <DetailItem
                                                label="Country"
                                                value={company.country}
                                            />
                                            <div className="md:col-span-2">
                                                <DetailItem
                                                    label="Full address"
                                                    value={fullAddress}
                                                />
                                            </div>
                                        </dl>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <PhoneIcon className="size-5 text-muted-foreground" />
                                            Contact
                                        </CardTitle>
                                        <CardDescription>
                                            Phone, email, and public contact
                                            links.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <dl className="flex flex-col gap-4">
                                            <DetailItem
                                                label="Phone number"
                                                value={company.phone_number}
                                            />
                                            <DetailItem
                                                label="Contact phone number"
                                                value={
                                                    company.contact_phone_number
                                                }
                                            />
                                            <DetailItem
                                                label="Email"
                                                value={company.email}
                                            />
                                            <DetailItem
                                                label="Website"
                                                value={company.website_url}
                                            />
                                            <DetailItem
                                                label="Contact URL"
                                                value={company.contact_url}
                                            />
                                        </dl>

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {company.contact_phone_number && (
                                                <a
                                                    href={`tel:${company.contact_phone_number}`}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
                                                >
                                                    <PhoneIcon className="size-4" />
                                                    Contact us
                                                </a>
                                            )}
                                            {company.email && (
                                                <a
                                                    href={`mailto:${company.email}`}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
                                                >
                                                    <MailIcon className="size-4" />
                                                    Email
                                                </a>
                                            )}
                                            {company.website_url && (
                                                <a
                                                    href={company.website_url}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
                                                >
                                                    <GlobeIcon className="size-4" />
                                                    Website
                                                </a>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {company.notes && (
                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle>Notes</CardTitle>
                                        <CardDescription>
                                            Internal company details.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="leading-7 text-muted-foreground">
                                            {company.notes}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    ) : (
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2Icon className="size-5 text-muted-foreground" />
                                    No company record found
                                </CardTitle>
                                <CardDescription>
                                    Add the company data using the form below.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    )}

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>
                                {company
                                    ? 'Update company data'
                                    : 'Add company data'}
                            </CardTitle>
                            <CardDescription>
                                This is the single company record used across
                                the application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="flex flex-col gap-6">
                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="name"
                                            value="Company name"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="name"
                                            value={data.name}
                                            className={inputClassName}
                                            isFocused={!company}
                                            onChange={(event) =>
                                                setData(
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="legal_name"
                                            value="Legal name"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="legal_name"
                                            value={data.legal_name}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'legal_name',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.legal_name}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="email"
                                            value="Email"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="email"
                                            type="email"
                                            value={data.email}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'email',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={errors.email} />
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="phone_number"
                                            value="Phone number"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <PhoneInput
                                            id="phone_number"
                                            value={data.phone_number}
                                            className={inputClassName}
                                            onValueChange={(value) =>
                                                setData(
                                                    'phone_number',
                                                    value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.phone_number}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="contact_phone_number"
                                            value="Contact phone number"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <PhoneInput
                                            id="contact_phone_number"
                                            value={data.contact_phone_number}
                                            className={inputClassName}
                                            onValueChange={(value) =>
                                                setData(
                                                    'contact_phone_number',
                                                    value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                errors.contact_phone_number
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="address_line_1"
                                            value="Address line 1"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="address_line_1"
                                            value={data.address_line_1}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'address_line_1',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.address_line_1}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="address_line_2"
                                            value="Address line 2"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="address_line_2"
                                            value={data.address_line_2}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'address_line_2',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.address_line_2}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="city"
                                            value="City"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="city"
                                            value={data.city}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'city',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={errors.city} />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="state"
                                            value="State"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="state"
                                            value={data.state}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'state',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={errors.state} />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="postal_code"
                                            value="Postal code"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="postal_code"
                                            value={data.postal_code}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'postal_code',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.postal_code}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="country"
                                            value="Country"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="country"
                                            value={data.country}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'country',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={errors.country} />
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="website_url"
                                            value="Website URL"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="website_url"
                                            type="url"
                                            value={data.website_url}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'website_url',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.website_url}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor="contact_url"
                                            value="Contact URL"
                                            className="text-emerald-700 dark:text-emerald-300"
                                        />
                                        <TextInput
                                            id="contact_url"
                                            type="url"
                                            value={data.contact_url}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setData(
                                                    'contact_url',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.contact_url}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="notes"
                                        value="Notes"
                                        className="text-emerald-700 dark:text-emerald-300"
                                    />
                                    <textarea
                                        id="notes"
                                        value={data.notes}
                                        className="min-h-32 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                        onChange={(event) =>
                                            setData(
                                                'notes',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.notes} />
                                </div>

                                <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-sm font-medium text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={data.is_active}
                                        onChange={(event) =>
                                            setData(
                                                'is_active',
                                                event.target.checked,
                                            )
                                        }
                                        className="size-4 rounded border-border text-primary shadow-sm focus:ring-ring"
                                    />
                                    Active company record
                                </label>

                                <div className="flex justify-end border-t border-border pt-5">
                                    <Button type="submit" disabled={processing}>
                                        {company
                                            ? 'Save company data'
                                            : 'Add company data'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
