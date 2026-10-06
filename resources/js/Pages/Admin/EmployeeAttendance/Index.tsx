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
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDaysIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
    UsersIcon,
} from 'lucide-react';
import {
    FormEvent,
    useEffect,
    useRef,
    useState,
    type RefObject,
} from 'react';
import {
    WORK_WEEK,
    addDays,
    parseIsoDate,
    type AttendanceDayPayload,
    type AttendancePaginator,
    type AttendanceWeekPayload,
} from './types';

type IndexProps = {
    filters: {
        search?: string;
        from?: string;
        to?: string;
    };
    weeks: AttendancePaginator;
};

function DateChoice({
    id,
    name,
    defaultValue,
    inputRef,
    onChange,
}: {
    id: string;
    name: string;
    defaultValue: string;
    inputRef: RefObject<HTMLInputElement | null>;
    onChange: (value: string) => void;
}) {
    const openPicker = () => {
        const input = inputRef.current;

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

    return (
        <div className="flex h-11 overflow-hidden rounded-md border border-border bg-background">
            <input
                ref={inputRef}
                id={id}
                name={name}
                type="date"
                defaultValue={defaultValue}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground focus:outline-none dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
            />
            <button
                type="button"
                onClick={openPicker}
                aria-label="Choose date"
                className="flex w-11 shrink-0 items-center justify-center border-l border-border text-muted-foreground hover:bg-muted/60"
            >
                <CalendarDaysIcon className="size-4" />
            </button>
        </div>
    );
}

function shortMonthDay(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    }).format(parseIsoDate(value));
}

function dateInSearch(workDate: string, from?: string, to?: string): boolean {
    const start = from || to || '';
    const end = to || from || '';

    if (start === '' || end === '') {
        return false;
    }

    return workDate >= start && workDate <= end;
}

function weekColumns(attendanceWeek: AttendanceWeekPayload) {
    return WORK_WEEK.map((weekday) => {
        const workDate = addDays(attendanceWeek.week_start, weekday.offset);

        return {
            key: weekday.short,
            workDate,
            day:
                attendanceWeek.days.find((item) => item.work_date === workDate) ??
                null,
        };
    });
}

function ScheduleDay({
    day,
    workDate,
    matched = false,
}: {
    day: AttendanceDayPayload | null;
    workDate: string;
    matched?: boolean;
}) {
    return (
        <div className="flex min-h-24 flex-col gap-1">
            <p
                className={
                    matched
                        ? 'text-xs font-semibold text-emerald-800 dark:text-emerald-200'
                        : 'text-xs text-muted-foreground'
                }
            >
                {shortMonthDay(workDate)}
                {matched ? ' · In search' : ''}
            </p>
            {day ? (
                <>
                    <p className="font-medium text-foreground">
                        {day.skill?.name ?? day.profession?.name ?? 'Skill'}
                    </p>
                    <p className="text-xs text-muted-foreground">{day.rate_label}</p>
                    <div className="mt-auto flex flex-wrap gap-1 pt-1">
                        {day.scheduled ? (
                            <Badge variant="outline">Schedule</Badge>
                        ) : null}
                        {day.worked ? <Badge>Worked</Badge> : null}
                    </div>
                    {day.notes ? (
                        <p className="text-xs text-muted-foreground">{day.notes}</p>
                    ) : null}
                </>
            ) : (
                <p className="mt-auto text-xs text-muted-foreground">Off</p>
            )}
        </div>
    );
}

export default function Index({ filters, weeks }: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreate = Boolean(auth.can?.createEmployees);
    const canUpdate = Boolean(auth.can?.updateEmployees);
    const canDelete = Boolean(auth.can?.deleteEmployees);
    const [search, setSearch] = useState(filters.search ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const fromRef = useRef<HTMLInputElement>(null);
    const toRef = useRef<HTMLInputElement>(null);
    const [pendingDelete, setPendingDelete] = useState<AttendanceWeekPayload | null>(
        null,
    );
    const hasFilters = search.trim() !== '' || from !== '' || to !== '';

    useEffect(() => {
        setSearch(filters.search ?? '');
        setFrom(filters.from ?? '');
        setTo(filters.to ?? '');

        if (fromRef.current) {
            fromRef.current.value = filters.from ?? '';
        }

        if (toRef.current) {
            toRef.current.value = filters.to ?? '';
        }
    }, [filters.search, filters.from, filters.to]);

    const visit = (query: Record<string, string>) => {
        router.get(route('admin.employee-attendance.index'), query, {
            preserveState: false,
            replace: true,
        });
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const query: Record<string, string> = {};
        const fromValue = String(formData.get('from') ?? fromRef.current?.value ?? from);
        const toValue = String(formData.get('to') ?? toRef.current?.value ?? to);

        if (search.trim() !== '') {
            query.search = search.trim();
        }

        if (fromValue !== '') {
            query.from = fromValue;
        }

        if (toValue !== '') {
            query.to = toValue;
        }

        visit(query);
    };

    const clearFilters = () => {
        setSearch('');
        setFrom('');
        setTo('');

        if (fromRef.current) {
            fromRef.current.value = '';
        }

        if (toRef.current) {
            toRef.current.value = '';
        }

        visit({});
    };

    const searchedDates = new Map<number, string>();

    if (filters.from || filters.to) {
        for (const attendanceWeek of weeks.data) {
            for (const weekday of WORK_WEEK) {
                const workDate = addDays(attendanceWeek.week_start, weekday.offset);

                if (
                    dateInSearch(workDate, filters.from, filters.to) &&
                    !searchedDates.has(weekday.offset)
                ) {
                    searchedDates.set(weekday.offset, workDate);
                }
            }
        }
    }

    const destroyWeek = (weekId: number) => {
        router.delete(route('admin.employee-attendance.destroy', weekId), {
            preserveScroll: true,
            onFinish: () => setPendingDelete(null),
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
                            <span className="text-foreground">Attendance</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Employee attendance
                        </h2>
                    </div>

                    {canCreate && (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild>
                                <Link href={route('admin.employee-attendance.bulk')}>
                                    <UsersIcon className="size-4" />
                                    Add several
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link href={route('admin.employee-attendance.create')}>
                                    <PlusIcon className="size-4" />
                                    Add week
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>
            }
        >
            <Head title="Employee Attendance" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <Card className="shadow-sm">
                        <CardHeader className="gap-4">
                            <div>
                                <CardTitle>Work weeks</CardTitle>
                                <CardDescription>
                                    Monday through Saturday. Schedule each day
                                    with the employee&apos;s skill and rate,
                                    then record the days actually worked.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={submit}
                                className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1.4fr)_minmax(13rem,1fr)_minmax(13rem,1fr)_auto] lg:items-end"
                            >
                                <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                                    <label
                                        htmlFor="attendance-search"
                                        className="text-xs font-medium text-muted-foreground"
                                    >
                                        Employee
                                    </label>
                                    <div className="relative">
                                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="attendance-search"
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            placeholder="Name or email"
                                            className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="attendance-from"
                                        className="text-xs font-medium text-muted-foreground"
                                    >
                                        Start date
                                    </label>
                                    <DateChoice
                                        id="attendance-from"
                                        name="from"
                                        defaultValue={filters.from ?? ''}
                                        inputRef={fromRef}
                                        onChange={setFrom}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="attendance-to"
                                        className="text-xs font-medium text-muted-foreground"
                                    >
                                        End date
                                    </label>
                                    <DateChoice
                                        id="attendance-to"
                                        name="to"
                                        defaultValue={filters.to ?? ''}
                                        inputRef={toRef}
                                        onChange={setTo}
                                    />
                                </div>
                                <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                                    <Button
                                        type="submit"
                                        className="h-11 min-w-[8.5rem] flex-1 bg-emerald-600 px-4 text-white hover:bg-emerald-700 lg:flex-none"
                                    >
                                        Search
                                    </Button>
                                    {hasFilters ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-11"
                                            onClick={clearFilters}
                                        >
                                            Clear
                                        </Button>
                                    ) : null}
                                </div>
                            </form>
                        </CardHeader>
                        <CardContent>
                            {(filters.from || filters.to) && (
                                <p className="mb-4 text-sm text-muted-foreground">
                                    Showing work weeks with a recorded day from{' '}
                                    {filters.from || filters.to} to{' '}
                                    {filters.to || filters.from}.
                                </p>
                            )}
                            {weeks.data.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {filters.search || filters.from || filters.to
                                        ? 'No attendance matches that search.'
                                        : 'No attendance weeks yet. Add a week to schedule Monday through Saturday and record the days worked.'}
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th
                                                    rowSpan={2}
                                                    className="px-3 py-2 font-medium text-muted-foreground"
                                                >
                                                    Employee
                                                </th>
                                                <th
                                                    rowSpan={2}
                                                    className="px-3 py-2 font-medium text-muted-foreground"
                                                >
                                                    Week
                                                </th>
                                                <th
                                                    colSpan={6}
                                                    className="px-3 py-2 text-center font-semibold text-foreground"
                                                >
                                                    Schedule
                                                </th>
                                                <th
                                                    rowSpan={2}
                                                    className="px-3 py-2 text-right font-medium text-muted-foreground"
                                                >
                                                    <span className="sr-only">
                                                        Actions
                                                    </span>
                                                </th>
                                            </tr>
                                            <tr className="border-b border-border">
                                                {WORK_WEEK.map((weekday) => {
                                                    const searchedDate = searchedDates.get(
                                                        weekday.offset,
                                                    );

                                                    return (
                                                        <th
                                                            key={weekday.short}
                                                            className={
                                                                searchedDate
                                                                    ? 'w-40 border-l-4 border-l-emerald-700 bg-emerald-600 px-3 py-2 font-semibold text-white dark:border-l-emerald-300 dark:bg-emerald-700'
                                                                    : 'w-40 px-3 py-2 font-medium text-foreground'
                                                            }
                                                        >
                                                            {weekday.label}
                                                            {searchedDate ? (
                                                                <span className="mt-0.5 block text-xs font-medium text-emerald-50">
                                                                    {shortMonthDay(searchedDate)}
                                                                </span>
                                                            ) : null}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {weeks.data.map((attendanceWeek) => (
                                                <tr
                                                    key={attendanceWeek.id}
                                                    className="border-b border-border align-top last:border-b-0"
                                                >
                                                    <td className="px-3 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
                                                            <p className="font-semibold text-foreground">
                                                                {attendanceWeek
                                                                    .employee
                                                                    ?.full_name ??
                                                                    'Employee removed'}
                                                            </p>
                                                        </div>
                                                        {attendanceWeek.notes ? (
                                                            <p className="mt-2 max-w-56 text-xs text-muted-foreground">
                                                                {attendanceWeek.notes}
                                                            </p>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-3 py-4 text-muted-foreground">
                                                        <p>{attendanceWeek.week_label}</p>
                                                        <p className="mt-2 text-xs">
                                                            {attendanceWeek.scheduled_count}{' '}
                                                            scheduled ·{' '}
                                                            {attendanceWeek.worked_count}{' '}
                                                            worked
                                                        </p>
                                                    </td>
                                                    {weekColumns(attendanceWeek).map(
                                                        (column) => {
                                                            const matched = dateInSearch(
                                                                column.workDate,
                                                                filters.from,
                                                                filters.to,
                                                            );

                                                            return (
                                                                <td
                                                                    key={column.key}
                                                                    className={
                                                                        matched
                                                                            ? 'border-l-4 border-l-emerald-600 bg-emerald-100 px-3 py-4 dark:border-l-emerald-400 dark:bg-emerald-950'
                                                                            : 'px-3 py-4'
                                                                    }
                                                                >
                                                                    <ScheduleDay
                                                                        day={column.day}
                                                                        workDate={
                                                                            column.workDate
                                                                        }
                                                                        matched={matched}
                                                                    />
                                                                </td>
                                                            );
                                                        },
                                                    )}
                                                    <td className="px-3 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            {canUpdate && (
                                                                <Button
                                                                    variant="outline"
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        href={route(
                                                                            'admin.employee-attendance.edit',
                                                                            attendanceWeek.id,
                                                                        )}
                                                                    >
                                                                        Update
                                                                    </Link>
                                                                </Button>
                                                            )}
                                                            {canDelete && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        setPendingDelete(
                                                                            attendanceWeek,
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2Icon className="size-4" />
                                                                    Remove
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {weeks.last_page > 1 && (
                                <div className="mt-4">
                                    <PaginationNav
                                        paginator={weeks}
                                        itemLabel="weeks"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
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
                        <AlertDialogTitle>Remove this work week?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove attendance for{' '}
                            {pendingDelete?.employee?.full_name} on{' '}
                            {pendingDelete?.week_label}? This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDelete) {
                                    destroyWeek(pendingDelete.id);
                                }
                            }}
                        >
                            Remove week
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
