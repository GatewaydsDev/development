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
import { ArrowLeftIcon, CameraIcon, ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import AttendanceMember, { type AttendanceMemberData } from './Partials/AttendanceMember';
import ProgressBar from './Partials/ProgressBar';
import QualityReportForm from './Partials/QualityReportForm';
import TaskProgressForm from './Partials/TaskProgressForm';
import {
    resultClasses,
    statusClasses,
    type JobSchedule,
    type JobSummary,
    type ReportSummary,
} from './types';

type Task = {
    uuid: string;
    title: string;
    description: string | null;
    status: string;
    status_label: string;
    progress: number;
    requires_photo: boolean;
    requires_quality_control: boolean;
    photo_count: number;
    qc_open: boolean;
    quality_control: ReportSummary | null;
    performers: string[];
    notes: string | null;
    updated_on: string | null;
    photos: {
        uuid: string;
        url: string;
        taken_at: string | null;
        work_date: string;
    }[];
    reports: ReportSummary[];
};

type Props = {
    job: JobSchedule & {
        competent_person: string | null;
        quality_control: string | null;
        notes: string | null;
    };
    date: string;
    today: string;
    progress: {
        summary: JobSummary;
        tasks: Task[];
        attendance: {
            members: AttendanceMemberData[];
        };
        day: {
            updates: {
                task: string | null;
                status: string;
                progress: number;
                photos: number;
                notes: string | null;
            }[];
        };
        timeline: {
            date: string;
            present: number;
            hours: number;
            tasks: number;
            photos: number;
        }[];
    };
    can: { inspect: boolean; update: boolean };
    statuses: Record<string, string>;
    checklist: Record<string, string>;
    results: Record<string, string>;
};

export default function Show({
    job,
    date,
    today,
    progress,
    can,
    statuses,
    checklist,
    results,
}: Props) {
    const [inspecting, setInspecting] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const { summary } = progress;

    const goTo = (value: string) =>
        router.get(
            route('admin.job-progress.show', job.uuid),
            { date: value },
            { preserveScroll: true, preserveState: true, replace: true },
        );

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <Link
                        href={route('admin.job-progress.index')}
                        className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeftIcon className="size-3" /> Job progress
                    </Link>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        {job.project?.name ?? 'Job'}
                        {job.project?.project_number &&
                            ` · ${job.project.project_number}`}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {job.starts_on} → {job.ends_on} · {job.status_label}
                        {job.foreman && ` · Foreman ${job.foreman}`}
                    </p>
                </div>
            }
        >
            <Head title="Job progress" />
            <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <Card>
                    <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_2fr]">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Overall progress
                            </p>
                            <p className="text-4xl font-semibold">
                                {summary.progress}%
                            </p>
                            <ProgressBar
                                value={summary.progress}
                                className="mt-2"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                            <Stat
                                label="Tasks done"
                                value={`${summary.tasks_done}/${summary.tasks_total}`}
                            />
                            <Stat
                                label="Days worked"
                                value={`${summary.days_worked}`}
                            />
                            <Stat label="Hours" value={`${summary.hours}`} />
                            <Stat label="Photos" value={`${summary.photos}`} />
                            <Stat
                                label="QC passed"
                                value={`${summary.qc_passed}/${summary.qc_required}`}
                            />
                            <Stat
                                label="QC open"
                                value={`${summary.qc_open}`}
                            />
                            <Stat
                                label="Blocked"
                                value={`${summary.tasks_blocked}`}
                            />
                            <Stat
                                label="Photos missing"
                                value={`${summary.photos_missing}`}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-lg font-semibold">Tasks</h3>
                        {progress.tasks.length === 0 && (
                            <Card>
                                <CardContent className="p-5 text-sm text-muted-foreground">
                                    No daily tasks are attached to this
                                    schedule yet.
                                </CardContent>
                            </Card>
                        )}
                        {progress.tasks.map((task) => (
                            <Card key={task.uuid}>
                                <CardHeader className="pb-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle className="text-base">
                                            {task.title}
                                        </CardTitle>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs ${statusClasses[task.status] ?? ''}`}
                                        >
                                            {task.status_label}
                                        </span>
                                        {task.requires_photo && (
                                            <Badge variant="outline">
                                                <CameraIcon className="mr-1 size-3" />
                                                {task.photo_count} photo
                                                {task.photo_count === 1
                                                    ? ''
                                                    : 's'}
                                            </Badge>
                                        )}
                                        {task.requires_quality_control && (
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs ${
                                                    task.quality_control
                                                        ? (resultClasses[
                                                              task
                                                                  .quality_control
                                                                  .result
                                                          ] ?? '')
                                                        : 'bg-slate-200 text-slate-700'
                                                }`}
                                            >
                                                QC:{' '}
                                                {task.quality_control
                                                    ?.result_label ??
                                                    'Not inspected'}
                                            </span>
                                        )}
                                    </div>
                                    {task.description && (
                                        <CardDescription>
                                            {task.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3 text-sm">
                                    <div className="flex items-center gap-3">
                                        <ProgressBar value={task.progress} />
                                        <span className="w-10 text-right font-medium">
                                            {task.progress}%
                                        </span>
                                    </div>
                                    {(task.performers.length > 0 ||
                                        task.updated_on) && (
                                        <p className="text-xs text-muted-foreground">
                                            {task.performers.length > 0 &&
                                                `By ${task.performers.join(', ')}`}
                                            {task.updated_on &&
                                                ` · updated ${task.updated_on}`}
                                        </p>
                                    )}
                                    {task.notes && <p>{task.notes}</p>}

                                    {can.update &&
                                        (updating === task.uuid ? (
                                            <TaskProgressForm
                                                scheduleUuid={job.uuid}
                                                taskUuid={task.uuid}
                                                status={task.status}
                                                progress={task.progress}
                                                statuses={statuses}
                                                requiresPhoto={
                                                    task.requires_photo
                                                }
                                                onDone={() => setUpdating(null)}
                                            />
                                        ) : (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="w-fit"
                                                onClick={() =>
                                                    setUpdating(task.uuid)
                                                }
                                            >
                                                Update progress
                                            </Button>
                                        ))}

                                    {task.photos.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {task.photos.map((photo) => (
                                                <a
                                                    key={photo.uuid}
                                                    href={photo.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={photo.work_date}
                                                >
                                                    <img
                                                        src={photo.url}
                                                        alt={`${task.title} ${photo.work_date}`}
                                                        className="size-20 rounded-md border border-border object-cover"
                                                        loading="lazy"
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {task.requires_quality_control && (
                                        <div className="flex flex-col gap-2 border-t border-border pt-3">
                                            {task.reports.map((report) => (
                                                <Link
                                                    key={report.uuid}
                                                    href={route(
                                                        'admin.job-progress.report',
                                                        report.uuid,
                                                    )}
                                                    className="flex items-center justify-between text-xs hover:underline"
                                                >
                                                    <span>
                                                        {report.inspected_on}
                                                        {report.inspector &&
                                                            ` · ${report.inspector}`}
                                                    </span>
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 ${resultClasses[report.result] ?? ''}`}
                                                    >
                                                        {report.result_label}
                                                    </span>
                                                </Link>
                                            ))}
                                            {can.inspect &&
                                                (inspecting === task.uuid ? (
                                                    <QualityReportForm
                                                        scheduleUuid={job.uuid}
                                                        taskUuid={task.uuid}
                                                        today={today}
                                                        checklist={checklist}
                                                        results={results}
                                                        onDone={() =>
                                                            setInspecting(null)
                                                        }
                                                    />
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-fit"
                                                        onClick={() =>
                                                            setInspecting(
                                                                task.uuid,
                                                            )
                                                        }
                                                    >
                                                        <ShieldCheckIcon className="mr-1 size-4" />
                                                        New quality report
                                                    </Button>
                                                ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-lg font-semibold">Day</h3>
                        <Card>
                            <CardContent className="flex flex-col gap-3 p-4 text-sm">
                                <input
                                    type="date"
                                    value={date}
                                    max={today}
                                    onChange={(event) =>
                                        event.target.value &&
                                        goTo(event.target.value)
                                    }
                                    className="rounded-md border border-border bg-background px-2 py-1.5"
                                />
                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                        Attendance
                                    </p>
                                    {progress.attendance.members.length ===
                                    0 ? (
                                        <p className="text-muted-foreground">
                                            No crew on this schedule.
                                        </p>
                                    ) : (
                                        <ul className="flex flex-col gap-1">
                                            {progress.attendance.members.map(
                                                (member) => (
                                                    <AttendanceMember
                                                        key={`${date}-${member.uuid}-${member.present}-${member.hours}-${member.pay_rate_id}`}
                                                        member={member}
                                                        scheduleUuid={job.uuid}
                                                        date={date}
                                                        editable={can.update}
                                                    />
                                                ),
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <h3 className="text-lg font-semibold">History</h3>
                        <Card>
                            <CardContent className="p-2">
                                {progress.timeline.length === 0 ? (
                                    <p className="p-2 text-sm text-muted-foreground">
                                        No activity recorded yet.
                                    </p>
                                ) : (
                                    <ul>
                                        {progress.timeline.map((entry) => (
                                            <li key={entry.date}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        goTo(entry.date)
                                                    }
                                                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
                                                        entry.date === date
                                                            ? 'bg-muted font-medium'
                                                            : ''
                                                    }`}
                                                >
                                                    <span>{entry.date}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {entry.present} crew ·{' '}
                                                        {entry.tasks} tasks ·{' '}
                                                        {entry.photos} photos
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
        </div>
    );
}
