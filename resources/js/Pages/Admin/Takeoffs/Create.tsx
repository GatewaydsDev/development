import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

type ProjectOption = { id: number; name: string; project_number: string | null };

export default function Create({ projects, projectId }: { projects: ProjectOption[]; projectId: number | null }) {
    const form = useForm({
        project_id: projectId ? String(projectId) : '',
        title: '',
        notes: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('admin.takeoffs.store'));
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-100">New takeoff</h2>}>
            <Head title="New takeoff" />
            <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4 px-4 py-6">
                <div>
                    <InputLabel htmlFor="project_id" value="Project" />
                    <select id="project_id" className="mt-1 w-full rounded-md border-gray-300 shadow-sm" value={form.data.project_id} onChange={(event) => form.setData('project_id', event.target.value)}>
                        <option value="">Select a project</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>{project.project_number ? `${project.project_number} — ` : ''}{project.name}</option>
                        ))}
                    </select>
                    <InputError message={form.errors.project_id} className="mt-1" />
                </div>
                <div>
                    <InputLabel htmlFor="title" value="Title" />
                    <TextInput id="title" className="mt-1 w-full" value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} />
                    <InputError message={form.errors.title} className="mt-1" />
                </div>
                <div>
                    <InputLabel htmlFor="notes" value="Notes" />
                    <textarea id="notes" className="mt-1 w-full rounded-md border-gray-300 shadow-sm" rows={4} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                </div>
                <div className="flex gap-2">
                    <Button type="submit" disabled={form.processing}>Create takeoff</Button>
                    <Button variant="outline" asChild><Link href={route('admin.takeoffs.index')}>Cancel</Link></Button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
