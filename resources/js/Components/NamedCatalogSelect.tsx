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
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

export type CatalogOption = {
    id: number;
    name: string;
};

type NamedCatalogSelectProps = {
    id: string;
    label: string;
    placeholder: string;
    addLabel: string;
    items: CatalogOption[];
    value: string;
    reloadKey: 'languages' | 'skills' | 'professions';
    storeRoute: string;
    onChange: (id: string) => void;
    error?: string;
};

const newNameSchema = z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .min(3, 'Use at least 3 characters.');

export default function NamedCatalogSelect({
    id,
    label,
    placeholder,
    addLabel,
    items,
    value,
    reloadKey,
    storeRoute,
    onChange,
    error,
}: NamedCatalogSelectProps) {
    const [newName, setNewName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const normalizedName = newName.trim();
    const matchingItem = items.find(
        (item) => item.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    const validation = newNameSchema.safeParse(newName);
    const nameError =
        newName.length > 0 && !validation.success
            ? validation.error.issues[0]?.message
            : undefined;

    useEffect(() => {
        if (!isAdding) {
            return;
        }

        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
    }, [isAdding]);

    const selectItem = (itemId: string) => {
        if (itemId === '__add_new__') {
            setNewName('');
            setIsAdding(true);
            onChange('');
            return;
        }

        setIsAdding(false);
        setNewName('');
        onChange(itemId);
    };

    const confirmCreate = () => {
        if (!validation.success) {
            return;
        }

        if (matchingItem) {
            onChange(String(matchingItem.id));
            setIsDialogOpen(false);
            setIsAdding(false);
            setNewName('');
            return;
        }

        setIsSaving(true);
        router.post(
            route(storeRoute),
            { name: normalizedName },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsAdding(false);
                    router.reload({
                        only: [reloadKey],
                        onSuccess: (page) => {
                            const updated = page.props[reloadKey] as
                                | CatalogOption[]
                                | undefined;
                            const created = updated?.find(
                                (item) =>
                                    item.name.toLowerCase() ===
                                    normalizedName.toLowerCase(),
                            );

                            if (created) {
                                onChange(String(created.id));
                                setNewName('');
                            }
                        },
                    });
                },
                onFinish: () => setIsSaving(false),
            },
        );
    };

    return (
        <div className="flex flex-col gap-2">
            <InputLabel
                htmlFor={id}
                value={label}
                className="text-emerald-700 dark:text-emerald-300"
            />
            <select
                id={id}
                value={value}
                onChange={(event) => selectItem(event.target.value)}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            >
                <option value="">{placeholder}</option>
                {items.map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.name}
                    </option>
                ))}
                <option value="__add_new__">+ {addLabel}</option>
            </select>
            <InputError message={error} />
            {isAdding && (
                <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <TextInput
                            ref={inputRef}
                            id={`${id}-new`}
                            value={newName}
                            className="h-11 w-full border-border bg-background text-foreground"
                            placeholder={label}
                            onChange={(event) => setNewName(event.target.value)}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!validation.success}
                            onClick={() => setIsDialogOpen(true)}
                        >
                            {addLabel}
                        </Button>
                    </div>
                    <InputError message={nameError} />
                </div>
            )}
            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{addLabel}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {normalizedName} will be available the next time you
                            fill in an employee.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={!validation.success || isSaving}
                            onClick={(event) => {
                                event.preventDefault();
                                confirmCreate();
                            }}
                        >
                            {isSaving ? 'Saving...' : 'Add'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
