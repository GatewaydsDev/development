import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
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
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import {
    CheckIcon,
    ChevronDownIcon,
    HammerIcon,
    PlusIcon,
    SparklesIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

export type ContractorOption = {
    id: number;
    name: string;
    contact_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
};

type ContractorSelectProps = {
    id: string;
    value: string;
    contractors: ContractorOption[];
    disabledIds?: string[];
    onChange: (contractorId: string, contractorName: string) => void;
    error?: string;
};

const newContractorSchema = z
    .string()
    .trim()
    .min(1, 'Enter the contractor name.')
    .max(255, 'Contractor name must be 255 characters or less.');

export default function ContractorSelect({
    id,
    value,
    contractors,
    disabledIds = [],
    onChange,
    error,
}: ContractorSelectProps) {
    const listboxId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const commitQueryRef = useRef<() => void>(() => {});
    const selectedContractor = contractors.find(
        (contractor) => String(contractor.id) === value,
    );
    const [query, setQuery] = useState(selectedContractor?.name ?? '');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingCreateName, setPendingCreateName] = useState('');

    const normalizedQuery = query.trim();
    const selectedName = selectedContractor?.name ?? '';
    const queryValidation = newContractorSchema.safeParse(query);
    const exactMatch = contractors.find(
        (contractor) =>
            contractor.name.toLowerCase() === normalizedQuery.toLowerCase(),
    );
    const exactMatchAlreadyAdded =
        exactMatch !== undefined &&
        disabledIds.includes(String(exactMatch.id)) &&
        String(exactMatch.id) !== value;
    const canCreate =
        queryValidation.success &&
        exactMatch === undefined &&
        normalizedQuery !== '';

    const filteredContractors = useMemo(() => {
        const isFiltering =
            normalizedQuery !== '' &&
            normalizedQuery.toLowerCase() !== selectedName.toLowerCase();

        return contractors
            .filter((contractor) => {
                if (!isFiltering) {
                    return true;
                }

                return contractor.name
                    .toLowerCase()
                    .includes(normalizedQuery.toLowerCase());
            })
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [contractors, normalizedQuery, selectedName]);

    const createOptionIndex = canCreate ? filteredContractors.length : -1;
    const optionCount =
        filteredContractors.length + (canCreate ? 1 : 0);

    useEffect(() => {
        setQuery(selectedContractor?.name ?? '');
    }, [selectedContractor?.name, value]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [query, isOpen]);

    const chooseContractor = (contractor: ContractorOption) => {
        if (
            disabledIds.includes(String(contractor.id)) &&
            String(contractor.id) !== value
        ) {
            return;
        }

        onChange(String(contractor.id), contractor.name);
        setQuery(contractor.name);
        setIsOpen(false);
    };

    const askToCreate = (name: string) => {
        const parsed = newContractorSchema.safeParse(name);

        if (!parsed.success) {
            return;
        }

        const existing = contractors.find(
            (contractor) =>
                contractor.name.toLowerCase() === parsed.data.toLowerCase(),
        );

        if (existing) {
            chooseContractor(existing);
            return;
        }

        setPendingCreateName(parsed.data);
        setIsDialogOpen(true);
        setIsOpen(false);
    };

    const commitQuery = (allowCreate = false) => {
        if (normalizedQuery === '') {
            if (value !== '') {
                onChange('', '');
            }

            setQuery('');
            return;
        }

        if (exactMatch && !exactMatchAlreadyAdded) {
            chooseContractor(exactMatch);
            return;
        }

        if (canCreate && filteredContractors.length === 0) {
            if (allowCreate) {
                askToCreate(normalizedQuery);
            }

            return;
        }

        if (allowCreate && canCreate) {
            askToCreate(normalizedQuery);
            return;
        }

        setQuery(selectedName);
    };

    commitQueryRef.current = commitQuery;

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;

            if (target && containerRef.current?.contains(target)) {
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

    const confirmCreateContractor = () => {
        const contractorName = pendingCreateName.trim();

        if (contractorName === '') {
            return;
        }

        const existing = contractors.find(
            (contractor) =>
                contractor.name.toLowerCase() === contractorName.toLowerCase(),
        );

        if (existing) {
            chooseContractor(existing);
            setIsDialogOpen(false);
            setPendingCreateName('');
            return;
        }

        setIsSaving(true);
        router.post(
            route('admin.contractors.store'),
            { name: contractorName },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsDialogOpen(false);
                    router.reload({
                        only: ['options'],
                        onSuccess: (page) => {
                            const updatedOptions = page.props.options as {
                                contractors?: ContractorOption[];
                            };
                            const createdContractor =
                                updatedOptions.contractors?.find(
                                    (contractor) =>
                                        contractor.name.toLowerCase() ===
                                        contractorName.toLowerCase(),
                                );

                            if (createdContractor) {
                                onChange(
                                    String(createdContractor.id),
                                    createdContractor.name,
                                );
                                setQuery(createdContractor.name);
                            }

                            setPendingCreateName('');
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

    const applyHighlightedOption = () => {
        if (highlightedIndex === createOptionIndex) {
            askToCreate(normalizedQuery);
            return;
        }

        const contractor = filteredContractors[highlightedIndex];

        if (contractor) {
            chooseContractor(contractor);
        }
    };

    return (
        <div ref={containerRef} className="flex flex-col gap-2">
            <InputLabel
                htmlFor={id}
                value="Contractor name"
                className="text-emerald-700 dark:text-emerald-300"
            />
            <div className="relative">
                <TextInput
                    ref={inputRef}
                    id={id}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    aria-activedescendant={
                        isOpen && optionCount > 0
                            ? `${listboxId}-option-${highlightedIndex}`
                            : undefined
                    }
                    value={query}
                    autoComplete="off"
                    placeholder="Type to search or add a contractor"
                    className="h-11 w-full border-border bg-background pr-10 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                    onFocus={() => {
                        setIsOpen(true);
                        window.requestAnimationFrame(() => {
                            inputRef.current?.select();
                        });
                    }}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setIsOpen(true);

                        if (event.target.value.trim() === '') {
                            onChange('', '');
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setIsOpen(true);
                            highlightOption(
                                isOpen ? highlightedIndex + 1 : 0,
                            );
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
                                applyHighlightedOption();
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
                {isOpen && (
                    <div
                        id={listboxId}
                        role="listbox"
                        className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-lg"
                    >
                        {filteredContractors.map((contractor, index) => {
                            const contractorId = String(contractor.id);
                            const isSelected = contractorId === value;
                            const isDisabled =
                                disabledIds.includes(contractorId) &&
                                !isSelected;

                            return (
                                <button
                                    key={contractor.id}
                                    id={`${listboxId}-option-${index}`}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    disabled={isDisabled}
                                    className={cn(
                                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
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
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                    }}
                                    onClick={() => chooseContractor(contractor)}
                                >
                                    <span className="min-w-0 truncate">
                                        {contractor.name}
                                        {isDisabled
                                            ? ' (already added)'
                                            : ''}
                                    </span>
                                    {isSelected ? (
                                        <CheckIcon className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
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
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                }}
                                onClick={() => askToCreate(normalizedQuery)}
                            >
                                <PlusIcon className="size-4 shrink-0" />
                                <span className="min-w-0 truncate">
                                    Create “{normalizedQuery}”
                                </span>
                            </button>
                        ) : null}
                        {filteredContractors.length === 0 && !canCreate ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">
                                {exactMatchAlreadyAdded
                                    ? 'This contractor is already added.'
                                    : 'No contractors match that name.'}
                            </p>
                        ) : null}
                    </div>
                )}
            </div>
            <InputError
                message={
                    error ||
                    (exactMatchAlreadyAdded
                        ? 'This contractor is already added.'
                        : undefined)
                }
            />
            {canCreate &&
            !isDialogOpen &&
            filteredContractors.length === 0 ? (
                <button
                    type="button"
                    className="inline-flex w-fit items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                    onClick={() => askToCreate(normalizedQuery)}
                >
                    <PlusIcon className="size-4" />
                    Create “{normalizedQuery}”?
                </button>
            ) : null}
            {selectedContractor ? (
                <Badge variant="outline" className="w-fit">
                    <HammerIcon className="size-3" />
                    Using saved contractor: {selectedContractor.name}
                </Badge>
            ) : null}
            <p className="text-xs text-muted-foreground">
                Type to choose a saved contractor. If the name is new, confirm
                when asked to create it.
            </p>

            <AlertDialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    setIsDialogOpen(open);

                    if (!open && !isSaving) {
                        setPendingCreateName('');
                        setQuery(selectedName);
                    }
                }}
            >
                <AlertDialogContent className="border-emerald-200 dark:border-emerald-900/70">
                    <AlertDialogHeader>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:mx-0">
                            <SparklesIcon className="size-5" />
                        </div>
                        <AlertDialogTitle>
                            Create this contractor?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            “{pendingCreateName}” is not in the list yet. Create
                            it so it can be reused on other projects?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>
                            No, go back
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isSaving || pendingCreateName === ''}
                            onClick={(event) => {
                                event.preventDefault();
                                confirmCreateContractor();
                            }}
                        >
                            {isSaving ? 'Saving...' : 'Yes, create contractor'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
