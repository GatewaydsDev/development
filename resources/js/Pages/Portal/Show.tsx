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
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    CalendarClockIcon,
    CameraIcon,
    ClipboardCheckIcon,
    HardHatIcon,
    MapPinIcon,
    UsersIcon,
} from 'lucide-react';
import { ProgressBar, statusClassName } from './Index';

type Props = {
    project: {
        uuid: string;
        project_number: string | null;
        name: string;
        status: string | null;
        status_slug: string | null;
        address: string | null;
        estimated_start_date: string | null;
        estimated_end_date: string | null;
        public_notes: string | null;
    };
    progress: {
        overall_progress: number | null;
        tasks_total: number;
        tasks_done: number;
        is_working_today: boolean;
        schedules: {
            uuid: string;
            starts_on: string | null;
            ends_on: string | null;
            status_label: string;
            foreman: string | null;
            crew: { name: string; job_title: string | null; role: string }[];
        }[];
        tasks: {
            key: string;
            title: string;
            status: string;
            status_label: string;
            progress: number;
            updated_on: string | null;
        }[];
        photos: {
            uuid: string;
            caption: string | null;
            task: string | null;
            taken_at: string | null;
            work_date: string | null;
        }[];
    };
    canManageTeam: boolean;
};

export default function Show({ project, progress, canManageTeam }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <Link
                        href={route('portal.index')}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                        ← My projects
                    </Link>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        {project.name}
                    </h2>
                </div>
            }
        >
            <Head title={project.name} />
            <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle>{project.project_number}</CardTitle>
                            <Badge
                                variant="outline"
                                className={cn(statusClassName(project.status_slug))}
                            >
                                {project.status ?? 'Not set'}
                            </Badge>
                            {progress.is_working_today && (
                                <Badge>
                                    <HardHatIcon className="size-3" />
                                    Crew on site today
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="flex items-start gap-2">
                            <MapPinIcon className="mt-0.5 size-4 shrink-0" />
                            {project.address ?? 'No address on file'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div>
                            <p className="mb-2 text-sm font-medium text-foreground">
                                Overall progress ({progress.tasks_done} of{' '}
                                {progress.tasks_total} tasks done)
                            </p>
                            <ProgressBar value={progress.overall_progress} />
                        </div>
                        {(project.estimated_start_date ||
                            project.estimated_end_date) && (
                            <p className="text-sm text-muted-foreground">
                                Estimated {project.estimated_start_date ?? '—'} →{' '}
                                {project.estimated_end_date ?? '—'}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardCheckIcon className="size-5 text-muted-foreground" />
                                Work progress
                            </CardTitle>
                            <CardDescription>
                                Latest update of each task on the job.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {progress.tasks.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No tasks have been set for this job yet.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {progress.tasks.map((task) => (
                                        <li
                                            key={task.key}
                                            className="rounded-lg border border-border bg-muted/20 p-3"
                                        >
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-foreground">
                                                    {task.title}
                                                </span>
                                                <Badge variant="outline">
                                                    {task.status_label}
                                                </Badge>
                                                {task.updated_on && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {task.updated_on}
                                                    </span>
                                                )}
                                            </div>
                                            <ProgressBar value={task.progress} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarClockIcon className="size-5 text-muted-foreground" />
                                Crew and schedule
                            </CardTitle>
                            <CardDescription>
                                The people assigned to this job.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {progress.schedules.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No crew has been scheduled yet.
                                </p>
                            ) : (
                                progress.schedules.map((schedule) => (
                                    <div
                                        key={schedule.uuid}
                                        className="rounded-lg border border-border bg-muted/20 p-3"
                                    >
                                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                            {schedule.starts_on} →{' '}
                                            {schedule.ends_on}
                                            <Badge variant="outline">
                                                {schedule.status_label}
                                            </Badge>
                                        </p>
                                        {schedule.foreman && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Foreman: {schedule.foreman}
                                            </p>
                                        )}
                                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {schedule.crew.map((member, index) => (
                                                <li
                                                    key={`${member.name}-${index}`}
                                                    className="rounded-md border border-border bg-background p-2 text-sm"
                                                >
                                                    <span className="block font-medium text-foreground">
                                                        {member.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {[
                                                            member.role,
                                                            member.job_title,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CameraIcon className="size-5 text-muted-foreground" />
                            Photos
                        </CardTitle>
                        <CardDescription>
                            Pictures taken on site by the crew.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {progress.photos.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No photos have been taken yet.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                                {progress.photos.map((photo) => (
                                    <a
                                        key={photo.uuid}
                                        href={route('portal.photos.show', photo.uuid)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group block overflow-hidden rounded-lg border border-border bg-muted/20"
                                    >
                                        <img
                                            src={route('portal.photos.show', photo.uuid)}
                                            alt={photo.caption ?? photo.task ?? 'Job photo'}
                                            loading="lazy"
                                            className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                                        />
                                        <span className="block p-2 text-xs text-muted-foreground">
                                            {photo.task ?? 'Photo'}
                                            {photo.work_date &&
                                                ` · ${formatDate(photo.work_date)}`}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {canManageTeam && (
                    <Card>
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                            <p className="text-sm text-muted-foreground">
                                Add or remove the people in your company who can follow your projects.
                            </p>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('portal.team.index')}>
                                    <UsersIcon className="size-4" />
                                    Manage company team
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function formatDate(value: string): string {
    const [year, month, day] = value.split('-');

    return year && month && day ? `${month}/${day}/${year}` : value;
}
