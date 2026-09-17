import { Button } from '@/Components/ui/button';
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
    placeholderToken,
    slugifyPlaceholderKey,
} from '@/Pages/Admin/Bids/bidText';
import { PageProps } from '@/types';
import { router } from '@inertiajs/react';
import { BracesIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export type InsertBidTextFieldOption = {
    key: string;
    label: string;
};

type InsertBidTextFieldMenuProps = {
    fields: InsertBidTextFieldOption[];
    onInsert: (key: string) => void;
    onOpenChange?: (open: boolean) => void;
};

export default function InsertBidTextFieldMenu({
    fields,
    onInsert,
    onOpenChange,
}: InsertBidTextFieldMenuProps) {
    const [query, setQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (normalizedQuery === '') {
            return fields;
        }

        return fields.filter((field) => {
            const haystack =
                `${field.label} ${field.key} ${placeholderToken(field.key)}`.toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }, [fields, normalizedQuery]);

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

    const addField = (name: string) => {
        const trimmed = name.trim();
        const key = slugifyPlaceholderKey(trimmed);

        if (key === '') {
            toast.error('Use letters or numbers in the field name.');
            return;
        }

        const existing = fields.find((field) => field.key === key);

        if (existing) {
            onInsert(existing.key);
            setQuery('');
            return;
        }

        onInsert(key);
        setQuery('');
        setIsSaving(true);

        router.post(
            route('admin.bid-text-fields.store'),
            { name: trimmed },
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

                    toast.success(
                        `Added “${created?.name || trimmed}” to the editor. It fills from the bid automatically.`,
                    );
                    router.reload({ only: ['options'] });
                },
            },
        );
    };

    return (
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
                className="z-[200] w-80 p-0"
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

                                if (filtered[0] && exactMatch) {
                                    onInsert(exactMatch.key);
                                    return;
                                }

                                if (filtered.length === 1) {
                                    onInsert(filtered[0].key);
                                    return;
                                }

                                if (canCreate) {
                                    addField(query);
                                }
                            }}
                            placeholder="Search or add a field…"
                            className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-8 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        />
                    </label>
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                    <DropdownMenuLabel>
                        Search a field or add one into the editor
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {filtered.length > 0 ? (
                        <DropdownMenuGroup>
                            {filtered.map((field) => (
                                <DropdownMenuItem
                                    key={field.key}
                                    onClick={() => onInsert(field.key)}
                                >
                                    {field.label}
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {placeholderToken(field.key)}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    ) : (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                            No matching fields. Add it to insert it into the
                            editor.
                        </p>
                    )}
                    {canCreate ? (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={isSaving}
                                onSelect={() => addField(query)}
                            >
                                <PlusIcon />
                                Add “{query.trim()}” to editor
                            </DropdownMenuItem>
                        </>
                    ) : null}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
