import CertificationBadge from '@/Components/CertificationBadge';
import DateMaskInput from '@/Components/DateMaskInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import NamedCatalogSelect from '@/Components/NamedCatalogSelect';
import { Button } from '@/Components/ui/button';
import { PlusIcon, Trash2Icon } from 'lucide-react';
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
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div>
                <h3 className="text-base font-semibold text-foreground">
                    Certifications and qualifications
                </h3>
                <p className="text-sm text-muted-foreground">
                    Choose a shared qualification, or add a new one from the
                    list. The same qualification can be assigned to other
                    employees.
                </p>
            </div>
            {certifications.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                    No certifications yet.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {certifications.map((certification, index) => {
                        const selected = catalog.find(
                            (item) =>
                                String(item.id) ===
                                certification.certification_id,
                        );

                        return (
                            <div
                                key={index}
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
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => onRemove(index)}
                                    >
                                        <Trash2Icon />
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <Button
                type="button"
                variant="outline"
                onClick={onAdd}
                className="self-end bg-background"
            >
                <PlusIcon />
                Add certification
            </Button>
        </section>
    );
}
