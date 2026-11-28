import CertificationBadge from '@/Components/CertificationBadge';
import DateMaskInput from '@/Components/DateMaskInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import NamedCatalogSelect from '@/Components/NamedCatalogSelect';
import { FormAddButton, FormRemoveButton, FormSectionHeading } from '@/Components/ContactDirectory/FormSection';
import { router } from '@inertiajs/react';
import { AwardIcon } from 'lucide-react';
import { FieldErrors } from 'react-hook-form';
import type {
    CertificationOption,
    EmployeeCertificationFormData,
    EmployeeFormData,
} from '../types';

type EmployeeCertificationsFieldsProps = {
    catalog: CertificationOption[];
    certifications: EmployeeCertificationFormData[];
    errors: FieldErrors<EmployeeFormData>;
    labelClassName: string;
    onChange: (
        index: number,
        field: keyof EmployeeCertificationFormData,
        value: string | boolean,
    ) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
};

function fieldError(
    errors: FieldErrors<EmployeeFormData>,
    index: number,
    field: keyof EmployeeCertificationFormData,
): string | undefined {
    const message = errors.certifications?.[index]?.[field]?.message;

    return message ? String(message) : undefined;
}

export default function EmployeeCertificationsFields({
    catalog,
    certifications,
    errors,
    labelClassName,
    onChange,
    onAdd,
    onRemove,
}: EmployeeCertificationsFieldsProps) {
    return (
        <section data-add-scope className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30 sm:p-6">
            <FormSectionHeading
                icon={AwardIcon}
                title="Certifications and qualifications"
                description="Choose a shared qualification, or add a new one from the list. The same qualification can be assigned to other employees."
            />
            {certifications.length > 0 && (
                <div data-add-list className="flex flex-col gap-3">
                    {certifications.map((certification, index) => {
                        const selected = catalog.find(
                            (item) =>
                                String(item.id) ===
                                certification.certification_id,
                        );

                        return (
                            <div
                                key={index}
                                data-add-row
                                className="grid gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-2"
                            >
                                <div className="flex flex-col gap-2 md:col-span-2">
                                    <NamedCatalogSelect
                                        id={`certification-name-${index}`}
                                        label="Certification or qualification"
                                        items={catalog}
                                        value={certification.certification_id}
                                        placeholder="Select a certification"
                                        addLabel="Add certification"
                                        reloadKey="certifications"
                                        storeRoute="admin.certifications.store"
                                        competentPersonToggle
                                        selectClassName="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                        onChange={(id) =>
                                            onChange(
                                                index,
                                                'certification_id',
                                                id,
                                            )
                                        }
                                        error={fieldError(
                                            errors,
                                            index,
                                            'certification_id',
                                        )}
                                    />
                                    {selected?.name && (
                                        <CertificationBadge
                                            id={selected.id}
                                            name={selected.name}
                                            competent={
                                                selected.is_competent_person
                                            }
                                        />
                                    )}
                                    {selected?.name && (
                                        <label className="flex items-center gap-2 text-sm text-foreground">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(
                                                    selected.is_competent_person,
                                                )}
                                                onChange={(event) =>
                                                    router.patch(
                                                        route(
                                                            'admin.certifications.update',
                                                            selected.id,
                                                        ),
                                                        {
                                                            is_competent_person:
                                                                event.target
                                                                    .checked,
                                                        },
                                                        {
                                                            preserveScroll: true,
                                                            preserveState: true,
                                                            only: [
                                                                'certifications',
                                                                'flash',
                                                            ],
                                                        },
                                                    )
                                                }
                                            />
                                            This certification makes the
                                            employee a competent person
                                        </label>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`certification-issued-${index}`}
                                        value="Issued"
                                        className={labelClassName}
                                    />
                                    <DateMaskInput
                                        id={`certification-issued-${index}`}
                                        value={certification.issued_on}
                                        className="h-9 w-36 border-border bg-background px-2 text-sm text-foreground focus:border-ring focus:ring-ring"
                                        onValueChange={(value) =>
                                            onChange(index, 'issued_on', value)
                                        }
                                    />
                                    <InputError
                                        message={fieldError(
                                            errors,
                                            index,
                                            'issued_on',
                                        )}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`certification-expires-${index}`}
                                        value="Expires"
                                        className={labelClassName}
                                    />
                                    <DateMaskInput
                                        id={`certification-expires-${index}`}
                                        value={certification.expires_on}
                                        className="h-9 w-36 border-border bg-background px-2 text-sm text-foreground focus:border-ring focus:ring-ring"
                                        onValueChange={(value) =>
                                            onChange(index, 'expires_on', value)
                                        }
                                    />
                                    <InputError
                                        message={fieldError(
                                            errors,
                                            index,
                                            'expires_on',
                                        )}
                                    />
                                </div>
                                <div className="flex justify-end md:col-span-2">
                                    <FormRemoveButton label={`Remove certification ${index + 1}`} onClick={() => onRemove(index)} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <FormAddButton onClick={onAdd}>Add certification</FormAddButton>
        </section>
    );
}
