import { Badge } from '@/Components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    CalendarClockIcon,
    CameraIcon,
    ClipboardCheckIcon,
    MapPinIcon,
    ShieldCheckIcon,
    UserIcon,
} from 'lucide-react';

type Person = { full_name: string | null };

type MySchedule = {
    uuid: string;
    date_label: string;
    status_label: string;
    is_today: boolean;
    notes: string | null;
    project: {
        name: string | null;
        project_number: string | null;
        address: string | null;
    } | null;
    foreman: {
        name: string | null;
        email: string | null;
        job_title: string | null;
    } | null;
    competent_person: Person | null;
    quality_control: Person | null;
    crew: { full_name: string; job_title: string | null }[];
    tasks: {
        uuid: string;
        title: string;
        description: string | null;
        requires_photo: boolean;
        requires_quality_control: boolean;
        performed_by: string;
        performed_by_label: string | null;
    }[];
};

type Props = {
    employee: { full_name: string } | null;
    schedules: MySchedule[];
    windowDays: number;
};

export default function Index({ employee, schedules, windowDays }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        My schedule
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Your jobs for today and the next {windowDays} days.
                    </p>
                </div>
            }
        >
            <Head title="My schedule" />
            <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {!employee ? (
                    <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                            Your login is not linked to an employee record yet.
                            Ask an administrator to link it.
                        </CardContent>
                    </Card>
                ) : schedules.length === 0 ? (
                    <Card>
                        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                            <CalendarClockIcon className="size-5" />
                            You are not scheduled on any job in the next{' '}
                            {windowDays} days.
                        </CardContent>
                    </Card>
                ) : (
                    schedules.map((schedule) => (
                        <Card key={schedule.uuid}>
                            <CardHeader>
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle>
                                        {schedule.project?.name ?? 'Job'}
                                        {schedule.project?.project_number &&
                                            ` · ${schedule.project.project_number}`}
                                    </CardTitle>
                                    {schedule.is_today && (
                                        <Badge>Today</Badge>
                                    )}
                                    <Badge variant="outline">
                                        {schedule.status_label}
                                    </Badge>
                                </div>
                                <CardDescription>
                                    {schedule.date_label}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <p className="flex items-start gap-2 text-sm text-foreground sm:col-span-2">
                                        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                        {schedule.project?.address ??
                                            'No address on file'}
                                    </p>
                                    <p className="flex items-start gap-2 text-sm text-foreground">
                                        <UserIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                        <span>
                                            <span className="block text-xs text-muted-foreground">
                                                Foreman
                                            </span>
                                            {schedule.foreman?.name ??
                                                'Not assigned'}
                                            {schedule.foreman?.job_title &&
                                                ` · ${schedule.foreman.job_title}`}
                                        </span>
                                    </p>
                                    {(schedule.competent_person ||
                                        schedule.quality_control) && (
                                        <p className="flex items-start gap-2 text-sm text-foreground">
                                            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                            <span>
                                                {schedule.competent_person && (
                                                    <span className="block">
                                                        Competent person:{' '}
                                                        {
                                                            schedule
                                                                .competent_person
                                                                .full_name
                                                        }
                                                    </span>
                                                )}
                                                {schedule.quality_control && (
                                                    <span className="block">
                                                        Quality control:{' '}
                                                        {
                                                            schedule
                                                                .quality_control
                                                                .full_name
                                                        }
                                                    </span>
                                                )}
                                            </span>
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <ClipboardCheckIcon className="size-4" />
                                        Tasks ({schedule.tasks.length})
                                    </p>
                                    {schedule.tasks.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No tasks have been set for this job
                                            yet.
                                        </p>
                                    ) : (
                                        <ul className="flex flex-col gap-2">
                                            {schedule.tasks.map((task) => (
                                                <li
                                                    key={task.uuid}
                                                    className="rounded-lg border border-border bg-muted/20 p-3"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium text-foreground">
                                                            {task.title}
                                                        </span>
                                                        {task.performed_by !==
                                                            'anyone' && (
                                                            <Badge variant="outline">
                                                                {task.performed_by_label}
                                                            </Badge>
                                                        )}
                                                        {task.requires_photo && (
                                                            <Badge variant="outline">
                                                                <CameraIcon className="size-3" />
                                                                Photos
                                                            </Badge>
                                                        )}
                                                        {task.requires_quality_control && (
                                                            <Badge variant="outline">
                                                                Quality control
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {task.description && (
                                                        <p className="mt-1 text-sm text-muted-foreground">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {schedule.crew.length > 0 && (
                                    <div>
                                        <p className="mb-2 text-sm font-semibold text-foreground">
                                            Crew ({schedule.crew.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {schedule.crew.map((member) => (
                                                <Badge
                                                    key={member.full_name}
                                                    variant="outline"
                                                >
                                                    {member.full_name}
                                                    {member.job_title &&
                                                        ` · ${member.job_title}`}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {schedule.notes && (
                                    <div
                                        className="prose prose-sm max-w-none text-foreground dark:prose-invert"
                                        dangerouslySetInnerHTML={{
                                            __html: schedule.notes,
                                        }}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </AuthenticatedLayout>
    );
}
