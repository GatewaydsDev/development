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
import { router } from '@inertiajs/react';
import { ChevronDownIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type UserLevelOption = {
    id: number;
    name: string;
};

export type AccessPermission = {
    key: string;
    name: string;
    group: string;
    description: string;
};

type UserLevelSelectProps = {
    id: string;
    label?: string;
    value: string;
    levels: UserLevelOption[];
    permissions?: AccessPermission[];
    canCreate?: boolean;
    reloadOnly?: string;
    emptyLabel: string;
    error?: string;
    onChange: (levelId: string) => void;
};

const reservedLevelNames = ['super admin', 'super administrator'];

export default function UserLevelSelect({
    id,
    label = 'User level',
    value,
    levels,
    permissions = [],
    canCreate = false,
    reloadOnly = 'levels',
    emptyLabel,
    error,
    onChange,
}: UserLevelSelectProps) {
    const selected = levels.find((level) => String(level.id) === value);
    const [query, setQuery] = useState(selected?.name ?? '');
    const [open, setOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const [grantMobile, setGrantMobile] = useState(true);
    const [selectedPermissions, setSelectedPermissions] = useState<
        Record<string, boolean>
    >({});
    const [nameError, setNameError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const blurTimer = useRef<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const cancelClose = () => {
        if (blurTimer.current !== null) {
            window.clearTimeout(blurTimer.current);
            blurTimer.current = null;
        }
    };

    useEffect(() => {
        if (!dialogOpen && !open) {
            setQuery(selected?.name ?? '');
            setIsEditing(false);
        }
    }, [dialogOpen, open, selected?.name]);

    useEffect(
        () => () => {
            if (blurTimer.current !== null) {
                window.clearTimeout(blurTimer.current);
            }
        },
        [],
    );

    const groupedPermissions = useMemo(
        () =>
            permissions.reduce<Record<string, AccessPermission[]>>(
                (groups, permission) => ({
                    ...groups,
                    [permission.group]: [
                        ...(groups[permission.group] ?? []),
                        permission,
                    ],
                }),
                {},
            ),
        [permissions],
    );

    const normalizedQuery = query.trim().toLowerCase();
    const matches =
        !isEditing || normalizedQuery === ''
            ? levels
            : levels.filter((level) =>
                  level.name.toLowerCase().includes(normalizedQuery),
              );
    const showMatches = open && matches.length > 0;

    const chooseLevel = (level: UserLevelOption) => {
        cancelClose();
        onChange(String(level.id));
        setQuery(level.name);
        setIsEditing(false);
        setOpen(false);
        setNameError(undefined);
    };

    const clearLevel = () => {
        cancelClose();
        onChange('');
        setQuery('');
        setIsEditing(false);
        setOpen(false);
        setNameError(undefined);
    };

    const restoreSelection = () => {
        setQuery(selected?.name ?? '');
        setDialogOpen(false);
        setPendingName('');
        setNameError(undefined);
    };

    const finishTyping = () => {
        const typed = query.trim();
        const exact = levels.find(
            (level) => level.name.toLowerCase() === typed.toLowerCase(),
        );

        if (typed === '') {
            onChange('');
            setQuery('');
            return;
        }

        if (exact) {
            chooseLevel(exact);
            return;
        }

        if (
            canCreate &&
            typed.length >= 2 &&
            !reservedLevelNames.includes(typed.toLowerCase())
        ) {
            setPendingName(typed);
            setGrantMobile(true);
            setSelectedPermissions({});
            setNameError(undefined);
            setDialogOpen(true);
            return;
        }

        setQuery(selected?.name ?? '');
        setIsEditing(false);
        setNameError(
            reservedLevelNames.includes(typed.toLowerCase())
                ? 'Super Admin already exists.'
                : canCreate
                  ? undefined
                  : 'Choose a user level that already exists.',
        );
    };

    const scheduleClose = () => {
        cancelClose();
        blurTimer.current = window.setTimeout(() => {
            blurTimer.current = null;
            setOpen(false);
            finishTyping();
        }, 180);
    };

    const createLevel = () => {
        const levelName = pendingName.trim();
        const existing = levels.find(
            (level) => level.name.toLowerCase() === levelName.toLowerCase(),
        );

        if (existing) {
            chooseLevel(existing);
            setDialogOpen(false);
            return;
        }

        setSaving(true);
        setNameError(undefined);

        router.post(
            route('admin.access-control.levels.store'),
            {
                name: levelName,
                grant_mobile: grantMobile,
                permissions: selectedPermissions,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    router.reload({
                        only: [reloadOnly],
                        onSuccess: (page) => {
                            const updated = page.props[reloadOnly] as
                                | UserLevelOption[]
                                | undefined;
                            const created = updated?.find(
                                (level) =>
                                    level.name.toLowerCase() ===
                                    levelName.toLowerCase(),
                            );

                            if (created) {
                                onChange(String(created.id));
                                setQuery(created.name);
                                setDialogOpen(false);
                                setPendingName('');
                            }
                        },
                    });
                },
                onError: (errors) => {
                    setNameError(errors.name);
                },
                onFinish: () => setSaving(false),
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
            <div className="relative">
                <TextInput
                    ref={inputRef}
                    id={id}
                    value={query}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={`${id}-options`}
                    placeholder={emptyLabel}
                    className="h-11 w-full border-border bg-background pe-11 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                    onFocus={(event) => {
                        cancelClose();
                        setIsEditing(false);
                        setOpen(true);
                        event.currentTarget.select();
                    }}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setIsEditing(true);
                        setOpen(true);
                        setNameError(undefined);
                    }}
                    onBlur={scheduleClose}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            setOpen(false);
                            finishTyping();
                        }

                        if (event.key === 'Escape') {
                            setQuery(selected?.name ?? '');
                            setIsEditing(false);
                            setOpen(false);
                        }
                    }}
                />
                <button
                    type="button"
                    className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground"
                    aria-label="Show user levels"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                        cancelClose();

                        if (open) {
                            setOpen(false);
                            finishTyping();
                            return;
                        }

                        setIsEditing(false);
                        setOpen(true);
                        inputRef.current?.focus();
                    }}
                >
                    <ChevronDownIcon className="size-4" />
                </button>
                {showMatches && (
                    <div
                        id={`${id}-options`}
                        role="listbox"
                        className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-background shadow-md"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            cancelClose();
                        }}
                    >
                        {emptyLabel !== '' && (
                            <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                                onClick={clearLevel}
                            >
                                {emptyLabel}
                            </button>
                        )}
                        {matches.map((level) => (
                            <button
                                key={level.id}
                                type="button"
                                role="option"
                                aria-selected={String(level.id) === value}
                                className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                                    String(level.id) === value
                                        ? 'bg-muted font-medium text-foreground'
                                        : 'text-foreground'
                                }`}
                                onClick={() => chooseLevel(level)}
                            >
                                {level.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <InputError message={error ?? nameError} />
            {open &&
                isEditing &&
                normalizedQuery.length >= 2 &&
                matches.length === 0 &&
                canCreate && (
                    <p className="text-sm text-muted-foreground">
                        No level named {query.trim()}. Leave this field and you
                        can add it.
                    </p>
                )}

            <AlertDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    if (!open && !saving) {
                        restoreSelection();
                    }
                }}
            >
                <AlertDialogContent className="max-h-[85vh] overflow-y-auto border-emerald-200 dark:border-emerald-900/70">
                    <AlertDialogHeader>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:mx-0">
                            <SparklesIcon className="size-5" />
                        </div>
                        <AlertDialogTitle>
                            Add {pendingName}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This user level does not exist yet. Add it and
                            choose its access now.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-4">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                            <input
                                type="checkbox"
                                checked={grantMobile}
                                onChange={(event) =>
                                    setGrantMobile(event.target.checked)
                                }
                            />
                            Grant these rights on the mobile app
                        </label>
                        <div className="grid max-h-64 gap-3 overflow-y-auto md:grid-cols-2">
                            {Object.entries(groupedPermissions).map(
                                ([group, groupPermissions]) => (
                                    <fieldset
                                        key={group}
                                        className="rounded-lg border border-border p-3"
                                    >
                                        <legend className="px-1 text-sm font-semibold text-foreground">
                                            {group}
                                        </legend>
                                        <div className="flex flex-col gap-2">
                                            {groupPermissions.map(
                                                (permission) => (
                                                    <label
                                                        key={permission.key}
                                                        className="flex items-start gap-2 text-sm text-foreground"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="mt-1"
                                                            checked={
                                                                selectedPermissions[
                                                                    permission
                                                                        .key
                                                                ] ?? false
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) =>
                                                                setSelectedPermissions(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        [permission.key]:
                                                                            event
                                                                                .target
                                                                                .checked,
                                                                    }),
                                                                )
                                                            }
                                                        />
                                                        <span>
                                                            <span className="block">
                                                                {
                                                                    permission.name
                                                                }
                                                            </span>
                                                            <span className="block text-xs text-muted-foreground">
                                                                {
                                                                    permission.description
                                                                }
                                                            </span>
                                                        </span>
                                                    </label>
                                                ),
                                            )}
                                        </div>
                                    </fieldset>
                                ),
                            )}
                        </div>
                        <InputError message={nameError} />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>
                            No, keep the current level
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={saving}
                            onClick={(event) => {
                                event.preventDefault();
                                createLevel();
                            }}
                        >
                            {saving ? 'Saving...' : 'Yes, add this level'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
