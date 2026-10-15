import TextInput from '@/Components/TextInput';
import { InputHTMLAttributes, useEffect, useId, useState } from 'react';

const emailDomains = [
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'yahoo.com',
    'icloud.com',
    'live.com',
    'aol.com',
    'gateway-ds.com',
];

export function emailDomainSuggestions(value: string): string[] {
    const typed = value.trim();

    if (typed === '') {
        return [];
    }

    const at = typed.indexOf('@');
    const local = (at === -1 ? typed : typed.slice(0, at)).trim();
    const domainQuery = (at === -1 ? '' : typed.slice(at + 1))
        .trim()
        .toLowerCase();

    if (local === '' || /\s/.test(local)) {
        return [];
    }

    return emailDomains
        .filter((domain) => domain.startsWith(domainQuery))
        .map((domain) => `${local}@${domain}`)
        .filter(
            (suggestion) => suggestion.toLowerCase() !== typed.toLowerCase(),
        );
}

type EmailAddressInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value' | 'type'
> & {
    value: string;
    onChange: (value: string) => void;
};

export default function EmailAddressInput({
    value,
    onChange,
    className,
    id,
    ...props
}: EmailAddressInputProps) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const suggestions = emailDomainSuggestions(value);
    const showSuggestions = open && suggestions.length > 0;

    useEffect(() => {
        setActiveIndex(0);
    }, [value]);

    const choose = (suggestion: string) => {
        onChange(suggestion);
        setOpen(false);
    };

    return (
        <div className="relative">
            <TextInput
                {...props}
                id={id}
                type="email"
                value={value}
                autoComplete="off"
                className={className}
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls={listId}
                aria-autocomplete="list"
                onFocus={(event) => {
                    setOpen(true);
                    props.onFocus?.(event);
                }}
                onBlur={(event) => {
                    setOpen(false);
                    props.onBlur?.(event);
                }}
                onChange={(event) => {
                    setOpen(true);
                    onChange(event.target.value);
                }}
                onKeyDown={(event) => {
                    if (!showSuggestions) {
                        props.onKeyDown?.(event);
                        return;
                    }

                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveIndex(
                            (index) => (index + 1) % suggestions.length,
                        );
                        return;
                    }

                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveIndex(
                            (index) =>
                                (index - 1 + suggestions.length) %
                                suggestions.length,
                        );
                        return;
                    }

                    if (event.key === 'Enter') {
                        event.preventDefault();
                        choose(suggestions[activeIndex] ?? suggestions[0]);
                        return;
                    }

                    if (event.key === 'Escape') {
                        event.preventDefault();
                        setOpen(false);
                        return;
                    }

                    props.onKeyDown?.(event);
                }}
            />
            {showSuggestions ? (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-lg"
                >
                    {suggestions.map((suggestion, index) => (
                        <li key={suggestion} role="presentation">
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === activeIndex}
                                className={
                                    'flex w-full px-3 py-2 text-left text-sm text-foreground ' +
                                    (index === activeIndex
                                        ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50'
                                        : 'hover:bg-muted')
                                }
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    choose(suggestion);
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                            >
                                {suggestion}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
