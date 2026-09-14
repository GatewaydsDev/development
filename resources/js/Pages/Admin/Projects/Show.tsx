import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/money';
import {
    BriefcaseIcon,
    EditIcon,
    HammerIcon,
    HistoryIcon,
    MapPinIcon,
    TrashIcon,
} from 'lucide-react';
import { isEmptyHtml } from '@/Pages/Admin/Bids/bidText';
import {
    optionLabel,
    scopeTypeLabel,
    type ProjectOptions,
    type ProjectPayload,
} from './types';

type ShowProps = {
    project: ProjectPayload;
    options: ProjectOptions;
};

function DetailItem({
    label,
    value,
}: {
    label: string;
    value?: string | number | null;
}) {
    return (
        <div className="rounded-lg border border-border bg-background p-4">
            <dt className="text-sm font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">
                {value || 'Not added yet'}
            </dd>
        </div>
    );
}

export default function Show({ project, options }: ShowProps) {
    const removeProject = () => {
        if (!window.confirm('Remove this project? This cannot be undone.')) {
            return;
        }

        router.delete(route('admin.projects.destroy', project.id));
    };

    return (
        <AuthenticatedLayout
            stickyTitle={`Project details — ${project.name}`}
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                            <span className="text-foreground">
                                {project.name}
                            </span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Project details
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {options.can.update && (
                            <Button variant="outline" asChild>
                                <Link
                                    href={route(
                                        'admin.projects.edit',
                                        project.id,
                                    )}
                                >
                                    <EditIcon className="size-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        {options.can.delete && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={removeProject}
                            >
                                <TrashIcon className="size-4" />
                                Remove
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title={project.name} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader className="gap-4 sm:grid sm:grid-cols-[1fr_auto] sm:items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <BriefcaseIcon className="size-5 text-muted-foreground" />
                                    {project.name}
                                </CardTitle>
                                <CardDescription>
                                    {project.project_number || project.uuid}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">
                                    {project.status || 'Not set'}
                                </Badge>
                                <Badge>{optionLabel(project.priority)}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <DetailItem
                                    label="Status"
                                    value={project.status}
                                />
                                <DetailItem
                                    label="Priority"
                                    value={optionLabel(project.priority)}
                                />
                                <DetailItem
                                    label="Assigned to"
                                    value={project.assignee?.name}
                                />
                                {options.can.viewSensitiveFields && (
                                    <DetailItem
                                        label="Budget amount"
                                        value={
                                            project.budget_amount
                                                ? formatCurrency(
                                                      project.budget_amount,
                                                  )
                                                : null
                                        }
                                    />
                                )}
                                <DetailItem
                                    label="Estimated start"
                                    value={project.estimated_start_date}
                                />
                                <DetailItem
                                    label="Estimated end"
                                    value={project.estimated_end_date}
                                />
                            </dl>

                            <div className="mt-6 border-t border-border pt-5">
                                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                                    <HistoryIcon className="size-4 text-muted-foreground" />
                                    Revisions
                                </h3>
                                {project.revisions?.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {project.revisions.map((revision) => (
                                            <div
                                                key={
                                                    revision.id ??
                                                    revision.number
                                                }
                                                className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-[8rem_10rem_minmax(10rem,0.9fr)_minmax(0,1fr)] sm:items-start"
                                            >
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Revision
                                                    </p>
                                                    <p className="mt-1 font-medium text-foreground">
                                                        {revision.number}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Date
                                                    </p>
                                                    <p className="mt-1 text-sm text-foreground">
                                                        {revision.revision_date ||
                                                            'Not set'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Updated by
                                                    </p>
                                                    <p className="mt-1 text-sm text-foreground">
                                                        {revision.user?.name ||
                                                            'Not set'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        Notes
                                                    </p>
                                                    <p className="mt-1 text-sm text-foreground">
                                                        {revision.notes ||
                                                            'No notes added.'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No revisions added yet.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPinIcon className="size-5 text-muted-foreground" />
                                Address
                            </CardTitle>
                            <CardDescription>
                                Where the project work will happen.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-2">
                                <DetailItem
                                    label="Address line 1"
                                    value={project.site_address_line_1}
                                />
                                <DetailItem
                                    label="Address line 2"
                                    value={project.site_address_line_2}
                                />
                                <DetailItem
                                    label="City"
                                    value={project.site_city}
                                />
                                <DetailItem
                                    label="State"
                                    value={project.site_state}
                                />
                            </dl>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HammerIcon className="size-5 text-muted-foreground" />
                                General contractors/Customer
                            </CardTitle>
                            <CardDescription>
                                Each contractor has a company name, phone
                                number, and email address.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                            {project.contractors?.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {project.contractors.map(
                                        (contractor) => (
                                            <div
                                                key={contractor.id}
                                                className="rounded-lg border border-border bg-muted/30 p-4"
                                            >
                                                <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                    <DetailItem
                                                        label="Company name"
                                                        value={contractor.name}
                                                    />
                                                    <DetailItem
                                                        label="Contact name"
                                                        value={
                                                            contractor.contact_name
                                                        }
                                                    />
                                                    <DetailItem
                                                        label="Phone number"
                                                        value={
                                                            contractor.phone_number
                                                        }
                                                    />
                                                    <DetailItem
                                                        label="Email address"
                                                        value={
                                                            contractor.email
                                                        }
                                                    />
                                                </dl>
                                            </div>
                                        ),
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No contractors added yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BriefcaseIcon className="size-5 text-muted-foreground" />
                                    Scope of work
                                </CardTitle>
                                <CardDescription>
                                    Scope type and any necessary text for this
                                    project.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {project.scopes?.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {project.scopes.map((scope) => (
                                            <div
                                                key={scope.id ?? scope.type}
                                                className="rounded-lg border border-border bg-muted/30 p-4"
                                            >
                                                <p className="font-medium text-foreground">
                                                    {scopeTypeLabel(
                                                        scope.type,
                                                        options.scopeTypes,
                                                    )}
                                                </p>
                                                {isEmptyHtml(scope.notes) ? (
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        No text added.
                                                    </p>
                                                ) : (
                                                    <div
                                                        className="rich-text-content mt-2 text-sm text-foreground"
                                                        dangerouslySetInnerHTML={{
                                                            __html: scope.notes ?? '',
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No scopes added yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground">
                                    Project notes
                                </h3>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                                    {project.public_notes || 'No notes added.'}
                                </p>
                            </div>
                            {options.can.viewSensitiveFields && (
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">
                                        Internal notes
                                    </h3>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                                        {project.internal_notes ||
                                            'No internal notes added.'}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

