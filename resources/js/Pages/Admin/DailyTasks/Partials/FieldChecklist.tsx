import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { router, usePage } from '@inertiajs/react';
import {
    AlertTriangleIcon,
    CameraIcon,
    ImageIcon,
    CheckCircle2Icon,
    CircleIcon,
    HardHatIcon,
    UsersRoundIcon,
    LoaderIcon,
    MapPinIcon,
    Trash2Icon,
    XIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type AttendanceSchedule = {
    schedule_uuid: string;
    date: string;
    project: { name: string; project_number: string | null } | null;
    members: {
        uuid: string;
        name: string;
        is_foreman: boolean;
        present: boolean;
        hours: string | null;
        hourly: boolean;
        has_rate: boolean;
        locked: boolean;
    }[];
};

export type FieldStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type FieldTask = {
    task_uuid: string;
    title: string;
    description: string | null;
    requires_photo?: boolean;
    requires_quality_control?: boolean;
    quality_control?: string | null;
    performed_by?: string;
    performed_by_label?: string;
    performers?: {
        uuid: string;
        name: string;
        job_title: string | null;
        is_self: boolean;
        tags: string[];
    }[];
    performed_by_employee_uuids?: string[];
    schedule_uuid: string | null;
    project: { uuid: string; name: string; project_number: string | null } | null;
    status: FieldStatus;
    progress: number;
    completed: boolean;
    completed_at: string | null;
    notes: string | null;
    employee_names: string[];
    photos: { uuid: string; url: string; taken_at: string | null }[];
};

const statuses: {
    value: FieldStatus;
    label: string;
    icon: typeof CircleIcon;
    active: string;
}[] = [
    {
        value: 'pending',
        label: 'Not started',
        icon: CircleIcon,
        active: 'border-slate-500 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
    },
    {
        value: 'in_progress',
        label: 'In progress',
        icon: LoaderIcon,
        active: 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    },
    {
        value: 'blocked',
        label: 'Blocked',
        icon: AlertTriangleIcon,
        active: 'border-red-500 bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
    },
    {
        value: 'completed',
        label: 'Done',
        icon: CheckCircle2Icon,
        active: 'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    },
];

function formatTime(value: string | null): string {
    return value
        ? new Date(value).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
          })
        : '';
}

function TaskCard({ task }: { task: FieldTask }) {
    const [status, setStatus] = useState<FieldStatus>(task.status);
    const [progress, setProgress] = useState(task.progress);
    const [notes, setNotes] = useState(task.notes ?? '');
    const performers = task.performers ?? [];
    const savedPerformers = (
        task.performed_by_employee_uuids?.length
            ? task.performed_by_employee_uuids
            : performers.slice(0, 1).map((p) => p.uuid)
    ).join(',');
    const [selected, setSelected] = useState<string[]>(
        savedPerformers ? savedPerformers.split(',') : [],
    );
    const togglePerformer = (uuid: string) =>
        setSelected((current) =>
            current.includes(uuid)
                ? current.filter((id) => id !== uuid)
                : [...current, uuid],
        );
    const [files, setFiles] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(task.status !== 'completed');
    const camera = useRef<HTMLInputElement>(null);
    const gallery = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setStatus(task.status);
        setProgress(task.progress);
        setNotes(task.notes ?? '');
        setSelected(savedPerformers ? savedPerformers.split(',') : []);
    }, [task.status, task.progress, task.notes, savedPerformers]);

    const previews = useMemo(
        () => files.map((file) => URL.createObjectURL(file)),
        [files],
    );

    useEffect(
        () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
        [previews],
    );

    const dirty =
        status !== task.status ||
        (status === 'in_progress' && progress !== task.progress) ||
        notes !== (task.notes ?? '') ||
        [...selected].sort().join(',') !==
            savedPerformers.split(',').sort().join(',') ||
        files.length > 0;

    const save = (nextStatus: FieldStatus = status) => {
        setSaving(true);
        setError(null);
        router.post(
            route('admin.daily-tasks.progress', task.task_uuid),
            {
                schedule_uuid: task.schedule_uuid,
                status: nextStatus,
                performed_by_employee_uuids: selected,
                progress: nextStatus === 'in_progress' ? progress : null,
                notes,
                photos: files,
            },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => setFiles([]),
                onError: (errors) =>
                    setError(Object.values(errors)[0] ?? 'Could not save.'),
                onFinish: () => setSaving(false),
            },
        );
    };

    const removePhoto = (uuid: string) => {
        if (confirm('Remove this photo?')) {
            router.delete(route('admin.daily-task-photos.destroy', uuid), {
                preserveScroll: true,
            });
        }
    };

    const current = statuses.find((item) => item.value === task.status)!;

    return (
        <div
            className={`rounded-xl border bg-card shadow-sm ${
                task.completed
                    ? 'border-emerald-300 dark:border-emerald-800'
                    : 'border-sky-200 dark:border-sky-900'
            }`}
        >
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-start gap-3 p-4 text-left"
            >
                <current.icon
                    className={`mt-0.5 size-5 shrink-0 ${
                        task.completed
                            ? 'text-emerald-600'
                            : task.status === 'blocked'
                              ? 'text-red-600'
                              : task.status === 'in_progress'
                                ? 'text-amber-600'
                                : 'text-muted-foreground'
                    }`}
                />
                <span className="min-w-0 flex-1">
                    <span
                        className={`block text-base font-semibold ${
                            task.completed
                                ? 'text-muted-foreground line-through'
                                : ''
                        }`}
                    >
                        {task.title}
                    </span>
                    {task.description && (
                        <span className="block text-sm text-muted-foreground">
                            {task.description}
                        </span>
                    )}
                    {(task.requires_photo ||
                        task.requires_quality_control ||
                        task.performed_by !== 'anyone') && (
                        <span className="mt-1 flex flex-wrap gap-1">
                            {task.performed_by &&
                                task.performed_by !== 'anyone' && (
                                    <Badge variant="outline">
                                        {task.performed_by_label}
                                    </Badge>
                                )}
                            {task.requires_photo && (
                                <Badge variant="outline">Photo required</Badge>
                            )}
                            {task.requires_quality_control && (
                                <Badge variant="outline">
                                    Quality control
                                    {task.quality_control
                                        ? `: ${task.quality_control}`
                                        : ''}
                                </Badge>
                            )}
                        </span>
                    )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={task.completed ? 'success' : 'outline'}>
                        {current.label}
                        {task.status === 'in_progress' && ` ${task.progress}%`}
                    </Badge>
                    {task.completed && (
                        <span className="text-xs text-muted-foreground">
                            {formatTime(task.completed_at)}
                        </span>
                    )}
                    {task.photos.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CameraIcon className="size-3" />
                            {task.photos.length}
                        </span>
                    )}
                </span>
            </button>

            {open && (
                <div className="flex flex-col gap-4 border-t border-border p-4">
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">
                            Who does this task? (select one or more)
                            {task.performed_by_label &&
                                task.performed_by !== 'anyone' &&
                                ` (${task.performed_by_label} only)`}
                        </p>
                        {performers.length === 0 ? (
                            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                No {task.performed_by_label?.toLowerCase()} is
                                set on this job. Ask the office to add one in
                                the work schedule.
                            </p>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {performers.map((person) => (
                                    <button
                                        key={person.uuid}
                                        type="button"
                                        disabled={performers.length === 1}
                                        onClick={() => togglePerformer(person.uuid)}
                                        className={`flex flex-col rounded-lg border-2 p-3 text-left transition ${
                                            selected.includes(person.uuid)
                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                                                : 'border-border bg-background'
                                        }`}
                                    >
                                        <span className="font-medium">
                                            {person.is_self
                                                ? `${person.name} (me)`
                                                : person.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {[
                                                person.job_title,
                                                person.tags.join(', '),
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {statuses.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setStatus(item.value)}
                                className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 px-2 text-sm font-medium transition ${
                                    status === item.value
                                        ? item.active
                                        : 'border-border bg-background text-muted-foreground'
                                }`}
                            >
                                <item.icon className="size-4" />
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {status === 'in_progress' && (
                        <label className="flex flex-col gap-2 text-sm font-medium">
                            <span className="flex justify-between">
                                Progress <span>{progress}%</span>
                            </span>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={progress}
                                onChange={(event) =>
                                    setProgress(Number(event.target.value))
                                }
                                className="h-8 w-full accent-amber-600"
                            />
                        </label>
                    )}

                    <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={2}
                        placeholder="Notes from the field (optional)"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                    />

                    <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {task.photos.map((photo) => (
                                <div
                                    key={photo.uuid}
                                    className="relative aspect-square overflow-hidden rounded-lg border border-border"
                                >
                                    <a href={photo.url} target="_blank" rel="noreferrer">
                                        <img
                                            src={photo.url}
                                            alt="Task photo"
                                            loading="lazy"
                                            className="size-full object-cover"
                                        />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(photo.uuid)}
                                        aria-label="Remove photo"
                                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                                    >
                                        <Trash2Icon className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                            {previews.map((url, index) => (
                                <div
                                    key={url}
                                    className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-amber-500"
                                >
                                    <img
                                        src={url}
                                        alt="New photo"
                                        className="size-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFiles(
                                                files.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            )
                                        }
                                        aria-label="Discard photo"
                                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                                    >
                                        <XIcon className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <input
                            ref={camera}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                                setFiles([
                                    ...files,
                                    ...Array.from(event.target.files ?? []),
                                ]);
                                event.target.value = '';
                            }}
                        />
                        <input
                            ref={gallery}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                                setFiles([
                                    ...files,
                                    ...Array.from(event.target.files ?? []),
                                ]);
                                event.target.value = '';
                            }}
                        />
                        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-12 w-full gap-2 text-base"
                                onClick={() => camera.current?.click()}
                            >
                                <CameraIcon className="size-5" />
                                Take photo
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-12 w-full gap-2 text-base"
                                onClick={() => gallery.current?.click()}
                            >
                                <ImageIcon className="size-5" />
                                From gallery
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button
                        type="button"
                        className="h-12 w-full text-base"
                        disabled={saving || !dirty}
                        onClick={() => save()}
                    >
                        {saving ? 'Saving…' : 'Save update'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function AttendancePanel({ schedule }: { schedule: AttendanceSchedule }) {
    const { errors } = usePage().props as { errors: Record<string, string> };
    const [rows, setRows] = useState(() =>
        schedule.members.map((member) => ({
            uuid: member.uuid,
            present: member.present,
            hours: member.hours ?? '8',
        })),
    );
    const [saving, setSaving] = useState(false);
    const present = rows.filter((row) => row.present).length;

    const update = (uuid: string, changes: Partial<(typeof rows)[number]>) =>
        setRows((current) =>
            current.map((row) => (row.uuid === uuid ? { ...row, ...changes } : row)),
        );

    const save = () => {
        setSaving(true);
        router.post(
            route('admin.daily-tasks.attendance', schedule.schedule_uuid),
            {
                entries: schedule.members
                    .filter((member) => !member.locked)
                    .map((member) => {
                        const row = rows.find((item) => item.uuid === member.uuid)!;

                        return {
                            employee_uuid: member.uuid,
                            present: row.present,
                            hours: member.hourly ? row.hours : null,
                        };
                    }),
            },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    };

    return (
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm dark:border-violet-900 dark:bg-violet-950/30">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h5 className="flex items-center gap-2 text-sm font-semibold">
                    <UsersRoundIcon className="size-4 text-indigo-600" />
                    Who is on site today
                </h5>
                <Badge variant="secondary">
                    {present} / {schedule.members.length} present
                </Badge>
            </div>
            <div className="flex flex-col gap-2">
                {schedule.members.map((member) => {
                    const row = rows.find((item) => item.uuid === member.uuid)!;
                    const error = errors[`attendance.${member.uuid}`];

                    return (
                        <div key={member.uuid} className="flex flex-col gap-1">
                            <div
                                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                                    row.present
                                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                                        : 'border-border'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    className="size-6 rounded accent-emerald-600"
                                    checked={row.present}
                                    disabled={member.locked || !member.has_rate}
                                    onChange={(event) =>
                                        update(member.uuid, { present: event.target.checked })
                                    }
                                    aria-label={`${member.name} present`}
                                />
                                <span className="min-w-0 flex-1 text-sm font-medium">
                                    {member.name}
                                </span>
                                {member.is_foreman && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 text-[0.65rem] font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                        <HardHatIcon className="size-3" />
                                        Foreman
                                    </span>
                                )}
                                {member.hourly && row.present && (
                                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="0.25"
                                            max="24"
                                            step="0.25"
                                            value={row.hours}
                                            onChange={(event) =>
                                                update(member.uuid, { hours: event.target.value })
                                            }
                                            className="h-9 w-16 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                                        />
                                        h
                                    </label>
                                )}
                            </div>
                            {member.locked && (
                                <p className="px-1 text-xs text-amber-600">
                                    Already recorded on another job today.
                                </p>
                            )}
                            {!member.has_rate && !member.locked && (
                                <p className="px-1 text-xs text-amber-600">
                                    No pay rate on file. Ask the office to add one.
                                </p>
                            )}
                            {error && <p className="px-1 text-xs text-destructive">{error}</p>}
                        </div>
                    );
                })}
            </div>
            <Button
                type="button"
                className="mt-3 h-12 w-full text-base"
                disabled={saving}
                onClick={save}
            >
                {saving ? 'Saving…' : 'Save attendance'}
            </Button>
        </div>
    );
}

export default function FieldChecklist({
    tasks,
    attendance = [],
}: {
    tasks: FieldTask[];
    attendance?: AttendanceSchedule[];
}) {
    const done = tasks.filter((task) => task.completed).length;
    const allDone = tasks.length > 0 && done === tasks.length;

    const groups = useMemo(() => {
        const map = new Map<string, { title: string; subtitle: string | null; tasks: FieldTask[] }>();

        tasks.forEach((task) => {
            const key = task.schedule_uuid ?? 'general';
            const group = map.get(key) ?? {
                title: task.project?.name ?? 'General daily tasks',
                subtitle: task.project?.project_number ?? null,
                tasks: [],
            };
            group.tasks.push(task);
            map.set(key, group);
        });

        return Array.from(map.entries());
    }, [tasks]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                <div>
                    <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Start your work day</h3>
                    <p className="text-sm text-muted-foreground">
                        Update each task, add notes and take photos from the
                        field.
                    </p>
                </div>
                <Badge variant={allDone ? 'success' : 'warning'}>
                    {done} / {tasks.length} done
                </Badge>
            </div>

            {tasks.length === 0 && (
                <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    No daily tasks for you today.
                </p>
            )}

            {attendance.map((schedule) => (
                <section key={`attendance-${schedule.schedule_uuid}`} className="flex flex-col gap-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        <MapPinIcon className="size-4" />
                        {schedule.project?.name ?? 'Job'} · Attendance
                    </h4>
                    <AttendancePanel schedule={schedule} />
                </section>
            ))}

            {groups.map(([key, group]) => (
                <section key={key} className="flex flex-col gap-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        <MapPinIcon className="size-4" />
                        {group.title}
                        {group.subtitle && (
                            <span className="font-normal normal-case">
                                #{group.subtitle}
                            </span>
                        )}
                    </h4>
                    {group.tasks.map((task) => (
                        <TaskCard
                            key={`${task.schedule_uuid}:${task.task_uuid}`}
                            task={task}
                        />
                    ))}
                </section>
            ))}

            {allDone && (
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2Icon className="size-4" />
                    All tasks done. Great work today.
                </p>
            )}
        </div>
    );
}
