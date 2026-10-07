import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ScheduleForm from './Partials/ScheduleForm';
import type {
    ScheduleOption,
    SchedulePayload,
    ScheduleStatusOption,
} from './types';

type EditProps = {
    projects: ScheduleOption[];
    foremen: ScheduleOption[];
    employees: ScheduleOption[];
    statuses: ScheduleStatusOption[];
    schedule: SchedulePayload;
};

export default function Edit({
    projects,
    foremen,
    employees,
    statuses,
    schedule,
}: EditProps) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>People</span>
                        <span>/</span>
                        <Link
                            href={route('admin.employee-schedules.index', {
                                date: schedule.starts_on,
                            })}
                            className="transition hover:text-foreground"
                        >
                            Work Schedule
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit job crew
                    </h2>
                </div>
            }
        >
            <Head title="Edit Work Schedule" />
            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ScheduleForm
                        action={route(
                            'admin.employee-schedules.update',
                            schedule.uuid,
                        )}
                        method="patch"
                        submitLabel="Save changes"
                        projects={projects}
                        foremen={foremen}
                        employees={employees}
                        statuses={statuses}
                        schedule={schedule}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
