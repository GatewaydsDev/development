import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import ConvertJobDialog, { type ConvertKind } from './Partials/ConvertJobDialog';
import { FolderPlusIcon, RulerIcon } from 'lucide-react';
import ProjectControlForm, { type ConnectedTakeoff, type ControlDraft, type ControlTerms } from './Partials/ProjectControlForm';
import type { ScheduledReminder } from './Partials/ReminderCards';
import type { ReminderPerson } from './Partials/ReminderDialog';

export default function Edit({ control, people, terms, connectedTakeoff = null, reminders = [], projectUrl = null, canCreateProject = false, canCreateTakeoff = false }: { projectUrl?: string | null; canCreateProject?: boolean; canCreateTakeoff?: boolean; control: ControlDraft & { uuid: string }; people: ReminderPerson[]; terms: ControlTerms; connectedTakeoff?: ConnectedTakeoff; reminders?: ScheduledReminder[] }) {
    const [convert, setConvert] = useState<ConvertKind | null>(null);

    return (
        <AuthenticatedLayout
            fullWidth
            header={
                <div className="flex flex-wrap items-start justify-between gap-3">
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
                </div>
            }
        >
            <Head title={control.name || 'Edit job'} />
            <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <h3 className="text-base font-semibold text-foreground">Convert this job</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Turn this job into a project and a takeoff without leaving this page. Save any edits below first.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background p-3">
                            <p className="text-sm font-medium text-foreground">Project</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {projectUrl ? 'This job already has a project.' : 'Creates a project with the name, location, value, customer and notes from this job.'}
                            </p>
                            <div className="mt-3">
                                {projectUrl ? (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={projectUrl}><FolderPlusIcon data-icon="inline-start" />View project</Link>
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={!canCreateProject}
                                        onClick={() => setConvert('project')}
                                    >
                                        <FolderPlusIcon data-icon="inline-start" />
                                        Convert to project
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="rounded-lg border border-border bg-background p-3">
                            <p className="text-sm font-medium text-foreground">Takeoff</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {connectedTakeoff
                                    ? `Connected takeoff: ${connectedTakeoff.title}.`
                                    : 'Creates a takeoff from this job’s openings. A project is created first if the job has none.'}
                            </p>
                            <div className="mt-3">
                                {connectedTakeoff ? (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={connectedTakeoff.url}><RulerIcon data-icon="inline-start" />Open takeoff</Link>
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={!canCreateTakeoff}
                                        onClick={() => setConvert('takeoff')}
                                    >
                                        <RulerIcon data-icon="inline-start" />
                                        Convert to takeoff
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
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
            <ConvertJobDialog kind={convert} jobUuid={control.uuid} jobLabel={control.job_code} onClose={() => setConvert(null)} />
        </AuthenticatedLayout>
    );
}
