import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import {
    BID_TEXT_FIELD_GROUP_ORDER,
    BID_TEXT_PLACEHOLDERS,
    placeholderToken,
    slugifyPlaceholderKey,
    suggestedFieldSource,
} from '@/Pages/Admin/Bids/bidText';
import { PageProps } from '@/types';
import { router } from '@inertiajs/react';
import { BracesIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type InsertBidTextFieldOption = {
    key: string;
    label: string;
    group?: string;
    source?: string;
    sourceLabel?: string;
};

type InsertBidTextFieldMenuProps = {
    fields: InsertBidTextFieldOption[];
    values?: Record<string, string>;
    onInsert: (key: string) => void;
    onOpenChange?: (open: boolean) => void;
};

export default function InsertBidTextFieldMenu({
    fields,
    values = {},
    onInsert,
    onOpenChange,
}: InsertBidTextFieldMenuProps) {
    const [query, setQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [fieldName, setFieldName] = useState('');
    const [sourceKey, setSourceKey] = useState('');
    const [sourceQuery, setSourceQuery] = useState('');

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (normalizedQuery === '') {
            return fields;
        }

        return fields.filter((field) => {
            const haystack =
                `${field.label} ${field.key} ${field.sourceLabel ?? ''} ${placeholderToken(field.key)}`.toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }, [fields, normalizedQuery]);

    const groupedFields = useMemo(() => {
        const groups = new Map<string, InsertBidTextFieldOption[]>();

        filtered.forEach((field) => {
            const group = field.group ?? 'Your fields';
            const items = groups.get(group) ?? [];
            items.push(field);
            groups.set(group, items);
        });

        return BID_TEXT_FIELD_GROUP_ORDER.flatMap((group) => {
            const items = groups.get(group);

            return items && items.length > 0 ? [{ group, items }] : [];
        });
    }, [filtered]);

    const exactMatch = fields.find((field) => {
        const queryValue = normalizedQuery;

        return (
            field.label.toLowerCase() === queryValue ||
            field.key.toLowerCase() === queryValue
        );
    });

    const draftedKey = slugifyPlaceholderKey(query);
    const canCreate =
        query.trim() !== '' &&
        draftedKey !== '' &&
        exactMatch === undefined &&
        !isSaving;

    const sourceOptions = useMemo(() => {
        const needle = sourceQuery.trim().toLowerCase();

        return BID_TEXT_PLACEHOLDERS.filter((field) => {
            if (needle === '') {
                return true;
            }

            return `${field.label} ${field.key} ${field.group}`.toLowerCase().includes(
                needle,
            );
        });
    }, [sourceQuery]);

    const groupedSources = useMemo(() => {
        const groups = new Map<string, typeof sourceOptions>();

        sourceOptions.forEach((field) => {
            const items = groups.get(field.group) ?? [];
            items.push(field);
            groups.set(field.group, items);
        });

        return BID_TEXT_FIELD_GROUP_ORDER.flatMap((group) => {
            const items = groups.get(group);

            return items && items.length > 0 ? [{ group, items }] : [];
        });
    }, [sourceOptions]);

    const openCreate = (name: string) => {
        const trimmed = name.trim();
        const suggested = suggestedFieldSource(trimmed);

        setFieldName(trimmed);
        setSourceKey(suggested);
        setSourceQuery('');
        setIsCreateOpen(true);
    };

    const addField = (event?: FormEvent) => {
        event?.preventDefault();
        event?.stopPropagation();

        const name = fieldName.trim();
        const key = slugifyPlaceholderKey(name);

        if (name === '' || key === '') {
            toast.error('Enter a field name.');
            return;
        }

        if (sourceKey === '') {
            toast.error('Choose which value on this bid this field should show.');
            return;
        }

        const existing = fields.find((field) => field.key === key);

        if (existing) {
            onInsert(existing.key);
            setIsCreateOpen(false);
            setQuery('');
            return;
        }

        if (sourceKey === key) {
            onInsert(sourceKey);
            setIsCreateOpen(false);
            setQuery('');
            return;
        }

        onInsert(key);
        setIsCreateOpen(false);
        setQuery('');
        setIsSaving(true);

        router.post(
            route('admin.bid-text-fields.store'),
            { name, source: sourceKey },
            {
                preserveScroll: true,
                preserveState: true,
                onError: (errors) => {
                    setIsSaving(false);
                    toast.error(
                        Object.values(errors)[0] ||
                            'The insert field could not be saved.',
                    );
                },
                onSuccess: (page) => {
                    setIsSaving(false);
                    const created = (page.props as PageProps).flash
                        ?.createdTextField;
                    const source = BID_TEXT_PLACEHOLDERS.find(
                        (field) => field.key === (created?.source || sourceKey),
                    );

                    toast.success(
                        `“${created?.name || name}” now shows ${source?.label ?? 'the linked bid value'}.`,
                    );
                    router.reload({ only: ['options'] });
                },
            },
        );
    };

    return (
        <>
            <DropdownMenu
                modal={false}
                onOpenChange={(open) => {
                    onOpenChange?.(open);

                    if (!open) {
                        setQuery('');
                    }
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                        <BracesIcon />
                        Insert field
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    collisionPadding={12}
                    className="z-[200] w-96 p-0"
                    onCloseAutoFocus={(event) => event.preventDefault()}
                >
                    <div
                        className="sticky top-0 z-10 border-b border-border bg-popover p-2"
                        onKeyDown={(event) => event.stopPropagation()}
                    >
                        <label className="relative block">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter') {
                                        return;
                                    }

                                    event.preventDefault();

                                    if (exactMatch) {
                                        onInsert(exactMatch.key);
                                        return;
                                    }

                                    if (filtered.length === 1) {
                                        onInsert(filtered[0].key);
                                        return;
                                    }

                                    if (canCreate) {
                                        openCreate(query);
                                    }
                                }}
                                placeholder="Search Combined price, project name…"
                                className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-8 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                            />
                        </label>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-1">
                        <DropdownMenuLabel>
                            Insert a live value from this bid
                        </DropdownMenuLabel>
                        {groupedFields.length > 0 ? (
                            groupedFields.map(({ group, items }) => (
                                <div key={group}>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                                        {group}
                                    </DropdownMenuLabel>
                                    <DropdownMenuGroup>
                                        {items.map((field) => (
                                            <DropdownMenuItem
                                                key={field.key}
                                                onClick={() => onInsert(field.key)}
                                            >
                                                <span className="flex min-w-0 flex-col">
                                                    <span>{field.label}</span>
                                                    {field.group === 'Your fields' &&
                                                    field.sourceLabel ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            Shows {field.sourceLabel}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="ml-auto text-xs text-muted-foreground">
                                                    {values[field.key] ||
                                                        placeholderToken(field.key)}
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuGroup>
                                </div>
                            ))
                        ) : (
                            <p className="px-2 py-3 text-sm text-muted-foreground">
                                No matching fields. Add one and link it to a
                                value on this bid.
                            </p>
                        )}
                        {canCreate ? (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    disabled={isSaving}
                                    onSelect={() => openCreate(query)}
                                >
                                    <PlusIcon />
                                    Add “{query.trim()}” and link it
                                </DropdownMenuItem>
                            </>
                        ) : null}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Link this field</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose which value on this bid screen it should
                            show. Combined price, latest revision total, and
                            item quantity update as you edit the lines.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <form className="flex flex-col gap-4" onSubmit={addField}>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="bid-text-field-name"
                                value="Field name in the text"
                            />
                            <TextInput
                                id="bid-text-field-name"
                                value={fieldName}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setFieldName(next);

                                    if (sourceKey === '' || sourceKey === suggestedFieldSource(fieldName)) {
                                        setSourceKey(suggestedFieldSource(next));
                                    }
                                }}
                                placeholder="Combined price"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="bid-text-field-source"
                                value="Show this value from the bid"
                            />
                            <input
                                id="bid-text-field-source"
                                value={sourceQuery}
                                onChange={(event) =>
                                    setSourceQuery(event.target.value)
                                }
                                placeholder="Search Combined price, item quantity…"
                                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                            />
                            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                                {groupedSources.map(({ group, items }) => (
                                    <div key={group} className="p-1">
                                        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                                            {group}
                                        </p>
                                        {items.map((field) => {
                                            const selected =
                                                field.key === sourceKey;
                                            const preview =
                                                values[field.key] || '—';

                                            return (
                                                <button
                                                    key={field.key}
                                                    type="button"
                                                    onClick={() =>
                                                        setSourceKey(field.key)
                                                    }
                                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                                        selected
                                                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100'
                                                            : 'hover:bg-muted'
                                                    }`}
                                                >
                                                    <span className="min-w-0 flex-1">
                                                        {field.label}
                                                    </span>
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {preview}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel type="button">
                                Cancel
                            </AlertDialogCancel>
                            <Button type="submit" disabled={isSaving}>
                                Add field
                            </Button>
                        </AlertDialogFooter>
                    </form>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
