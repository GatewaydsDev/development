import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PaginationNav from '@/Components/PaginationNav';
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
    EditIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
    WrenchIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type { ServicesPaginator } from './types';

type IndexProps = {
    filters: {
        search?: string;
        highlight?: number | null;
    };
    services: ServicesPaginator;
};

export default function Index({ filters, services }: IndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreateServices = Boolean(auth.can?.createServices);
    const canUpdateServices = Boolean(auth.can?.updateServices);
    const canDeleteServices = Boolean(auth.can?.deleteServices);
    const [search, setSearch] = useState(filters.search ?? '');
    const highlightedServiceId = filters.highlight ?? null;

    useEffect(() => {
        if (!highlightedServiceId) {
            return;
        }

        document
            .getElementById(`service-row-${highlightedServiceId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightedServiceId]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.get(
            route('admin.services.index'),
            { search },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const destroyService = (serviceId: number, serviceName: string) => {
        if (!window.confirm(`Delete service ${serviceName}?`)) {
            return;
        }

        router.delete(route('admin.services.destroy', serviceId), {
            preserveScroll: true,
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
                            <span className="text-foreground">Services</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Services
                        </h2>
                    </div>

                    {canCreateServices && (
                        <Button asChild>
                            <Link href={route('admin.services.create')}>
                                <PlusIcon className="size-4" />
                                Add service
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Services" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <WrenchIcon className="size-4 text-muted-foreground" />
                                    Total services
                                </CardTitle>
                                <CardDescription>
                                    Reusable work performed on a product.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {services.total}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Service directory</CardTitle>
                                <CardDescription>
                                    Add and update services such as Assembly w/
                                    vision glazing, then pair them with a
                                    product on a bid.
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
                                        placeholder="Search services"
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
                                <div className="hidden grid-cols-[1.4fr_1fr_auto] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                                    <div>Service</div>
                                    <div>Used on bids</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {services.data.length > 0 ? (
                                    services.data.map((item) => (
                                        <div
                                            id={`service-row-${item.id}`}
                                            key={item.id}
                                            className={cn(
                                                'grid gap-3 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_1fr_auto] md:items-center md:gap-4',
                                                highlightedServiceId ===
                                                    item.id &&
                                                    'bg-emerald-50 dark:bg-emerald-950/30',
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium text-foreground wrap-break-word">
                                                    {item.name}
                                                </p>
                                                {item.description ? (
                                                    <p className="mt-1 truncate text-sm text-muted-foreground">
                                                        {item.description}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {item.bid_count ?? 0}
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {canUpdateServices && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={route(
                                                                'admin.services.edit',
                                                                item.id,
                                                            )}
                                                        >
                                                            <EditIcon className="size-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                )}
                                                {canDeleteServices &&
                                                    (item.bid_count ?? 0) ===
                                                        0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() =>
                                                                destroyService(
                                                                    item.id,
                                                                    item.name,
                                                                )
                                                            }
                                                        >
                                                            <Trash2Icon className="size-4" />
                                                            Delete
                                                        </Button>
                                                    )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-12 text-center">
                                        <WrenchIcon className="mx-auto size-10 text-muted-foreground" />
                                        <p className="mt-3 font-medium">
                                            No services found
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try another search or create the
                                            first service.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <PaginationNav
                                paginator={services}
                                itemLabel="services"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
