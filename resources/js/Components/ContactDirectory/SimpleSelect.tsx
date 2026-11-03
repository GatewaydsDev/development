import { cn } from '@/lib/utils';
import { useId } from 'react';

export type SimpleSelectOption = {
    value: string;
    label: string;
};

type SimpleSelectProps = {
    id?: string;
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: SimpleSelectOption[];
    placeholder?: string;
    ariaLabel?: string;
    className?: string;
    required?: boolean;
    error?: string;
};

export default function SimpleSelect({
    id,
    label,
    value,
    onChange,
    options,
    placeholder,
    ariaLabel,
    className,
    required,
    error,
}: SimpleSelectProps) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    return (
        <div className={cn('min-w-0', className)}>
            {label && (
                <label
                    htmlFor={selectId}
                    className="mb-1 block text-sm font-medium text-foreground"
                >
                    {label}
                </label>
            )}
            <select
                id={selectId}
                value={value}
                required={required}
                aria-label={ariaLabel ?? label}
                onChange={(event) => onChange(event.target.value)}
                className={cn(
                    'h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                    'focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none',
                    error && 'border-destructive',
                )}
            >
                {placeholder !== undefined && (
                    <option value="">{placeholder}</option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
    );
}
