import type { AccessPermission, UserLevelOption } from '@/Components/UserLevelSelect';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import EmployeeForm from './Partials/EmployeeForm';
import type {
    EmployeeRateTypeOptions,
    EmployeeStatusOptions,
    NamedOption,
} from './types';

type CreateProps = {
    languages: NamedOption[];
    certifications?: NamedOption[];
    skills: NamedOption[];
    skillsVersion?: string | null;
    rateTypeOptions: EmployeeRateTypeOptions;
    statusOptions: EmployeeStatusOptions;
    userLevels?: UserLevelOption[];
    accessPermissions?: AccessPermission[];
    canCreateUserLevel?: boolean;
};

export default function Create({
    languages,
    certifications = [],
    skills,
    skillsVersion = null,
    rateTypeOptions,
    statusOptions,
    userLevels = [],
    accessPermissions = [],
    canCreateUserLevel = false,
}: CreateProps) {
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
                            href={route('admin.employees.index')}
                            className="transition hover:text-foreground"
                        >
                            Employees
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add employee
                    </h2>
                </div>
            }
        >
            <Head title="Add Employee" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <EmployeeForm
                        action={route('admin.employees.store')}
                        submitLabel="Create employee"
                        title="Employee information"
                        description="Contact details, employment, app login, and skill rates."
                        languages={languages}
                        certifications={certifications}
                        skills={skills}
                        skillsVersion={skillsVersion}
                        rateTypeOptions={rateTypeOptions}
                        statusOptions={statusOptions}
                        userLevels={userLevels}
                        accessPermissions={accessPermissions}
                        canCreateUserLevel={canCreateUserLevel}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
