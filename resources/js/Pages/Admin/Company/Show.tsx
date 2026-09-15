import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, useForm } from '@inertiajs/react';
import { ImageIcon, Trash2Icon } from 'lucide-react';
import { ChangeEvent, FormEventHandler, useEffect, useState } from 'react';

const maxLogoSizeBytes = 2 * 1024 * 1024;

type Company = {
    id: number;
    uuid: string;
    name: string;
    legal_name: string | null;
    logo_url: string | null;
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
    logo: File | null;
    remove_logo: boolean;
};

export default function Show({ company }: ShowProps) {
    const [localLogoPreviewUrl, setLocalLogoPreviewUrl] = useState<string | null>(
        null,
    );
    const [selectedLogoName, setSelectedLogoName] = useState<string | null>(null);
    const { data, setData, errors, processing, post, setError, clearErrors } =
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
            logo: null,
            remove_logo: false,
        });
    const logoPreviewUrl =
        localLogoPreviewUrl || (!data.remove_logo ? company?.logo_url : null);

    useEffect(() => {
        return () => {
            if (localLogoPreviewUrl) {
                URL.revokeObjectURL(localLogoPreviewUrl);
            }
        };
    }, [localLogoPreviewUrl]);

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        post(route('admin.company.store'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const selectLogo = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;

        if (localLogoPreviewUrl) {
            URL.revokeObjectURL(localLogoPreviewUrl);
        }

        if (file && file.size > maxLogoSizeBytes) {
            event.target.value = '';
            setData('logo', null);
            setSelectedLogoName(null);
            setLocalLogoPreviewUrl(null);
            setError('logo', 'The company logo must be 2 MB or smaller.');

            return;
        }

        clearErrors('logo');
        setData('logo', file);
        setData('remove_logo', false);
        setSelectedLogoName(file?.name ?? null);
        setLocalLogoPreviewUrl(file ? URL.createObjectURL(file) : null);
    };

    const removeLogo = () => {
        if (localLogoPreviewUrl) {
            URL.revokeObjectURL(localLogoPreviewUrl);
        }

        setData('logo', null);
        setData('remove_logo', true);
        setSelectedLogoName(null);
        setLocalLogoPreviewUrl(null);
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
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
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
                            <form
                                id="company-profile-form"
                                onSubmit={submit}
                                className="flex flex-col gap-6 pr-14 sm:pr-16"
                            >
                                <FormActionFab
                                    form="company-profile-form"
                                    cancelHref={route('dashboard')}
                                    saveLabel={
                                        company
                                            ? 'Save company data'
                                            : 'Add company data'
                                    }
                                    disabled={processing}
                                />
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

                                <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
                                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                                        <div className="group/logo flex size-64 shrink-0 items-center justify-center self-start overflow-hidden rounded-2xl border border-border bg-muted/40 transition duration-700 ease-out hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/10 sm:size-72 lg:size-80">
                                            {logoPreviewUrl ? (
                                                <img
                                                    src={logoPreviewUrl}
                                                    alt="Company logo preview"
                                                    className="size-full object-contain p-5 transition duration-700 ease-out group-hover/logo:scale-110 sm:p-6"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                                    <ImageIcon className="size-14 sm:size-16" />
                                                    <span className="text-sm">
                                                        No logo
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-1 flex-col gap-3">
                                            <div>
                                                <InputLabel
                                                    htmlFor="logo"
                                                    value="Company logo"
                                                    className="text-emerald-700 dark:text-emerald-300"
                                                />
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    Upload a PNG, JPG, WebP, or
                                                    SVG logo up to 2 MB. Uploading
                                                    a new logo replaces the
                                                    current one.
                                                </p>
                                            </div>

                                            <input
                                                id="logo"
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                onChange={selectLogo}
                                                className="block w-full rounded-md border border-border bg-background text-sm text-foreground file:me-4 file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                                            />
                                            <InputError message={errors.logo} />

                                            {selectedLogoName && (
                                                <p className="text-sm text-muted-foreground">
                                                    Selected: {selectedLogoName}
                                                </p>
                                            )}

                                            {(logoPreviewUrl ||
                                                company?.logo_url) && (
                                                <button
                                                    type="button"
                                                    onClick={removeLogo}
                                                    className="inline-flex w-fit items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/30"
                                                >
                                                    <Trash2Icon className="size-4" />
                                                    Remove logo
                                                </button>
                                            )}
                                        </div>
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
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
