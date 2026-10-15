import TextInput from '@/Components/TextInput';
import { InputHTMLAttributes } from 'react';

export const phoneCountries = [
    { code: 'US', name: 'USA', dial: '1', nationalDigits: 10 },
    { code: 'CA', name: 'Canada', dial: '1', nationalDigits: 10 },
    { code: 'MX', name: 'Mexico', dial: '52', nationalDigits: 10 },
    { code: 'GB', name: 'UK', dial: '44', nationalDigits: 11 },
    { code: 'PR', name: 'Puerto Rico', dial: '1', nationalDigits: 10 },
    { code: 'DO', name: 'Dominican Republic', dial: '1', nationalDigits: 10 },
    { code: 'BR', name: 'Brazil', dial: '55', nationalDigits: 11 },
    { code: 'ES', name: 'Spain', dial: '34', nationalDigits: 9 },
    { code: 'FR', name: 'France', dial: '33', nationalDigits: 9 },
    { code: 'DE', name: 'Germany', dial: '49', nationalDigits: 11 },
    { code: 'AU', name: 'Australia', dial: '61', nationalDigits: 9 },
    { code: 'IN', name: 'India', dial: '91', nationalDigits: 10 },
    { code: 'PH', name: 'Philippines', dial: '63', nationalDigits: 10 },
] as const;

export type PhoneCountryCode = (typeof phoneCountries)[number]['code'];

const nanpCountries = new Set(['US', 'CA', 'PR', 'DO']);

export function phoneCountry(code?: string | null) {
    return (
        phoneCountries.find((country) => country.code === code) ??
        phoneCountries[0]
    );
}

export function getPhoneDigits(value: string, maxDigits = 10): string {
    return value.replace(/\D/g, '').slice(0, maxDigits);
}

export function formatPhoneNumber(value: string, countryCode?: string | null): string {
    const country = phoneCountry(countryCode);
    const digits = getPhoneDigits(value, country.nationalDigits);

    if (!nanpCountries.has(country.code)) {
        return digits;
    }

    if (digits.length <= 3) {
        return digits;
    }

    if (digits.length <= 6) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type PhoneInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'value' | 'onChange'
> & {
    value: string;
    onValueChange: (value: string) => void;
    country?: string;
    onCountryChange?: (country: string) => void;
    isFocused?: boolean;
};

export default function PhoneInput({
    value,
    onValueChange,
    country,
    onCountryChange,
    className = '',
    ...props
}: PhoneInputProps) {
    const selected = phoneCountry(country);
    const formatted = formatPhoneNumber(value, selected.code);
    const input = (
        <TextInput
            {...props}
            type="tel"
            inputMode="numeric"
            value={formatted}
            maxLength={nanpCountries.has(selected.code) ? 14 : selected.nationalDigits}
            className={
                (onCountryChange
                    ? 'h-9 w-36 rounded-l-none border-l-0 '
                    : '') + className
            }
            onChange={(event) =>
                onValueChange(
                    formatPhoneNumber(event.target.value, selected.code),
                )
            }
        />
    );

    if (!onCountryChange) {
        return input;
    }

    return (
        <div className="flex w-auto max-w-full items-stretch">
            <select
                aria-label="Country"
                value={selected.code}
                onChange={(event) => onCountryChange(event.target.value)}
                className="h-9 max-w-[9.5rem] shrink-0 rounded-l-md border border-border bg-muted px-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {phoneCountries.map((item) => (
                    <option key={item.code} value={item.code}>
                        {item.name} +{item.dial}
                    </option>
                ))}
            </select>
            {input}
        </div>
    );
}
