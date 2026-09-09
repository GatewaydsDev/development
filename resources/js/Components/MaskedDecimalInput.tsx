import TextInput from '@/Components/TextInput';
import {
    formatMoneyMask,
    isMaskedNumericKey,
    sanitizeDecimal,
} from '@/lib/money';
import { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';

type MaskedDecimalInputProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    prefix?: string;
    suffix?: string;
    maxDecimals?: number;
    withThousands?: boolean;
};

export default function MaskedDecimalInput({
    id,
    value,
    onChange,
    className,
    placeholder,
    prefix,
    suffix,
    maxDecimals = 2,
    withThousands = true,
}: MaskedDecimalInputProps) {
    const displayValue = withThousands
        ? formatMoneyMask(value)
        : sanitizeDecimal(value, maxDecimals);

    return (
        <div className="relative">
            {prefix ? (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {prefix}
                </span>
            ) : null}
            <TextInput
                id={id}
                inputMode="decimal"
                autoComplete="off"
                value={displayValue}
                placeholder={placeholder}
                className={`${className ?? ''} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (!isMaskedNumericKey(event)) {
                        event.preventDefault();
                    }
                }}
                onPaste={(event: ClipboardEvent<HTMLInputElement>) => {
                    event.preventDefault();
                    const pasted = sanitizeDecimal(
                        event.clipboardData.getData('text'),
                        maxDecimals,
                    );
                    onChange(pasted);
                }}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    onChange(sanitizeDecimal(event.target.value, maxDecimals));
                }}
            />
            {suffix ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {suffix}
                </span>
            ) : null}
        </div>
    );
}
