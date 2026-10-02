import TextInput from '@/Components/TextInput';
import { InputHTMLAttributes } from 'react';

export function formatMoneyInput(value: string): string {
    const cleaned = value.replace(/[^\d.]/g, '');
    const dot = cleaned.indexOf('.');
    const whole = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(
        /^0+(?=\d)/,
        '',
    );
    const fraction =
        dot === -1 ? null : cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);

    if (fraction === null) {
        return whole;
    }

    return `${whole || '0'}.${fraction}`;
}

type MoneyInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'value' | 'onChange'
> & {
    value: string;
    onValueChange: (value: string) => void;
};

export default function MoneyInput({
    value,
    onValueChange,
    ...props
}: MoneyInputProps) {
    return (
        <TextInput
            {...props}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) =>
                onValueChange(formatMoneyInput(event.target.value))
            }
        />
    );
}
