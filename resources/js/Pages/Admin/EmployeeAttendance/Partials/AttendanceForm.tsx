import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
    WORK_WEEK,
    addDays,
    attendanceToFormData,
    hoursLabel,
    mondayOf,
    numericHours,
    weekRangeLabel,
    weekdayDateLabel,
    type AttendanceDayPayload,
    type AttendanceEmployeeOption,
    type AttendanceFormData,
    type AttendanceWeekPayload,
} from '../types';

const inputClassName =
    'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
const labelClassName = 'text-emerald-700 dark:text-emerald-300';
const selectClassName =
    'h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

function SavedDayDetails({ day }: { day: AttendanceDayPayload }) {
    return (
        <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium text-foreground">
                {day.skill?.name ?? day.profession?.name ?? 'Skill'}
            </p>
            <p className="text-muted-foreground">{day.rate_label}</p>
            {day.rate_type === 'hourly' && hoursLabel(day.hours) ? (
                <p className="text-muted-foreground">{hoursLabel(day.hours)}</p>
            ) : null}
            <div className="flex flex-wrap gap-1">
                {day.scheduled ? <Badge variant="outline">On schedule</Badge> : null}
                {day.worked ? <Badge>Worked</Badge> : null}
            </div>
            {day.notes ? (
                <p className="text-muted-foreground">{day.notes}</p>
            ) : null}
        </div>
    );
}

type AttendanceFormProps = {
    action: string;
    method: 'post' | 'patch';
    submitLabel: string;
    employees: AttendanceEmployeeOption[];
    attendance?: AttendanceWeekPayload;
    defaultWeekStart: string;
};

export default function AttendanceForm({
    action,
    method,
    submitLabel,
    employees,
    attendance,
    defaultWeekStart,
}: AttendanceFormProps) {
    const form = useForm<AttendanceFormData>(
        attendanceToFormData(attendance, employees, defaultWeekStart),
    );
    const { data, setData, processing, errors, transform } = form;
    const errorBag = errors as Record<string, string | undefined>;
    const selectedEmployee = employees.find(
        (employee) => String(employee.id) === data.employee_id,
    );
    const rangeLabel = data.week_start ? weekRangeLabel(data.week_start) : '';
    const [existingWeek, setExistingWeek] = useState<AttendanceWeekPayload | null>(
        null,
    );
    const [loadingExisting, setLoadingExisting] = useState(false);
    const existingRequest = useRef(0);
    const existingByDate = new Map(
        (existingWeek?.days ?? []).map((day) => [day.work_date, day]),
    );
    const openDayCount = data.week_start
        ? WORK_WEEK.filter(
              (weekday) =>
                  !existingByDate.has(addDays(data.week_start, weekday.offset)),
          ).length
        : WORK_WEEK.length;

    useEffect(() => {
        if (attendance || data.employee_id === '' || data.week_start === '') {
            setExistingWeek(null);
            setLoadingExisting(false);
            return;
        }

        const requestId = ++existingRequest.current;
        const params = new URLSearchParams({
            employee_id: data.employee_id,
            week_start: data.week_start,
        });
        let existingUrl = `/administration/employees/attendance/existing?${params.toString()}`;

        try {
            existingUrl = `${route(
                'admin.employee-attendance.existing',
                undefined,
                false,
            )}?${params.toString()}`;
        } catch {
            existingUrl = `/administration/employees/attendance/existing?${params.toString()}`;
        }

        setLoadingExisting(true);

        fetch(existingUrl, {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then(async (response) => {
                if (requestId !== existingRequest.current) {
                    return;
                }

                if (!response.ok) {
                    setExistingWeek(null);
                    return;
                }

                const body = (await response.json()) as {
                    attendance?: AttendanceWeekPayload | null;
                };
                setExistingWeek(body.attendance ?? null);
            })
            .catch(() => {
                if (requestId === existingRequest.current) {
                    setExistingWeek(null);
                }
            })
            .finally(() => {
                if (requestId === existingRequest.current) {
                    setLoadingExisting(false);
                }
            });
    }, [attendance, data.employee_id, data.week_start]);

    const blankDays = () =>
        data.days.map(() => ({
            scheduled: false,
            worked: false,
            skill_id: '',
            pay_rate_id: '',
            hours: '',
            notes: '',
        }));

    const updateDay = (
        index: number,
        patch: Partial<AttendanceFormData['days'][number]>,
    ) => {
        setData(
            'days',
            data.days.map((day, dayIndex) =>
                dayIndex === index ? { ...day, ...patch } : day,
            ),
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        transform((values) => ({
            ...values,
            employee_id: values.employee_id,
            days: values.days.map((day, offset) => ({
                work_date: values.week_start
                    ? addDays(values.week_start, offset)
                    : '',
                skill_id: day.skill_id || null,
                pay_rate_id: day.pay_rate_id || null,
                hours: day.hours || null,
                scheduled: day.scheduled,
                worked: day.worked,
                notes: day.notes,
            })),
        }));

        if (method === 'post') {
            form.post(action);
            return;
        }

        form.patch(action);
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-6">
            <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <InputLabel
                        htmlFor="attendance-employee"
                        value="Employee"
                        className={labelClassName}
                    />
                    <select
                        id="attendance-employee"
                        value={data.employee_id}
                        onChange={(event) => {
                            setData({
                                ...data,
                                employee_id: event.target.value,
                                days: blankDays(),
                            });
                        }}
                        className={selectClassName}
                    >
                        <option value="">Select an employee</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.full_name} ({employee.email})
                            </option>
                        ))}
                    </select>
                    <InputError message={errorBag.employee_id} />
                </div>

                <div className="flex flex-col gap-2">
                    <InputLabel
                        htmlFor="attendance-week"
                        value="Work week"
                        className={labelClassName}
                    />
                    <TextInput
                        id="attendance-week"
                        type="date"
                        value={data.week_start}
                        className={inputClassName}
                        onChange={(event) =>
                            setData({
                                ...data,
                                week_start: event.target.value
                                    ? mondayOf(event.target.value)
                                    : '',
                                days: blankDays(),
                            })
                        }
                    />
                    <p className="text-sm text-muted-foreground">
                        {rangeLabel
                            ? `Monday through Saturday: ${rangeLabel}. Any date snaps to that week's Monday.`
                            : 'Work weeks run Monday through Saturday.'}
                    </p>
                    <InputError message={errorBag.week_start} />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                    <InputLabel
                        htmlFor="attendance-notes"
                        value="Week notes"
                        className={labelClassName}
                    />
                    <textarea
                        id="attendance-notes"
                        value={data.notes}
                        rows={3}
                        onChange={(event) => setData('notes', event.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Optional note for this work week"
                    />
                    <InputError message={errorBag.notes} />
                </div>
            </section>

            <section className="flex flex-col gap-4">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        Schedule and days worked
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        For each day, choose the employee&apos;s skill and rate.
                        Mark the day on the schedule, as worked, or both.
                    </p>
                    {!attendance && loadingExisting ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                            Checking the days already set for this work week.
                        </p>
                    ) : null}
                    {!attendance && existingWeek && existingWeek.days.length > 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                            {openDayCount === 0
                                ? 'Every Monday through Saturday is already set for this week.'
                                : 'Days already set stay as they are. Add any day that is still open.'}{' '}
                            <Link
                                href={route(
                                    'admin.employee-attendance.edit',
                                    existingWeek.uuid,
                                )}
                                className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                            >
                                Edit this week
                            </Link>
                        </p>
                    ) : null}
                    <InputError message={errorBag.days} className="mt-2" />
                </div>

                {selectedEmployee && selectedEmployee.skills.length === 0 ? (
                    <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        This employee has no skill rates yet. Add a skill and
                        its rates on the employee record before scheduling days.
                    </p>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {WORK_WEEK.map((weekday, index) => {
                        const day = data.days[index];
                        const active = day.scheduled || day.worked;
                        const skills = selectedEmployee?.skills ?? [];
                        const rates =
                            skills.find(
                                (skill) => String(skill.id) === day.skill_id,
                            )?.rates ?? [];
                        const hourlyRate =
                            rates.find((rate) => String(rate.id) === day.pay_rate_id)
                                ?.rate_type === 'hourly';
                        const workDate = data.week_start
                            ? addDays(data.week_start, weekday.offset)
                            : '';
                        const savedDay = attendance
                            ? undefined
                            : existingByDate.get(workDate);

                        return (
                            <article
                                key={weekday.label}
                                className={
                                    savedDay
                                        ? 'flex flex-col gap-4 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/10'
                                        : 'flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10'
                                }
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <h4 className="font-semibold text-foreground">
                                        {workDate
                                            ? weekdayDateLabel(workDate)
                                            : weekday.label}
                                    </h4>
                                    {savedDay ? (
                                        <Badge variant="secondary">Already set</Badge>
                                    ) : null}
                                </div>

                                {savedDay ? (
                                    <SavedDayDetails day={savedDay} />
                                ) : (
                                <>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-sm text-foreground">
                                        <Checkbox
                                            checked={day.scheduled}
                                            onChange={(event) =>
                                                updateDay(index, {
                                                    scheduled: event.target.checked,
                                                })
                                            }
                                        />
                                        On schedule
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-foreground">
                                        <Checkbox
                                            checked={day.worked}
                                            onChange={(event) =>
                                                updateDay(index, {
                                                    worked: event.target.checked,
                                                })
                                            }
                                        />
                                        Worked
                                    </label>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`attendance-skill-${index}`}
                                        value="Skill"
                                        className={labelClassName}
                                    />
                                    <select
                                        id={`attendance-skill-${index}`}
                                        value={day.skill_id}
                                        disabled={!active || !selectedEmployee}
                                        onChange={(event) =>
                                            updateDay(index, {
                                                skill_id: event.target.value,
                                                pay_rate_id: '',
                                                hours: '',
                                            })
                                        }
                                        className={selectClassName}
                                    >
                                        <option value="">Select a skill</option>
                                        {skills.map((skill) => (
                                            <option key={skill.id} value={skill.id}>
                                                {skill.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`attendance-rate-${index}`}
                                            value="Rate"
                                            className={labelClassName}
                                        />
                                        <select
                                            id={`attendance-rate-${index}`}
                                            value={day.pay_rate_id}
                                            disabled={
                                                !active || day.skill_id === ''
                                            }
                                            onChange={(event) => {
                                                const rate = rates.find(
                                                    (item) =>
                                                        String(item.id) ===
                                                        event.target.value,
                                                );

                                                updateDay(index, {
                                                    pay_rate_id: event.target.value,
                                                    hours:
                                                        rate?.rate_type === 'hourly'
                                                            ? day.hours
                                                            : '',
                                                });
                                            }}
                                            className={selectClassName}
                                        >
                                            <option value="">Select a rate</option>
                                            {rates.map((rate) => (
                                                <option key={rate.id} value={rate.id}>
                                                    {rate.label}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={
                                                errorBag[`days.${index}.pay_rate_id`] ||
                                                errorBag[`days.${index}.work_date`]
                                            }
                                        />
                                    </div>

                                    {hourlyRate ? (
                                        <div className="flex w-28 shrink-0 flex-col gap-2">
                                            <InputLabel
                                                htmlFor={`attendance-hours-${index}`}
                                                value="Hours"
                                                className={`${labelClassName} whitespace-nowrap`}
                                            />
                                            <TextInput
                                                id={`attendance-hours-${index}`}
                                                inputMode="decimal"
                                                value={day.hours}
                                                className={inputClassName}
                                                placeholder="0"
                                                onChange={(event) =>
                                                    updateDay(index, {
                                                        hours: numericHours(
                                                            event.target.value,
                                                        ),
                                                    })
                                                }
                                            />
                                            <InputError
                                                message={
                                                    errorBag[`days.${index}.hours`]
                                                }
                                            />
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`attendance-day-notes-${index}`}
                                        value="Day notes"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id={`attendance-day-notes-${index}`}
                                        value={day.notes}
                                        disabled={!active}
                                        className={inputClassName}
                                        placeholder="Optional"
                                        onChange={(event) =>
                                            updateDay(index, {
                                                notes: event.target.value,
                                            })
                                        }
                                    />
                                </div>
                                </>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="submit"
                    disabled={
                        processing ||
                        loadingExisting ||
                        (!attendance && openDayCount === 0)
                    }
                    className="h-11 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                >
                    {submitLabel}
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
    );
}
