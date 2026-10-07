import CertificationBadge from '@/Components/CertificationBadge';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import RichTextEditor from '@/Components/RichTextEditor';
import { Badge } from '@/Components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';
import type {
    ScheduleOption,
    SchedulePayload,
    ScheduleStatusOption,
} from '../types';

function EmployeeChoice({
    employee,
    checked,
    onToggle,
}: {
    employee: ScheduleOption;
    checked: boolean;
    onToggle: () => void;
}) {
    const skills = employee.skills ?? [];
    const certifications = (employee.certifications ?? []).filter(
        (certification) => certification.name,
    );

    return (
        <label className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-3 text-sm">
            <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                onChange={onToggle}
            />
            <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">
                    {employee.full_name}
                </span>
                <span className="block text-xs text-muted-foreground">
                    {employee.email}
                </span>
                {certifications.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">
                        {certifications.map((certification) => (
                            <CertificationBadge
                                key={certification.id}
                                id={certification.id}
                                name={certification.name}
                                competent={certification.is_competent_person}
                                className="h-6 px-2.5"
                            />
                        ))}
                    </span>
                )}
                {skills.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">
                        {skills.map((skill) => (
                            <Badge
                                key={skill.id}
                                variant="outline"
                                className="h-6 border-emerald-300 bg-emerald-100 px-2.5 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
                            >
                                {skill.name}
                            </Badge>
                        ))}
                    </span>
                )}
            </span>
        </label>
    );
}

type ScheduleFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    projects: ScheduleOption[];
    foremen: ScheduleOption[];
    employees: ScheduleOption[];
    statuses: ScheduleStatusOption[];
    defaultDate?: string;
    schedule?: SchedulePayload;
};

export default function ScheduleForm({
    action,
    method = 'post',
    submitLabel,
    projects,
    foremen,
    employees,
    statuses,
    defaultDate = '',
    schedule,
}: ScheduleFormProps) {
    const [employeeSearch, setEmployeeSearch] = useState('');
    const { data, setData, post, processing, errors, transform } = useForm({
        project_uuid: schedule?.project?.uuid ?? '',
        starts_on: schedule?.starts_on ?? schedule?.work_date ?? defaultDate,
        ends_on: schedule?.ends_on ?? schedule?.work_date ?? defaultDate,
        status: schedule?.status ?? 'active',
        foreman_user_id: schedule?.foreman ? String(schedule.foreman.id) : '',
        employee_uuids:
            schedule?.employees.map((employee) => employee.uuid ?? '') ?? [],
        requires_competent_person:
            schedule?.requires_competent_person ?? false,
        competent_person_uuid: schedule?.competent_person?.uuid ?? '',
        notes: schedule?.notes ?? '',
    });

    transform((formData) =>
        method === 'patch' ? { ...formData, _method: 'PATCH' } : formData,
    );

    const competentEmployees = useMemo(
        () => employees.filter((employee) => employee.competent_person),
        [employees],
    );

    const selectedCompetentPerson = useMemo(
        () =>
            competentEmployees.find(
                (employee) => employee.uuid === data.competent_person_uuid,
            ),
        [competentEmployees, data.competent_person_uuid],
    );

    const statusTone =
        {
            active: 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100',
            inactive:
                'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
            on_hold:
                'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
            completed:
                'border-sky-400 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-100',
        }[data.status] ?? 'border-border bg-background text-foreground';

    const selectedEmployees = useMemo(
        () =>
            employees.filter((employee) =>
                data.employee_uuids.includes(employee.uuid ?? ''),
            ),
        [data.employee_uuids, employees],
    );

    const availableEmployees = useMemo(() => {
        const query = employeeSearch.trim().toLowerCase();
        const selected = new Set(data.employee_uuids);

        return employees.filter((employee) => {
            if (selected.has(employee.uuid ?? '')) {
                return false;
            }

            if (query === '') {
                return true;
            }

            const name = (employee.full_name ?? '').toLowerCase();
            const skills = (employee.skills ?? [])
                .map((skill) => skill.name.toLowerCase())
                .join(' ');
            const certifications = (employee.certifications ?? [])
                .map((certification) => certification.name.toLowerCase())
                .join(' ');

            return (
                name.includes(query) ||
                employee.email.toLowerCase().includes(query) ||
                skills.includes(query) ||
                certifications.includes(query)
            );
        });
    }, [data.employee_uuids, employeeSearch, employees]);

    const toggleEmployee = (employeeUuid: string) => {
        setData(
            'employee_uuids',
            data.employee_uuids.includes(employeeUuid)
                ? data.employee_uuids.filter((uuid) => uuid !== employeeUuid)
                : [...data.employee_uuids, employeeUuid],
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(action);
    };

    return (
        <form onSubmit={submit} className="pb-28">
            <FormActionFab
                cancelHref={route('admin.employee-schedules.index', {
                    date: data.starts_on,
                })}
                saveLabel={submitLabel}
                disabled={processing}
            />
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Job crew</CardTitle>
                    <CardDescription>
                        Set the start and end dates for this job. A schedule
                        can cover a whole week. Choose the foreman responsible
                        and every employee attending.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 lg:grid-cols-4">
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="schedule-start" value="Start date" />
                        <input
                            id="schedule-start"
                            type="date"
                            value={data.starts_on}
                            onChange={(event) => {
                                const startsOn = event.target.value;

                                setData({
                                    ...data,
                                    starts_on: startsOn,
                                    ends_on:
                                        !data.ends_on || data.ends_on < startsOn
                                            ? startsOn
                                            : data.ends_on,
                                });
                            }}
                            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
                        />
                        <InputError message={errors.starts_on} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="schedule-end" value="End date" />
                        <input
                            id="schedule-end"
                            type="date"
                            value={data.ends_on}
                            min={data.starts_on}
                            onChange={(event) =>
                                setData('ends_on', event.target.value)
                            }
                            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
                        />
                        <InputError message={errors.ends_on} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="schedule-status" value="Status" />
                        <select
                            id="schedule-status"
                            value={data.status}
                            onChange={(event) =>
                                setData('status', event.target.value)
                            }
                            className={`h-9 w-44 rounded-md border px-2 text-sm font-medium shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring ${statusTone}`}
                        >
                            {statuses.map((status) => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.status} />
                    </div>
                    <div className="flex flex-col gap-2 lg:col-span-4">
                        <InputLabel htmlFor="schedule-project" value="Job" />
                        <select
                            id="schedule-project"
                            value={data.project_uuid}
                            onChange={(event) =>
                                setData('project_uuid', event.target.value)
                            }
                            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Select a job</option>
                            {projects.map((project) => (
                                <option key={project.uuid} value={project.uuid ?? ''}>
                                    {project.name}
                                    {project.project_number
                                        ? ` (${project.project_number})`
                                        : ''}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.project_uuid} />
                    </div>
                    <div className="flex flex-col gap-2 lg:col-span-2">
                        <InputLabel
                            htmlFor="schedule-foreman"
                            value="Foreman or responsible"
                        />
                        <select
                            id="schedule-foreman"
                            value={data.foreman_user_id}
                            onChange={(event) =>
                                setData('foreman_user_id', event.target.value)
                            }
                            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Select a foreman</option>
                            {foremen.map((foreman) => (
                                <option key={foreman.id} value={foreman.id}>
                                    {foreman.name} ({foreman.email})
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.foreman_user_id} />
                    </div>
                    <div className="flex flex-col gap-3 lg:col-span-4">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                            <input
                                type="checkbox"
                                checked={data.requires_competent_person}
                                onChange={(event) =>
                                    setData({
                                        ...data,
                                        requires_competent_person:
                                            event.target.checked,
                                        competent_person_uuid: event.target
                                            .checked
                                            ? data.competent_person_uuid
                                            : '',
                                    })
                                }
                            />
                            This job needs a competent person
                        </label>
                        {data.requires_competent_person && (
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="schedule-competent-person"
                                    value="Competent person"
                                />
                                <select
                                    id="schedule-competent-person"
                                    value={data.competent_person_uuid}
                                    onChange={(event) => {
                                        const uuid = event.target.value;

                                        setData({
                                            ...data,
                                            competent_person_uuid: uuid,
                                            employee_uuids:
                                                uuid !== '' &&
                                                !data.employee_uuids.includes(
                                                    uuid,
                                                )
                                                    ? [
                                                          ...data.employee_uuids,
                                                          uuid,
                                                      ]
                                                    : data.employee_uuids,
                                        });
                                    }}
                                    className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">
                                        Select a competent person
                                    </option>
                                    {competentEmployees.map((employee) => (
                                        <option
                                            key={employee.uuid}
                                            value={employee.uuid ?? ''}
                                        >
                                            {employee.full_name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Only employees with a competent person
                                    certification are listed.
                                </p>
                                {competentEmployees.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No employee has a competent person
                                        certification yet.
                                    </p>
                                )}
                                {(selectedCompetentPerson?.certifications ?? [])
                                    .length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {selectedCompetentPerson?.certifications?.map(
                                            (certification) => (
                                                <CertificationBadge
                                                    key={certification.id}
                                                    id={certification.id}
                                                    name={certification.name}
                                                    competent={
                                                        certification.is_competent_person
                                                    }
                                                    className="h-6 px-2.5"
                                                />
                                            ),
                                        )}
                                    </div>
                                )}
                                <InputError
                                    message={errors.competent_person_uuid}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-3 lg:col-span-4">
                        <InputLabel
                            htmlFor="schedule-employee-search"
                            value={`Employees attending (${data.employee_uuids.length} selected)`}
                        />
                        <input
                            id="schedule-employee-search"
                            value={employeeSearch}
                            onChange={(event) =>
                                setEmployeeSearch(event.target.value)
                            }
                            placeholder="Search name, email, skill, or qualification"
                            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {selectedEmployees.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Selected for this job
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {selectedEmployees.map((employee) => (
                                        <EmployeeChoice
                                            key={employee.uuid}
                                            employee={employee}
                                            checked
                                            onToggle={() =>
                                                toggleEmployee(
                                                    employee.uuid ?? '',
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-medium text-muted-foreground">
                                Available employees
                            </p>
                            {availableEmployees.length === 0 ? (
                                <p className="rounded-md border border-border px-3 py-4 text-sm text-muted-foreground">
                                    No employees match that search.
                                </p>
                            ) : (
                                <div className="grid max-h-[32rem] gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                                    {availableEmployees.map((employee) => (
                                        <EmployeeChoice
                                            key={employee.uuid}
                                            employee={employee}
                                            checked={false}
                                            onToggle={() =>
                                                toggleEmployee(
                                                    employee.uuid ?? '',
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <InputError message={errors.employee_uuids} />
                    </div>
                    <div className="flex flex-col gap-2 lg:col-span-4">
                        <InputLabel htmlFor="schedule-notes" value="Notes" />
                        <RichTextEditor
                            id="schedule-notes"
                            value={data.notes}
                            onChange={(html) => setData('notes', html)}
                            placeholder="Notes for this job"
                            error={errors.notes}
                            showPlaceholders={false}
                            allowSideToolbar={false}
                        />
                        <InputError message={errors.notes} />
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
