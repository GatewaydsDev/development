import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';
import type { ScheduleOption, SchedulePayload } from '../types';

type ScheduleFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    projects: ScheduleOption[];
    foremen: ScheduleOption[];
    employees: ScheduleOption[];
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
    defaultDate = '',
    schedule,
}: ScheduleFormProps) {
    const [employeeSearch, setEmployeeSearch] = useState('');
    const { data, setData, post, processing, errors, transform } = useForm({
        project_id: schedule?.project ? String(schedule.project.id) : '',
        work_date: schedule?.work_date ?? defaultDate,
        foreman_user_id: schedule?.foreman ? String(schedule.foreman.id) : '',
        employee_ids: schedule?.employees.map((employee) => employee.id) ?? [],
        notes: schedule?.notes ?? '',
    });

    transform((formData) =>
        method === 'patch' ? { ...formData, _method: 'PATCH' } : formData,
    );

    const visibleEmployees = useMemo(() => {
        const query = employeeSearch.trim().toLowerCase();

        if (query === '') {
            return employees;
        }

        return employees.filter((employee) => {
            const name = (employee.full_name ?? '').toLowerCase();

            return (
                name.includes(query) ||
                employee.email.toLowerCase().includes(query)
            );
        });
    }, [employeeSearch, employees]);

    const toggleEmployee = (employeeId: number) => {
        setData(
            'employee_ids',
            data.employee_ids.includes(employeeId)
                ? data.employee_ids.filter((id) => id !== employeeId)
                : [...data.employee_ids, employeeId],
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
                    date: data.work_date,
                })}
                saveLabel={submitLabel}
                disabled={processing}
            />
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Job crew</CardTitle>
                    <CardDescription>
                        Choose the job, the foreman responsible for it, and
                        every employee attending. The same employee can also
                        be placed on another job the same day.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="schedule-date" value="Work date" />
                        <input
                            id="schedule-date"
                            type="date"
                            value={data.work_date}
                            onChange={(event) =>
                                setData('work_date', event.target.value)
                            }
                            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
                        />
                        <InputError message={errors.work_date} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel htmlFor="schedule-project" value="Job" />
                        <select
                            id="schedule-project"
                            value={data.project_id}
                            onChange={(event) =>
                                setData('project_id', event.target.value)
                            }
                            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Select a job</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                    {project.project_number
                                        ? ` (${project.project_number})`
                                        : ''}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.project_id} />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
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
                    <div className="flex flex-col gap-2 md:col-span-2">
                        <InputLabel
                            htmlFor="schedule-employee-search"
                            value={`Employees attending (${data.employee_ids.length} selected)`}
                        />
                        <input
                            id="schedule-employee-search"
                            value={employeeSearch}
                            onChange={(event) =>
                                setEmployeeSearch(event.target.value)
                            }
                            placeholder="Search employees"
                            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                            {visibleEmployees.length === 0 ? (
                                <p className="px-3 py-4 text-sm text-muted-foreground">
                                    No employees match that search.
                                </p>
                            ) : (
                                visibleEmployees.map((employee) => (
                                    <label
                                        key={employee.id}
                                        className="flex items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={data.employee_ids.includes(
                                                employee.id,
                                            )}
                                            onChange={() =>
                                                toggleEmployee(employee.id)
                                            }
                                        />
                                        <span>
                                            <span className="block text-foreground">
                                                {employee.full_name}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                {employee.email}
                                            </span>
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                        <InputError message={errors.employee_ids} />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                        <InputLabel htmlFor="schedule-notes" value="Notes" />
                        <textarea
                            id="schedule-notes"
                            value={data.notes}
                            onChange={(event) =>
                                setData('notes', event.target.value)
                            }
                            rows={3}
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <InputError message={errors.notes} />
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
