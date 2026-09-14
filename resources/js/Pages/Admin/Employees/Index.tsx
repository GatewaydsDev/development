import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    AlertDialog,
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
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    DollarSignIcon,
    EditIcon,
    MailIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
    UserRoundIcon,
    UsersRoundIcon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { EmployeePayload, EmployeesPaginator } from './types';

type IndexProps = {
    filters: {
        search?: string;
    };
    employees: EmployeesPaginator;
};

function statusBadgeClassName(status: string): string {
    return cn(
        status === 'active' &&
            'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        status === 'inactive' &&
            'border-muted-foreground/30 bg-muted text-muted-foreground',
        status === 'on_leave' &&
            'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        status === 'terminated' &&
            'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    );
}

function statusLabel(status: string): string {
    return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
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

export default function Index({ filters, employees }: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreateEmployees = Boolean(auth.can?.createEmployees);
    const canUpdateEmployees = Boolean(auth.can?.updateEmployees);
    const canDeleteEmployees = Boolean(auth.can?.deleteEmployees);
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedRatesEmployee, setSelectedRatesEmployee] =
        useState<EmployeePayload | null>(null);

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

    const destroyEmployee = (employeeId: number, employeeName: string) => {
        if (!window.confirm(`Delete employee record for ${employeeName}?`)) {
            return;
        }

        router.delete(route('admin.employees.destroy', employeeId), {
            preserveScroll: true,
        });
    };

    const paginationLabel = (label: string) =>
        label
            .replace('&laquo; Previous', 'Previous')
            .replace('Next &raquo;', 'Next');

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

                    {canCreateEmployees && (
                        <Button asChild>
                            <Link href={route('admin.employees.create')}>
                                <PlusIcon className="size-4" />
                                Add employee
                            </Link>
                        </Button>
                    )}
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
                                        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
                                    />
                                </div>
                                <Button type="submit" variant="outline">
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
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
                                            className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] lg:items-center lg:gap-4"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium text-foreground">
                                                    {employee.full_name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {employee.job_title ||
                                                        employee.pay_rates[0]
                                                            ?.profession
                                                            ?.name ||
                                                        employee.uuid}
                                                </p>
                                            </div>
                                            <div className="min-w-0 text-sm text-muted-foreground">
                                                <p className="flex items-center gap-2 truncate">
                                                    <MailIcon className="size-4 shrink-0" />
                                                    {employee.email}
                                                </p>
                                                <p>
                                                    {employee.phone_number ||
                                                        'No phone added'}
                                                </p>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {employee.department ||
                                                    'Not added'}
                                                {employee.hire_date && (
                                                    <span className="block">
                                                        Hired{' '}
                                                        {employee.hire_date}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <Badge
                                                    variant="outline"
                                                    className={statusBadgeClassName(
                                                        employee.employment_status,
                                                    )}
                                                >
                                                    {statusLabel(
                                                        employee.employment_status,
                                                    )}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-2 md:justify-end">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setSelectedRatesEmployee(
                                                            employee,
                                                        )
                                                    }
                                                >
                                                    <DollarSignIcon className="size-4" />
                                                    Rates (
                                                    {
                                                        employee.pay_rates
                                                            .length
                                                    }
                                                    )
                                                </Button>
                                                {canUpdateEmployees && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={route(
                                                                'admin.employees.edit',
                                                                employee.id,
                                                            )}
                                                        >
                                                            <EditIcon className="size-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                )}
                                                {canDeleteEmployees && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        onClick={() =>
                                                            destroyEmployee(
                                                                employee.id,
                                                                employee.full_name,
                                                            )
                                                        }
                                                    >
                                                        <Trash2Icon className="size-4" />
                                                        Delete
                                                    </Button>
                                                )}
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

                            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {employees.from ?? 0} to{' '}
                                    {employees.to ?? 0} of {employees.total}{' '}
                                    employees
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {employees.links.length > 3 &&
                                        employees.links.map((link, index) =>
                                            link.url ? (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant={
                                                        link.active
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link href={link.url}>
                                                        {paginationLabel(
                                                            link.label,
                                                        )}
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                >
                                                    {paginationLabel(
                                                        link.label,
                                                    )}
                                                </Button>
                                            ),
                                        )}
                                </div>
                            </div>
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
                            Review all configured rates for this employee.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {selectedRatesEmployee?.pay_rates.length ? (
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <div className="hidden grid-cols-[1.2fr_1fr_0.8fr] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                                <div>Profession</div>
                                <div>Rate type</div>
                                <div>Amount</div>
                            </div>
                            {selectedRatesEmployee.pay_rates.map((rate) => (
                                <div
                                    key={rate.id}
                                    className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 lg:grid-cols-[1.2fr_1fr_0.8fr] lg:gap-4"
                                >
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {rate.profession?.name ||
                                                'Profession removed'}
                                        </p>
                                        {rate.notes && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {rate.notes}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {rateTypeLabel(
                                            rate.rate_type,
                                            rate.custom_rate_type,
                                        )}
                                    </div>
                                    <div className="font-semibold text-foreground">
                                        {formatCurrency(rate.amount)}
                                    </div>
                                </div>
                            ))}
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
        </AuthenticatedLayout>
    );
}
