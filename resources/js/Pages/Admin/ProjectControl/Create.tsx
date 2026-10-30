import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ProjectControlForm, { type ControlDraft, type ControlTerms } from './Partials/ProjectControlForm';
import type { ReminderPerson } from './Partials/ReminderDialog';

export default function Create({ control, people, terms }: { control: ControlDraft; people: ReminderPerson[]; terms: ControlTerms }) {
    return (
        <AuthenticatedLayout
            fullWidth
            header={
                <div>
                    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Link href={route('admin.project-control.index')} className="transition hover:text-foreground">
                            Project control
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add job
                    </h2>
                </div>
            }
        >
            <Head title="Add job" />
            <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <ProjectControlForm action={route('admin.project-control.store')} method="post" control={control} people={people} terms={terms} />
            </div>
        </AuthenticatedLayout>
    );
}
