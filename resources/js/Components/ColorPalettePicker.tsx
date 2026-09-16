import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { cn } from '@/lib/utils';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { CheckIcon } from 'lucide-react';

const PALETTE = [
    '#065F46',
    '#047857',
    '#059669',
    '#10B981',
    '#064E3B',
    '#022C22',
    '#0F766E',
    '#155E75',
    '#1E3A8A',
    '#1D4ED8',
    '#2563EB',
    '#0F172A',
    '#7C2D12',
    '#9A3412',
    '#B91C1C',
    '#991B1B',
    '#6B21A8',
    '#7C3AED',
    '#374151',
    '#111827',
    '#000000',
    '#FFFFFF',
    '#F8FAFC',
    '#E5E7EB',
];

function formatHex(value: string, fallback = '#065F46'): string {
    let hex = value.trim();

    if (hex !== '' && !hex.startsWith('#')) {
        hex = `#${hex}`;
    }

    hex = hex.toUpperCase();

    if (/^#[0-9A-F]{6}$/.test(hex)) {
        return hex;
    }

    if (/^#[0-9A-F]{3}$/.test(hex)) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }

    return fallback;
}

type ColorPalettePickerProps = {
    id: string;
    label: string;
    hint?: string;
    value: string;
    error?: string;
    onChange: (hex: string) => void;
};

export default function ColorPalettePicker({
    id,
    label,
    hint,
    value,
    error,
    onChange,
}: ColorPalettePickerProps) {
    const selected = formatHex(value);

    const chooseColor = (hex: string, close?: () => void) => {
        onChange(formatHex(hex));
        close?.();
    };

    return (
        <div className="flex flex-col gap-2">
            <InputLabel
                htmlFor={id}
                value={label}
                className="text-emerald-700 dark:text-emerald-300"
            />
            <Popover className="relative">
                <div className="flex items-center gap-3">
                    <PopoverButton
                        type="button"
                        className="size-11 shrink-0 rounded-md border border-border shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: selected }}
                        aria-label={`Open color palette for ${label}`}
                    />
                    <TextInput
                        id={id}
                        value={value.toUpperCase()}
                        onChange={(event) => {
                            let next = event.target.value.trim().toUpperCase();

                            if (next !== '' && !next.startsWith('#')) {
                                next = `#${next}`;
                            }

                            onChange(next.slice(0, 7));
                        }}
                        className="h-11 w-full uppercase"
                        maxLength={7}
                        placeholder="#065F46"
                    />
                </div>
                <PopoverPanel
                    portal
                    anchor="bottom start"
                    className="z-50 w-72 rounded-xl border border-border bg-background p-4 shadow-lg"
                >
                    {({ close }) => (
                        <div className="flex flex-col gap-4">
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    Color palette
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Click a color to fill the hex value.
                                </p>
                            </div>
                            <div className="grid grid-cols-8 gap-2">
                                {PALETTE.map((color) => {
                                    const isSelected =
                                        selected.toLowerCase() ===
                                        color.toLowerCase();

                                    return (
                                        <button
                                            key={color}
                                            type="button"
                                            title={color}
                                            onClick={() =>
                                                chooseColor(color, close)
                                            }
                                            className={cn(
                                                'relative size-7 rounded-md border border-border',
                                                isSelected &&
                                                    'ring-2 ring-ring ring-offset-2 ring-offset-background',
                                            )}
                                            style={{ backgroundColor: color }}
                                            aria-label={`Choose ${color}`}
                                            aria-pressed={isSelected}
                                        >
                                            {isSelected ? (
                                                <CheckIcon
                                                    className={cn(
                                                        'absolute inset-0 m-auto size-3.5',
                                                        color === '#FFFFFF' ||
                                                            color === '#F8FAFC' ||
                                                            color === '#E5E7EB'
                                                            ? 'text-foreground'
                                                            : 'text-white',
                                                    )}
                                                />
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Custom color
                                </p>
                                <input
                                    type="color"
                                    value={selected}
                                    onChange={(event) =>
                                        chooseColor(event.target.value)
                                    }
                                    className="h-11 w-full cursor-pointer rounded-md border border-border bg-background p-1"
                                    aria-label={`Custom ${label}`}
                                />
                            </div>
                        </div>
                    )}
                </PopoverPanel>
            </Popover>
            {hint ? (
                <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
            <InputError message={error} />
        </div>
    );
}
