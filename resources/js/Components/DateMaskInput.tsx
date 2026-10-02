import TextInput from '@/Components/TextInput';
import { InputHTMLAttributes, useEffect, useState } from 'react';

export function formatDateMask(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const month = digits.slice(0, 2);
    const day = digits.slice(2, 4);
    const year = digits.slice(4, 8);

    if (digits.length <= 2) {
        return month;
    }

    if (digits.length <= 4) {
        return `${month}/${day}`;
    }

    return `${month}/${day}/${year}`;
}

export function maskedDateToIso(value: string): string {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!match) {
        return '';
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return '';
    }

    return `${match[3]}-${match[1]}-${match[2]}`;
}

export function isoToMaskedDate(value: string): string {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        return '';
    }

    return `${match[2]}/${match[3]}/${match[1]}`;
}

type DateMaskInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'value' | 'onChange'
> & {
    value: string;
    onValueChange: (value: string) => void;
};

export default function DateMaskInput({
    value,
    onValueChange,
    ...props
}: DateMaskInputProps) {
    const [display, setDisplay] = useState(() => isoToMaskedDate(value));

    useEffect(() => {
        if (value === '') {
            return;
        }

        setDisplay(isoToMaskedDate(value));
    }, [value]);

    return (
        <TextInput
            {...props}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM/DD/YYYY"
            maxLength={10}
            value={display}
            onChange={(event) => {
                const masked = formatDateMask(event.target.value);
                setDisplay(masked);
                onValueChange(masked === '' ? '' : maskedDateToIso(masked));
            }}
        />
    );
}
