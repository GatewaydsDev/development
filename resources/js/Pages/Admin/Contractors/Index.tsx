import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ActionHint from '@/Components/ActionHint';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
import PaginationNav from '@/Components/PaginationNav';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { PageProps } from '@/types';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BriefcaseIcon,
    EditIcon,
    HardHatIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { phoneTypeLabel, type ContractorsPaginator } from './types';

type IndexProps = {
    filters: {
        search?: string;
        highlight?: number | null;
    };
    contractors: ContractorsPaginator;
};

export default function Index({ filters, contractors }: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreateContractors = Boolean(auth.can?.createContractors);
    const canUpdateContractors = Boolean(auth.can?.updateContractors);
    const canDeleteContractors = Boolean(auth.can?.deleteContractors);
    const [search, setSearch] = useState(filters.search ?? '');
    const [pendingDeleteContractor, setPendingDeleteContractor] = useState<{
        id: number;
        name: string;
    } | null>(null);
    const highlightedContractorId = filters.highlight ?? null;

    useEffect(() => {
        if (!highlightedContractorId) {
            return;
        }

        document
            .getElementById(`contractor-row-${highlightedContractorId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightedContractorId]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.contractors.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const destroyContractor = (contractorId: number) => {
        router.delete(route('admin.contractors.destroy', contractorId), {
            preserveScroll: true,
            onFinish: () => setPendingDeleteContractor(null),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Contractors</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Contractors
                        </h2>
                    </div>

                    {canCreateContractors && (
                        <Button asChild>
                            <Link href={route('admin.contractors.create')}>
                                <PlusIcon className="size-4" />
                                Add contractor
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Contractors" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <HardHatIcon className="size-4 text-muted-foreground" />
                                    Total contractors
                                </CardTitle>
                                <CardDescription>
                                    Reusable general contractor records.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {contractors.total}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Contractor directory</CardTitle>
                                <CardDescription>
                                    Search, review, add, and update general
                                    contractor companies and contacts.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={submit}
                                className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
                            >
                                <div className="relative">
                                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search contractors"
                                        className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground sm:w-64"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="h-11 min-w-[8.5rem] bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                                >
                                    Search
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                                    <div>Contractor</div>
                                    <div>Primary contact</div>
                                    <div>Phone</div>
                                    <div>Projects</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {contractors.data.length > 0 ? (
                                    contractors.data.map((contractor) => {
                                        const primaryContact =
                                            contractor.contacts.find(
                                                (contact) => contact.is_primary,
                                            ) ?? contractor.contacts[0];

                                        return (
                                            <div
                                                id={`contractor-row-${contractor.id}`}
                                                key={contractor.id}
                                                className={cn(
                                                    'grid gap-3 border-b border-border px-4 py-4 last:border-b-0 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4',
                                                    highlightedContractorId ===
                                                        contractor.id &&
                                                        'bg-emerald-50 dark:bg-emerald-950/30',
                                                )}
                                            >
                                                <div>
                                                    <DirectoryFieldLabel>Contractor</DirectoryFieldLabel>
                                                    <p className="font-medium text-foreground">
                                                        {contractor.name}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {primaryContact?.email ||
                                                            contractor.website ||
                                                            contractor.uuid}
                                                    </p>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    <DirectoryFieldLabel>Primary contact</DirectoryFieldLabel>
                                                    {primaryContact?.name ||
                                                        'Not added'}
                                                    {primaryContact?.title ? (
                                                        <span className="block text-xs">
                                                            {primaryContact.title}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    <DirectoryFieldLabel>Phone</DirectoryFieldLabel>
                                                    {primaryContact?.phone_number ? (
                                                        <>
                                                            {
                                                                primaryContact.phone_number
                                                            }
                                                            {primaryContact.phone_type ? (
                                                                <span className="block text-xs">
                                                                    {phoneTypeLabel(
                                                                        primaryContact.phone_type,
                                                                    )}
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    ) : (
                                                        'Not added'
                                                    )}
                                                </div>
                                                <div>
                                                    <DirectoryFieldLabel>Projects</DirectoryFieldLabel>
                                                    {contractor.projects_count >
                                                    0 ? (
                                                        <Badge variant="outline">
                                                            <BriefcaseIcon className="size-3" />
                                                            {
                                                                contractor.projects_count
                                                            }
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary">
                                                            No projects
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex min-w-0 flex-col gap-1 md:items-end">
                                                    <DirectoryFieldLabel>Actions</DirectoryFieldLabel>
                                                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                                                    {canUpdateContractors && (
                                                        <ActionHint hint="Edit this contractor">
                                                            <Button
                                                                variant="outline"
                                                                size="icon-sm"
                                                                className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={route(
                                                                        'admin.contractors.edit',
                                                                        contractor.id,
                                                                    )}
                                                                    aria-label="Edit this contractor"
                                                                >
                                                                    <EditIcon className="size-4" />
                                                                </Link>
                                                            </Button>
                                                        </ActionHint>
                                                    )}
                                                    {canDeleteContractors &&
                                                        contractor.projects_count ===
                                                            0 && (
                                                            <ActionHint hint="Delete this contractor">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon-sm"
                                                                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                    onClick={() =>
                                                                        setPendingDeleteContractor(
                                                                            {
                                                                                id: contractor.id,
                                                                                name: contractor.name,
                                                                            },
                                                                        )
                                                                    }
                                                                    aria-label="Delete this contractor"
                                                                >
                                                                    <Trash2Icon className="size-4" />
                                                                </Button>
                                                            </ActionHint>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <HardHatIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No contractors found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try another search or create the
                                            first contractor.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <PaginationNav
                                paginator={contractors}
                                itemLabel="contractors"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AlertDialog
                open={pendingDeleteContractor !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteContractor(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete contractor?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete contractor record for “{pendingDeleteContractor?.name}”? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDeleteContractor) {
                                    destroyContractor(pendingDeleteContractor.id);
                                }
                            }}
                        >
                            Delete contractor
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
