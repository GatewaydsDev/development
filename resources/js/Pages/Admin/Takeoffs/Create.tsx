import AiDraftButton from '@/Components/AiDraftButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import QuickProjectDialog from '@/Components/QuickProjectDialog';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { PageProps } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { PlusIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';

type ProjectOption = { id: number; name: string; project_number: string | null };

function suggestedTitle(project?: ProjectOption): string {
    if (!project) {
        return '';
    }

    const identity = [project.project_number, project.name].filter(Boolean).join(' ');

    return `${identity} — Takeoff`;
}

export default function Create({ projects, projectId }: { projects: ProjectOption[]; projectId: number | null }) {
    const canCreateProjects = Boolean(usePage<PageProps>().props.auth?.can?.createProjects);
    const [projectOpen, setProjectOpen] = useState(false);
    const form = useForm<{ project_id: string; title: string; notes: string; file: File | null }>({
        project_id: projectId ? String(projectId) : '',
        title: '',
        notes: '',
        file: null,
    });
    const selected = projects.find((project) => String(project.id) === form.data.project_id);
    const suggested = suggestedTitle(selected);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('admin.takeoffs.store'), { forceFormData: form.data.file !== null });
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-100">New takeoff</h2>}>
            <Head title="New takeoff" />
            <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-28">
                <FormActionFab
                    cancelHref={route('admin.takeoffs.index')}
                    saveLabel={form.processing ? 'Creating…' : 'Create takeoff'}
                    disabled={form.processing}
                />
                <AiDraftButton
                    surface="takeoff"
                    missing={form.data.project_id ? [] : ['Select a project.']}
                    onBlocked={() => document.getElementById('project_id')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    facts={{
                        project: selected?.name ?? '',
                        project_number: selected?.project_number ?? '',
                        title: form.data.title,
                    }}
                    currentText={form.data.notes}
                    onDraft={(text) => {
                        const plain = text
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<\/p>/gi, '\n')
                            .replace(/<[^>]+>/g, '')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();

                        if (plain === '') {
                            return;
                        }

                        const notes = form.data.notes.trim();
                        form.setData('notes', notes === '' ? plain : `${notes}\n\n${plain}`);
                    }}
                />
                <div>
                    <div className="flex items-center justify-between gap-2">
                        <InputLabel htmlFor="project_id" value="Project" />
                        {canCreateProjects ? (
                            <Button type="button" variant="create" size="sm" onClick={() => setProjectOpen(true)}>
                                <PlusIcon data-icon="inline-start" />
                                New project
                            </Button>
                        ) : null}
                    </div>
                    <select id="project_id" className="mt-1 h-12 w-full rounded-md border-gray-300 py-2 text-sm leading-6 shadow-sm" value={form.data.project_id} onChange={(event) => form.setData('project_id', event.target.value)}>
                        <option value="">Select a project</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>{project.project_number ? `${project.project_number} — ` : ''}{project.name}</option>
                        ))}
                    </select>
                    <InputError message={form.errors.project_id} className="mt-1" />
                </div>
                <div>
                    <InputLabel htmlFor="title" value="Title" />
                    <TextInput id="title" className="mt-1 w-full" value={form.data.title} placeholder={suggested || 'Named from the project and drawing'} onChange={(event) => form.setData('title', event.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">
                        Leave this blank and the system names the takeoff{suggested ? `, starting from “${suggested}”` : ''}. A drawing with a sheet title replaces that name.
                    </p>
                    <InputError message={form.errors.title} className="mt-1" />
                </div>
                <div>
                    <InputLabel htmlFor="drawing" value="Drawing or door schedule" />
                    <input
                        id="drawing"
                        type="file"
                        accept="application/pdf,.pdf"
                        className="mt-1 block w-full text-sm"
                        onChange={(event) => form.setData('file', event.target.files?.[0] ?? null)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                        Upload a PDF up to 64 MB. The drawing is scanned for every door and window, and each one is added once with its specs. You can remove any opening you will not use.
                    </p>
                    <InputError message={form.errors.file} className="mt-1" />
                </div>
                <div>
                    <InputLabel htmlFor="notes" value="Notes" />
                    <textarea id="notes" className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={4} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                </div>
                <QuickProjectDialog
                    show={projectOpen}
                    onClose={() => setProjectOpen(false)}
                    onCreated={(project) => form.setData('project_id', String(project.id))}
                />
            </form>
        </AuthenticatedLayout>
    );
}
