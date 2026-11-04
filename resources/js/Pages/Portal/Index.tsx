import { Badge } from '@/Components/ui/badge';
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
import { BriefcaseIcon, CameraIcon, HardHatIcon, MapPinIcon } from 'lucide-react';

type PortalProject = {
    uuid: string;
    project_number: string | null;
    name: string;
    status: string | null;
    status_slug: string | null;
    address: string | null;
    overall_progress: number | null;
    is_working_today: boolean;
    photos_count: number;
};

export function ProgressBar({ value }: { value: number | null }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${value ?? 0}%` }}
                />
            </div>
            <span className="w-10 text-right text-sm font-medium text-foreground">
                {value === null ? '—' : `${value}%`}
            </span>
        </div>
    );
}

export const statusClassName = (status?: string | null) => {
    const colors: Record<string, string> = {
        lead: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300',
        approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
        scheduled: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300',
        in_progress: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
        completed: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-300',
    };

    return (
        (status && colors[status]) ||
        'border-border bg-muted text-muted-foreground'
    );
};

export default function Index({
    projects,
    company,
}: {
    projects: PortalProject[];
    company: string | null;
}) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        My projects
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {company ? `${company} · ` : ''}Follow the status, crew,
                        progress and photos of your jobs.
                    </p>
                </div>
            }
        >
            <Head title="My projects" />
            <div className="grid w-full gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-2 lg:px-8 2xl:grid-cols-3">
                {projects.length === 0 ? (
                    <Card className="lg:col-span-2 2xl:col-span-3">
                        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                            <BriefcaseIcon className="size-5" />
                            No project has been shared with you yet.
                        </CardContent>
                    </Card>
                ) : (
                    projects.map((project) => (
                        <Link
                            key={project.uuid}
                            href={route('portal.projects.show', project.uuid)}
                            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Card className="h-full transition-shadow hover:shadow-md">
                                <CardHeader>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle>{project.name}</CardTitle>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                statusClassName(
                                                    project.status_slug,
                                                ),
                                            )}
                                        >
                                            {project.status ?? 'Not set'}
                                        </Badge>
                                        {project.is_working_today && (
                                            <Badge>
                                                <HardHatIcon className="size-3" />
                                                Crew on site today
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription>
                                        {project.project_number}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <p className="flex items-start gap-2 text-sm text-foreground">
                                        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                        {project.address ?? 'No address on file'}
                                    </p>
                                    <ProgressBar value={project.overall_progress} />
                                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CameraIcon className="size-4" />
                                        {project.photos_count} photo
                                        {project.photos_count === 1 ? '' : 's'}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))
                )}
            </div>
        </AuthenticatedLayout>
    );
}
