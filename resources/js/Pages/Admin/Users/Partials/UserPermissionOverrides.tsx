import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import {
    GlobeIcon,
    ShieldCheckIcon,
    SmartphoneIcon,
    Undo2Icon,
} from 'lucide-react';
import { FormEventHandler, useMemo } from 'react';

export type UserAccessPermission = {
    key: string;
    name: string;
    group: string;
    description: string;
    parent_key?: string | null;
};

type OverrideValue = boolean | null;

type Props = {
    userUuid: string;
    userName: string;
    levelName: string;
    permissions: UserAccessPermission[];
    permissionOverrides: Record<string, boolean>;
    mobilePermissionOverrides: Record<string, boolean>;
    levelPermissions: Record<string, boolean>;
    levelMobilePermissions: Record<string, boolean>;
};

const initialOverrides = (
    permissions: UserAccessPermission[],
    overrides: Record<string, boolean>,
) =>
    Object.fromEntries(
        permissions.map((permission) => [
            permission.key,
            Object.prototype.hasOwnProperty.call(overrides, permission.key)
                ? overrides[permission.key]
                : null,
        ]),
    ) as Record<string, OverrideValue>;

function OverrideSwitch({
    value,
    inherited,
    label,
    onChange,
}: {
    value: OverrideValue;
    inherited: boolean;
    label: string;
    onChange: (value: OverrideValue) => void;
}) {
    const effective = value ?? inherited;

    return (
        <div className="flex min-w-28 flex-col items-end gap-1">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    disabled={value === null}
                    className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition',
                        value === null
                            ? 'bg-muted text-muted-foreground'
                            : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50',
                    )}
                >
                    {value === null ? 'Level' : 'Reset'}
                </button>
                <button
                    type="button"
                    role="switch"
                    aria-checked={effective}
                    aria-label={label}
                    onClick={() => onChange(!effective)}
                    className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        effective
                            ? 'border-emerald-700 bg-emerald-600 dark:border-emerald-400'
                            : 'border-muted-foreground/45 bg-muted',
                    )}
                >
                    <span
                        className={cn(
                            'inline-block size-4 rounded-full border border-black/10 bg-white shadow transition-transform',
                            effective
                                ? 'translate-x-5'
                                : 'translate-x-0.5',
                        )}
                    />
                </button>
            </div>
            <span
                className={cn(
                    'text-[10px] font-medium',
                    value === null
                        ? 'text-muted-foreground'
                        : effective
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-600 dark:text-rose-300',
                )}
            >
                {value === null
                    ? `Inherited: ${inherited ? 'allowed' : 'denied'}`
                    : effective
                      ? 'Allowed for user'
                      : 'Denied for user'}
            </span>
        </div>
    );
}

export default function UserPermissionOverrides({
    userUuid,
    userName,
    levelName,
    permissions,
    permissionOverrides,
    mobilePermissionOverrides,
    levelPermissions,
    levelMobilePermissions,
}: Props) {
    const {
        data,
        setData,
        patch,
        processing,
        recentlySuccessful,
        errors,
        hasErrors,
        transform,
    } = useForm({
        permission_overrides: initialOverrides(
            permissions,
            permissionOverrides,
        ),
        mobile_permission_overrides: initialOverrides(
            permissions,
            mobilePermissionOverrides,
        ),
    });
    const groups = useMemo(
        () =>
            permissions.reduce<Record<string, UserAccessPermission[]>>(
                (result, permission) => ({
                    ...result,
                    [permission.group]: [
                        ...(result[permission.group] ?? []),
                        permission,
                    ],
                }),
                {},
            ),
        [permissions],
    );

    const compactOverrides = (overrides: Record<string, OverrideValue>) =>
        Object.fromEntries(
            Object.entries(overrides).filter(([, value]) => value !== null),
        );

    const persist = (
        permissionOverrides: Record<string, OverrideValue>,
        mobileOverrides: Record<string, OverrideValue>,
    ) => {
        const next = {
            permission_overrides: permissionOverrides,
            mobile_permission_overrides: mobileOverrides,
        };

        setData(next);
        transform(() => ({
            permission_overrides: compactOverrides(permissionOverrides),
            mobile_permission_overrides: compactOverrides(mobileOverrides),
        }));
        patch(route('admin.users.permissions.update', userUuid), {
            preserveScroll: true,
        });
    };

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        persist(
            data.permission_overrides,
            data.mobile_permission_overrides,
        );
    };

    const resetToLevel = () => {
        persist(
            initialOverrides(permissions, {}),
            initialOverrides(permissions, {}),
        );
    };

    return (
        <form
            onSubmit={submit}
            className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <ShieldCheckIcon className="size-4.5" />
                    </span>
                    <div>
                        <h3 className="font-semibold text-foreground">
                            Individual permission overrides
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {userName} inherits permissions from {levelName}.
                            Override only the exceptions for this user. Changes
                            save immediately.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetToLevel}
                    >
                        <Undo2Icon className="size-4" />
                        Reset to level
                    </Button>
                    <Button type="submit" size="sm" disabled={processing}>
                        {processing
                            ? 'Saving…'
                            : recentlySuccessful
                              ? 'Saved'
                              : 'Save overrides'}
                    </Button>
                </div>
            </div>
            {hasErrors && (
                <div
                    role="alert"
                    className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 sm:px-5"
                >
                    {Object.values(errors)[0] ??
                        'The individual permission overrides could not be saved.'}
                </div>
            )}

            <div className="space-y-5 bg-background/40 p-4 sm:p-5">
                {Object.entries(groups).map(([group, items]) => {
                const itemKeys = new Set(items.map((item) => item.key));
                const roots = items.filter(
                    (item) =>
                        !item.parent_key || !itemKeys.has(item.parent_key),
                );
                const ordered = roots.flatMap((root) => [
                    root,
                    ...items.filter((item) => item.parent_key === root.key),
                ]);

                return (
                    <section
                        key={group}
                        className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                    >
                        <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/40 px-4 py-3">
                            <h4 className="font-semibold text-foreground">
                                {group}
                            </h4>
                            <div className="flex items-center gap-8 text-xs font-medium text-muted-foreground sm:gap-12">
                                <span className="flex items-center gap-1.5">
                                    <GlobeIcon className="size-3.5" />
                                    Website
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <SmartphoneIcon className="size-3.5" />
                                    Mobile
                                </span>
                            </div>
                        </div>
                        <ul className="divide-y divide-border">
                            {ordered.map((permission) => {
                                const isChild = Boolean(
                                    permission.parent_key &&
                                        itemKeys.has(permission.parent_key),
                                );
                                const children = items.filter(
                                    (item) =>
                                        item.parent_key === permission.key,
                                );
                                const childSiblings = isChild
                                    ? items.filter(
                                          (item) =>
                                              item.parent_key ===
                                              permission.parent_key,
                                      )
                                    : [];
                                const isLastChild =
                                    isChild &&
                                    childSiblings.at(-1)?.key ===
                                        permission.key;
                                const websiteEffective =
                                    data.permission_overrides[permission.key] ??
                                    levelPermissions[permission.key] ??
                                    false;

                                return (
                                    <li
                                        key={permission.key}
                                        className={cn(
                                            'relative grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:items-center',
                                            children.length > 0 && 'pl-10',
                                            isChild &&
                                                'bg-muted/15 pl-12 sm:pl-14',
                                        )}
                                    >
                                        {children.length > 0 && (
                                            <>
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute left-5 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-600 bg-card"
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute bottom-0 left-5 top-1/2 border-l-2 border-emerald-600/55"
                                                />
                                            </>
                                        )}
                                        {isChild && (
                                            <>
                                                <span
                                                    aria-hidden="true"
                                                    className={cn(
                                                        'absolute left-5 top-0 border-l-2 border-emerald-600/55',
                                                        isLastChild
                                                            ? 'h-1/2'
                                                            : 'h-full',
                                                    )}
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute left-5 top-1/2 w-5 border-t-2 border-emerald-600/55 sm:w-7"
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute left-10 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600/70 sm:left-12"
                                                />
                                            </>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground">
                                                {permission.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {permission.description}
                                            </p>
                                        </div>
                                        <OverrideSwitch
                                            label={`${permission.name} website permission`}
                                            value={
                                                data.permission_overrides[
                                                    permission.key
                                                ]
                                            }
                                            inherited={
                                                levelPermissions[
                                                    permission.key
                                                ] ?? false
                                            }
                                            onChange={(value) =>
                                                persist(
                                                    {
                                                        ...data.permission_overrides,
                                                        [permission.key]: value,
                                                    },
                                                    data.mobile_permission_overrides,
                                                )
                                            }
                                        />
                                        <OverrideSwitch
                                            label={`${permission.name} mobile permission`}
                                            value={
                                                data.mobile_permission_overrides[
                                                    permission.key
                                                ]
                                            }
                                            inherited={
                                                levelMobilePermissions[
                                                    permission.key
                                                ] ?? false
                                            }
                                            onChange={(value) => {
                                                const nextWebsite =
                                                    value === true &&
                                                    !websiteEffective
                                                        ? {
                                                              ...data.permission_overrides,
                                                              [permission.key]:
                                                                  true,
                                                          }
                                                        : data.permission_overrides;
                                                const nextMobile = {
                                                    ...data.mobile_permission_overrides,
                                                    [permission.key]: value,
                                                };

                                                persist(
                                                    nextWebsite,
                                                    nextMobile,
                                                );
                                            }}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
                })}
            </div>
        </form>
    );
}
