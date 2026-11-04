import FormActionFab from "@/Components/FormActionFab";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { cn } from "@/lib/utils";
import { Head, Link, useForm } from "@inertiajs/react";
import {
    GlobeIcon,
    LockIcon,
    ShieldCheckIcon,
    SmartphoneIcon,
} from "lucide-react";
import { FormEventHandler, useMemo, useState } from "react";

type Permission = {
    key: string;
    name: string;
    group: string;
    description: string;
};

type Level = {
    id: number;
    uuid: string;
    name: string;
    locked: boolean;
    permissions: Record<string, boolean>;
    mobile_permissions: Record<string, boolean>;
};

type AccessControlProps = {
    permissions: Permission[];
    levels: Level[];
    selectedLevelId?: number | null;
};

type AccessControlForm = {
    levels: Record<string, Record<string, boolean>>;
    mobile_levels: Record<string, Record<string, boolean>>;
};

function Switch({
    checked,
    disabled,
    label,
    onChange,
}: {
    checked: boolean;
    disabled?: boolean;
    label: string;
    onChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-emerald-600" : "bg-muted-foreground/30",
            )}
        >
            <span
                className={cn(
                    "inline-block size-5 rounded-full bg-white shadow transition-transform",
                    checked ? "translate-x-5" : "translate-x-0.5",
                )}
            />
        </button>
    );
}

export default function Edit({
    permissions,
    levels,
    selectedLevelId,
}: AccessControlProps) {
    const { data, setData, patch, processing } = useForm<AccessControlForm>({
        levels: Object.fromEntries(
            levels.map((level) => [level.id, level.permissions]),
        ),
        mobile_levels: Object.fromEntries(
            levels.map((level) => [level.id, level.mobile_permissions]),
        ),
    });
    const [activeId, setActiveId] = useState(
        selectedLevelId ?? levels[0]?.id ?? null,
    );
    const active = levels.find((level) => level.id === activeId) ?? null;

    const groups = useMemo(
        () =>
            permissions.reduce<Record<string, Permission[]>>(
                (acc, permission) => ({
                    ...acc,
                    [permission.group]: [
                        ...(acc[permission.group] ?? []),
                        permission,
                    ],
                }),
                {},
            ),
        [permissions],
    );

    const website = (level: Level, key: string) =>
        level.locked ? true : Boolean(data.levels[level.id]?.[key]);
    const mobile = (level: Level, key: string) =>
        level.locked
            ? true
            : Boolean(
                  data.levels[level.id]?.[key] &&
                  data.mobile_levels[level.id]?.[key],
              );

    const countFor = (level: Level, scope: "web" | "mobile") =>
        permissions.filter((permission) =>
            scope === "web"
                ? website(level, permission.key)
                : mobile(level, permission.key),
        ).length;

    const setWebsite = (level: Level, keys: string[], checked: boolean) => {
        setData({
            levels: {
                ...data.levels,
                [level.id]: {
                    ...data.levels[level.id],
                    ...Object.fromEntries(keys.map((key) => [key, checked])),
                },
            },
            mobile_levels: checked
                ? data.mobile_levels
                : {
                      ...data.mobile_levels,
                      [level.id]: {
                          ...data.mobile_levels[level.id],
                          ...Object.fromEntries(
                              keys.map((key) => [key, false]),
                          ),
                      },
                  },
        });
    };

    const setMobile = (level: Level, keys: string[], checked: boolean) => {
        const allowed = keys.filter((key) => data.levels[level.id]?.[key]);

        setData("mobile_levels", {
            ...data.mobile_levels,
            [level.id]: {
                ...data.mobile_levels[level.id],
                ...Object.fromEntries(allowed.map((key) => [key, checked])),
            },
        });
    };

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        patch(route("admin.access-control.update"));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <Link
                            href={route("admin.access-control.index")}
                            className="transition hover:text-foreground"
                        >
                            Access Control
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Permissions</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Grant permissions
                    </h2>
                </div>
            }
        >
            <Head title="Grant permissions" />

            <form
                onSubmit={submit}
                className="px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:pb-8"
            >
                <FormActionFab
                    cancelHref={route("admin.access-control.index")}
                    saveLabel="Save permissions"
                    disabled={processing}
                />
                <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <aside className="flex flex-col gap-2 lg:sticky lg:top-20 lg:self-start">
                        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            User levels
                        </p>
                        <div className="flex gap-2 overflow-x-auto lg:flex-col">
                            {levels.map((level) => (
                                <button
                                    key={level.id}
                                    type="button"
                                    onClick={() => setActiveId(level.id)}
                                    className={cn(
                                        "flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                                        level.id === activeId
                                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
                                            : "border-border bg-card hover:bg-muted/50",
                                    )}
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        {level.name}
                                        {level.locked && (
                                            <LockIcon className="size-3.5 text-muted-foreground" />
                                        )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {countFor(level, "web")}/
                                        {permissions.length}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route("admin.access-control.index")}>
                                Manage levels
                            </Link>
                        </Button>
                    </aside>

                    {active ? (
                        <section className="flex min-w-0 flex-col gap-5">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                        <ShieldCheckIcon className="size-5" />
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">
                                            {active.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {active.locked
                                                ? "Super Admin always has full access and cannot be changed."
                                                : "Choose what this level can do on the website and mobile app."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="secondary">
                                        <GlobeIcon className="size-3" />
                                        {countFor(active, "web")}/
                                        {permissions.length} website
                                    </Badge>
                                    <Badge variant="secondary">
                                        <SmartphoneIcon className="size-3" />
                                        {countFor(active, "mobile")}/
                                        {permissions.length} mobile
                                    </Badge>
                                </div>
                            </div>

                            {Object.entries(groups).map(([group, items]) => {
                                const keys = items.map((item) => item.key);
                                const allWeb = keys.every((key) =>
                                    website(active, key),
                                );
                                const allMobile = keys.every((key) =>
                                    mobile(active, key),
                                );

                                return (
                                    <div
                                        key={group}
                                        className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                                    >
                                        <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/40 px-4 py-3">
                                            <h4 className="font-semibold text-foreground">
                                                {group}
                                            </h4>
                                            <div className="flex items-center gap-5 text-xs font-medium text-muted-foreground">
                                                <label className="flex items-center gap-2">
                                                    <GlobeIcon className="size-3.5" />
                                                    All
                                                    <Switch
                                                        label={`Toggle all ${group} on the website`}
                                                        checked={allWeb}
                                                        disabled={active.locked}
                                                        onChange={(checked) =>
                                                            setWebsite(
                                                                active,
                                                                keys,
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <SmartphoneIcon className="size-3.5" />
                                                    All
                                                    <Switch
                                                        label={`Toggle all ${group} on mobile`}
                                                        checked={allMobile}
                                                        disabled={active.locked}
                                                        onChange={(checked) =>
                                                            setMobile(
                                                                active,
                                                                keys,
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <ul className="divide-y divide-border">
                                            {items.map((permission) => (
                                                <li
                                                    key={permission.key}
                                                    className="flex items-center justify-between gap-4 px-4 py-3"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-foreground">
                                                            {permission.name}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {
                                                                permission.description
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-5">
                                                        <Switch
                                                            label={`${permission.name} on the website`}
                                                            checked={website(
                                                                active,
                                                                permission.key,
                                                            )}
                                                            disabled={
                                                                active.locked
                                                            }
                                                            onChange={(
                                                                checked,
                                                            ) =>
                                                                setWebsite(
                                                                    active,
                                                                    [
                                                                        permission.key,
                                                                    ],
                                                                    checked,
                                                                )
                                                            }
                                                        />
                                                        <Switch
                                                            label={`${permission.name} on mobile`}
                                                            checked={mobile(
                                                                active,
                                                                permission.key,
                                                            )}
                                                            disabled={
                                                                active.locked ||
                                                                !website(
                                                                    active,
                                                                    permission.key,
                                                                )
                                                            }
                                                            onChange={(
                                                                checked,
                                                            ) =>
                                                                setMobile(
                                                                    active,
                                                                    [
                                                                        permission.key,
                                                                    ],
                                                                    checked,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </section>
                    ) : (
                        <p className="text-muted-foreground">
                            No user levels yet.
                        </p>
                    )}
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
