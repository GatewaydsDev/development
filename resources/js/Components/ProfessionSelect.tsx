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
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { BriefcaseBusinessIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

export type ProfessionOption = {
    id: number;
    name: string;
};

type ProfessionSelectProps = {
    id: string;
    value: string;
    professions: ProfessionOption[];
    onChange: (professionId: string, professionName: string) => void;
    error?: string;
};

const newProfessionSchema = z
    .string()
    .trim()
    .min(1, 'Enter the new profession name.')
    .min(3, 'Profession name must be at least 3 characters.');

export default function ProfessionSelect({
    id,
    value,
    professions,
    onChange,
    error,
}: ProfessionSelectProps) {
    const selectedProfession = professions.find(
        (profession) => String(profession.id) === value,
    );
    const [newProfessionName, setNewProfessionName] = useState('');
    const [isAddingProfession, setIsAddingProfession] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const newProfessionInputRef = useRef<HTMLInputElement>(null);
    const normalizedNewProfessionName = newProfessionName.trim();
    const matchingProfession = professions.find(
        (profession) =>
            profession.name.toLowerCase() ===
            normalizedNewProfessionName.toLowerCase(),
    );
    const newProfessionValidation =
        newProfessionSchema.safeParse(newProfessionName);
    const newProfessionError =
        newProfessionName.length > 0 && !newProfessionValidation.success
            ? newProfessionValidation.error.issues[0]?.message
            : undefined;
    const canReviewNewProfession = newProfessionValidation.success;

    useEffect(() => {
        if (!isAddingProfession) {
            return;
        }

        window.requestAnimationFrame(() => {
            newProfessionInputRef.current?.focus();
        });
    }, [isAddingProfession]);

    const selectProfession = (professionId: string) => {
        if (professionId === '__add_new__') {
            setNewProfessionName('');
            setIsAddingProfession(true);
            onChange('', '');
            return;
        }

        const profession = professions.find(
            (item) => String(item.id) === professionId,
        );

        setIsAddingProfession(false);
        setNewProfessionName('');
        onChange(
            profession ? String(profession.id) : '',
            profession?.name ?? '',
        );
    };

    const reviewNewProfession = () => {
        if (!canReviewNewProfession) {
            return;
        }

        if (matchingProfession) {
            onChange(String(matchingProfession.id), matchingProfession.name);
            setIsAddingProfession(false);
            setNewProfessionName('');
            return;
        }

        setIsDialogOpen(true);
    };

    const confirmCreateProfession = () => {
        const professionName = normalizedNewProfessionName;

        if (!canReviewNewProfession) {
            return;
        }

        if (matchingProfession) {
            onChange(String(matchingProfession.id), matchingProfession.name);
            setIsDialogOpen(false);
            setIsAddingProfession(false);
            setNewProfessionName('');
            return;
        }

        setIsSaving(true);
        router.post(
            route('admin.professions.store'),
            { name: professionName },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsAddingProfession(false);
                    router.reload({
                        only: ['professions'],
                        onSuccess: (page) => {
                            const updatedProfessions = page.props
                                .professions as ProfessionOption[];
                            const createdProfession = updatedProfessions.find(
                                (profession) =>
                                    profession.name.toLowerCase() ===
                                    professionName.toLowerCase(),
                            );

                            if (createdProfession) {
                                onChange(
                                    String(createdProfession.id),
                                    createdProfession.name,
                                );
                                setNewProfessionName('');
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
                value="Profession"
                className="text-emerald-700 dark:text-emerald-300"
            />
            <select
                id={id}
                value={value}
                onChange={(event) => selectProfession(event.target.value)}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            >
                <option value="">Select a profession</option>
                {professions.map((profession) => (
                    <option key={profession.id} value={profession.id}>
                        {profession.name}
                    </option>
                ))}
                <option value="__add_new__">+ Add new profession...</option>
            </select>
            <InputError message={error} />
            {selectedProfession ? (
                <Badge variant="outline" className="w-fit">
                    <BriefcaseBusinessIcon className="size-3" />
                    Using saved profession: {selectedProfession.name}
                </Badge>
            ) : null}
            {isAddingProfession && (
                <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                    <InputLabel
                        htmlFor={`${id}-new-profession-inline`}
                        value="New profession name"
                        className="text-emerald-700 dark:text-emerald-300"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <TextInput
                            ref={newProfessionInputRef}
                            id={`${id}-new-profession-inline`}
                            value={newProfessionName}
                            className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                            placeholder="Type the new profession first"
                            onChange={(event) =>
                                setNewProfessionName(event.target.value)
                            }
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!canReviewNewProfession}
                            onClick={reviewNewProfession}
                        >
                            Add profession
                        </Button>
                    </div>
                    <InputError message={newProfessionError} />
                    <p className="text-xs text-muted-foreground">
                        Enter at least 3 characters to enable the confirmation
                        dialog.
                    </p>
                </div>
            )}

            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <AlertDialogContent className="border-emerald-200 dark:border-emerald-900/70">
                    <AlertDialogHeader>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:mx-0">
                            <SparklesIcon className="size-5" />
                        </div>
                        <AlertDialogTitle>
                            Add a new profession
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This profession will be available for future
                            employee pay rates.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                        <InputLabel
                            htmlFor={`${id}-new-profession`}
                            value="New profession name"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <TextInput
                            id={`${id}-new-profession`}
                            value={newProfessionName}
                            className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                            onChange={(event) =>
                                setNewProfessionName(event.target.value)
                            }
                        />
                        <InputError message={newProfessionError} />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={!canReviewNewProfession || isSaving}
                            onClick={(event) => {
                                event.preventDefault();
                                confirmCreateProfession();
                            }}
                        >
                            {isSaving ? 'Saving...' : 'Yes, add profession'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
