import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PaginationNav, { type Paginator } from '@/Components/PaginationNav';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Head, Link, router } from '@inertiajs/react';
import { FilterIcon, PlusIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { marginLabel, money, statusLabel, type TakeoffAbilities, type TakeoffSummary } from './types';

type Props = {
    filters: { search: string; status: string; project_id: string | number };
    takeoffs: Paginator & { data: TakeoffSummary[] };
    projects: { id: number; name: string; project_number: string | null }[];
    can: TakeoffAbilities;
};

export default function Index({ filters, takeoffs, projects, can }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [projectId, setProjectId] = useState(String(filters.project_id ?? ''));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('admin.takeoffs.index'), { search, status, project_id: projectId }, { preserveState: true });
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-100">Takeoffs</h2>}>
            <Head title="Takeoffs" />
            <div className="px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        Internal door and window counts for estimating. Approval means the takeoff was reviewed internally. It does not certify product compliance.
                    </p>
                    {can.create ? (
                        <Button asChild variant="create">
                            <Link href={route('admin.takeoffs.create')}>
                                <PlusIcon data-icon="inline-start" />
                                New takeoff
                            </Link>
                        </Button>
                    ) : null}
                </div>
                <form onSubmit={submit} className="mb-4 flex flex-wrap items-center gap-2">
                    <TextInput className="h-8 w-full sm:w-64" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or project" />
                    <select className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="">All statuses</option>
                        {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select className="h-8 max-w-full rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                        <option value="">All projects</option>
                        {projects.map((project) => <option key={project.id} value={project.id}>{project.project_number ? `${project.project_number} — ` : ''}{project.name}</option>)}
                    </select>
                    <Button type="submit" variant="outline" size="sm">
                        <FilterIcon data-icon="inline-start" />
                        Filter
                    </Button>
                </form>
                <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                            <tr>
                                <th className="px-3 py-2">Takeoff</th>
                                <th className="px-3 py-2">Project</th>
                                <th className="px-3 py-2">Revision</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Openings</th>
                                <th className="px-3 py-2">Estimated selling</th>
                                <th className="px-3 py-2">Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {takeoffs.data.map((takeoff) => (
                                <tr key={takeoff.uuid} className="border-t">
                                    <td className="px-3 py-2">
                                        <Link className="font-medium text-indigo-700" href={route('admin.takeoffs.show', takeoff.uuid)}>{takeoff.title}</Link>
                                    </td>
                                    <td className="px-3 py-2">{takeoff.project?.project_number} {takeoff.project?.name}</td>
                                    <td className="px-3 py-2">{takeoff.revision_number}{takeoff.revision_label ? ` ${takeoff.revision_label}` : ''}</td>
                                    <td className="px-3 py-2"><Badge variant="outline">{statusLabel[takeoff.status] ?? takeoff.status}</Badge></td>
                                    <td className="px-3 py-2">{takeoff.opening_count}</td>
                                    <td className="px-3 py-2">
                                        {takeoff.estimate ? (
                                            <span title={`Estimated cost ${money(takeoff.estimate.cost)}, profit ${money(takeoff.estimate.profit)}, margin ${marginLabel(takeoff.estimate.margin)}`}>
                                                {money(takeoff.estimate.selling)}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-3 py-2">{takeoff.updated_at ? new Date(takeoff.updated_at).toLocaleString() : '—'}</td>
                                </tr>
                            ))}
                            {takeoffs.data.length === 0 ? (
                                <tr><td className="px-3 py-6 text-muted-foreground" colSpan={7}>No takeoffs yet.</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4">
                    <PaginationNav paginator={takeoffs} itemLabel="takeoffs" />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
