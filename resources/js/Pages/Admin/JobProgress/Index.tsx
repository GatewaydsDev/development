import { Badge } from '@/Components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { GaugeIcon } from 'lucide-react';
import ProgressBar from './Partials/ProgressBar';
import type { JobSchedule, JobSummary } from './types';

type Job = JobSchedule & { summary: JobSummary };

type Props = {
    status: string;
    statuses: Record<string, string>;
    jobs: Job[];
};

export default function Index({ status, statuses, jobs }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Job progress
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Schedule, crew attendance, task progress, photos and
                        quality control for each job.
                    </p>
                </div>
            }
        >
            <Head title="Job progress" />
            <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <div className="flex flex-wrap items-center gap-2">
                    {[['all', 'All'], ...Object.entries(statuses)].map(
                        ([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() =>
                                    router.get(
                                        route('admin.job-progress.index'),
                                        { status: value },
                                        { preserveState: true, replace: true },
                                    )
                                }
                                className={`rounded-full border px-3 py-1 text-sm ${
                                    status === value
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-border text-foreground hover:bg-muted'
                                }`}
                            >
                                {label}
                            </button>
                        ),
                    )}
                </div>

                {jobs.length === 0 ? (
                    <Card>
                        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                            <GaugeIcon className="size-5" />
                            No jobs to show for this filter.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {jobs.map((job) => (
                            <Link
                                key={job.uuid}
                                href={route('admin.job-progress.show', job.uuid)}
                                className="block"
                            >
                                <Card className="h-full transition hover:border-emerald-500">
                                    <CardHeader>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <CardTitle className="text-base">
                                                {job.project?.name ?? 'Job'}
                                                {job.project?.project_number &&
                                                    ` · ${job.project.project_number}`}
                                            </CardTitle>
                                            <Badge variant="outline">
                                                {job.status_label}
                                            </Badge>
                                        </div>
                                        <CardDescription>
                                            {job.starts_on} → {job.ends_on}
                                            {job.foreman &&
                                                ` · Foreman ${job.foreman}`}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-3 text-sm">
                                        <div>
                                            <div className="mb-1 flex justify-between">
                                                <span className="text-muted-foreground">
                                                    Overall progress
                                                </span>
                                                <span className="font-semibold">
                                                    {job.summary.progress}%
                                                </span>
                                            </div>
                                            <ProgressBar
                                                value={job.summary.progress}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <span>
                                                Tasks {job.summary.tasks_done}/
                                                {job.summary.tasks_total}
                                            </span>
                                            <span>
                                                {job.summary.days_worked} days ·{' '}
                                                {job.summary.hours} h
                                            </span>
                                            <span>
                                                {job.summary.photos} photos
                                                {job.summary.photos_missing >
                                                    0 &&
                                                    ` · ${job.summary.photos_missing} missing`}
                                            </span>
                                            <span>
                                                QC {job.summary.qc_passed}/
                                                {job.summary.qc_required}
                                                {job.summary.qc_open > 0 &&
                                                    ` · ${job.summary.qc_open} open`}
                                            </span>
                                        </div>
                                        {job.summary.tasks_blocked > 0 && (
                                            <Badge variant="destructive">
                                                {job.summary.tasks_blocked}{' '}
                                                blocked
                                            </Badge>
                                        )}
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
