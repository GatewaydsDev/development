import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ScheduleForm from './Partials/ScheduleForm';
import type { ScheduleDailyTask, ScheduleOption, ScheduleStatusOption } from './types';

type CreateProps = {
    projects: ScheduleOption[];
    foremen: ScheduleOption[];
    employees: ScheduleOption[];
    dailyTasks?: ScheduleDailyTask[];
    statuses: ScheduleStatusOption[];
    defaultDate: string;
    defaultEndDate?: string;
};

export default function Create({
    projects,
    foremen,
    employees,
    dailyTasks = [],
    statuses,
    defaultDate,
    defaultEndDate,
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
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <ScheduleForm
                        action={route('admin.employee-schedules.store')}
                        submitLabel="Save schedule"
                        projects={projects}
                        foremen={foremen}
                        employees={employees}
                        dailyTasks={dailyTasks}
                        statuses={statuses}
                        defaultDate={defaultDate}
                        defaultEndDate={defaultEndDate}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
