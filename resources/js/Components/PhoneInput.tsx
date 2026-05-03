import TextInput from '@/Components/TextInput';
import { InputHTMLAttributes } from 'react';

export function getPhoneDigits(value: string): string {
    return value.replace(/\D/g, '').slice(0, 10);
}

export function formatPhoneNumber(value: string): string {
    const digits = getPhoneDigits(value);

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
    isFocused?: boolean;
};

export default function PhoneInput({
    value,
    onValueChange,
    ...props
}: PhoneInputProps) {
    return (
        <TextInput
            {...props}
            type="tel"
            inputMode="numeric"
            value={formatPhoneNumber(value)}
            maxLength={14}
            onChange={(event) =>
                onValueChange(formatPhoneNumber(event.target.value))
            }
        />
    );
}
