import EmailAddressInput from '@/Components/EmailAddressInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput, { phoneCountries } from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import { ReactNode } from 'react';
import { Button } from '@/Components/ui/button';
import { PlusIcon, Trash2Icon } from 'lucide-react';

export type UserContactRow = {
    value: string;
    country?: string;
    is_primary: boolean;
    id?: number;
    label?: string;
    extension?: string;
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
    maxRows?: number;
    renderDetails?: (row: UserContactRow, index: number) => ReactNode;
    preserveLegacyPhone?: boolean;
    stackPhonesOnMobile?: boolean;
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
    maxRows = 20,
    renderDetails,
    preserveLegacyPhone = false,
    stackPhonesOnMobile = false,
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
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4">
            <legend className="sr-only">{legend}</legend>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {legend}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0"
                    onClick={addRow}
                    disabled={rows.length >= maxRows}
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
                            ) : preserveLegacyPhone && row.country === '' ? (
                                <div className={stackPhonesOnMobile ? 'flex min-w-0 w-full max-w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:gap-0' : 'flex min-w-0 max-w-full items-stretch'}>
                                    <select aria-label={`Country for ${legend} ${index + 1}`} value="" onChange={(event) => updateCountry(index, event.target.value)} className={(stackPhonesOnMobile ? 'h-11 w-full min-w-0 rounded-md sm:h-9 sm:w-auto sm:max-w-36 sm:rounded-r-none ' : 'h-9 max-w-36 rounded-l-md ') + 'border-border bg-muted text-sm text-foreground'}>
                                        <option value="">Keep existing code</option>
                                        {phoneCountries.map((country) => <option key={country.code} value={country.code}>{country.name} +{country.dial}</option>)}
                                    </select>
                                    <TextInput id={`${field}-${index}`} type="tel" aria-label={`${legend} ${index + 1}`} value={row.value} className={(stackPhonesOnMobile ? 'h-11 min-w-0 w-full sm:h-9 sm:w-36 sm:rounded-l-none ' : 'h-9 min-w-0 w-36 rounded-l-none ') + 'border-border bg-background text-foreground'} onChange={(event) => updateValue(index, event.target.value)} />
                                </div>
                            ) : (
                                <PhoneInput
                                    id={`${field}-${index}`}
                                    value={row.value}
                                    country={row.country ?? 'US'}
                                    stackOnMobile={stackPhonesOnMobile}
                                    placeholder={placeholder}
                                    className="border-border bg-background text-sm text-foreground focus:border-ring focus:ring-ring"
                                    aria-label={`${legend} ${index + 1}`}
                                    countryAriaLabel={`Country for ${legend} ${index + 1}`}
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
                                    aria-label={`Primary ${legend} ${index + 1}`}
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
                            {renderDetails && <div className="basis-full sm:col-span-3">{renderDetails(row, index)}</div>}
                        </div>
                    ))}
                </div>
            )}
            <InputError message={errors[field]} />
            {rows.length >= maxRows && <p className="text-xs text-muted-foreground">Maximum {maxRows} entries.</p>}
        </fieldset>
    );
}
