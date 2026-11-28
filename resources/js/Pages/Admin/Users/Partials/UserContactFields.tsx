import EmailAddressInput from '@/Components/EmailAddressInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput, { phoneCountries } from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import { ReactNode } from 'react';
import { formRemoveButtonClassName } from '@/Components/ContactDirectory/FormSection';
import { queueFocusAddedRow } from '@/lib/focusFirstField';
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
    renderAfterPrimary?: (row: UserContactRow, index: number) => ReactNode;
    preserveLegacyPhone?: boolean;
    stackPhonesOnMobile?: boolean;
    sectionClassName?: string;
    headingIcon?: ReactNode;
    addAtBottom?: boolean;
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
    renderAfterPrimary,
    preserveLegacyPhone = false,
    stackPhonesOnMobile = false,
    sectionClassName,
    headingIcon,
    addAtBottom = false,
}: UserContactFieldsProps) {
    const updateValue = (index: number, value: string) => {
        onChange(
            rows.map((row, rowIndex) =>
                rowIndex === index ? { ...row, value } : row,
            ),
        );
    };

    const addRow = (event: { currentTarget: HTMLElement }) => {
        onChange([
            ...rows,
            {
                value: '',
                is_primary: rows.length === 0,
                ...(field === 'phones' ? { country: 'US' } : {}),
            },
        ]);
        queueFocusAddedRow(event.currentTarget.closest('[data-add-scope]'));
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

    const addButton = (
        <Button
            type="button"
            variant={addAtBottom ? 'create' : sectionClassName ? 'default' : 'outline'}
            className={
                addAtBottom
                    ? 'ml-auto h-8 w-auto self-end px-3 text-xs'
                    : `h-11 shrink-0 ${sectionClassName ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`
            }
            onClick={(event) => addRow(event)}
            disabled={rows.length >= maxRows}
        >
            <PlusIcon className={addAtBottom ? 'size-3.5' : 'size-4'} />
            {addLabel}
        </Button>
    );

    return (
        <fieldset data-add-scope className={`flex min-w-0 flex-col gap-3 border p-4 ${sectionClassName ? `rounded-lg sm:p-6 ${sectionClassName}` : 'rounded-xl border-border'}`}>
            <legend className="sr-only">{legend}</legend>
            <div className={addAtBottom ? undefined : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'}>
                <div>
                    <h3 className={sectionClassName ? 'flex items-center gap-2 text-lg font-semibold text-foreground' : 'text-sm font-medium text-emerald-700 dark:text-emerald-300'}>
                        {headingIcon}
                        {legend}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                {addAtBottom ? null : addButton}
            </div>

            {rows.length > 0 && (
                <div data-add-list className="flex flex-col gap-3">
                    {rows.map((row, index) => (
                        <div
                            key={`${field}-${index}`}
                            data-add-row
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
                                    className={sectionClassName ? 'accent-emerald-600' : undefined}
                                    name={`${field}-primary`}
                                    aria-label={`Primary ${legend} ${index + 1}`}
                                    checked={row.is_primary}
                                    onChange={() =>
                                        onChange(withPrimary(rows, index))
                                    }
                                />
                                Primary
                            </label>
                            {renderAfterPrimary?.(row, index)}
                            <Button
                                type="button"
                                variant="outline"
                                title={`Remove ${legend} ${index + 1}`}
                                className={formRemoveButtonClassName}
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
            {addAtBottom ? addButton : null}
        </fieldset>
    );
}
