import CertificationBadge from "@/Components/CertificationBadge";
import CreatableSelect from "@/Components/CreatableSelect";
import CrewRatePicker, { type RateGroup } from "@/Components/CrewRatePicker";
import FormActionFab from "@/Components/FormActionFab";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import RichTextEditor from "@/Components/RichTextEditor";
import { Badge } from "@/Components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { router, useForm } from "@inertiajs/react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
    ScheduleDailyTask,
    ScheduleCertification,
    ScheduleOption,
    SchedulePayload,
    ScheduleStatusOption,
} from "../types";

type CrewAssignment = {
    skill_id: number | null;
    employee_pay_rate_id: number | null;
};

function CrewAssignmentRow({
    employee,
    value,
    error,
    onChange,
}: {
    employee: ScheduleOption;
    value: CrewAssignment;
    error?: string;
    onChange: (value: CrewAssignment) => void;
}) {
    const [groups, setGroups] = useState<RateGroup[] | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        fetch(route("admin.employee-schedules.rates", employee.uuid ?? ""), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setGroups(data?.groups ?? []))
            .catch(() => undefined);

        return () => controller.abort();
    }, [employee.uuid]);

    return (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">
                {employee.full_name ?? employee.name}
            </p>
            {groups === null ? (
                <p className="text-xs text-muted-foreground">Loading rates...</p>
            ) : (
                <CrewRatePicker
                    groups={groups}
                    skillId={value.skill_id}
                    rateId={value.employee_pay_rate_id}
                    onChange={(skill_id, employee_pay_rate_id) =>
                        onChange({ skill_id, employee_pay_rate_id })
                    }
                />
            )}
            <InputError message={error} />
        </div>
    );
}

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
                {employee.job_title && (
                    <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {employee.job_title}
                    </span>
                )}
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

function PersonCard({
    name,
    jobTitle,
    email,
    certifications,
    tag,
    onRemove,
}: {
    name: string;
    jobTitle?: string | null;
    email?: string | null;
    certifications?: ScheduleCertification[];
    tag: string;
    onRemove?: () => void;
}) {
    const initials = name
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {initials}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{name}</span>
                    <Badge variant="outline">{tag}</Badge>
                </span>
                <span className="block text-xs text-muted-foreground">
                    {jobTitle || "No job title set"}
                    {email && ` · ${email}`}
                </span>
                {(certifications ?? []).length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">
                        {certifications?.map((certification) => (
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
            </span>
            {onRemove && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${tag.toLowerCase()}`}
                    onClick={onRemove}
                >
                    <Trash2Icon className="size-4" />
                </Button>
            )}
        </div>
    );
}

type ScheduleFormProps = {
    action: string;
    method?: "post" | "patch";
    submitLabel: string;
    projects: ScheduleOption[];
    foremen: ScheduleOption[];
    employees: ScheduleOption[];
    dailyTasks?: ScheduleDailyTask[];
    statuses: ScheduleStatusOption[];
    defaultDate?: string;
    defaultEndDate?: string;
    schedule?: SchedulePayload;
    crewAssignments?: Record<string, CrewAssignment>;
};

function saturdayOfWeek(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime()) || parsed.getDay() === 0) {
        return date;
    }

    parsed.setDate(parsed.getDate() + (6 - parsed.getDay()));

    const pad = (value: number) => String(value).padStart(2, "0");

    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export default function ScheduleForm({
    action,
    method = "post",
    submitLabel,
    projects,
    foremen,
    employees,
    dailyTasks = [],
    statuses,
    defaultDate = "",
    defaultEndDate,
    schedule,
    crewAssignments = {},
}: ScheduleFormProps) {
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [focusNewDailyTask, setFocusNewDailyTask] = useState(false);
    const lastTaskRefresh = useRef(0);
    const { data, setData, post, processing, errors, transform } = useForm({
        project_uuid: schedule?.project?.uuid ?? "",
        starts_on: schedule?.starts_on ?? schedule?.work_date ?? defaultDate,
        ends_on: schedule?.ends_on ?? schedule?.work_date ?? defaultEndDate ?? defaultDate,
        status: schedule?.status ?? "active",
        foreman_user_id: schedule?.foreman ? String(schedule.foreman.id) : "",
        employee_uuids:
            schedule?.employees.map((employee) => employee.uuid ?? "") ?? [],
        requires_competent_person: schedule?.requires_competent_person ?? false,
        competent_person_uuid: schedule?.competent_person?.uuid ?? "",
        quality_control_uuid: schedule?.quality_control?.uuid ?? "",
        notes: schedule?.notes ?? "",
        daily_task_uuids: schedule?.daily_task_uuids ?? [],
        crew_assignments: crewAssignments as Record<string, CrewAssignment>,
    });

    transform((formData) => {
        const payload = {
            ...formData,
            requires_competent_person: formData.competent_person_uuid !== "",
            daily_task_uuids: formData.daily_task_uuids.filter(Boolean),
        };

        return method === "patch" ? { ...payload, _method: "PATCH" } : payload;
    });

    const refreshDailyTasks = () => {
        const now = Date.now();

        if (now - lastTaskRefresh.current < 5_000) {
            return;
        }

        lastTaskRefresh.current = now;
        router.reload({
            only: ["dailyTasks"],
            preserveScroll: true,
            preserveState: true,
            showProgress: false,
        } as never);
    };

    const selectedForeman = useMemo(
        () =>
            foremen.find(
                (foreman) => String(foreman.id) === data.foreman_user_id,
            ),
        [foremen, data.foreman_user_id],
    );

    const foremanEmployee = useMemo(
        () =>
            employees.find(
                (employee) =>
                    employee.uuid &&
                    employee.uuid === selectedForeman?.employee_uuid,
            ),
        [employees, selectedForeman],
    );

    const roles = [
        {
            field: "competent_person_uuid" as const,
            errorKey: "competent_person_uuid" as const,
            title: "Competent person",
            eligible: employees.filter((employee) => employee.competent_person),
            missing: "This employee has no competent person certification.",
            none: "No employee has a competent person certification yet.",
        },
        {
            field: "quality_control_uuid" as const,
            errorKey: "quality_control_uuid" as const,
            title: "Quality control",
            eligible: employees.filter((employee) => employee.quality_control),
            missing: "This employee is not marked as quality control.",
            none: "No employee is marked as quality control yet.",
        },
    ];

    const changeForeman = (foremanId: string) => {
        const next = foremen.find(
            (foreman) => String(foreman.id) === foremanId,
        );
        const previousUuid = foremanEmployee?.uuid;

        setData({
            ...data,
            foreman_user_id: foremanId,
            competent_person_uuid:
                data.competent_person_uuid === previousUuid
                    ? ""
                    : data.competent_person_uuid,
            quality_control_uuid:
                data.quality_control_uuid === previousUuid
                    ? ""
                    : data.quality_control_uuid,
        });

        return next;
    };

    const statusTone =
        {
            active: "border-emerald-400 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
            inactive:
                "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100",
            on_hold:
                "border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
            completed:
                "border-sky-400 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
        }[data.status] ?? "border-border bg-background text-foreground";

    const selectedEmployees = useMemo(
        () =>
            employees.filter((employee) =>
                data.employee_uuids.includes(employee.uuid ?? ""),
            ),
        [data.employee_uuids, employees],
    );

    const availableEmployees = useMemo(() => {
        const query = employeeSearch.trim().toLowerCase();
        const selected = new Set(data.employee_uuids);

        return employees.filter((employee) => {
            if (selected.has(employee.uuid ?? "")) {
                return false;
            }

            if (query === "") {
                return true;
            }

            const name = (employee.full_name ?? "").toLowerCase();
            const skills = (employee.skills ?? [])
                .map((skill) => skill.name.toLowerCase())
                .join(" ");
            const certifications = (employee.certifications ?? [])
                .map((certification) => certification.name.toLowerCase())
                .join(" ");

            return (
                name.includes(query) ||
                (employee.job_title ?? "").toLowerCase().includes(query) ||
                employee.email.toLowerCase().includes(query) ||
                skills.includes(query) ||
                certifications.includes(query)
            );
        });
    }, [data.employee_uuids, employeeSearch, employees]);

    const employeeGroups = useMemo(() => {
        const selectedId = selectedForeman?.id;
        const rank = (employee: ScheduleOption) =>
            employee.uuid && employee.uuid === foremanEmployee?.uuid ? 0 : 1;
        const groups = new Map<
            string,
            { key: string; label: string; employees: ScheduleOption[] }
        >();

        availableEmployees.forEach((employee) => {
            const isForeman = rank(employee) === 0;
            const ownerId = isForeman
                ? selectedId
                : (employee.foreman_user_id ?? null);
            const owner = foremen.find((foreman) => foreman.id === ownerId);
            const key = ownerId ? String(ownerId) : "none";
            const group = groups.get(key) ?? {
                key,
                label: owner
                    ? `Foreman ${owner.full_name ?? owner.name}`
                    : "No foreman assigned",
                employees: [],
            };

            group.employees.push(employee);
            groups.set(key, group);
        });

        return [...groups.values()]
            .map((group) => ({
                ...group,
                employees: [...group.employees].sort(
                    (a, b) => rank(a) - rank(b),
                ),
            }))
            .sort((a, b) => {
                const weight = (key: string) =>
                    key === String(selectedId) ? 0 : key === "none" ? 2 : 1;

                return weight(a.key) - weight(b.key);
            });
    }, [availableEmployees, foremanEmployee, foremen, selectedForeman]);

    const toggleEmployee = (employeeUuid: string) => {
        setData(
            "employee_uuids",
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
                cancelHref={route("admin.employee-schedules.index", {
                    date: data.starts_on,
                })}
                saveLabel={submitLabel}
                disabled={processing}
            />
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Job crew</CardTitle>
                    <CardDescription>
                        Set the start and end dates for this job. A schedule can
                        cover a whole week. Choose the foreman responsible and
                        every employee attending.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 lg:grid-cols-4">
                    <div className="flex flex-col gap-2 lg:col-span-4">
                        <InputLabel htmlFor="schedule-project" value="Job" />
                        <select
                            id="schedule-project"
                            value={data.project_uuid}
                            onChange={(event) =>
                                setData("project_uuid", event.target.value)
                            }
                            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Select a job</option>
                            {projects.map((project) => (
                                <option
                                    key={project.uuid}
                                    value={project.uuid ?? ""}
                                >
                                    {project.name}
                                    {project.project_number
                                        ? ` (${project.project_number})`
                                        : ""}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.project_uuid} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="schedule-start"
                            value="Start date"
                        />
                        <input
                            id="schedule-start"
                            type="date"
                            value={data.starts_on}
                            onChange={(event) => {
                                const startsOn = event.target.value;

                                setData({
                                    ...data,
                                    starts_on: startsOn,
                                    ends_on: !schedule
                                        ? saturdayOfWeek(startsOn)
                                        : !data.ends_on ||
                                            data.ends_on < startsOn
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
                                setData("ends_on", event.target.value)
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
                                setData("status", event.target.value)
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
                    <div className="flex flex-col gap-3 lg:col-span-4">
                        <div className="flex flex-col gap-2 lg:max-w-xl">
                            <InputLabel
                                htmlFor="schedule-foreman"
                                value="Foreman or responsible"
                            />
                            <select
                                id="schedule-foreman"
                                value={data.foreman_user_id}
                                onChange={(event) =>
                                    changeForeman(event.target.value)
                                }
                                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">Select a foreman</option>
                                {foremen.map((foreman) => (
                                    <option key={foreman.id} value={foreman.id}>
                                        {foreman.full_name ?? foreman.name}
                                        {foreman.job_title
                                            ? ` — ${foreman.job_title}`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.foreman_user_id} />
                        </div>
                        {selectedForeman && (
                            <PersonCard
                                name={
                                    foremanEmployee?.full_name ??
                                    selectedForeman.name ??
                                    ""
                                }
                                jobTitle={selectedForeman.job_title}
                                email={selectedForeman.email}
                                certifications={foremanEmployee?.certifications}
                                tag="Foreman"
                            />
                        )}
                        {selectedForeman && (
                            <div className="grid gap-4 lg:grid-cols-2">
                                {roles.map((role) => {
                                    const value = data[role.field];
                                    const isForeman =
                                        Boolean(foremanEmployee?.uuid) &&
                                        value === foremanEmployee?.uuid;
                                    const canBeForeman = role.eligible.some(
                                        (employee) =>
                                            employee.uuid ===
                                            foremanEmployee?.uuid,
                                    );
                                    const chosen = role.eligible.find(
                                        (employee) => employee.uuid === value,
                                    );

                                    return (
                                        <div
                                            key={role.field}
                                            className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4"
                                        >
                                            <p className="text-sm font-semibold text-foreground">
                                                {role.title}
                                            </p>
                                            <label
                                                className={`flex items-start gap-2 text-sm ${canBeForeman ? "text-foreground" : "text-muted-foreground"}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="mt-1"
                                                    disabled={!canBeForeman}
                                                    checked={isForeman}
                                                    onChange={(event) =>
                                                        setData(
                                                            role.field,
                                                            event.target.checked
                                                                ? (foremanEmployee?.uuid ??
                                                                      "")
                                                                : "",
                                                        )
                                                    }
                                                />
                                                <span>
                                                    The foreman is the{" "}
                                                    {role.title.toLowerCase()}
                                                    {!canBeForeman && (
                                                        <span className="block text-xs">
                                                            {foremanEmployee
                                                                ? role.missing
                                                                : "This foreman has no employee record."}
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                            {isForeman ? null : chosen ? (
                                                <PersonCard
                                                    name={
                                                        chosen.full_name ?? ""
                                                    }
                                                    jobTitle={chosen.job_title}
                                                    email={chosen.email}
                                                    certifications={
                                                        chosen.certifications
                                                    }
                                                    tag={role.title}
                                                    onRemove={() =>
                                                        setData(role.field, "")
                                                    }
                                                />
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    <select
                                                        id={`schedule-${role.field}`}
                                                        aria-label={`Select a ${role.title.toLowerCase()}`}
                                                        value=""
                                                        onChange={(event) =>
                                                            setData(
                                                                role.field,
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                                    >
                                                        <option value="">
                                                            Select a{" "}
                                                            {role.title.toLowerCase()}
                                                        </option>
                                                        {role.eligible.map(
                                                            (employee) => (
                                                                <option
                                                                    key={
                                                                        employee.uuid
                                                                    }
                                                                    value={
                                                                        employee.uuid ??
                                                                        ""
                                                                    }
                                                                >
                                                                    {
                                                                        employee.full_name
                                                                    }
                                                                    {employee.job_title
                                                                        ? ` — ${employee.job_title}`
                                                                        : ""}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    {role.eligible.length ===
                                                        0 && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {role.none}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            <InputError
                                                message={errors[role.errorKey]}
                                            />
                                        </div>
                                    );
                                })}
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
                            placeholder="Search name, job title, email, skill, or qualification"
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
                                                    employee.uuid ?? "",
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        {selectedEmployees.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Skill and pay rate for this job
                                </p>
                                <div className="grid gap-2 lg:grid-cols-2">
                                    {selectedEmployees.map((employee) => (
                                        <CrewAssignmentRow
                                            key={employee.uuid}
                                            employee={employee}
                                            value={
                                                data.crew_assignments[
                                                    employee.uuid ?? ""
                                                ] ?? {
                                                    skill_id: null,
                                                    employee_pay_rate_id: null,
                                                }
                                            }
                                            error={
                                                (errors as Record<string, string>)[
                                                    `crew_assignments.${employee.uuid}.employee_pay_rate_id`
                                                ]
                                            }
                                            onChange={(value) =>
                                                setData("crew_assignments", {
                                                    ...data.crew_assignments,
                                                    [employee.uuid ?? ""]: value,
                                                })
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
                                <div className="flex max-h-[32rem] flex-col gap-4 overflow-y-auto">
                                    {employeeGroups.map((group) => (
                                        <div
                                            key={group.key}
                                            className="flex flex-col gap-2"
                                        >
                                            <p className="text-sm font-semibold text-foreground">
                                                {group.label}
                                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                    {group.employees.length}
                                                </span>
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                                {group.employees.map(
                                                    (employee) => (
                                                        <EmployeeChoice
                                                            key={employee.uuid}
                                                            employee={employee}
                                                            checked={false}
                                                            onToggle={() =>
                                                                toggleEmployee(
                                                                    employee.uuid ??
                                                                        "",
                                                                )
                                                            }
                                                        />
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <InputError message={errors.employee_uuids} />
                    </div>
                    <div className="flex flex-col gap-3 lg:col-span-4">
                        <InputLabel
                            value={`Daily tasks for the foreman (${data.daily_task_uuids.length} selected)`}
                        />
                        <div className="flex flex-col gap-3">
                            {data.daily_task_uuids.map((taskUuid, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <CreatableSelect
                                            id={`schedule-daily-task-${index}`}
                                            label={`Task ${index + 1}`}
                                            value={taskUuid}
                                            options={dailyTasks}
                                            disabledIds={data.daily_task_uuids.filter(
                                                Boolean,
                                            )}
                                            createRoute={route(
                                                "admin.daily-tasks.store",
                                            )}
                                            createExtras={{ is_active: "1" }}
                                            optionsProp="dailyTasks"
                                            entityLabel="task"
                                            placeholder="Type to search or add a task"
                                            onOpen={refreshDailyTasks}
                                            autoFocus={
                                                focusNewDailyTask &&
                                                index ===
                                                    data.daily_task_uuids
                                                        .length -
                                                        1
                                            }
                                            onChange={(uuid) =>
                                                setData(
                                                    "daily_task_uuids",
                                                    data.daily_task_uuids.map(
                                                        (current, position) =>
                                                            position === index
                                                                ? uuid
                                                                : current,
                                                    ),
                                                )
                                            }
                                        />
                                        {(() => {
                                            const task = dailyTasks.find(
                                                (item) =>
                                                    item.uuid === taskUuid,
                                            );

                                            return task &&
                                                (task.performed_by !== 'anyone' ||
                                                    task.requires_photo ||
                                                    task.requires_quality_control) ? (
                                                <div className="mt-1 flex gap-1">
                                                    {task.performed_by &&
                                                        task.performed_by !==
                                                            'anyone' && (
                                                            <Badge variant="outline">
                                                                {task.performed_by_label}
                                                            </Badge>
                                                        )}
                                                    {task.requires_photo && (
                                                        <Badge variant="outline">
                                                            Needs photos
                                                        </Badge>
                                                    )}
                                                    {task.requires_quality_control && (
                                                        <Badge variant="outline">
                                                            Needs quality
                                                            control
                                                        </Badge>
                                                    )}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mt-7"
                                        aria-label="Remove task"
                                        onClick={() =>
                                            setData(
                                                "daily_task_uuids",
                                                data.daily_task_uuids.filter(
                                                    (_, position) =>
                                                        position !== index,
                                                ),
                                            )
                                        }
                                    >
                                        <Trash2Icon className="size-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="create"
                                className="w-fit self-end"
                                onClick={() => {
                                    setFocusNewDailyTask(true);
                                    setData("daily_task_uuids", [
                                        ...data.daily_task_uuids,
                                        "",
                                    ]);
                                }}
                            >
                                <PlusIcon className="size-4" />
                                Add task
                            </Button>
                        </div>
                        <InputError message={errors.daily_task_uuids} />
                    </div>
                    <div className="flex flex-col gap-2 lg:col-span-4">
                        <InputLabel htmlFor="schedule-notes" value="Notes" />
                        <RichTextEditor
                            id="schedule-notes"
                            value={data.notes}
                            onChange={(html) => setData("notes", html)}
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
