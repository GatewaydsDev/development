import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';
import {
    numericHours,
    weekdayName,
    type AttendanceEmployeeOption,
} from './types';

const inputClassName =
    'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
const labelClassName = 'text-emerald-700 dark:text-emerald-300';
const selectClassName =
    'h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring';

type BulkEmployee = {
    employee_id: string;
    skill_id: string;
    pay_rate_id: string;
    hours: string;
};

type BulkFormData = {
    work_date: string;
    scheduled: boolean;
    worked: boolean;
    notes: string;
    employees: BulkEmployee[];
};

type BulkProps = {
    employees: AttendanceEmployeeOption[];
    defaultWorkDate: string;
};

function canSchedule(employee: AttendanceEmployeeOption): boolean {
    return employee.skills.some((skill) => skill.rates.length > 0);
}

function defaultRow(employee: AttendanceEmployeeOption): BulkEmployee {
    const skill = employee.skills.length === 1 ? employee.skills[0] : undefined;
    const rate = skill?.rates.length === 1 ? skill.rates[0] : undefined;

    return {
        employee_id: String(employee.id),
        skill_id: skill ? String(skill.id) : '',
        pay_rate_id: rate ? String(rate.id) : '',
        hours: '',
    };
}

export default function Bulk({ employees, defaultWorkDate }: BulkProps) {
    const form = useForm<BulkFormData>({
        work_date: defaultWorkDate,
        scheduled: true,
        worked: true,
        notes: '',
        employees: [],
    });
    const { data, setData, post, processing, errors } = form;
    const errorBag = errors as Record<string, string | undefined>;
    const [query, setQuery] = useState('');
    const selectedIds = new Set(data.employees.map((row) => row.employee_id));
    const visibleEmployees = useMemo(() => {
        const term = query.trim().toLowerCase();

        if (term === '') {
            return employees;
        }

        return employees.filter((employee) =>
            `${employee.full_name} ${employee.email}`.toLowerCase().includes(term),
        );
    }, [employees, query]);
    const dayName = weekdayName(data.work_date);

    const rowsFor = (ids: Set<string>): BulkEmployee[] =>
        employees
            .filter((employee) => ids.has(String(employee.id)))
            .map((employee) => {
                const current = data.employees.find(
                    (row) => row.employee_id === String(employee.id),
                );

                return current ?? defaultRow(employee);
            });

    const toggleEmployee = (employee: AttendanceEmployeeOption, checked: boolean) => {
        const ids = new Set(selectedIds);

        if (checked) {
            ids.add(String(employee.id));
        } else {
            ids.delete(String(employee.id));
        }

        setData('employees', rowsFor(ids));
    };

    const selectVisible = () => {
        const ids = new Set(selectedIds);

        visibleEmployees.forEach((employee) => {
            if (canSchedule(employee)) {
                ids.add(String(employee.id));
            }
        });

        setData('employees', rowsFor(ids));
    };

    const updateRow = (employeeId: string, patch: Partial<BulkEmployee>) => {
        setData(
            'employees',
            data.employees.map((row) =>
                row.employee_id === employeeId ? { ...row, ...patch } : row,
            ),
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('admin.employee-attendance.bulk.store'));
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
                            href={route('admin.employee-attendance.index')}
                            className="transition hover:text-foreground"
                        >
                            Attendance
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add several</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add attendance for several employees
                    </h2>
                </div>
            }
        >
            <Head title="Add Attendance for Several Employees" />

            <div className="py-6 sm:py-8">
                <form
                    onSubmit={submit}
                    className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8"
                >
                    <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="bulk-work-date"
                                value="Work date"
                                className={labelClassName}
                            />
                            <TextInput
                                id="bulk-work-date"
                                type="date"
                                value={data.work_date}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData('work_date', event.target.value)
                                }
                            />
                            <p className="text-sm text-muted-foreground">
                                {dayName
                                    ? `${dayName}. Work days are Monday through Saturday. This date is added to each selected employee's week.`
                                    : 'Work days are Monday through Saturday.'}
                            </p>
                            <InputError message={errorBag.work_date} />
                        </div>

                        <div className="flex flex-col gap-3">
                            <span className={labelClassName + ' text-sm font-medium'}>
                                This day
                            </span>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                    checked={data.scheduled}
                                    onChange={(event) =>
                                        setData('scheduled', event.target.checked)
                                    }
                                />
                                On schedule
                            </label>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                    checked={data.worked}
                                    onChange={(event) =>
                                        setData('worked', event.target.checked)
                                    }
                                />
                                Worked
                            </label>
                            <InputError message={errorBag.scheduled} />
                        </div>

                        <div className="flex flex-col gap-2 md:col-span-2">
                            <InputLabel
                                htmlFor="bulk-notes"
                                value="Day notes"
                                className={labelClassName}
                            />
                            <TextInput
                                id="bulk-notes"
                                value={data.notes}
                                className={inputClassName}
                                placeholder="Optional note saved on this day for every selected employee"
                                onChange={(event) =>
                                    setData('notes', event.target.value)
                                }
                            />
                            <InputError message={errorBag.notes} />
                        </div>
                    </section>

                    <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-foreground">
                                    Employees
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Select who worked, then choose each
                                    person&apos;s skill and pay rate.
                                    {data.employees.length > 0
                                        ? ` ${data.employees.length} selected.`
                                        : ''}
                                </p>
                                <InputError message={errorBag.employees} className="mt-2" />
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search employees"
                                    className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground sm:w-56"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11"
                                    onClick={selectVisible}
                                >
                                    Select shown
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11"
                                    onClick={() => setData('employees', [])}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>

                        {visibleEmployees.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No employees match that search.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {visibleEmployees.map((employee) => {
                                    const row = data.employees.find(
                                        (item) =>
                                            item.employee_id === String(employee.id),
                                    );
                                    const selected = row !== undefined;
                                    const ready = canSchedule(employee);
                                    const errorIndex = data.employees.findIndex(
                                        (item) =>
                                            item.employee_id === String(employee.id),
                                    );
                                    const rates =
                                        employee.skills.find(
                                            (skill) =>
                                                String(skill.id) ===
                                                row?.skill_id,
                                        )?.rates ?? [];

                                    return (
                                        <li
                                            key={employee.id}
                                            className="rounded-lg border border-border p-4"
                                        >
                                            <label className="flex items-start gap-3">
                                                <Checkbox
                                                    className="mt-1"
                                                    checked={selected}
                                                    disabled={!ready}
                                                    onChange={(event) =>
                                                        toggleEmployee(
                                                            employee,
                                                            event.target.checked,
                                                        )
                                                    }
                                                />
                                                <span>
                                                    <span className="block font-medium text-foreground">
                                                        {employee.full_name}
                                                    </span>
                                                    <span className="block text-sm text-muted-foreground">
                                                        {employee.email}
                                                    </span>
                                                    {!ready ? (
                                                        <span className="mt-1 block text-sm text-muted-foreground">
                                                            Add a skill and
                                                            rate on the employee
                                                            record before
                                                            selecting them.
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </label>

                                            {selected && row ? (
                                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`bulk-skill-${employee.id}`}
                                                            value="Skill"
                                                            className={labelClassName}
                                                        />
                                                        <select
                                                            id={`bulk-skill-${employee.id}`}
                                                            value={row.skill_id}
                                                            onChange={(event) =>
                                                                updateRow(
                                                                    row.employee_id,
                                                                    {
                                                                        skill_id:
                                                                            event.target
                                                                                .value,
                                                                        pay_rate_id: '',
                                                                        hours: '',
                                                                    },
                                                                )
                                                            }
                                                            className={selectClassName}
                                                        >
                                                            <option value="">
                                                                Select a skill
                                                            </option>
                                                            {employee.skills.map(
                                                                (skill) => (
                                                                    <option
                                                                        key={skill.id}
                                                                        value={skill.id}
                                                                        disabled={
                                                                            skill
                                                                                .rates
                                                                                .length ===
                                                                            0
                                                                        }
                                                                    >
                                                                        {skill.name}
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`bulk-rate-${employee.id}`}
                                                            value="Rate"
                                                            className={labelClassName}
                                                        />
                                                        <select
                                                            id={`bulk-rate-${employee.id}`}
                                                            value={row.pay_rate_id}
                                                            disabled={row.skill_id === ''}
                                                            onChange={(event) => {
                                                                const rate = rates.find(
                                                                    (item) =>
                                                                        String(item.id) ===
                                                                        event.target.value,
                                                                );

                                                                updateRow(
                                                                    row.employee_id,
                                                                    {
                                                                        pay_rate_id:
                                                                            event.target
                                                                                .value,
                                                                        hours:
                                                                            rate?.rate_type ===
                                                                            'hourly'
                                                                                ? row.hours
                                                                                : '',
                                                                    },
                                                                );
                                                            }}
                                                            className={selectClassName}
                                                        >
                                                            <option value="">
                                                                Select a rate
                                                            </option>
                                                            {rates.map((rate) => (
                                                                <option
                                                                    key={rate.id}
                                                                    value={rate.id}
                                                                >
                                                                    {rate.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <InputError
                                                            message={
                                                                errorBag[
                                                                    `employees.${errorIndex}.pay_rate_id`
                                                                ] ||
                                                                errorBag[
                                                                    `employees.${errorIndex}.skill_id`
                                                                ] ||
                                                                errorBag[
                                                                    `employees.${errorIndex}.employee_id`
                                                                ]
                                                            }
                                                        />
                                                        </div>
                                                        {rates.find(
                                                            (rate) =>
                                                                String(rate.id) ===
                                                                row.pay_rate_id,
                                                        )?.rate_type === 'hourly' ? (
                                                            <div className="flex w-28 shrink-0 flex-col gap-2">
                                                                <InputLabel
                                                                    htmlFor={`bulk-hours-${employee.id}`}
                                                                    value="Hours"
                                                                    className={`${labelClassName} whitespace-nowrap`}
                                                                />
                                                                <TextInput
                                                                    id={`bulk-hours-${employee.id}`}
                                                                    inputMode="decimal"
                                                                    value={row.hours}
                                                                    className={inputClassName}
                                                                    placeholder="0"
                                                                    onChange={(event) =>
                                                                        updateRow(
                                                                            row.employee_id,
                                                                            {
                                                                                hours: numericHours(
                                                                                    event.target
                                                                                        .value,
                                                                                ),
                                                                            },
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={
                                                                        errorBag[
                                                                            `employees.${errorIndex}.hours`
                                                                        ]
                                                                    }
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="submit"
                            disabled={processing}
                            className="h-11 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                        >
                            Save for selected employees
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11"
                            onClick={() =>
                                router.visit(route('admin.employee-attendance.index'))
                            }
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
