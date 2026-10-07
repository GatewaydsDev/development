import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ScheduleForm from './Partials/ScheduleForm';
import type { ScheduleOption, ScheduleStatusOption } from './types';

type CreateProps = {
    projects: ScheduleOption[];
    foremen: ScheduleOption[];
    employees: ScheduleOption[];
    statuses: ScheduleStatusOption[];
    defaultDate: string;
};

export default function Create({
    projects,
    foremen,
    employees,
    statuses,
    defaultDate,
}: CreateProps) {
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
                            href={route('admin.employee-schedules.index')}
                            className="transition hover:text-foreground"
                        >
                            Work Schedule
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add a job crew
                    </h2>
                </div>
            }
        >
            <Head title="Add Work Schedule" />
            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ScheduleForm
                        action={route('admin.employee-schedules.store')}
                        submitLabel="Save schedule"
                        projects={projects}
                        foremen={foremen}
                        employees={employees}
                        statuses={statuses}
                        defaultDate={defaultDate}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
