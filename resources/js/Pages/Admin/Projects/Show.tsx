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
import {
    BriefcaseIcon,
    EditIcon,
    MapPinIcon,
    TrashIcon,
    UserIcon,
} from 'lucide-react';
import { optionLabel, type ProjectOptions, type ProjectPayload } from './types';

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
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span>Projects</span>
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
                                    {optionLabel(project.status)}
                                </Badge>
                                <Badge>{optionLabel(project.priority)}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <DetailItem
                                    label="Service type"
                                    value={optionLabel(project.service_type)}
                                />
                                <DetailItem
                                    label="Assigned to"
                                    value={project.assignee?.name}
                                />
                                <DetailItem
                                    label="Estimated start"
                                    value={project.estimated_start_date}
                                />
                                <DetailItem
                                    label="Estimated end"
                                    value={project.estimated_end_date}
                                />
                                {options.can.viewSensitiveFields && (
                                    <DetailItem
                                        label="Budget"
                                        value={project.budget_amount}
                                    />
                                )}
                            </dl>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserIcon className="size-5 text-muted-foreground" />
                                    Customer
                                </CardTitle>
                                <CardDescription>
                                    Customer information linked one-to-one with
                                    this project.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-4 md:grid-cols-2">
                                    <DetailItem
                                        label="Name"
                                        value={project.customer.name}
                                    />
                                    <DetailItem
                                        label="Company"
                                        value={project.customer.company_name}
                                    />
                                </dl>
                                {options.can.viewCustomerContactFields && (
                                    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
                                        <h3 className="text-sm font-medium text-muted-foreground">
                                            Contacts
                                        </h3>
                                        {project.customer.contacts &&
                                        project.customer.contacts.length > 0 ? (
                                            project.customer.contacts.map(
                                                (contact) => (
                                                    <div
                                                        key={contact.id}
                                                        className="rounded-lg border border-border bg-muted/30 p-4"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-medium text-foreground">
                                                                {contact.name}
                                                            </p>
                                                            {contact.is_primary && (
                                                                <Badge variant="outline">
                                                                    Primary
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {contact.title && (
                                                            <p className="mt-1 text-sm text-muted-foreground">
                                                                {contact.title}
                                                            </p>
                                                        )}
                                                        <p className="mt-2 text-sm text-muted-foreground">
                                                            {contact.email ||
                                                                'No email'}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {contact.phone_number ||
                                                                'No phone'}
                                                        </p>
                                                    </div>
                                                ),
                                            )
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No contacts added yet.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPinIcon className="size-5 text-muted-foreground" />
                                    Site location
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
                    </div>

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

