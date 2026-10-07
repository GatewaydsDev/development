import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import AttendanceForm from './Partials/AttendanceForm';
import type {
    AttendanceEmployeeOption,
    AttendanceWeekPayload,
} from './types';

type EditProps = {
    attendance: AttendanceWeekPayload;
    employees: AttendanceEmployeeOption[];
};

export default function Edit({ attendance, employees }: EditProps) {
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
                        <span className="text-foreground">Update</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Update attendance week
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {attendance.employee?.full_name} · {attendance.week_label}
                    </p>
                </div>
            }
        >
            <Head title="Update Attendance" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <AttendanceForm
                        action={route(
                            'admin.employee-attendance.update',
                            attendance.uuid,
                        )}
                        method="patch"
                        submitLabel="Update week"
                        employees={employees}
                        attendance={attendance}
                        defaultWeekStart={attendance.week_start}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
