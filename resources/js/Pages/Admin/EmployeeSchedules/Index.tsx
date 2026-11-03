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
import { formatCurrency } from '@/lib/money';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { Head, Link, router } from '@inertiajs/react';
import {
    BriefcaseIcon,
    CheckIcon,
    ChevronDownIcon,
    CalendarDaysIcon,
    ClipboardCheckIcon,
    DollarSignIcon,
    EditIcon,
    HardHatIcon,
    MapPinIcon,
    PlusIcon,
    SearchIcon,
    ShieldCheckIcon,
    Trash2Icon,
    UsersRoundIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type {
    SchedulePaginator,
    SchedulePayload,
    ScheduleStatusOption,
} from './types';

type RoleKey = 'foreman' | 'competent_person' | 'quality_control';

type RoleOption = { uuid: string; name: string };

type PendingRole = {
    schedule: SchedulePayload;
    role: RoleKey;
    option: RoleOption;
    currentName: string | null;
};

const ROLE_LABELS: Record<RoleKey, string> = {
    foreman: 'foreman',
    competent_person: 'competent person',
    quality_control: 'quality control',
};

type IndexProps = {
    roleOptions: Record<RoleKey, RoleOption[]> | null;
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

function FieldLabel({
    icon: Icon,
    tone,
    children,
}: {
    icon: typeof CalendarDaysIcon;
    tone: string;
    children: string;
}) {
    return (
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span
                className={`flex size-6 items-center justify-center rounded-md ${tone}`}
            >
                <Icon className="size-3.5" />
            </span>
            {children}
        </p>
    );
}

type RatesData = {
    name: string;
    groups: {
        id: number;
        name: string;
        rates: { id: number; label: string; amount: string; notes: string | null }[];
    }[];
};

function RatesButton({
    uuid,
    onOpen,
}: {
    uuid?: string | null;
    onOpen: (uuid: string) => void;
}) {
    if (!uuid) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={() => onOpen(uuid)}
            aria-label="View pay rates"
            title="View pay rates"
            className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
        >
            <DollarSignIcon className="size-3" />
        </button>
    );
}

function attendees(schedule: SchedulePayload) {
    const foremanUuid = schedule.foreman?.employee_uuid ?? null;
    const people = [];

    if (schedule.foreman) {
        people.push({
            key: `foreman-${schedule.foreman.id}`,
            uuid: foremanUuid,
            name: schedule.foreman.name ?? '',
            isForeman: true,
            isQc: false,
            isCompetent: false,
            skills: schedule.foreman.skills ?? [],
            certifications: [] as NonNullable<SchedulePayload['employees'][number]['certifications']>,
        });
    }

    for (const employee of schedule.employees) {
        if (foremanUuid && employee.uuid === foremanUuid) {
            const first = people[0];

            if (first) {
                first.certifications = employee.certifications ?? [];
            }

            continue;
        }

        people.push({
            key: employee.uuid ?? String(employee.id),
            uuid: employee.uuid ?? null,
            name: employee.full_name ?? '',
            isForeman: false,
            isQc: false,
            isCompetent: false,
            skills: employee.skills ?? [],
            certifications: employee.certifications ?? [],
        });
    }

    const competent = schedule.requires_competent_person
        ? schedule.competent_person
        : null;

    if (competent) {
        const existing = people.find(
            (person) => person.uuid && person.uuid === competent.uuid,
        );

        if (existing) {
            existing.isCompetent = true;
        } else {
            people.push({
                key: `competent-${competent.id}`,
                uuid: competent.uuid ?? null,
                name: competent.full_name ?? '',
                isForeman: false,
                isQc: false,
                isCompetent: true,
                skills: [],
                certifications: [],
            });
        }
    }

    const qc = schedule.quality_control;

    if (qc) {
        const existing = people.find((person) => person.uuid && person.uuid === qc.uuid);

        if (existing) {
            existing.isQc = true;
        } else {
            people.push({
                key: `qc-${qc.id}`,
                uuid: qc.uuid ?? null,
                name: qc.full_name ?? '',
                isForeman: false,
                isQc: true,
                isCompetent: false,
                skills: qc.skills ?? [],
                certifications: qc.certifications ?? [],
            });
        }
    }

    return people;
}

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

function RoleField({
    role,
    schedule,
    value,
    currentUuid,
    fallback,
    options,
    onPick,
    children,
}: {
    role: RoleKey;
    schedule: SchedulePayload;
    value: string | null;
    currentUuid: string | null;
    fallback: string;
    options: RoleOption[] | null;
    onPick: (pending: PendingRole) => void;
    children?: React.ReactNode;
}) {
    if (!options) {
        return (
            <>
                <p className="mt-1 text-sm font-medium text-foreground">
                    {value ?? fallback}
                </p>
                {children}
            </>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 -ms-1.5 text-start text-sm font-medium text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                        title={`Change ${ROLE_LABELS[role]}`}
                    >
                        <span className="truncate">{value ?? fallback}</span>
                        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 min-w-56 overflow-y-auto">
                    <DropdownMenuLabel>Change {ROLE_LABELS[role]}</DropdownMenuLabel>
                    {options.length === 0 && (
                        <p className="px-2 py-2 text-sm text-muted-foreground">
                            No one is available for this role.
                        </p>
                    )}
                    {options.map((option) => (
                        <DropdownMenuItem
                            key={option.uuid}
                            disabled={option.uuid === currentUuid}
                            onSelect={() =>
                                onPick({
                                    schedule,
                                    role,
                                    option,
                                    currentName: value,
                                })
                            }
                        >
                            {option.name}
                            {option.uuid === currentUuid && (
                                <CheckIcon className="ms-auto size-4 text-emerald-600" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            {children}
        </>
    );
}

export default function Index({ filters, statuses, schedules, can, roleOptions }: IndexProps) {
    const [pendingRole, setPendingRole] = useState<PendingRole | null>(null);
    const dateRef = useRef<HTMLInputElement>(null);
    const [ratesUuid, setRatesUuid] = useState<string | null>(null);
    const [rates, setRates] = useState<RatesData | null>(null);
    const [ratesFailed, setRatesFailed] = useState(false);

    useEffect(() => {
        if (!ratesUuid) {
            return;
        }

        const controller = new AbortController();

        fetch(route('admin.employee-schedules.rates', ratesUuid), {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed');
                }

                return response.json();
            })
            .then((data: RatesData) => setRates(data))
            .catch((error: Error) => {
                if (error.name !== 'AbortError') {
                    setRatesFailed(true);
                }
            });

        return () => controller.abort();
    }, [ratesUuid]);

    const openRates = (uuid: string) => {
        setRates(null);
        setRatesFailed(false);
        setRatesUuid(uuid);
    };
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
                        <Button asChild variant="create">
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
                <div className="flex w-full flex-col gap-4 px-4 sm:px-6 lg:px-8">
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
                                <Button type="submit" variant="outline" size="sm" className="self-center">
                                    <SearchIcon data-icon="inline-start" />
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
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                            <BriefcaseIcon className="size-5" />
                                        </span>
                                        <div className="min-w-0">
                                        <CardTitle className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                                            <span className="truncate">
                                                {schedule.project?.name ?? 'Job'}
                                                {schedule.project?.project_number
                                                    ? ` (${schedule.project.project_number})`
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
                                        {schedule.project?.address && (
                                            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <MapPinIcon className="size-4 shrink-0 text-rose-500" />
                                                <span className="truncate">
                                                    {schedule.project.address}
                                                </span>
                                            </p>
                                        )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {can.update && (
                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                                asChild
                                            >
                                                <Link
                                                    href={route(
                                                        'admin.employee-schedules.edit',
                                                        schedule.uuid,
                                                    )}
                                                    aria-label="Edit schedule"
                                                >
                                                    <EditIcon className="size-4" />
                                                </Link>
                                            </Button>
                                        )}
                                        {can.delete && (
                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                                        <FieldLabel
                                            icon={CalendarDaysIcon}
                                            tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                                        >
                                            Dates
                                        </FieldLabel>
                                        <p className="mt-1 text-sm text-foreground">
                                            {schedule.date_label}
                                        </p>
                                    </div>
                                    <div>
                                        <FieldLabel
                                            icon={ShieldCheckIcon}
                                            tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                        >
                                            Competent person
                                        </FieldLabel>
                                        <RoleField
                                            role="competent_person"
                                            schedule={schedule}
                                            value={
                                                schedule.requires_competent_person
                                                    ? (schedule.competent_person?.full_name ?? null)
                                                    : null
                                            }
                                            currentUuid={schedule.competent_person?.uuid ?? null}
                                            fallback={
                                                schedule.requires_competent_person
                                                    ? 'Not set'
                                                    : 'Not required'
                                            }
                                            options={roleOptions?.competent_person ?? null}
                                            onPick={setPendingRole}
                                        />
                                    </div>
                                    {(schedule.quality_control || roleOptions) && (
                                        <div>
                                            <FieldLabel
                                                icon={ClipboardCheckIcon}
                                                tone="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                                            >
                                                Quality control
                                            </FieldLabel>
                                            <RoleField
                                                role="quality_control"
                                                schedule={schedule}
                                                value={schedule.quality_control?.full_name ?? null}
                                                currentUuid={schedule.quality_control?.uuid ?? null}
                                                fallback="Not set"
                                                options={roleOptions?.quality_control ?? null}
                                                onPick={setPendingRole}
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <FieldLabel
                                            icon={HardHatIcon}
                                            tone="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                        >
                                            Foreman
                                        </FieldLabel>
                                        <RoleField
                                            role="foreman"
                                            schedule={schedule}
                                            value={schedule.foreman?.name ?? null}
                                            currentUuid={schedule.foreman?.employee_uuid ?? null}
                                            fallback="Not set"
                                            options={roleOptions?.foreman ?? null}
                                            onPick={setPendingRole}
                                        />
                                        {schedule.foreman?.job_title && (
                                            <p className="text-xs text-muted-foreground">
                                                {schedule.foreman.job_title}
                                            </p>
                                        )}
                                    </div>
                                    <div className="lg:col-span-4">
                                        <FieldLabel
                                            icon={UsersRoundIcon}
                                            tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                        >
                                            Employees attending
                                        </FieldLabel>
                                        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-1.5 font-medium">Name</th>
                                                        <th className="px-3 py-1.5 font-medium">Role</th>
                                                        <th className="px-3 py-1.5 font-medium">Skills</th>
                                                        <th className="px-3 py-1.5 font-medium">Certifications</th>
                                                        <th className="w-12 px-3 py-1.5 text-center font-medium">Rates</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {attendees(schedule).map((person) => (
                                                        <tr key={person.key} className="align-middle">
                                                            <td className="whitespace-nowrap px-3 py-1.5 font-medium text-foreground">
                                                                {person.name}
                                                            </td>
                                                            <td className="whitespace-nowrap px-3 py-1.5">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {person.isForeman && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 text-[0.65rem] font-semibold leading-4 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                                                            <HardHatIcon className="size-3" />
                                                                            Foreman
                                                                        </span>
                                                                    )}
                                                                    {person.isQc && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-1.5 text-[0.65rem] font-semibold leading-4 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                                                                            <ClipboardCheckIcon className="size-3" />
                                                                            Quality control
                                                                        </span>
                                                                    )}
                                                                    {person.isCompetent && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 text-[0.65rem] font-semibold leading-4 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                                            <ShieldCheckIcon className="size-3" />
                                                                            Competent person
                                                                        </span>
                                                                    )}
                                                                    {!person.isForeman && !person.isQc && !person.isCompetent && (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            Crew
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {person.skills.map((skill) => (
                                                                        <span
                                                                            key={skill.id}
                                                                            className="inline-flex items-center rounded-full bg-sky-100 px-1.5 text-[0.65rem] font-medium leading-4 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                                                                        >
                                                                            {skill.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {person.certifications.map((certification) => (
                                                                        <CertificationBadge
                                                                            key={certification.id}
                                                                            id={certification.id}
                                                                            name={certification.name}
                                                                            competent={certification.is_competent_person}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-1.5 text-center">
                                                                <RatesButton uuid={person.uuid} onOpen={openRates} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
                open={pendingRole !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingRole(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Change the {pendingRole ? ROLE_LABELS[pendingRole.role] : ''}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingRole?.currentName
                                ? `${pendingRole.currentName} will be replaced by ${pendingRole.option.name}`
                                : `${pendingRole?.option.name} will be set`}{' '}
                            as {pendingRole ? ROLE_LABELS[pendingRole.role] : ''} for{' '}
                            {pendingRole?.schedule.project?.name ?? 'this job'}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (!pendingRole) {
                                    return;
                                }

                                router.patch(
                                    route(
                                        'admin.employee-schedules.role',
                                        pendingRole.schedule.uuid,
                                    ),
                                    {
                                        role: pendingRole.role,
                                        employee_uuid: pendingRole.option.uuid,
                                    },
                                    { preserveScroll: true },
                                );
                                setPendingRole(null);
                            }}
                        >
                            Yes, change
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={ratesUuid !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setRatesUuid(null);
                    }
                }}
            >
                <AlertDialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <DollarSignIcon className="size-5 text-emerald-600" />
                            {rates ? `${rates.name} pay rates` : 'Pay rates'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Current rates by skill.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {ratesFailed ? (
                        <p className="text-sm text-destructive">
                            Could not load the rates.
                        </p>
                    ) : !rates ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : rates.groups.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                            No pay rates have been added for this employee yet.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {rates.groups.map((group) => (
                                <div
                                    key={group.id}
                                    className="overflow-hidden rounded-lg border border-border"
                                >
                                    <div className="border-b border-border bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                                        {group.name}
                                    </div>
                                    {group.rates.length ? (
                                        group.rates.map((rate) => (
                                            <div
                                                key={rate.id}
                                                className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                                            >
                                                <div>
                                                    <p className="text-foreground">{rate.label}</p>
                                                    {rate.notes && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {rate.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                                                    {formatCurrency(rate.amount)}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="px-3 py-2 text-sm text-muted-foreground">
                                            No rates for this skill yet.
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
