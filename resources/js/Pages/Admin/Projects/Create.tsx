import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import ProjectForm from './Partials/ProjectForm';
import type { ProjectOptions } from './types';

type CreateProps = {
    options: ProjectOptions;
};

export default function Create({ options }: CreateProps) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>Administration</span>
                        <span>/</span>
                        <span>Projects</span>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add project
                    </h2>
                </div>
            }
        >
            <Head title="Add Project" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ProjectForm
                        action={route('admin.projects.store')}
                        submitLabel="Create project"
                        title="Project information"
                        description="Create a project and link it to an existing customer."
                        options={options}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

