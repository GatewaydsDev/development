import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ProjectControlForm, { type ConnectedTakeoff, type ControlDraft, type ControlTerms } from './Partials/ProjectControlForm';
import type { ScheduledReminder } from './Partials/ReminderCards';
import type { ReminderPerson } from './Partials/ReminderDialog';

export default function Edit({ control, people, terms, connectedTakeoff = null, reminders = [] }: { control: ControlDraft & { uuid: string }; people: ReminderPerson[]; terms: ControlTerms; connectedTakeoff?: ConnectedTakeoff; reminders?: ScheduledReminder[] }) {
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
                        <span className="text-foreground">{control.job_code || 'Job'}</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        {control.name || 'Edit job'}
                    </h2>
                </div>
            }
        >
            <Head title={control.name || 'Edit job'} />
            <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <ProjectControlForm
                    action={route('admin.project-control.update', control.uuid)}
                    method="patch"
                    control={control}
                    people={people}
                    terms={terms}
                    connectedTakeoff={connectedTakeoff}
                    reminders={reminders}
                />
            </div>
        </AuthenticatedLayout>
    );
}
