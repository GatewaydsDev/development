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
import type { SchedulePaginator, SchedulePayload } from './types';

type IndexProps = {
    filters: {
        date: string;
        search: string;
    };
    schedules: SchedulePaginator;
    can: {
        create: boolean;
        update: boolean;
        delete: boolean;
    };
};

export default function Index({ filters, schedules, can }: IndexProps) {
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
                            Jobs for the day, the foreman responsible, and the
                            employees attending.
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
                                className="flex flex-col gap-3 sm:flex-row"
                            >
                                <div className="flex h-11 overflow-hidden rounded-md border border-border bg-background sm:w-56">
                                    <input
                                        ref={dateRef}
                                        name="date"
                                        type="date"
                                        defaultValue={filters.date}
                                        aria-label="Work date"
                                        className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground focus:outline-none dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={openDatePicker}
                                        aria-label="Choose date"
                                        className="flex w-11 items-center justify-center border-l border-border text-muted-foreground hover:bg-muted/60"
                                    >
                                        <CalendarDaysIcon className="size-4" />
                                    </button>
                                </div>
                                <input
                                    name="search"
                                    defaultValue={filters.search}
                                    placeholder="Search job, foreman, or employee"
                                    className="h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <Button type="submit" variant="outline">
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
                                    No crew is assigned on this date.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        schedules.data.map((schedule) => (
                            <Card key={schedule.id} className="shadow-sm">
                                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                                    <div>
                                        <CardTitle>
                                            {schedule.project?.name ?? 'Job'}
                                        </CardTitle>
                                        <CardDescription>
                                            {schedule.project?.project_number
                                                ? `${schedule.project.project_number} · `
                                                : ''}
                                            {schedule.project?.address ||
                                                'No site address'}
                                        </CardDescription>
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
                                                        schedule.id,
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
                                <CardContent className="flex flex-col gap-3">
                                    <p className="text-sm text-muted-foreground">
                                        Foreman:{' '}
                                        <span className="font-medium text-foreground">
                                            {schedule.foreman?.name ??
                                                'Not set'}
                                        </span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {schedule.employees.map((employee) => (
                                            <Badge
                                                key={employee.id}
                                                variant="outline"
                                            >
                                                {employee.full_name}
                                            </Badge>
                                        ))}
                                    </div>
                                    {schedule.notes && (
                                        <p className="text-sm text-muted-foreground">
                                            {schedule.notes}
                                        </p>
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
                            this crew on {pendingDelete?.work_date}.
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
                                        pendingDelete.id,
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
