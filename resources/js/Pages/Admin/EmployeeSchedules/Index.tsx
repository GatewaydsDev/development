import CertificationBadge from '@/Components/CertificationBadge';
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
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarDaysIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import type {
    SchedulePaginator,
    SchedulePayload,
    ScheduleStatusOption,
} from './types';

type IndexProps = {
    filters: {
        date: string;
        search: string;
        status: string;
    };
    statuses: ScheduleStatusOption[];
    schedules: SchedulePaginator;
    can: {
        create: boolean;
        update: boolean;
        delete: boolean;
    };
};

function statusBadgeVariant(
    status: string,
): 'success' | 'secondary' | 'warning' | 'default' {
    switch (status) {
        case 'active':
            return 'success';
        case 'on_hold':
            return 'warning';
        case 'completed':
            return 'default';
        default:
            return 'secondary';
    }
}

export default function Index({ filters, statuses, schedules, can }: IndexProps) {
    const dateRef = useRef<HTMLInputElement>(null);
    const [pendingDelete, setPendingDelete] = useState<SchedulePayload | null>(
        null,
    );

    const openDatePicker = () => {
        const input = dateRef.current;

        if (!input) {
            return;
        }

        input.focus();

        if (typeof input.showPicker === 'function') {
            try {
                input.showPicker();

                return;
            } catch {
                input.click();
            }
        }
    };

    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        router.get(
            route('admin.employee-schedules.index'),
            {
                date: String(formData.get('date') ?? ''),
                status: String(formData.get('status') ?? ''),
                search: String(formData.get('search') ?? ''),
            },
            { preserveState: false },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Work schedule
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Jobs covering the selected date, with a start and
                            end date, a status, and the crew attending.
                        </p>
                    </div>
                    {can.create && (
                        <Button asChild>
                            <Link href={route('admin.employee-schedules.create')}>
                                <PlusIcon />
                                Add job crew
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Work Schedule" />
            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-4 px-4 sm:px-6 lg:px-8">
                    <Card className="shadow-sm">
                        <CardContent className="pt-6">
                            <form
                                onSubmit={search}
                                className="grid gap-3 lg:grid-cols-[11rem_14rem_minmax(0,1fr)_auto]"
                            >
                                <div className="flex h-9 overflow-hidden rounded-md border border-border bg-background">
                                    <input
                                        ref={dateRef}
                                        name="date"
                                        type="date"
                                        defaultValue={filters.date}
                                        aria-label="Date within the schedule"
                                        className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground focus:outline-none dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={openDatePicker}
                                        aria-label="Choose date"
                                        className="flex w-9 items-center justify-center border-l border-border text-muted-foreground hover:bg-muted/60"
                                    >
                                        <CalendarDaysIcon className="size-4" />
                                    </button>
                                </div>
                                <select
                                    name="status"
                                    defaultValue={filters.status}
                                    aria-label="Status"
                                    className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">All statuses</option>
                                    {statuses.map((status) => (
                                        <option key={status.value} value={status.value}>
                                            {status.label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    name="search"
                                    defaultValue={filters.search}
                                    placeholder="Search job, foreman, or employee"
                                    className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <Button type="submit" variant="outline" className="h-9">
                                    Search
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {schedules.data.length === 0 ? (
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>No jobs scheduled</CardTitle>
                                <CardDescription>
                                    No crew is assigned on a schedule that covers
                                    this date.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        schedules.data.map((schedule) => (
                            <Card key={schedule.uuid} className="shadow-sm">
                                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                                    <div>
                                        <CardTitle className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                                            <span className="truncate">
                                                {schedule.project?.name ?? 'Job'}
                                                {schedule.project?.project_number
                                                    ? ` (${schedule.project.project_number})`
                                                    : ''}
                                                {schedule.project?.address
                                                    ? ` · ${schedule.project.address}`
                                                    : ''}
                                            </span>
                                            <Badge
                                                variant={statusBadgeVariant(
                                                    schedule.status,
                                                )}
                                                className="shrink-0"
                                            >
                                                {schedule.status_label}
                                            </Badge>
                                        </CardTitle>
                                    </div>
                                    <div className="flex gap-2">
                                        {can.update && (
                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                asChild
                                            >
                                                <Link
                                                    href={route(
                                                        'admin.employee-schedules.edit',
                                                        schedule.uuid,
                                                    )}
                                                    aria-label="Edit schedule"
                                                >
                                                    <PencilIcon className="size-4" />
                                                </Link>
                                            </Button>
                                        )}
                                        {can.delete && (
                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                aria-label="Remove schedule"
                                                onClick={() =>
                                                    setPendingDelete(schedule)
                                                }
                                            >
                                                <Trash2Icon className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="grid gap-4 lg:grid-cols-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Dates
                                        </p>
                                        <p className="text-sm text-foreground">
                                            {schedule.date_label}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Competent person
                                        </p>
                                        <p className="text-sm font-medium text-foreground">
                                            {schedule.requires_competent_person
                                                ? (schedule.competent_person
                                                      ?.full_name ??
                                                  'Not set')
                                                : 'Not required'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Foreman
                                        </p>
                                        <p className="text-sm font-medium text-foreground">
                                            {schedule.foreman?.name ??
                                                'Not set'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Employees attending
                                        </p>
                                        <div className="mt-1 flex flex-col gap-2">
                                            {schedule.employees.map(
                                                (employee) => (
                                                    <div key={employee.uuid}>
                                                        <p className="text-sm font-medium text-foreground">
                                                            {employee.full_name}
                                                        </p>
                                                        {(employee.certifications ??
                                                            []).length > 0 && (
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {employee.certifications?.map(
                                                                    (
                                                                        certification,
                                                                    ) => (
                                                                        <CertificationBadge
                                                                            key={
                                                                                certification.id
                                                                            }
                                                                            id={
                                                                                certification.id
                                                                            }
                                                                            name={
                                                                                certification.name
                                                                            }
                                                                            competent={
                                                                                certification.is_competent_person
                                                                            }
                                                                        />
                                                                    ),
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                    {schedule.notes && (
                                        <div
                                            className="rich-text-content text-sm text-muted-foreground lg:col-span-4"
                                            dangerouslySetInnerHTML={{
                                                __html: schedule.notes,
                                            }}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}

                    <PaginationNav paginator={schedules} itemLabel="schedules" />
                </div>
            </div>

            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDelete(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this job crew?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete?.project?.name} will no longer have
                            this crew from {pendingDelete?.date_label}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (!pendingDelete) {
                                    return;
                                }

                                router.delete(
                                    route(
                                        'admin.employee-schedules.destroy',
                                        pendingDelete.uuid,
                                    ),
                                );
                                setPendingDelete(null);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
