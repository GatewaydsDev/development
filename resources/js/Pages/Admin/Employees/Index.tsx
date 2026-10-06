import { useProjectListRefresh } from '@/hooks/useProjectListRefresh';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ActionHint from '@/Components/ActionHint';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
import PaginationNav from '@/Components/PaginationNav';
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
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDaysIcon,
    DollarSignIcon,
    EditIcon,
    MailIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
    UserRoundIcon,
    UsersRoundIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
    CatalogChangeBadges,
    catalogChanges,
    type CatalogChange,
} from './CatalogChanges';
import {
    formatDisplayDate,
    type EmployeePayload,
    type EmployeesPaginator,
} from './types';

type IndexProps = {
    filters: {
        search?: string;
    };
    employees: EmployeesPaginator;
    employeesVersion?: string | null;
};

function statusBadgeVariant(
    status: string,
): 'success' | 'secondary' | 'warning' | 'destructive' {
    switch (status) {
        case 'active':
            return 'success';
        case 'on_leave':
            return 'warning';
        case 'terminated':
            return 'destructive';
        default:
            return 'secondary';
    }
}

function statusLabel(status: string): string {
    return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function skillRateGroups(employee: EmployeePayload) {
    const groups = new Map<
        number,
        { id: number; name: string; rates: EmployeePayload['pay_rates'] }
    >();

    for (const skill of employee.skills) {
        groups.set(skill.id, {
            id: skill.id,
            name: skill.name,
            rates: skill.rates ?? [],
        });
    }

    for (const rate of employee.pay_rates) {
        if (!rate.skill_id) {
            continue;
        }

        const existing = groups.get(rate.skill_id);

        if (existing) {
            if (!existing.rates.some((item) => item.id === rate.id)) {
                existing.rates.push(rate);
            }
            continue;
        }

        groups.set(rate.skill_id, {
            id: rate.skill_id,
            name: rate.skill?.name || 'Skill removed',
            rates: [rate],
        });
    }

    return [...groups.values()];
}

function rateTypeLabel(rateType: string, customRateType?: string | null): string {
    if (rateType === 'custom') {
        return customRateType || 'Custom';
    }

    return rateType
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function MembershipLine({
    label,
    items,
}: {
    label: string;
    items: Array<{ id: number; name: string }>;
}) {
    return (
        <div className="mt-3">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {label}
            </p>
            {items.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {items.map((item) => (
                        <Badge
                            key={item.id}
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                            {item.name}
                        </Badge>
                    ))}
                </div>
            ) : (
                <p className="mt-1 text-sm text-muted-foreground">None</p>
            )}
        </div>
    );
}

const employeeListColumns =
    'lg:grid-cols-[minmax(16rem,1.5fr)_minmax(13rem,1.1fr)_minmax(11rem,1fr)_7.5rem_14.5rem]';

function formatCurrency(amount: string): string {
    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount)) {
        return amount;
    }

    return numericAmount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
    });
}

export default function Index({
    filters,
    employees,
    employeesVersion = null,
}: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreateEmployees = Boolean(auth.can?.createEmployees);
    const canUpdateEmployees = Boolean(auth.can?.updateEmployees);
    const canDeleteEmployees = Boolean(auth.can?.deleteEmployees);
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedRatesEmployee, setSelectedRatesEmployee] =
        useState<EmployeePayload | null>(null);
    const [pendingDeleteEmployee, setPendingDeleteEmployee] = useState<{
        uuid: string;
        name: string;
    } | null>(null);
    const [catalogChangesByEmployee, setCatalogChangesByEmployee] = useState<
        Record<number, CatalogChange[]>
    >({});
    const previousEmployees = useRef<Map<number, EmployeePayload> | null>(null);
    const seenEmployeesVersion = useRef(employeesVersion);

    useProjectListRefresh(
        employeesVersion,
        ['employees', 'employeesVersion'],
        'admin.employees.version',
    );

    useEffect(() => {
        const next = new Map(
            employees.data.map((employee) => [employee.id, employee]),
        );
        const previous = previousEmployees.current;
        const versionChanged = seenEmployeesVersion.current !== employeesVersion;
        previousEmployees.current = next;
        seenEmployeesVersion.current = employeesVersion;

        if (!previous || !versionChanged) {
            return;
        }

        const changes: Record<number, CatalogChange[]> = {};

        next.forEach((employee, id) => {
            const before = previous.get(id);

            if (!before) {
                changes[id] = [
                    ...employee.professions.map((profession) => ({
                        id: profession.id,
                        name: profession.name,
                        kind: 'profession' as const,
                        action: 'added' as const,
                    })),
                    ...employee.skills.map((skill) => ({
                        id: skill.id,
                        name: skill.name,
                        kind: 'skill' as const,
                        action: 'added' as const,
                    })),
                ];

                return;
            }

            const employeeChanges = catalogChanges(before, employee);

            if (employeeChanges.length > 0) {
                changes[id] = employeeChanges;
            }
        });

        setCatalogChangesByEmployee(changes);

        const timer = window.setTimeout(
            () => setCatalogChangesByEmployee({}),
            12_000,
        );

        return () => window.clearTimeout(timer);
    }, [employeesVersion, employees]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.employees.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const destroyEmployee = (employeeUuid: string) => {
        router.delete(route('admin.employees.destroy', employeeUuid), {
            preserveScroll: true,
            onFinish: () => setPendingDeleteEmployee(null),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Employees</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Employees
                        </h2>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route('admin.employee-attendance.index')}>
                                <CalendarDaysIcon className="size-4" />
                                Attendance
                            </Link>
                        </Button>
                        {canCreateEmployees && (
                            <Button asChild>
                                <Link href={route('admin.employees.create')}>
                                    <PlusIcon className="size-4" />
                                    Add employee
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Employees" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UsersRoundIcon className="size-4 text-muted-foreground" />
                                    Total employees
                                </CardTitle>
                                <CardDescription>
                                    Current employee records in the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {employees.total}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Employee directory</CardTitle>
                                <CardDescription>
                                    Search, review, add, update, and delete
                                    employee records.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={submit}
                                className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                            >
                                <div className="relative">
                                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search employees"
                                        className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground sm:w-64"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="h-11 min-w-[8.5rem] bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                                >
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div
                                    className={`hidden gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid ${employeeListColumns}`}
                                >
                                    <div>Employee</div>
                                    <div>Contact</div>
                                    <div>Department</div>
                                    <div>Status</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {employees.data.length > 0 ? (
                                    employees.data.map((employee) => (
                                        <div
                                            key={employee.id}
                                            className={`grid gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:items-start lg:gap-4 ${employeeListColumns}`}
                                        >
                                            <div className="min-w-0">
                                                <DirectoryFieldLabel>Employee</DirectoryFieldLabel>
                                                <p className="font-medium text-foreground">
                                                    {employee.full_name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {employee.job_title ||
                                                        employee.skills[0]
                                                            ?.name ||
                                                        employee.uuid}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {[
                                                        employee.language?.name,
                                                        employee.date_of_birth
                                                            ? `Born ${formatDisplayDate(employee.date_of_birth)}`
                                                            : null,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') ||
                                                        'No language yet'}
                                                </p>
                                                <CatalogChangeBadges
                                                    changes={
                                                        catalogChangesByEmployee[
                                                            employee.id
                                                        ] ?? []
                                                    }
                                                />
                                                <MembershipLine
                                                    label="Skills"
                                                    items={employee.skills}
                                                />
                                            </div>
                                            <div className="min-w-0 text-sm text-muted-foreground">
                                                <DirectoryFieldLabel>Contact</DirectoryFieldLabel>
                                                <p className="flex min-w-0 items-center gap-2">
                                                    <MailIcon className="size-4 shrink-0" />
                                                    <span className="truncate">
                                                        {employee.email}
                                                    </span>
                                                </p>
                                                <p>
                                                    {employee.phone_number ||
                                                        'No phone added'}
                                                </p>
                                            </div>
                                            <div className="min-w-0 text-sm text-muted-foreground">
                                                <DirectoryFieldLabel>Department</DirectoryFieldLabel>
                                                {employee.department ||
                                                    'Not added'}
                                                <span className="block">
                                                    App login:{' '}
                                                    {employee.user?.level
                                                        ?.name ||
                                                        'No login yet'}
                                                </span>
                                                {employee.hire_date && (
                                                    <span className="block">
                                                        Hired{' '}
                                                        {formatDisplayDate(
                                                            employee.hire_date,
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <DirectoryFieldLabel>Status</DirectoryFieldLabel>
                                                <Badge
                                                    variant={statusBadgeVariant(
                                                        employee.employment_status,
                                                    )}
                                                >
                                                    {statusLabel(
                                                        employee.employment_status,
                                                    )}
                                                </Badge>
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-1 lg:items-end">
                                                <DirectoryFieldLabel>Actions</DirectoryFieldLabel>
                                                <div className="flex flex-wrap items-center gap-1.5 lg:flex-nowrap lg:justify-end">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                                    onClick={() =>
                                                        setSelectedRatesEmployee(
                                                            employee,
                                                        )
                                                    }
                                                >
                                                    <DollarSignIcon className="size-4" />
                                                    Rates
                                                </Button>
                                                {canUpdateEmployees && (
                                                    <ActionHint hint="Edit this employee">
                                                        <Button
                                                            variant="outline"
                                                            size="icon-sm"
                                                            className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={route(
                                                                    'admin.employees.edit',
                                                                    employee.uuid,
                                                                )}
                                                                aria-label="Edit this employee"
                                                            >
                                                                <EditIcon className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </ActionHint>
                                                )}
                                                {canDeleteEmployees && (
                                                    <ActionHint hint="Delete this employee">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon-sm"
                                                            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() =>
                                                                setPendingDeleteEmployee(
                                                                    {
                                                                        uuid: employee.uuid,
                                                                        name: employee.full_name,
                                                                    },
                                                                )
                                                            }
                                                            aria-label="Delete this employee"
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                        </Button>
                                                    </ActionHint>
                                                )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <UserRoundIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No employees found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try another search or create the
                                            first employee.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <PaginationNav
                                paginator={employees}
                                itemLabel="employees"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AlertDialog
                open={selectedRatesEmployee !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRatesEmployee(null);
                    }
                }}
            >
                <AlertDialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {selectedRatesEmployee?.full_name} pay rates
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Rates are grouped by skill. A skill can have
                            hourly, daily, half day, day off, and union rates.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {selectedRatesEmployee &&
                    skillRateGroups(selectedRatesEmployee).length ? (
                        <div className="flex flex-col gap-4">
                            {skillRateGroups(selectedRatesEmployee).map(
                                (group) => (
                                    <div
                                        key={group.id}
                                        className="overflow-hidden rounded-lg border border-border"
                                    >
                                        <div className="border-b border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground">
                                            {group.name}
                                        </div>
                                        {group.rates.length ? (
                                            group.rates.map((rate) => (
                                                <div
                                                    key={rate.id}
                                                    className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                                                >
                                                    <div>
                                                        <p className="text-sm text-foreground">
                                                            {rateTypeLabel(
                                                                rate.rate_type,
                                                                rate.custom_rate_type,
                                                            )}
                                                        </p>
                                                        {rate.notes && (
                                                            <p className="text-sm text-muted-foreground">
                                                                {rate.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p className="font-semibold text-foreground">
                                                        {formatCurrency(
                                                            rate.amount,
                                                        )}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="px-4 py-4 text-sm text-muted-foreground">
                                                No rates for this skill yet.
                                            </p>
                                        )}
                                    </div>
                                ),
                            )}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                            No pay rates have been added for this employee yet.
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={pendingDeleteEmployee !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteEmployee(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete employee?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete employee record for “{pendingDeleteEmployee?.name}”? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDeleteEmployee) {
                                    destroyEmployee(pendingDeleteEmployee.uuid);
                                }
                            }}
                        >
                            Delete employee
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
