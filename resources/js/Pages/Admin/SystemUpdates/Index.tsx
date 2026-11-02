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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckIcon,
    ChevronDownIcon,
    EyeIcon,
    GitCommitHorizontalIcon,
    LockIcon,
    PlusIcon,
    SearchIcon,
    ShareIcon,
    SparklesIcon,
    Trash2Icon,
    UsersIcon,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type Level = { id: number; name: string };

type Update = {
    uuid: string;
    title: string;
    summary: string | null;
    category: string;
    released_on: string;
    released_label: string;
    details: string[];
    commits: { hash: string; date: string; subject: string }[];
    levels: Level[];
};

type Props = {
    updates: Update[];
    levels: Level[];
    categories: string[];
    windowDays: number;
    canManage: boolean;
};

const categoryStyle: Record<string, string> = {
    Feature:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    Improvement: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    Fix: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    Field: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
};

const inputClass =
    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring';

function weekLabel(date: string): string {
    const day = new Date(`${date}T00:00:00`);
    const start = new Date(day);
    start.setDate(day.getDate() - day.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) =>
        d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return `Week of ${fmt(start)} – ${fmt(end)}`;
}

function AddUpdateForm({
    categories,
    onDone,
}: {
    categories: string[];
    onDone: () => void;
}) {
    const form = useForm({
        title: '',
        summary: '',
        category: categories[0] ?? 'Feature',
        released_on: new Date().toISOString().slice(0, 10),
        details: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            details: data.details
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
        }));
        form.post(route('admin.system-updates.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
        });
    };

    return (
        <form
            onSubmit={submit}
            className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2"
        >
            <div className="md:col-span-2">
                <label className="text-sm font-medium" htmlFor="su-title">
                    Title
                </label>
                <input
                    id="su-title"
                    className={inputClass}
                    value={form.data.title}
                    onChange={(e) => form.setData('title', e.target.value)}
                />
                {form.errors.title && (
                    <p className="text-sm text-destructive">
                        {form.errors.title}
                    </p>
                )}
            </div>
            <div>
                <label className="text-sm font-medium" htmlFor="su-category">
                    Type
                </label>
                <select
                    id="su-category"
                    className={inputClass}
                    value={form.data.category}
                    onChange={(e) => form.setData('category', e.target.value)}
                >
                    {categories.map((category) => (
                        <option key={category}>{category}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium" htmlFor="su-date">
                    Date
                </label>
                <input
                    id="su-date"
                    type="date"
                    className={inputClass}
                    value={form.data.released_on}
                    onChange={(e) =>
                        form.setData('released_on', e.target.value)
                    }
                />
            </div>
            <div className="md:col-span-2">
                <label className="text-sm font-medium" htmlFor="su-summary">
                    Short summary
                </label>
                <input
                    id="su-summary"
                    className={inputClass}
                    value={form.data.summary}
                    onChange={(e) => form.setData('summary', e.target.value)}
                />
            </div>
            <div className="md:col-span-2">
                <label className="text-sm font-medium" htmlFor="su-details">
                    What changed (one line per change)
                </label>
                <textarea
                    id="su-details"
                    rows={4}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.data.details}
                    onChange={(e) => form.setData('details', e.target.value)}
                />
            </div>
            <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={form.processing}>
                    Add update
                </Button>
                <Button type="button" variant="outline" onClick={onDone}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

export default function Index({
    updates,
    levels,
    categories,
    windowDays,
    canManage,
}: Props) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string | null>(null);
    const [open, setOpen] = useState<string[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [adding, setAdding] = useState(false);
    const [sharing, setSharing] = useState<string[] | null>(null);
    const [levelIds, setLevelIds] = useState<number[]>([]);
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState<Update | null>(null);
    const [saving, setSaving] = useState(false);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        return updates.filter(
            (update) =>
                (category === null || update.category === category) &&
                (term === '' ||
                    [update.title, update.summary ?? '', ...update.details]
                        .join(' ')
                        .toLowerCase()
                        .includes(term)),
        );
    }, [updates, search, category]);

    const grouped = useMemo(() => {
        const groups = new Map<string, Update[]>();
        filtered.forEach((update) => {
            const label = weekLabel(update.released_on);
            groups.set(label, [...(groups.get(label) ?? []), update]);
        });

        return [...groups.entries()];
    }, [filtered]);

    const sharedCount = updates.filter((u) => u.levels.length > 0).length;
    const single = sharing?.length === 1;

    const openShare = (uuids: string[]) => {
        const first = updates.find((u) => u.uuid === uuids[0]);
        setLevelIds(
            uuids.length === 1 && first ? first.levels.map((l) => l.id) : [],
        );
        setConfirming(false);
        setSharing(uuids);
    };

    const toggleLevel = (id: number) =>
        setLevelIds((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
        );

    const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
        set(
            list.includes(id)
                ? list.filter((item) => item !== id)
                : [...list, id],
        );

    const confirmShare = () => {
        if (!sharing) {
            return;
        }

        setSaving(true);
        router.post(
            route('admin.system-updates.share'),
            {
                update_uuids: sharing,
                level_ids: levelIds,
                mode: single ? 'set' : 'add',
                confirmed: true,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSharing(null);
                    setConfirming(false);
                    setSelected([]);
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const chosenNames = levels
        .filter((level) => levelIds.includes(level.id))
        .map((level) => level.name);

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        System updates
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        What changed in the last {windowDays} days
                        {canManage ? ' and who can see it.' : '.'}
                    </p>
                </div>
            }
        >
            <Head title="System Updates" />
            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-2xl font-semibold">
                                {updates.length}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Updates in {windowDays} days
                            </p>
                        </div>
                        {canManage && (
                            <div className="rounded-xl border border-border bg-card p-4">
                                <p className="text-2xl font-semibold">
                                    {sharedCount}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Shared with other levels
                                </p>
                            </div>
                        )}
                        <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-2xl font-semibold">
                                {
                                    updates.filter(
                                        (u) => u.category === 'Feature',
                                    ).length
                                }
                            </p>
                            <p className="text-sm text-muted-foreground">
                                New features
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search updates"
                                className={`${inputClass} pl-9`}
                            />
                        </div>
                        {canManage && (
                            <Button
                                type="button"
                                className="gap-2"
                                onClick={() => setAdding((value) => !value)}
                            >
                                <PlusIcon className="size-4" />
                                Add update
                            </Button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {[null, ...categories].map((item) => (
                            <button
                                key={item ?? 'all'}
                                type="button"
                                onClick={() => setCategory(item)}
                                className={`rounded-full border px-3 py-1 text-sm transition ${
                                    category === item
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-border bg-background hover:bg-muted'
                                }`}
                            >
                                {item ?? 'All'}
                            </button>
                        ))}
                    </div>

                    {canManage && adding && (
                        <AddUpdateForm
                            categories={categories}
                            onDone={() => setAdding(false)}
                        />
                    )}

                    {canManage && selected.length > 0 && (
                        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 shadow dark:border-emerald-800 dark:bg-emerald-950">
                            <span className="text-sm font-medium">
                                {selected.length} selected
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => openShare(selected)}
                                >
                                    <ShareIcon className="size-4" />
                                    Share with user levels
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelected([])}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    )}

                    {grouped.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                            <SparklesIcon className="mx-auto mb-2 size-6" />
                            No updates found.
                        </div>
                    )}

                    {grouped.map(([label, items]) => (
                        <section key={label} className="flex flex-col gap-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {label}
                            </h3>
                            <ul className="flex flex-col gap-3 border-l-2 border-emerald-200 pl-4 dark:border-emerald-900">
                                {items.map((update) => {
                                    const expanded = open.includes(update.uuid);
                                    const checked = selected.includes(
                                        update.uuid,
                                    );

                                    return (
                                        <li
                                            key={update.uuid}
                                            className="rounded-xl border border-border bg-card shadow-sm"
                                        >
                                            <div className="flex gap-3 p-4">
                                                {canManage && (
                                                    <button
                                                        type="button"
                                                        role="checkbox"
                                                        aria-checked={checked}
                                                        aria-label={`Select ${update.title}`}
                                                        onClick={() =>
                                                            toggle(
                                                                selected,
                                                                setSelected,
                                                                update.uuid,
                                                            )
                                                        }
                                                        className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded border ${
                                                            checked
                                                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                                                : 'border-border bg-background'
                                                        }`}
                                                    >
                                                        {checked && (
                                                            <CheckIcon className="size-3.5" />
                                                        )}
                                                    </button>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryStyle[update.category] ?? 'bg-muted'}`}
                                                        >
                                                            {update.category}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {
                                                                update.released_label
                                                            }
                                                        </span>
                                                    </div>
                                                    <h4 className="mt-1 text-base font-semibold">
                                                        {update.title}
                                                    </h4>
                                                    {update.summary && (
                                                        <p className="mt-1 text-sm text-muted-foreground">
                                                            {update.summary}
                                                        </p>
                                                    )}
                                                    {canManage && (
                                                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                                            <UsersIcon className="size-4 text-muted-foreground" />
                                                            <Badge
                                                                variant="secondary"
                                                                className="gap-1"
                                                            >
                                                                <LockIcon className="size-3" />
                                                                Super admins
                                                            </Badge>
                                                            {update.levels.map(
                                                                (level) => (
                                                                    <Badge
                                                                        key={
                                                                            level.id
                                                                        }
                                                                        variant="outline"
                                                                    >
                                                                        {
                                                                            level.name
                                                                        }
                                                                    </Badge>
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-2"
                                                            aria-expanded={
                                                                expanded
                                                            }
                                                            onClick={() =>
                                                                toggle(
                                                                    open,
                                                                    setOpen,
                                                                    update.uuid,
                                                                )
                                                            }
                                                        >
                                                            <EyeIcon className="size-4" />
                                                            {expanded
                                                                ? 'Hide the change'
                                                                : 'See the change'}
                                                            <ChevronDownIcon
                                                                className={`size-4 transition ${expanded ? 'rotate-180' : ''}`}
                                                            />
                                                        </Button>
                                                        {canManage && (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="gap-2"
                                                                    onClick={() =>
                                                                        openShare(
                                                                            [
                                                                                update.uuid,
                                                                            ],
                                                                        )
                                                                    }
                                                                >
                                                                    <ShareIcon className="size-4" />
                                                                    Share
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    aria-label={`Delete ${update.title}`}
                                                                    onClick={() =>
                                                                        setDeleting(
                                                                            update,
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2Icon className="size-4 text-destructive" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {expanded && (
                                                <div className="border-t border-border bg-muted/30 p-4">
                                                    {update.details.length >
                                                    0 ? (
                                                        <ul className="list-disc space-y-1 pl-5 text-sm">
                                                            {update.details.map(
                                                                (
                                                                    line,
                                                                    index,
                                                                ) => (
                                                                    <li
                                                                        key={
                                                                            index
                                                                        }
                                                                    >
                                                                        {line}
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">
                                                            No further details.
                                                        </p>
                                                    )}
                                                    {canManage &&
                                                        update.commits.length >
                                                            0 && (
                                                            <details className="mt-4">
                                                                <summary className="cursor-pointer text-sm font-medium">
                                                                    Code commits
                                                                    (
                                                                    {
                                                                        update
                                                                            .commits
                                                                            .length
                                                                    }
                                                                    )
                                                                </summary>
                                                                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
                                                                    {update.commits.map(
                                                                        (
                                                                            commit,
                                                                        ) => (
                                                                            <li
                                                                                key={
                                                                                    commit.hash
                                                                                }
                                                                                className="flex items-start gap-2"
                                                                            >
                                                                                <GitCommitHorizontalIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                                                                <code>
                                                                                    {
                                                                                        commit.hash
                                                                                    }
                                                                                </code>
                                                                                <span className="text-muted-foreground">
                                                                                    {
                                                                                        commit.date
                                                                                    }
                                                                                </span>
                                                                                <span>
                                                                                    {
                                                                                        commit.subject
                                                                                    }
                                                                                </span>
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>
                                                            </details>
                                                        )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>

            <Dialog
                open={sharing !== null && !confirming}
                onOpenChange={(value) => !value && setSharing(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Who can see this?</DialogTitle>
                        <DialogDescription>
                            {single
                                ? 'Tick the user levels that may read this update. Super administrators always can.'
                                : `Tick the user levels that may read these ${sharing?.length} updates. They are added to anyone already allowed.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid max-h-72 gap-2 overflow-y-auto">
                        {levels.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No other user levels exist yet.
                            </p>
                        )}
                        {levels.map((level) => {
                            const on = levelIds.includes(level.id);

                            return (
                                <button
                                    key={level.id}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={on}
                                    onClick={() => toggleLevel(level.id)}
                                    className={`flex min-h-11 items-center gap-3 rounded-lg border-2 px-3 text-left ${
                                        on
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                                            : 'border-border'
                                    }`}
                                >
                                    <span
                                        className={`flex size-5 items-center justify-center rounded border ${
                                            on
                                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                                : 'border-border'
                                        }`}
                                    >
                                        {on && <CheckIcon className="size-3.5" />}
                                    </span>
                                    {level.name}
                                </button>
                            );
                        })}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setSharing(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={!single && levelIds.length === 0}
                            onClick={() => setConfirming(true)}
                        >
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={sharing !== null && confirming}
                onOpenChange={(value) => !value && setConfirming(false)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm sharing</AlertDialogTitle>
                        <AlertDialogDescription>
                            {chosenNames.length > 0
                                ? `${chosenNames.join(', ')} will be able to read ${single ? 'this update' : `${sharing?.length} updates`}.`
                                : 'Only super administrators will be able to read this update.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Go back</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={saving}
                            onClick={confirmShare}
                        >
                            Yes, confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={deleting !== null}
                onOpenChange={(value) => !value && setDeleting(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this update?</AlertDialogTitle>
                        <AlertDialogDescription>
                            “{deleting?.title}” will disappear for everyone who
                            could see it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() =>
                                deleting &&
                                router.delete(
                                    route(
                                        'admin.system-updates.destroy',
                                        deleting.uuid,
                                    ),
                                    { preserveScroll: true },
                                )
                            }
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
