import EmailAddressInput from '@/Components/EmailAddressInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import { Button } from '@/Components/ui/button';
import { PlusIcon, Trash2Icon } from 'lucide-react';

export type UserContactRow = {
    value: string;
    country?: string;
    is_primary: boolean;
};

type UserContactFieldsProps = {
    legend: string;
    description: string;
    addLabel: string;
    placeholder: string;
    inputType: 'email' | 'tel';
    field: 'emails' | 'phones';
    rows: UserContactRow[];
    errors: Record<string, string | undefined>;
    onChange: (rows: UserContactRow[]) => void;
};

const inputClassName =
    'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';

const withPrimary = (rows: UserContactRow[], index: number): UserContactRow[] =>
    rows.map((row, rowIndex) => ({
        ...row,
        is_primary: rowIndex === index,
    }));

export default function UserContactFields({
    legend,
    description,
    addLabel,
    placeholder,
    inputType,
    field,
    rows,
    errors,
    onChange,
}: UserContactFieldsProps) {
    const updateValue = (index: number, value: string) => {
        onChange(
            rows.map((row, rowIndex) =>
                rowIndex === index ? { ...row, value } : row,
            ),
        );
    };

    const addRow = () => {
        onChange([
            ...rows,
            {
                value: '',
                is_primary: rows.length === 0,
                ...(field === 'phones' ? { country: 'US' } : {}),
            },
        ]);
    };

    const updateCountry = (index: number, country: string) => {
        onChange(
            rows.map((row, rowIndex) =>
                rowIndex === index ? { ...row, country } : row,
            ),
        );
    };

    const removeRow = (index: number) => {
        const next = rows.filter((_, rowIndex) => rowIndex !== index);

        if (next.length > 0 && !next.some((row) => row.is_primary)) {
            next[0] = { ...next[0], is_primary: true };
        }

        onChange(next);
    };

    return (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <legend className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {legend}
                    </legend>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0"
                    onClick={addRow}
                >
                    <PlusIcon className="size-4" />
                    {addLabel}
                </Button>
            </div>

            {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    None added yet.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {rows.map((row, index) => (
                        <div
                            key={`${field}-${index}`}
                            className={
                                field === 'phones'
                                    ? 'flex flex-wrap items-center gap-2'
                                    : 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center'
                            }
                        >
                            {inputType === 'email' ? (
                                <EmailAddressInput
                                    id={`${field}-${index}`}
                                    value={row.value}
                                    placeholder={placeholder}
                                    className={inputClassName}
                                    aria-label={`${legend} ${index + 1}`}
                                    onChange={(value) =>
                                        updateValue(index, value)
                                    }
                                />
                            ) : (
                                <PhoneInput
                                    id={`${field}-${index}`}
                                    value={row.value}
                                    country={row.country ?? 'US'}
                                    placeholder={placeholder}
                                    className="border-border bg-background text-sm text-foreground focus:border-ring focus:ring-ring"
                                    aria-label={`${legend} ${index + 1}`}
                                    onCountryChange={(country) =>
                                        updateCountry(index, country)
                                    }
                                    onValueChange={(value) =>
                                        updateValue(index, value)
                                    }
                                />
                            )}
                            <label
                                className={
                                    'flex items-center gap-2 text-sm text-foreground ' +
                                    (field === 'phones' ? 'h-9' : 'h-11')
                                }
                            >
                                <input
                                    type="radio"
                                    name={`${field}-primary`}
                                    checked={row.is_primary}
                                    onChange={() =>
                                        onChange(withPrimary(rows, index))
                                    }
                                />
                                Primary
                            </label>
                            <Button
                                type="button"
                                variant="outline"
                                className={field === 'phones' ? 'h-9 px-3' : 'h-11'}
                                aria-label={`Remove ${legend} ${index + 1}`}
                                onClick={() => removeRow(index)}
                            >
                                <Trash2Icon className="size-4" />
                            </Button>
                            <InputError
                                className={
                                    field === 'phones'
                                        ? 'basis-full'
                                        : 'sm:col-span-3'
                                }
                                message={
                                    errors[`${field}.${index}.value`] ||
                                    errors[
                                        field === 'emails'
                                            ? `emails.${index}.email`
                                            : `phones.${index}.phone`
                                    ]
                                }
                            />
                        </div>
                    ))}
                </div>
            )}
            <InputError message={errors[field]} />
        </fieldset>
    );
}
