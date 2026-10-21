import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/Components/ui/drawer';
import { normalizeStateInitials } from '@/lib/stateInitials';
import { router } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

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

function useDrawerDirection(): 'bottom' | 'right' {
    const [direction, setDirection] = useState<'bottom' | 'right'>('bottom');

    useEffect(() => {
        const media = window.matchMedia('(min-width: 640px)');
        const update = () => setDirection(media.matches ? 'right' : 'bottom');

        update();
        media.addEventListener('change', update);

        return () => media.removeEventListener('change', update);
    }, []);

    return direction;
}

export default function QuickProjectDialog({
    show,
    onClose,
    contractorId = '',
    contractorRole = 'contractor',
    showContractorName = false,
    allowPrice = false,
    onCreated,
}: QuickProjectDialogProps) {
    const direction = useDrawerDirection();
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
                    const pageProps = page.props as {
                        options?: { projects?: QuickProjectRecord[] };
                        projects?: QuickProjectRecord[];
                    };
                    const projects =
                        pageProps.options?.projects ?? pageProps.projects ?? [];
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
        <Drawer
            open={show}
            direction={direction}
            onOpenChange={(next) => {
                if (!next) {
                    close();
                }
            }}
        >
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>New project</DrawerTitle>
                    <DrawerDescription>
                        Save the project name and job site here. You stay on
                        this form, and the new project is selected for you.
                    </DrawerDescription>
                </DrawerHeader>
            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-2">
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

                </div>
                <DrawerFooter className="sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={close}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save project'}
                    </Button>
                </DrawerFooter>
            </form>
                </DrawerContent>
        </Drawer>
    );
}
