import InputError from '@/Components/InputError';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Trash2Icon, UserPlusIcon, UsersIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';

type Member = {
    uuid: string;
    name: string;
    email: string;
    role: 'master' | 'manager' | 'viewer';
    all_projects: boolean;
    project_uuids: string[];
    is_you: boolean;
    can_manage: boolean;
    last_login_at: string | null;
};

type Project = { uuid: string; project_number: string | null; name: string };

type Props = {
    company: string;
    isMaster: boolean;
    members: Member[];
    projects: Project[];
};

const selectClass =
    'h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground';

function ProjectPicker({
    projects,
    allProjects,
    selected,
    onAll,
    onSelected,
}: {
    projects: Project[];
    allProjects: boolean;
    selected: string[];
    onAll: (value: boolean) => void;
    onSelected: (value: string[]) => void;
}) {
    return (
        <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 text-foreground">
                <input type="checkbox" checked={allProjects} onChange={(event) => onAll(event.target.checked)} />
                Access to every company project
            </label>
            {!allProjects && (
                <div className="grid gap-1 sm:grid-cols-2">
                    {projects.map((project) => (
                        <label key={project.uuid} className="flex items-center gap-2 text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={selected.includes(project.uuid)}
                                onChange={(event) =>
                                    onSelected(
                                        event.target.checked
                                            ? [...selected, project.uuid]
                                            : selected.filter((uuid) => uuid !== project.uuid),
                                    )
                                }
                            />
                            {project.name}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

function MemberRow({ member, projects, isMaster }: { member: Member; projects: Project[]; isMaster: boolean }) {
    const [editing, setEditing] = useState(false);
    const form = useForm({
        role: member.role === 'manager' ? 'manager' : 'viewer',
        all_projects: member.all_projects,
        project_uuids: member.project_uuids,
    });

    const save = (event: FormEvent) => {
        event.preventDefault();
        form.patch(route('portal.team.update', member.uuid), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    const remove = () => {
        if (window.confirm(`Remove access for ${member.name}?`)) {
            router.delete(route('portal.team.destroy', member.uuid), { preserveScroll: true });
        }
    };

    return (
        <li className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        {member.name}
                        {member.role === 'master' && <Badge>Master</Badge>}
                        {member.role === 'manager' && <Badge variant="secondary">Manager</Badge>}
                        {member.is_you && <Badge variant="outline">You</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                        {member.email}
                        {member.last_login_at ? ` · last visit ${member.last_login_at}` : ' · never signed in'}
                        {member.role === 'viewer' && !member.all_projects
                            ? ` · ${member.project_uuids.length} project(s)`
                            : ''}
                    </p>
                </div>
                {member.can_manage && (
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                            {editing ? 'Cancel' : 'Edit access'}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={remove}>
                            <Trash2Icon className="size-4" />
                            Remove
                        </Button>
                    </div>
                )}
            </div>
            {editing && (
                <form onSubmit={save} className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                    {isMaster && (
                        <select
                            value={form.data.role}
                            onChange={(event) => form.setData('role', event.target.value as 'viewer' | 'manager')}
                            className={`${selectClass} w-fit`}
                            aria-label="Role"
                        >
                            <option value="viewer">Viewer</option>
                            <option value="manager">Manager (can manage the team)</option>
                        </select>
                    )}
                    {form.data.role === 'viewer' && (
                        <ProjectPicker
                            projects={projects}
                            allProjects={form.data.all_projects}
                            selected={form.data.project_uuids}
                            onAll={(value) => form.setData('all_projects', value)}
                            onSelected={(value) => form.setData('project_uuids', value)}
                        />
                    )}
                    <InputError message={form.errors.project_uuids} />
                    <Button type="submit" size="sm" className="w-fit" disabled={form.processing}>
                        Save
                    </Button>
                </form>
            )}
        </li>
    );
}

export default function Team({ company, isMaster, members, projects }: Props) {
    const form = useForm({
        name: '',
        email: '',
        role: 'viewer',
        all_projects: true,
        project_uuids: [] as string[],
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('portal.team.store'), { preserveScroll: true, onSuccess: () => form.reset() });
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Company team
                    </h2>
                    <p className="text-sm text-muted-foreground">{company}</p>
                </div>
            }
        >
            <Head title="Company team" />
            <div className="grid w-full gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UsersIcon className="size-5 text-muted-foreground" />
                            People with access
                        </CardTitle>
                        <CardDescription>
                            Add or remove the people in {company} and choose which projects each one can follow.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <ul className="flex flex-col gap-2">
                            {members.map((member) => (
                                <MemberRow key={member.uuid} member={member} projects={projects} isMaster={isMaster} />
                            ))}
                        </ul>

                        <form onSubmit={submit} className="grid gap-3 rounded-lg border border-dashed border-border p-4">
                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                                <div>
                                    <TextInput
                                        value={form.data.name}
                                        onChange={(event) => form.setData('name', event.target.value)}
                                        placeholder="Full name"
                                        aria-label="Full name"
                                        className="block h-10 w-full border-border bg-background px-3"
                                    />
                                    <InputError message={form.errors.name} className="mt-1" />
                                </div>
                                <div>
                                    <TextInput
                                        type="email"
                                        value={form.data.email}
                                        onChange={(event) => form.setData('email', event.target.value)}
                                        placeholder="Email address"
                                        aria-label="Email address"
                                        className="block h-10 w-full border-border bg-background px-3"
                                    />
                                    <InputError message={form.errors.email} className="mt-1" />
                                </div>
                                {isMaster && (
                                    <select
                                        value={form.data.role}
                                        onChange={(event) => form.setData('role', event.target.value)}
                                        className={selectClass}
                                        aria-label="Role"
                                    >
                                        <option value="viewer">Viewer</option>
                                        <option value="manager">Manager</option>
                                    </select>
                                )}
                                <Button type="submit" disabled={form.processing}>
                                    <UserPlusIcon className="size-4" />
                                    Add
                                </Button>
                            </div>
                            {form.data.role === 'viewer' && (
                                <ProjectPicker
                                    projects={projects}
                                    allProjects={form.data.all_projects}
                                    selected={form.data.project_uuids}
                                    onAll={(value) => form.setData('all_projects', value)}
                                    onSelected={(value) => form.setData('project_uuids', value)}
                                />
                            )}
                            <p className="text-xs text-muted-foreground">
                                New people receive an email to set their password. Managers can add and remove viewers;
                                only the master can create managers.
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
