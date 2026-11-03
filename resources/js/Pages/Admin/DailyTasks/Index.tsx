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
import CreatableSelect from '@/Components/CreatableSelect';
import FieldChecklist, { type AttendanceSchedule, type FieldTask } from './Partials/FieldChecklist';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle2Icon,
    CircleIcon,
    PencilIcon,
    PlusIcon,
    Trash2Icon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';

type Task = {
    uuid: string;
    title: string;
    daily_task_title_id: number | null;
    description: string | null;
    is_active: boolean;
    requires_photo: boolean;
    requires_quality_control: boolean;
    performed_by: string;
    performed_by_label: string;
    schedule_count: number | null;
};

type Props = {
    can: { manage: boolean; complete: boolean };
    date: string;
    today: string;
    tasks?: Task[];
    taskTitles?: { id: number; name: string }[];
    checklist?: FieldTask[];
    attendance?: AttendanceSchedule[];
};

const inputClass =
    'h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring';

function formatTime(value: string | null): string {
    return value
        ? new Date(value).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
          })
        : '';
}

function TaskManager({
    tasks,
    taskTitles,
}: {
    tasks: Task[];
    taskTitles: { id: number; name: string }[];
}) {
    const [editing, setEditing] = useState<Task | null>(null);
    const form = useForm<{
        daily_task_title_id: string;
        description: string;
        is_active: boolean;
        requires_photo: boolean;
        requires_quality_control: boolean;
        performed_by: string;
    }>({
        daily_task_title_id: '',
        description: '',
        is_active: true,
        requires_photo: false,
        requires_quality_control: false,
        performed_by: 'anyone',
    });
    const [deleting, setDeleting] = useState<Task | null>(null);
    const reset = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const edit = (task: Task) => {
        setEditing(task);
        form.setData({
            daily_task_title_id: task.daily_task_title_id
                ? String(task.daily_task_title_id)
                : '',
            description: task.description ?? '',
            is_active: task.is_active,
            requires_photo: task.requires_photo,
            requires_quality_control: task.requires_quality_control,
            performed_by: task.performed_by,
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: reset };

        if (editing) {
            form.patch(route('admin.daily-tasks.update', editing.uuid), options);
        } else {
            form.post(route('admin.daily-tasks.store'), options);
        }
    };

    const confirmRemove = () => {
        if (!deleting) {
            return;
        }

        router.delete(route('admin.daily-tasks.destroy', deleting.uuid), {
            preserveScroll: true,
            onFinish: () => setDeleting(null),
        });
    };

    const setActive = (task: Task) =>
        router.patch(
            route('admin.daily-tasks.update', task.uuid),
            {
                daily_task_title_id: task.daily_task_title_id,
                description: task.description,
                requires_photo: task.requires_photo,
                requires_quality_control: task.requires_quality_control,
                performed_by: task.performed_by,
                is_active: !task.is_active,
            },
            { preserveScroll: true },
        );

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Manage daily tasks</CardTitle>
                <CardDescription>
                    Create the types of tasks and set whether they need photos or quality control. Assign them to a foreman from the work schedule.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
                    <CreatableSelect
                        id="daily-task-title"
                        label="Task"
                        compact
                        value={form.data.daily_task_title_id}
                        options={taskTitles}
                        createRoute={route('admin.daily-task-titles.store')}
                        optionsProp="taskTitles"
                        entityLabel="task"
                        placeholder="Type to search or add a task"
                        error={form.errors.daily_task_title_id ??
                            (form.errors as Record<string, string>).title}
                        onChange={(id) => form.setData('daily_task_title_id', id)}
                    />
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="daily-task-description"
                            className="text-sm font-medium text-foreground"
                        >
                            Description
                        </label>
                        <input
                            id="daily-task-description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            placeholder="Optional"
                            className={inputClass}
                        />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                        <label
                            htmlFor="daily-task-performer"
                            className="text-sm font-medium"
                        >
                            Who performs this task
                        </label>
                        <select
                            id="daily-task-performer"
                            value={form.data.performed_by}
                            onChange={(e) =>
                                form.setData('performed_by', e.target.value)
                            }
                            className={inputClass}
                        >
                            <option value="anyone">
                                Foreman or crew (foreman can delegate)
                            </option>
                            <option value="foreman">Foreman only</option>
                            <option value="competent_person">
                                Competent person
                            </option>
                            <option value="quality_control">
                                Quality control person
                            </option>
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 md:col-span-2">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.data.requires_photo}
                                onChange={(e) =>
                                    form.setData('requires_photo', e.target.checked)
                                }
                                className="size-4 accent-emerald-600"
                            />
                            Needs photos
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.data.requires_quality_control}
                                onChange={(e) =>
                                    form.setData(
                                        'requires_quality_control',
                                        e.target.checked,
                                    )
                                }
                                className="size-4 accent-emerald-600"
                            />
                            Needs quality control
                        </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(e) =>
                                form.setData('is_active', e.target.checked)
                            }
                            className="size-4 accent-emerald-600"
                        />
                        Active
                    </label>
                    <div className="flex justify-end gap-2">
                        {editing && (
                            <Button type="button" variant="outline" onClick={reset}>
                                Cancel
                            </Button>
                        )}
                        <Button
                            type="submit"
                            variant={editing ? 'default' : 'create'}
                            disabled={form.processing}
                        >
                            {!editing && <PlusIcon data-icon="inline-start" />}
                            {editing ? 'Save task' : 'Add task'}
                        </Button>
                    </div>
                </form>

                <div className="flex flex-col gap-2">
                    {tasks.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No daily tasks yet.
                        </p>
                    )}
                    {tasks.map((task) => (
                        <div
                            key={task.uuid}
                            className="flex items-center gap-3 rounded-md border border-border p-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 font-medium">
                                    <span className="truncate">{task.title}</span>
                                    <Badge
                                        variant={
                                            task.is_active ? 'success' : 'secondary'
                                        }
                                    >
                                        {task.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                    {task.performed_by !== 'anyone' && (
                                        <Badge variant="outline">
                                            {task.performed_by_label}
                                        </Badge>
                                    )}
                                    {task.requires_photo && (
                                        <Badge variant="outline">Photos</Badge>
                                    )}
                                    {task.requires_quality_control && (
                                        <Badge variant="outline">
                                            Quality control
                                        </Badge>
                                    )}
                                </div>
                                {task.description && (
                                    <p className="text-sm text-muted-foreground">
                                        {task.description}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {task.schedule_count
                                        ? `Used in ${task.schedule_count} work schedule${task.schedule_count === 1 ? '' : 's'}`
                                        : 'General (not on a schedule)'}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActive(task)}
                            >
                                {task.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label="Edit task"
                                onClick={() => edit(task)}
                            >
                                <PencilIcon />
                            </Button>
                            <Button
                                size="icon-sm"
                                variant="destructive"
                                aria-label="Delete task"
                                onClick={() => setDeleting(task)}
                            >
                                <Trash2Icon />
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
            <AlertDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                        <AlertDialogDescription>
                            “{deleting?.title}” will be removed from every work
                            schedule and foreman checklist. Past check-ins are
                            deleted with it. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep task</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={confirmRemove}
                        >
                            Delete task
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

export default function Index({
    can,
    date,
    today,
    tasks,
    taskTitles = [],
    checklist,
    attendance,
}: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Daily tasks
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Tasks every foreman must check when starting a work day.
                    </p>
                </div>
            }
        >
            <Head title="Daily Tasks" />
            <div className="py-6 sm:py-8">
                <div className="flex w-full flex-col gap-4 px-4 sm:px-6 lg:px-8">
                    {can.complete && checklist && (
                        <FieldChecklist tasks={checklist} attendance={attendance} />
                    )}
                    {can.manage && tasks && (
                        <TaskManager
                            tasks={tasks}
                            taskTitles={taskTitles}
                        />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
