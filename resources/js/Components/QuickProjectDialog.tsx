import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import Modal from '@/Components/Modal';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { normalizeStateInitials } from '@/lib/stateInitials';
import { router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const fieldClassName =
    'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

export type QuickProjectRecord = {
    id: number;
    name: string;
    prices?: Array<{
        id: number;
        label: string;
        amount: string | number;
    }>;
};

type QuickProjectDialogProps = {
    show: boolean;
    onClose: () => void;
    contractorId?: string;
    contractorRole?: 'contractor' | 'owner';
    showContractorName?: boolean;
    allowPrice?: boolean;
    onCreated: (project: QuickProjectRecord) => void;
};

type FormState = {
    name: string;
    site_address_line_1: string;
    site_city: string;
    site_state: string;
    site_postal_code: string;
    contractor_name: string;
    price_label: string;
    price_amount: string;
};

const emptyForm = (): FormState => ({
    name: '',
    site_address_line_1: '',
    site_city: '',
    site_state: '',
    site_postal_code: '',
    contractor_name: '',
    price_label: '',
    price_amount: '',
});

export default function QuickProjectDialog({
    show,
    onClose,
    contractorId = '',
    contractorRole = 'contractor',
    showContractorName = false,
    allowPrice = false,
    onCreated,
}: QuickProjectDialogProps) {
    const [form, setForm] = useState<FormState>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const close = () => {
        if (saving) {
            return;
        }

        setForm(emptyForm());
        setErrors({});
        onClose();
    };

    const setField = (field: keyof FormState, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: '' }));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const name = form.name.trim();

        if (name === '') {
            setErrors({ name: 'Enter a project name.' });

            return;
        }

        setSaving(true);
        setErrors({});

        router.post(
            route('admin.projects.quick-store'),
            {
                name,
                site_address_line_1: form.site_address_line_1.trim(),
                site_city: form.site_city.trim(),
                site_state: form.site_state.trim(),
                site_postal_code: form.site_postal_code.trim(),
                contractor_id: contractorId || null,
                contractor_name: showContractorName
                    ? form.contractor_name.trim()
                    : '',
                contractor_role: contractorRole,
                price_label: allowPrice ? form.price_label.trim() : '',
                price_amount: allowPrice
                    ? form.price_amount.replace(/,/g, '')
                    : '',
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => {
                    const projects =
                        (
                            page.props.options as
                                | { projects?: QuickProjectRecord[] }
                                | undefined
                        )?.projects ?? [];
                    const created = [...projects]
                        .reverse()
                        .find(
                            (project) =>
                                project.name.toLowerCase() === name.toLowerCase(),
                        );

                    setForm(emptyForm());
                    setErrors({});
                    onClose();

                    if (created) {
                        onCreated(created);
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
        <Modal show={show} maxWidth="xl" onClose={close}>
            <form onSubmit={submit} className="flex flex-col gap-5 p-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        New project
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Save the project name and job site here. You stay on
                        this form, and the new project is selected for you.
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <InputLabel htmlFor="quick-project-name" value="Project name" />
                    <TextInput
                        id="quick-project-name"
                        value={form.name}
                        className={fieldClassName}
                        placeholder="Hospital wing doors"
                        onChange={(event) => setField('name', event.target.value)}
                    />
                    <InputError message={errors.name} />
                </div>

                {showContractorName ? (
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="quick-project-contractor"
                            value="Contractor or owner"
                        />
                        <TextInput
                            id="quick-project-contractor"
                            value={form.contractor_name}
                            className={fieldClassName}
                            placeholder="Optional company name"
                            onChange={(event) =>
                                setField('contractor_name', event.target.value)
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave this blank if you do not have the company yet.
                            A matching name is reused.
                        </p>
                        <InputError message={errors.contractor_name} />
                    </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <InputLabel
                            htmlFor="quick-project-address"
                            value="Job site address"
                        />
                        <TextInput
                            id="quick-project-address"
                            value={form.site_address_line_1}
                            className={fieldClassName}
                            placeholder="Street address"
                            onChange={(event) =>
                                setField('site_address_line_1', event.target.value)
                            }
                        />
                        <InputError message={errors.site_address_line_1} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="quick-project-city" value="City" />
                        <TextInput
                            id="quick-project-city"
                            value={form.site_city}
                            className={fieldClassName}
                            onChange={(event) =>
                                setField('site_city', event.target.value)
                            }
                        />
                        <InputError message={errors.site_city} />
                    </div>
                    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel htmlFor="quick-project-state" value="State" />
                            <TextInput
                                id="quick-project-state"
                                value={form.site_state}
                                className={`${fieldClassName} uppercase`}
                                maxLength={2}
                                onChange={(event) =>
                                    setField(
                                        'site_state',
                                        normalizeStateInitials(event.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.site_state} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel htmlFor="quick-project-postal" value="ZIP" />
                            <TextInput
                                id="quick-project-postal"
                                value={form.site_postal_code}
                                className={fieldClassName}
                                onChange={(event) =>
                                    setField(
                                        'site_postal_code',
                                        event.target.value
                                            .replace(/[^0-9-]/g, '')
                                            .slice(0, 15),
                                    )
                                }
                            />
                            <InputError message={errors.site_postal_code} />
                        </div>
                    </div>
                </div>

                {allowPrice ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="quick-project-price-label"
                                value="First price"
                            />
                            <TextInput
                                id="quick-project-price-label"
                                value={form.price_label}
                                className={fieldClassName}
                                placeholder="2 windows"
                                onChange={(event) =>
                                    setField('price_label', event.target.value)
                                }
                            />
                            <InputError message={errors.price_label} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="quick-project-price-amount"
                                value="Amount"
                            />
                            <MaskedDecimalInput
                                id="quick-project-price-amount"
                                value={form.price_amount}
                                className={fieldClassName}
                                prefix="$"
                                onChange={(value) => setField('price_amount', value)}
                            />
                            <InputError message={errors.price_amount} />
                        </div>
                    </div>
                ) : null}

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
                        {saving ? 'Saving...' : 'Save project'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
