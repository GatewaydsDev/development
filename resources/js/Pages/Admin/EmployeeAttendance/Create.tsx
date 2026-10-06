import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import AttendanceForm from './Partials/AttendanceForm';
import type { AttendanceEmployeeOption } from './types';

type CreateProps = {
    employees: AttendanceEmployeeOption[];
    defaultWeekStart: string;
};

export default function Create({ employees, defaultWeekStart }: CreateProps) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <Link
                            href={route('admin.employee-attendance.index')}
                            className="transition hover:text-foreground"
                        >
                            Attendance
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add attendance week
                    </h2>
                </div>
            }
        >
            <Head title="Add Attendance" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <AttendanceForm
                        action={route('admin.employee-attendance.store')}
                        method="post"
                        submitLabel="Save week"
                        employees={employees}
                        defaultWeekStart={defaultWeekStart}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
