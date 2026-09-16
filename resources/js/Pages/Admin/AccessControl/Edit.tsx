import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import { Badge } from '@/Components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { CheckCircle2Icon } from 'lucide-react';
import { FormEventHandler } from 'react';

type Permission = {
    key: string;
    name: string;
    group: string;
    description: string;
};

type Level = {
    id: number;
    name: string;
    locked: boolean;
    permissions: Record<string, boolean>;
};

type AccessControlProps = {
    permissions: Permission[];
    levels: Level[];
    selectedLevelId?: number | null;
};

type AccessControlForm = {
    levels: Record<string, Record<string, boolean>>;
};

const permissionGroupStyles: Record<
    string,
    { panel: string; header: string; title: string; badge: string }
> = {
    Pages: {
        panel: 'border-slate-300/60 dark:border-slate-700/70',
        header: 'border-slate-900/20 bg-slate-900 dark:border-slate-400/20',
        title: 'text-slate-50',
        badge: 'border-slate-600/30 bg-slate-500/10 text-slate-800 dark:border-slate-300/30 dark:bg-slate-400/10 dark:text-slate-200',
    },
    Account: {
        panel: 'border-cyan-300/60 dark:border-cyan-800/70',
        header: 'border-cyan-900/20 bg-cyan-950 dark:border-cyan-400/20',
        title: 'text-cyan-50',
        badge: 'border-cyan-600/30 bg-cyan-500/10 text-cyan-800 dark:border-cyan-300/30 dark:bg-cyan-400/10 dark:text-cyan-200',
    },
    Users: {
        panel: 'border-blue-300/60 dark:border-blue-800/70',
        header: 'border-blue-900/20 bg-blue-950 dark:border-blue-400/20',
        title: 'text-blue-50',
        badge: 'border-blue-600/30 bg-blue-500/10 text-blue-800 dark:border-blue-300/30 dark:bg-blue-400/10 dark:text-blue-200',
    },
    Company: {
        panel: 'border-amber-300/60 dark:border-amber-800/70',
        header: 'border-amber-900/20 bg-amber-950 dark:border-amber-400/20',
        title: 'text-amber-50',
        badge: 'border-amber-600/30 bg-amber-500/10 text-amber-800 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-200',
    },
    'Access Control': {
        panel: 'border-violet-300/60 dark:border-violet-800/70',
        header: 'border-violet-900/20 bg-violet-950 dark:border-violet-400/20',
        title: 'text-violet-50',
        badge: 'border-violet-600/30 bg-violet-500/10 text-violet-800 dark:border-violet-300/30 dark:bg-violet-400/10 dark:text-violet-200',
    },
    Notifications: {
        panel: 'border-rose-300/60 dark:border-rose-800/70',
        header: 'border-rose-900/20 bg-rose-950 dark:border-rose-400/20',
        title: 'text-rose-50',
        badge: 'border-rose-600/30 bg-rose-500/10 text-rose-800 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-200',
    },
    Projects: {
        panel: 'border-indigo-300/60 dark:border-indigo-800/70',
        header: 'border-indigo-900/20 bg-indigo-950 dark:border-indigo-400/20',
        title: 'text-indigo-50',
        badge: 'border-indigo-600/30 bg-indigo-500/10 text-indigo-800 dark:border-indigo-300/30 dark:bg-indigo-400/10 dark:text-indigo-200',
    },
    Employees: {
        panel: 'border-orange-300/60 dark:border-orange-800/70',
        header: 'border-orange-900/20 bg-orange-950 dark:border-orange-400/20',
        title: 'text-orange-50',
        badge: 'border-orange-600/30 bg-orange-500/10 text-orange-800 dark:border-orange-300/30 dark:bg-orange-400/10 dark:text-orange-200',
    },
};

function groupStyle(group: string) {
    return (
        permissionGroupStyles[group] ?? {
            panel: 'border-border',
            header: 'border-emerald-900/20 bg-emerald-950 dark:border-emerald-400/20',
            title: 'text-emerald-50',
            badge: 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-200',
        }
    );
}

export default function Edit({
    permissions,
    levels,
    selectedLevelId,
}: AccessControlProps) {
    const { data, setData, patch, processing } = useForm<AccessControlForm>({
        levels: levels.reduce<Record<string, Record<string, boolean>>>(
            (currentLevels, level) => ({
                ...currentLevels,
                [level.id]: level.permissions,
            }),
            {},
        ),
    });

    const groupedPermissions = permissions.reduce<Record<string, Permission[]>>(
        (groups, permission) => ({
            ...groups,
            [permission.group]: [
                ...(groups[permission.group] ?? []),
                permission,
            ],
        }),
        {},
    );

    const togglePermission = (
        levelId: number,
        permissionKey: string,
        checked: boolean,
    ) => {
        setData('levels', {
            ...data.levels,
            [levelId]: {
                ...data.levels[levelId],
                [permissionKey]: checked,
            },
        });
    };

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        patch(route('admin.access-control.update'));
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <Link
                            href={route('admin.users.index')}
                            className="transition hover:text-foreground"
                        >
                            Users
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">
                            Access Control
                        </span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        User level permissions
                    </h2>
                </div>
            }
        >
            <Head title="Access Control" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <form onSubmit={submit} className="min-w-0 pr-4 pb-28 sm:pr-20 lg:pb-6">
                        <FormActionFab
                            cancelHref={route('admin.users.index')}
                            saveLabel="Save permissions"
                            disabled={processing}
                        />
                        <Card className="shadow-sm">
                            <CardHeader className="gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                <div>
                                    <CardTitle>Permission matrix</CardTitle>
                                    <CardDescription>
                                        Grant or deny abilities by user level.
                                        Super Admin remains fully checked.
                                    </CardDescription>
                                </div>
                            </CardHeader>

                            <CardContent className="flex flex-col gap-6">
                                {Object.entries(groupedPermissions).map(
                                    ([group, groupPermissions]) => {
                                        const styles = groupStyle(group);

                                        return (
                                            <div
                                                key={group}
                                                className={cn(
                                                    'overflow-hidden rounded-lg border',
                                                    styles.panel,
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        'border-b px-4 py-4',
                                                        styles.header,
                                                    )}
                                                >
                                                    <h3
                                                        className={cn(
                                                            'text-lg font-bold tracking-wide sm:text-xl',
                                                            styles.title,
                                                        )}
                                                    >
                                                        {group}
                                                    </h3>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <div className="min-w-[760px]">
                                                        <div className="grid grid-cols-[1.4fr_repeat(6,minmax(120px,1fr))] border-b border-border bg-background px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        <div>Permission</div>
                                                        {levels.map(
                                                            (level) => (
                                                                <div
                                                                    key={
                                                                        level.id
                                                                    }
                                                                    className={
                                                                        'rounded-md px-2 py-1 text-center ' +
                                                                        (selectedLevelId ===
                                                                        level.id
                                                                            ? 'bg-primary text-primary-foreground'
                                                                            : '')
                                                                    }
                                                                >
                                                                    {
                                                                        level.name
                                                                    }
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>

                                                    {groupPermissions.map(
                                                        (permission) => (
                                                            <div
                                                                key={
                                                                    permission.key
                                                                }
                                                                className="grid grid-cols-[1.4fr_repeat(6,minmax(120px,1fr))] items-center border-b border-border px-4 py-4 last:border-b-0"
                                                            >
                                                                <div className="pr-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-medium text-foreground">
                                                                            {
                                                                                permission.name
                                                                            }
                                                                        </p>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={
                                                                                styles.badge
                                                                            }
                                                                        >
                                                                            {
                                                                                permission.key
                                                                            }
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                                        {
                                                                            permission.description
                                                                        }
                                                                    </p>
                                                                </div>

                                                                {levels.map(
                                                                    (level) => {
                                                                        const checked =
                                                                            Boolean(
                                                                                data
                                                                                    .levels[
                                                                                    level
                                                                                        .id
                                                                                ]?.[
                                                                                    permission
                                                                                        .key
                                                                                ],
                                                                            );

                                                                        return (
                                                                            <label
                                                                                key={`${level.id}-${permission.key}`}
                                                                                className={
                                                                                    'flex justify-center rounded-md py-1 ' +
                                                                                    (selectedLevelId ===
                                                                                    level.id
                                                                                        ? 'bg-muted'
                                                                                        : '')
                                                                                }
                                                                            >
                                                                                <span className="sr-only">
                                                                                    {checked
                                                                                        ? 'Deny'
                                                                                        : 'Grant'}{' '}
                                                                                    {
                                                                                        permission.name
                                                                                    }{' '}
                                                                                    for{' '}
                                                                                    {
                                                                                        level.name
                                                                                    }
                                                                                </span>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={
                                                                                        checked
                                                                                    }
                                                                                    disabled={
                                                                                        level.locked
                                                                                    }
                                                                                    onChange={(
                                                                                        event,
                                                                                    ) =>
                                                                                        togglePermission(
                                                                                            level.id,
                                                                                            permission.key,
                                                                                            event
                                                                                                .target
                                                                                                .checked,
                                                                                        )
                                                                                    }
                                                                                    className="size-5 rounded border-border text-primary shadow-sm focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                                                                />
                                                                            </label>
                                                                        );
                                                                    },
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    },
                                )}

                                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                                    <p>
                                        Changes are applied immediately after
                                        saving. Checked boxes mean the user
                                        level is granted that permission.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
