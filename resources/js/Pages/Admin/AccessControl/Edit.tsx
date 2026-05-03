import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
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
                    <form onSubmit={submit}>
                        <Card className="shadow-sm">
                            <CardHeader className="gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                <div>
                                    <CardTitle>Permission matrix</CardTitle>
                                    <CardDescription>
                                        Grant or deny abilities by user level.
                                        Super Admin remains fully checked.
                                    </CardDescription>
                                </div>
                                <Button type="submit" disabled={processing}>
                                    Save permissions
                                </Button>
                            </CardHeader>

                            <CardContent className="flex flex-col gap-6">
                                {Object.entries(groupedPermissions).map(
                                    ([group, groupPermissions]) => (
                                        <div
                                            key={group}
                                            className="overflow-hidden rounded-lg border border-border"
                                        >
                                            <div className="border-b border-border bg-muted/50 px-4 py-3">
                                                <h3 className="font-semibold text-foreground">
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
                                                                        <Badge variant="outline">
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
                                    ),
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
