import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
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
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <Link
                            href={route('admin.projects.index')}
                            className="transition hover:text-foreground"
                        >
                            Projects
                        </Link>
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
                        description="Create a project with name, status, assignment, contractors, scopes, and revisions."
                        options={options}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

