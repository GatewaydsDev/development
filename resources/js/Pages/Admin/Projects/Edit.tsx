import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import ProjectForm from './Partials/ProjectForm';
import type { ProjectOptions, ProjectPayload } from './types';

type EditProps = {
    project: ProjectPayload;
    options: ProjectOptions;
};

export default function Edit({ project, options }: EditProps) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>Administration</span>
                        <span>/</span>
                        <span>Projects</span>
                        <span>/</span>
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit project
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${project.name}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ProjectForm
                        action={route('admin.projects.update', project.id)}
                        method="patch"
                        submitLabel="Save changes"
                        title={project.name}
                        description="Update the fields allowed for your user level."
                        options={options}
                        project={project}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

