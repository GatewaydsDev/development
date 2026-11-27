import AiDraftButton from '@/Components/AiDraftButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import QuickProjectDialog from '@/Components/QuickProjectDialog';
import RichTextEditor from '@/Components/RichTextEditor';
import { notesToHtml } from '@/lib/notesHtml';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { PageProps } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FileTextIcon, PlusIcon, StickyNoteIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';

type ProjectOption = { id: number; name: string; project_number: string | null };

const selectClassName =
    'h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm dark:[color-scheme:dark]';
const labelClassName = 'text-emerald-700 dark:text-emerald-300';

function suggestedTitle(project?: ProjectOption): string {
    if (!project) {
        return '';
    }

    const identity = [project.project_number, project.name].filter(Boolean).join(' ');

    return `${identity} — Takeoff`;
}

function projectNameFromFile(file: File | null): string {
    if (!file) {
        return '';
    }

    const stem = file.name.replace(/\.[^.]+$/, '');
    const name = stem
        .replace(/[_+]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.\-_]+|[\s.\-_]+$/g, '');

    return name.slice(0, 255);
}

export default function Create({ projects, projectId }: { projects: ProjectOption[]; projectId: number | null }) {
    const page = usePage<PageProps>();
    const canCreateProjects = Boolean(page.props.auth?.can?.createProjects);
    const takeoffExistsMessage = [page.props.flash?.success, page.props.flash?.error].find(
        (message): message is string =>
            typeof message === 'string' && /takeoff/i.test(message) && message.includes('already exists'),
    ) ?? null;
    const [projectOpen, setProjectOpen] = useState(false);
    const form = useForm<{ project_id: string; title: string; notes: string; file: File | null }>({
        project_id: projectId ? String(projectId) : '',
        title: '',
        notes: '',
        file: null,
    });
    const selected = projects.find((project) => String(project.id) === form.data.project_id);
    const fileProjectName = projectNameFromFile(form.data.file);
    const existingProject = fileProjectName
        ? projects.find((project) => project.name.trim().toLowerCase() === fileProjectName.trim().toLowerCase())
        : undefined;
    const suggested = suggestedTitle(selected);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('admin.takeoffs.store'), { forceFormData: form.data.file !== null });
    };

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
                            href={route('admin.takeoffs.index')}
                            className="transition hover:text-foreground"
                        >
                            Takeoffs
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        New takeoff
                    </h2>
                </div>
            }
        >
            <Head title="New takeoff" />
            <div className="py-6 sm:py-8">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Takeoff information</CardTitle>
                            <CardDescription>
                                Add the drawing, then choose the project the openings will be counted for.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {takeoffExistsMessage ? (
                                <div role="alert" className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-4 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                                    <p className="text-base font-semibold">{takeoffExistsMessage}</p>
                                    <p className="mt-1 text-sm">The existing takeoff was not changed.</p>
                                </div>
                            ) : null}
                            <form onSubmit={submit} className="flex w-full min-w-0 flex-col gap-6 pb-28">
                                <FormActionFab
                                    cancelHref={route('admin.takeoffs.index')}
                                    saveLabel={form.processing ? 'Creating…' : 'Create takeoff'}
                                    disabled={form.processing}
                                />
                                <AiDraftButton
                                    surface="takeoff"
                                    missing={form.data.project_id || form.data.file ? [] : ['Select a project, or upload a drawing.']}
                                    onBlocked={() => document.getElementById('project_id')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                    facts={{
                                        project: selected?.name || fileProjectName,
                                        project_number: selected?.project_number ?? '',
                                        title: form.data.title,
                                    }}
                                    currentText={form.data.notes}
                                    onDraft={(text) => {
                                        const incoming = notesToHtml(text.trim());

                                        if (incoming === '') {
                                            return;
                                        }

                                        const notes = form.data.notes.trim();
                                        form.setData('notes', notes === '' ? incoming : `${notes}${incoming}`);
                                    }}
                                />
                                <section className="flex flex-col gap-5 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
                                    <div className="flex items-start gap-3">
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                            <FileTextIcon className="size-4" />
                                        </span>
                                        <div>
                                            <h3 className="text-base font-semibold text-foreground">Drawing or door schedule</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Upload a PDF up to 64 MB. The drawing is read for every door and window. You confirm each one before it is added, and the measurements, location, and other specs that can be read come with it.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel htmlFor="drawing" value="PDF" className={labelClassName} />
                                        <input
                                            id="drawing"
                                            type="file"
                                            accept="application/pdf,.pdf"
                                            className="block w-full text-sm text-muted-foreground file:mr-4 file:h-11 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                                            onChange={(event) => form.setData('file', event.target.files?.[0] ?? null)}
                                        />
                                        {form.data.file ? (
                                            <p className="text-sm text-foreground">{form.data.file.name}</p>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">A drawing can also be added after the takeoff is created.</p>
                                        )}
                                        <InputError message={form.errors.file} />
                                    </div>
                                </section>
                                <section className="flex flex-col gap-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">Project</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Leave the project blank and upload a drawing. The drawing is searched for the project name, address, and other details. The takeoff title uses that same name.
                                        </p>
                                    </div>
                                    <div className="grid items-start gap-5">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex h-10 items-center justify-between gap-2">
                                                <InputLabel htmlFor="project_id" value="Project" className={labelClassName} />
                                                {canCreateProjects ? (
                                                    <Button type="button" variant="create" className="h-10 rounded-full px-5 has-data-[icon=inline-start]:pl-5" onClick={() => setProjectOpen(true)}>
                                                        <PlusIcon data-icon="inline-start" />
                                                        New project
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <select
                                                id="project_id"
                                                className={selectClassName}
                                                value={form.data.project_id}
                                                onChange={(event) => form.setData('project_id', event.target.value)}
                                            >
                                                <option value="">
                                                    {existingProject
                                                        ? `“${existingProject.name}” already exists`
                                                        : fileProjectName
                                                          ? `Create “${fileProjectName}”`
                                                          : 'Select a project'}
                                                </option>
                                                {projects.map((project) => (
                                                    <option key={project.id} value={project.id}>
                                                        {project.project_number ? `${project.project_number} — ` : ''}
                                                        {project.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {existingProject && !form.data.project_id ? (
                                                <p className="text-sm text-muted-foreground">
                                                    “{existingProject.name}” is already a project. Select it. If it already has a takeoff, that takeoff opens and a new one is not created.
                                                </p>
                                            ) : fileProjectName && !form.data.project_id ? (
                                                <p className="text-sm text-muted-foreground">
                                                    The project name will be “{fileProjectName}”.
                                                </p>
                                            ) : null}
                                            <InputError message={form.errors.project_id} />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex h-10 items-center">
                                                <InputLabel htmlFor="title" value="Title" className={labelClassName} />
                                            </div>
                                            <textarea
                                                id="title"
                                                rows={2}
                                                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-base leading-6 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                                value={form.data.title}
                                                placeholder={suggested || 'Named from the project and drawing'}
                                                onChange={(event) => form.setData('title', event.target.value)}
                                            />
                                            <p className="text-sm text-muted-foreground">
                                                {suggested
                                                    ? `Leave this blank to use “${suggested}”, unless the drawing names the project.`
                                                    : 'Leave this blank. When the project comes from the drawing, the title uses that same project name.'}
                                            </p>
                                            <InputError message={form.errors.title} />
                                        </div>
                                    </div>
                                </section>
                                <section className="flex flex-col gap-5 rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/60 dark:bg-violet-950/30">
                                    <div className="flex items-start gap-3">
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                                            <StickyNoteIcon className="size-4" />
                                        </span>
                                        <div>
                                            <h3 className="text-base font-semibold text-foreground">Notes</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Optional. Ask the AI from the action button and the answer is added here.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel htmlFor="notes" value="Notes" className={labelClassName} />
                                        <RichTextEditor
                                            id="notes"
                                            compact
                                            showPlaceholders={false}
                                            allowSideToolbar={false}
                                            value={notesToHtml(form.data.notes)}
                                            onChange={(html) => form.setData('notes', html)}
                                            placeholder="Notes for this takeoff"
                                            error={form.errors.notes}
                                        />
                                        <InputError message={form.errors.notes} />
                                    </div>
                                </section>
                                <QuickProjectDialog
                                    show={projectOpen}
                                    onClose={() => setProjectOpen(false)}
                                    onCreated={(project) => form.setData('project_id', String(project.id))}
                                />
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
