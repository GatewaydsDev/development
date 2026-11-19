import { cn } from '@/lib/utils';
import { SearchIcon, XIcon } from 'lucide-react';

type ListSearchInputProps = {
    value: string;
    onChange: (value: string) => void;
    onClear?: () => void;
    placeholder?: string;
    id?: string;
    name?: string;
    ariaLabel?: string;
    className?: string;
};

export const listSearchButtonClassName = 'h-11 w-full shrink-0 sm:w-auto';

export default function ListSearchInput({
    value,
    onChange,
    onClear,
    placeholder = 'Search',
    id,
    name,
    ariaLabel,
    className,
}: ListSearchInputProps) {
    const clear = () => {
        onChange('');
        onClear?.();
    };

    return (
        <div className={cn('relative w-full sm:w-64', className)}>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
                id={id}
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={ariaLabel ?? placeholder}
                className="h-11 w-full rounded-md border border-border bg-background pr-9 pl-9 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {value.trim() !== '' ? (
                <button
                    type="button"
                    onClick={clear}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <XIcon className="size-4" />
                </button>
            ) : null}
        </div>
    );
}
