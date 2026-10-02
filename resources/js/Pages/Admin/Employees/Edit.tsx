import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import EmployeeForm from './Partials/EmployeeForm';
import type {
    EmployeeOptionMap,
    EmployeePayload,
    EmployeeRateTypeOptions,
    EmployeeStatusOptions,
    NamedOption,
    ProjectOption,
} from './types';

type EditProps = {
    employee: EmployeePayload;
    professions: NamedOption[];
    languages: NamedOption[];
    skills: NamedOption[];
    projects: ProjectOption[];
    rateTypeOptions: EmployeeRateTypeOptions;
    statusOptions: EmployeeStatusOptions;
    shiftTypeOptions: EmployeeOptionMap;
    payBasisOptions: EmployeeOptionMap;
};

export default function Edit({
    employee,
    professions,
    languages,
    skills,
    projects,
    rateTypeOptions,
    statusOptions,
    shiftTypeOptions,
    payBasisOptions,
}: EditProps) {
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
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit employee
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${employee.full_name}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <EmployeeForm
                        action={route('admin.employees.update', employee.id)}
                        method="patch"
                        submitLabel="Save changes"
                        title={employee.full_name}
                        description="Update contact details, language, professions, projects, and skill shifts."
                        employee={employee}
                        professions={professions}
                        languages={languages}
                        skills={skills}
                        projects={projects}
                        rateTypeOptions={rateTypeOptions}
                        statusOptions={statusOptions}
                        shiftTypeOptions={shiftTypeOptions}
                        payBasisOptions={payBasisOptions}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
