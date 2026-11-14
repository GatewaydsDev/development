import TextInput from '@/Components/TextInput';
import { InputHTMLAttributes, useLayoutEffect, useRef } from 'react';
import { formatPhoneNumber, nanpCountries, phoneCountries, phoneCountry } from '@/lib/phoneFormatting';

export { phoneCountries, phoneCountry, getPhoneDigits, formatPhoneNumber } from '@/lib/phoneFormatting';
export type { PhoneCountryCode } from '@/lib/phoneFormatting';

type PhoneInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'value' | 'onChange'
> & {
    value: string;
    onValueChange: (value: string) => void;
    country?: string;
    onCountryChange?: (country: string) => void;
    isFocused?: boolean;
    countryAriaLabel?: string;
    stackOnMobile?: boolean;
};

export default function PhoneInput({
    value,
    onValueChange,
    country,
    onCountryChange,
    className = '',
    countryAriaLabel = 'Country',
    stackOnMobile = false,
    onPaste,
    ...props
}: PhoneInputProps) {
    const selected = phoneCountry(country);
    const formatted = formatPhoneNumber(value, selected.code);
    const inputRef = useRef<HTMLInputElement>(null);
    const caret = useRef<number | null>(null);
    useLayoutEffect(() => {
        if (caret.current === null || !inputRef.current) return;
        inputRef.current.setSelectionRange(caret.current, caret.current);
        caret.current = null;
    });

    const updateMasked = (raw: string, position: number, inputType = '') => {
        inputRef.current?.setCustomValidity('');
        let digits = raw.replace(/\D/g, '');
        let beforeCaret = raw.slice(0, position).replace(/\D/g, '').length;
        // Deleting a mask separator must delete a digit, not get stuck.
        if (inputType.startsWith('delete') && digits === formatted.replace(/\D/g, '') && raw.length < formatted.length) {
            const index = inputType === 'deleteContentBackward' ? beforeCaret - 1 : beforeCaret;
            if (index >= 0 && index < digits.length) {
                digits = digits.slice(0, index) + digits.slice(index + 1);
                if (inputType === 'deleteContentBackward') beforeCaret--;
                raw = digits;
            }
        }
        const next = formatPhoneNumber(raw, selected.code);
        const target = Math.min(beforeCaret, next.replace(/\D/g, '').length);
        let seen = 0;
        caret.current = target === 0 ? 0 : next.length;
        for (let index = 0; index < next.length; index++) {
            if (/\d/.test(next[index]) && ++seen === target) {
                caret.current = index + 1;
                break;
            }
        }
        onValueChange(next);
    };
    const input = (
        <TextInput
            {...props}
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            value={formatted}
            placeholder={nanpCountries.has(selected.code) ? '(555) 555-5555' : props.placeholder}
            autoComplete={props.autoComplete ?? 'tel-national'}
            className={
                (onCountryChange
                    ? stackOnMobile
                        ? 'h-11 min-w-0 w-full sm:h-9 sm:w-36 sm:rounded-l-none sm:border-l-0 '
                        : 'h-9 min-w-0 w-36 rounded-l-none border-l-0 '
                    : '') + className
            }
            onChange={(event) => updateMasked(event.target.value, event.target.selectionStart ?? event.target.value.length, (event.nativeEvent as InputEvent).inputType)}
            onPaste={(event) => {
                onPaste?.(event);
                if (event.defaultPrevented || props.readOnly || props.disabled) return;
                const pasted = event.clipboardData.getData('text').trim();
                if (!pasted.startsWith('+')) return;
                event.preventDefault();
                if (!pasted.replace(/\D/g, '').startsWith(selected.dial)) {
                    event.currentTarget.setCustomValidity('Select the matching country code before pasting this number.');
                    event.currentTarget.reportValidity();
                    return;
                }
                updateMasked(pasted, pasted.length);
            }}
        />
    );

    if (!onCountryChange) {
        return input;
    }

    return (
        <div className={stackOnMobile ? 'flex w-full max-w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:gap-0' : 'flex w-auto max-w-full items-stretch'}>
            <select
                aria-label={countryAriaLabel}
                value={selected.code}
                onChange={(event) => { inputRef.current?.setCustomValidity(''); onCountryChange(event.target.value); }}
                className={(stackOnMobile ? 'h-11 w-full min-w-0 rounded-md sm:h-9 sm:w-auto sm:max-w-[9.5rem] sm:shrink-0 sm:rounded-r-none ' : 'h-9 max-w-[9.5rem] shrink-0 rounded-l-md ') + 'border border-border bg-muted px-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring'}
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
