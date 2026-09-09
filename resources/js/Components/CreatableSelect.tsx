import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import TextInput from '@/Components/TextInput';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';

export type CreatableOption = {
    id: number;
    name: string;
    abbreviation?: string | null;
    description?: string | null;
    project_number?: string | null;
    kind?: string | null;
    allows_parts?: boolean | null;
    rate?: number | string | null;
};

type CreatableSelectProps = {
    id: string;
    label: string;
    value: string;
    options: CreatableOption[];
    onChange: (id: string, option?: CreatableOption) => void;
    error?: string;
    disabledIds?: string[];
    allowCreate?: boolean;
    createRoute?: string;
    optionsProp?: string;
    catalogKey?: string;
    entityLabel?: string;
    placeholder?: string;
    hint?: string;
    withDescription?: boolean;
    withRate?: boolean;
    compact?: boolean;
    createExtras?: Record<string, string>;
};

const nameSchema = z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(255, 'Name must be 255 characters or less.');

export default function CreatableSelect({
    id,
    label,
    value,
    options,
    onChange,
    error,
    disabledIds = [],
    allowCreate = true,
    createRoute,
    optionsProp = 'options',
    catalogKey,
    entityLabel = 'item',
    placeholder = 'Type to search or add',
    hint,
    withDescription = false,
    withRate = false,
    compact = false,
    createExtras = {},
}: CreatableSelectProps) {
    const listboxId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const commitQueryRef = useRef<() => void>(() => {});
    const selected = options.find((option) => String(option.id) === value);
    const [query, setQuery] = useState(selected?.name ?? '');
    const [description, setDescription] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [hasTyped, setHasTyped] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const [pendingRate, setPendingRate] = useState('');
    const [menuStyle, setMenuStyle] = useState<CSSProperties>({
        position: 'fixed',
        visibility: 'hidden',
        zIndex: 80,
    });
    const openDirectionRef = useRef<'up' | 'down' | null>(null);

    const normalizedQuery = query.trim();
    const selectedName = selected?.name ?? '';
    const exactMatch = options.find(
        (option) => option.name.toLowerCase() === normalizedQuery.toLowerCase(),
    );
    const exactMatchAlreadyAdded =
        exactMatch !== undefined &&
        disabledIds.includes(String(exactMatch.id)) &&
        String(exactMatch.id) !== value;
    const canCreate =
        allowCreate &&
        Boolean(createRoute) &&
        nameSchema.safeParse(query).success &&
        exactMatch === undefined &&
        normalizedQuery !== '';

    const filtered = useMemo(() => {
        const isFiltering = hasTyped && normalizedQuery !== '';

        return [...options]
            .filter((option) => {
                if (!isFiltering) {
                    return true;
                }

                const haystack = `${option.name} ${option.project_number ?? ''}`.toLowerCase();

                return haystack.includes(normalizedQuery.toLowerCase());
            })
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [hasTyped, normalizedQuery, options]);

    const createOptionIndex = canCreate ? filtered.length : -1;
    const optionCount = filtered.length + (canCreate ? 1 : 0);

    useEffect(() => {
        setQuery(selected?.name ?? '');
        setHasTyped(false);
    }, [selected?.name, value]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [query, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            openDirectionRef.current = null;
            return;
        }

        const updateMenuPosition = () => {
            const input = inputRef.current;

            if (!input) {
                return;
            }

            const rect = input.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom - 8;
            const spaceAbove = rect.top - 8;
            const maxHeight = Math.min(320, Math.max(spaceBelow, spaceAbove, 160));

            if (openDirectionRef.current === null) {
                openDirectionRef.current =
                    spaceBelow < 160 && spaceAbove > spaceBelow ? 'up' : 'down';
            }

            const openUp = openDirectionRef.current === 'up';
            const nextStyle: CSSProperties = {
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                maxHeight,
                top: openUp ? undefined : rect.bottom + 4,
                bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
                zIndex: 80,
                visibility: 'visible',
            };

            setMenuStyle((current) => {
                if (
                    current.left === nextStyle.left &&
                    current.width === nextStyle.width &&
                    current.top === nextStyle.top &&
                    current.bottom === nextStyle.bottom &&
                    current.maxHeight === nextStyle.maxHeight &&
                    current.visibility === nextStyle.visibility
                ) {
                    return current;
                }

                return nextStyle;
            });
        };

        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isOpen, filtered.length]);

    const optionLabel = (option: CreatableOption) => {
        const details = [
            option.abbreviation ? option.abbreviation : null,
            option.kind ? option.kind : null,
            option.project_number ? option.project_number : null,
            option.rate !== undefined &&
            option.rate !== null &&
            option.rate !== ''
                ? `${option.rate}%`
                : null,
        ].filter(Boolean);

        return details.length > 0
            ? `${option.name} (${details.join(', ')})`
            : option.name;
    };

    const choose = (option: CreatableOption) => {
        if (
            disabledIds.includes(String(option.id)) &&
            String(option.id) !== value
        ) {
            return;
        }

        onChange(String(option.id), option);
        setQuery(option.name);
        setHasTyped(false);
        setIsOpen(false);
    };

    const askToCreate = (name: string) => {
        const parsed = nameSchema.safeParse(name);

        if (!parsed.success || !createRoute) {
            return;
        }

        const existing = options.find(
            (option) =>
                option.name.toLowerCase() === parsed.data.toLowerCase(),
        );

        if (existing) {
            choose(existing);
            return;
        }

        setPendingName(parsed.data);
        setIsDialogOpen(true);
        setIsOpen(false);
    };

    const commitQuery = (allowCreateOnCommit = false) => {
        if (normalizedQuery === '') {
            if (value !== '') {
                onChange('', undefined);
            }

            setQuery('');
            return;
        }

        if (exactMatch && !exactMatchAlreadyAdded) {
            choose(exactMatch);
            return;
        }

        if (canCreate && filtered.length === 0) {
            if (allowCreateOnCommit) {
                askToCreate(normalizedQuery);
            }

            return;
        }

        if (allowCreateOnCommit && canCreate) {
            askToCreate(normalizedQuery);
            return;
        }

        setQuery(selectedName);
    };

    commitQueryRef.current = () => commitQuery();

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;

            if (
                target &&
                (containerRef.current?.contains(target) ||
                    listRef.current?.contains(target))
            ) {
                return;
            }

            setIsOpen((open) => {
                if (open) {
                    commitQueryRef.current();
                }

                return false;
            });
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, []);

    const confirmCreate = () => {
        if (!createRoute || pendingName === '') {
            return;
        }

        setIsSaving(true);
        router.post(
            createRoute,
            {
                name: pendingName,
                description: withDescription ? description.trim() : undefined,
                rate: withRate && pendingRate !== '' ? pendingRate : undefined,
                ...createExtras,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsDialogOpen(false);
                    router.reload({
                        only: [optionsProp],
                        onSuccess: (page) => {
                            const catalog = page.props[optionsProp] as
                                | Record<string, CreatableOption[]>
                                | CreatableOption[]
                                | undefined;
                            const list = Array.isArray(catalog)
                                ? catalog
                                : catalogKey && catalog
                                  ? (catalog[catalogKey] ?? [])
                                  : [
                                        ...(catalog?.stageTypes ?? []),
                                        ...(catalog?.scopeTitles ?? []),
                                        ...(catalog?.pricingStatuses ?? []),
                                        ...(catalog?.products ?? []),
                                        ...(catalog?.parts ?? []),
                                    ];
                            const created = list.find(
                                (option) =>
                                    option.name.toLowerCase() ===
                                    pendingName.toLowerCase(),
                            );

                            if (created) {
                                onChange(String(created.id), created);
                                setQuery(created.name);
                            }

                            setPendingName('');
                            setPendingRate('');
                            setDescription('');
                        },
                    });
                },
                onFinish: () => setIsSaving(false),
            },
        );
    };

    const highlightOption = (index: number) => {
        if (optionCount === 0) {
            return;
        }

        const nextIndex = (index + optionCount) % optionCount;
        setHighlightedIndex(nextIndex);
        document
            .getElementById(`${listboxId}-option-${nextIndex}`)
            ?.scrollIntoView({ block: 'nearest' });
    };

    const applyHighlighted = () => {
        if (highlightedIndex === createOptionIndex) {
            askToCreate(normalizedQuery);
            return;
        }

        const option = filtered[highlightedIndex];

        if (option) {
            choose(option);
        }
    };

    return (
        <div ref={containerRef} className="flex flex-col gap-2">
            {label ? (
                <InputLabel
                    htmlFor={id}
                    value={label}
                    className="text-emerald-700 dark:text-emerald-300"
                />
            ) : null}
            {hint ? (
                <p className="truncate text-sm text-muted-foreground">{hint}</p>
            ) : null}
            <div className="relative">
                <TextInput
                    ref={inputRef}
                    id={id}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    value={query}
                    autoComplete="off"
                    placeholder={placeholder}
                    className="h-11 w-full border-border bg-background pr-10 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                    onFocus={() => {
                        setHasTyped(false);
                        setIsOpen(true);
                        window.requestAnimationFrame(() => {
                            inputRef.current?.select();
                        });
                    }}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setHasTyped(true);
                        setIsOpen(true);

                        if (event.target.value.trim() === '') {
                            onChange('', undefined);
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setIsOpen(true);
                            highlightOption(isOpen ? highlightedIndex + 1 : 0);
                            return;
                        }

                        if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            setIsOpen(true);
                            highlightOption(highlightedIndex - 1);
                            return;
                        }

                        if (event.key === 'Enter') {
                            event.preventDefault();

                            if (isOpen && optionCount > 0) {
                                applyHighlighted();
                                return;
                            }

                            commitQuery(true);
                            return;
                        }

                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setIsOpen(false);
                            setQuery(selectedName);
                            return;
                        }

                        if (event.key === 'Tab') {
                            setIsOpen(false);
                            commitQuery();
                        }
                    }}
                />
                <ChevronDownIcon
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                />
            </div>
            {isOpen &&
                createPortal(
                    <div
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        style={menuStyle}
                        className="overflow-auto rounded-md border border-border bg-background py-1 shadow-lg"
                    >
                        {filtered.map((option, index) => {
                            const optionId = String(option.id);
                            const isSelected = optionId === value;
                            const isDisabled =
                                disabledIds.includes(optionId) && !isSelected;

                            return (
                                <button
                                    key={option.id}
                                    id={`${listboxId}-option-${index}`}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    disabled={isDisabled}
                                    className={cn(
                                        'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm',
                                        isDisabled
                                            ? 'cursor-not-allowed text-muted-foreground'
                                            : 'text-foreground',
                                        highlightedIndex === index &&
                                            !isDisabled &&
                                            'bg-emerald-50 dark:bg-emerald-950/40',
                                    )}
                                    onMouseEnter={() =>
                                        setHighlightedIndex(index)
                                    }
                                    onMouseDown={(event) =>
                                        event.preventDefault()
                                    }
                                    onClick={() => choose(option)}
                                >
                                    <span className="flex w-full items-center justify-between gap-3">
                                        <span className="min-w-0 truncate">
                                            {optionLabel(option)}
                                            {isDisabled
                                                ? ' (already added)'
                                                : ''}
                                        </span>
                                        {isSelected ? (
                                            <CheckIcon className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                                        ) : null}
                                    </span>
                                    {option.description ? (
                                        <span className="line-clamp-2 text-xs text-muted-foreground">
                                            {option.description}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                        {canCreate ? (
                            <button
                                id={`${listboxId}-option-${createOptionIndex}`}
                                type="button"
                                role="option"
                                aria-selected={false}
                                className={cn(
                                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 dark:text-emerald-300',
                                    highlightedIndex === createOptionIndex &&
                                        'bg-emerald-50 dark:bg-emerald-950/40',
                                )}
                                onMouseEnter={() =>
                                    setHighlightedIndex(createOptionIndex)
                                }
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => askToCreate(normalizedQuery)}
                            >
                                <PlusIcon className="size-4 shrink-0" />
                                Create “{normalizedQuery}”
                            </button>
                        ) : null}
                        {filtered.length === 0 && !canCreate ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">
                                {exactMatchAlreadyAdded
                                    ? 'This item is already added.'
                                    : 'No matches found.'}
                            </p>
                        ) : null}
                    </div>,
                    document.body,
                )}
            <InputError
                message={
                    error ||
                    (exactMatchAlreadyAdded
                        ? 'This item is already added.'
                        : undefined)
                }
            />
            {canCreate &&
            !compact &&
            !isDialogOpen &&
            filtered.length === 0 ? (
                <button
                    type="button"
                    className="inline-flex w-fit items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                    onClick={() => askToCreate(normalizedQuery)}
                >
                    <PlusIcon className="size-4" />
                    Create “{normalizedQuery}”?
                </button>
            ) : null}

            <AlertDialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    setIsDialogOpen(open);

                    if (!open && !isSaving) {
                        setPendingName('');
                        setPendingRate('');
                        setDescription('');
                        setQuery(selectedName);
                    }
                }}
            >
                <AlertDialogContent className="border-emerald-200 dark:border-emerald-900/70">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Create this {entityLabel}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            “{pendingName}” is not in the list yet. Create it so
                            it can be reused later?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {withDescription ? (
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`${id}-description`}
                                value="Description"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <textarea
                                id={`${id}-description`}
                                value={description}
                                rows={3}
                                placeholder="Doors, parts, and work to include"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                            />
                        </div>
                    ) : null}
                    {withRate ? (
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`${id}-rate`}
                                value="Tax percent"
                                className="text-emerald-700 dark:text-emerald-300"
                            />
                            <MaskedDecimalInput
                                id={`${id}-rate`}
                                suffix="%"
                                withThousands={false}
                                maxDecimals={3}
                                value={pendingRate}
                                className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                placeholder="6.625"
                                onChange={setPendingRate}
                            />
                        </div>
                    ) : null}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>
                            No, go back
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={
                                isSaving ||
                                pendingName === '' ||
                                (withRate && pendingRate === '')
                            }
                            onClick={(event) => {
                                event.preventDefault();
                                confirmCreate();
                            }}
                        >
                            {isSaving
                                ? 'Saving...'
                                : `Yes, create ${entityLabel}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
